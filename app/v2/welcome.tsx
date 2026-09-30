// V2 Section 1 (live): sign in / sign up with a one-time email code
// (owner decision 2026-09-30: email code for the closed beta; phone OTP later
// once an SMS provider is chosen). Supabase Auth creates the user on first
// verification; the address is then confirmed, which the application requires.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';
import { emailLooksValid, normalizeEmail, RESEND_COOLDOWN_SECONDS, sanitizeCode } from '@/lib/onboardingV2/yourProfile';
import { supabase } from '@/lib/supabaseClient';

type Phase = 'email' | 'code';

export default function V2Welcome() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  // KVKK consent — required before any code is sent, never pre-checked (as in
  // the V1 register screen). Recorded as profiles.privacy_consent_at once the
  // account exists.
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!sentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentAt]);
  const cooldown = sentAt ? Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - (now - sentAt) / 1000)) : 0;

  const sendCode = async () => {
    if (!emailLooksValid(email) || busy || !consent) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (e) {
      setError(/rate|seconds/i.test(e.message) ? 'Please wait a moment before asking for another code.' : "We couldn't send a code. Check the address and try again.");
      return;
    }
    setSentAt(Date.now());
    setCode('');
    setPhase('code');
  };

  const verify = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' });
    if (e) {
      setBusy(false);
      setError(/expired/i.test(e.message) ? 'That code has expired. Send a new one.' : "That code isn't right. Try again.");
      return;
    }
    const loaded = await loadMyOnboarding();
    if (loaded.ok) {
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      if (uid) {
        const { error: ce } = await supabase
          .from('profiles')
          .update({ privacy_consent_at: new Date().toISOString() })
          .eq('id', uid)
          .is('privacy_consent_at', null);
        if (ce) console.warn('[v2] consent write failed', ce.message);
      }
    }
    setBusy(false);
    if (!loaded.ok) {
      // An existing (V1) member signing in here keeps the current app.
      router.replace('/');
      return;
    }
    const status = loaded.value.state?.application_status;
    router.replace(status === 'draft' || status === 'changes_requested' ? '/v2/onboarding' : '/v2/status');
  };

  const isEmail = phase === 'email';
  return (
    <OnboardingScreen
      sectionLabel="Account"
      step={isEmail ? 1 : 2}
      totalSteps={2}
      title={isEmail ? "What's your email?" : 'Enter your code'}
      helper={isEmail ? "We'll send you a code to sign in." : `We sent a 6-digit code to ${normalizeEmail(email)}.`}
      onBack={isEmail ? (router.canGoBack() ? () => router.back() : undefined) : () => setPhase('email')}
      contentKey={phase}
      footer={
        <>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {error}
            </Text>
          ) : null}
          <OnboardingPrimaryButton
            label={busy ? 'Please wait…' : isEmail ? 'Send code' : 'Continue'}
            onPress={() => void (isEmail ? sendCode() : verify())}
            disabled={busy || (isEmail ? !emailLooksValid(email) || !consent : code.length < 6)}
          />
        </>
      }>
      {isEmail ? (
        <OnboardingTextField
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={() => void sendCode()}
        />
      ) : null}
      {isEmail ? (
        <TouchableOpacity
          onPress={() => setConsent((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="I have read the Privacy Notice and agree to the processing of my personal data"
          hitSlop={6}
          style={styles.consentRow}>
          <Text style={styles.box}>{consent ? '☑' : '☐'}</Text>
          <Text style={styles.consentText} maxFontSizeMultiplier={1.6}>
            {'I have read the '}
            <Text style={styles.consentLink} onPress={() => router.push('/privacy-notice')}>
              Privacy Notice
            </Text>
            {' and agree to the processing of my personal data.'}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <OnboardingTextField
            label="6-digit code"
            value={code}
            onChangeText={(v) => {
              setCode(sanitizeCode(v));
              setError(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            onSubmitEditing={() => void verify()}
          />
          <TouchableOpacity
            onPress={() => void sendCode()}
            disabled={cooldown > 0 || busy}
            accessibilityRole="button"
            accessibilityLabel={cooldown > 0 ? `Resend code in ${cooldown} seconds` : 'Resend code'}
            hitSlop={10}
            style={styles.link}>
            <Text style={[styles.linkText, (cooldown > 0 || busy) && styles.linkDisabled]} maxFontSizeMultiplier={1.6}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: '#A33A2B', textAlign: 'center', marginBottom: 8 },
  link: { minHeight: 44, justifyContent: 'center', marginTop: 16 },
  linkText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
  linkDisabled: { color: obColors.textSecondary },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, minHeight: 44 },
  box: { fontSize: 22, lineHeight: 26, color: obColors.cta },
  consentText: { flex: 1, fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
  consentLink: { color: obColors.cta, textDecorationLine: 'underline' },
});
