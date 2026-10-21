// V2 Section 1 (live): sign in / sign up with a one-time email code
// (owner decision 2026-09-30: email code for the closed beta; phone OTP later
// once an SMS provider is chosen). Supabase Auth creates the user on first
// verification; the address is then confirmed, which the application requires.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { ACCOUNT_COPY, AccountError, AccountLink, ConsentRow, accountStyles } from '@/components/onboarding-v2/account/AccountFields';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import { emailLooksValid, normalizeEmail, RESEND_COOLDOWN_SECONDS } from '@/lib/onboardingV2/yourProfile';
import { devCodeCommand, devSwitchAccountHint } from '@/lib/devSignIn';
import { backend, devTestEmail, supabase } from '@/lib/supabaseClient';
import { friendlyNetworkError, withTimeout } from '@/lib/withTimeout';

type Phase = 'email' | 'code';

// Supabase email codes are 6–10 digits depending on the project's OTP length
// setting (perfect-match-dev issues 7). Digits only; pasted text is cleaned.
const MIN_CODE = 6;
const MAX_CODE = 10;
const cleanCode = (v: string) => v.replace(/\D/g, '').slice(0, MAX_CODE);

export default function V2Welcome() {
  const router = useRouter();
  // DEV test sign-in: fixed synthetic address, no email is sent — the real
  // one-time code comes from the Mac terminal (scripts/dev-backend).
  const params = useLocalSearchParams<{ test?: string }>();
  const testMode = params.test === '1' && !!devTestEmail;
  const [phase, setPhase] = useState<Phase>(testMode ? 'code' : 'email');
  const [email, setEmail] = useState(testMode ? (devTestEmail ?? '') : '');
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
    try {
      console.log('[v2 welcome] send code: start');
      const { error: e } = await withTimeout(
        supabase.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: true } }),
        20000,
        'sendCode',
      );
      console.log(`[v2 welcome] send code: done (error: ${e ? e.name : 'none'})`);
      if (e) {
        setError(/rate|seconds/i.test(e.message) ? ACCOUNT_COPY.errors.rateLimited : ACCOUNT_COPY.errors.sendFailed);
        return;
      }
      setSentAt(Date.now());
      setCode('');
      setPhase('code');
    } catch (err) {
      setError(friendlyNetworkError(err, "We couldn't send a code. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length < MIN_CODE || busy || (testMode && !consent)) return;
    setBusy(true);
    setError(null);
    try {
      console.log('[v2 welcome] verify: start');
      const { error: e } = await withTimeout(
        supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' }),
        20000,
        'verifyCode',
      );
      console.log(`[v2 welcome] verify: done (error: ${e ? e.name : 'none'})`);
      if (e) {
        // Supabase Auth answers "otp_expired" (Token has expired or is invalid)
        // for BOTH a wrong code and an expired one, so never claim "expired".
        const ambiguous = (e as { code?: string }).code === 'otp_expired' || /expired|invalid/i.test(e.message);
        setError(
          ambiguous
            ? testMode
              ? `That code isn’t valid or has expired. Use the newest code made for ${normalizeEmail(email)}.`
              : ACCOUNT_COPY.errors.codeInvalid
            : ACCOUNT_COPY.errors.codeWrong,
        );
        return;
      }
      const loaded = await withTimeout(loadMyOnboarding(), 20000, 'loadDraft');
      if (!loaded.ok) {
        // An existing (V1) member signing in here keeps the current app.
        router.replace('/');
        return;
      }
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      if (uid) {
        const { error: ce } = await withTimeout(
          supabase
            .from('profiles')
            .update({ privacy_consent_at: new Date().toISOString() })
            .eq('id', uid)
            .is('privacy_consent_at', null),
          20000,
          'consent',
        );
        if (ce) console.warn('[v2] consent write failed', ce.code);
      }
      const status = loaded.value.state?.application_status;
      router.replace(status === 'draft' || status === 'changes_requested' ? '/v2/onboarding' : '/v2/status');
    } catch (err) {
      console.log(`[v2 welcome] verify failed: ${err instanceof Error ? err.message : 'unknown'}`);
      setError(friendlyNetworkError(err, 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const isEmail = phase === 'email';
  return (
    <OnboardingScreen
      sectionLabel={ACCOUNT_COPY.sectionLabel}
      step={isEmail ? 1 : 2}
      totalSteps={2}
      title={isEmail ? ACCOUNT_COPY.emailTitle : ACCOUNT_COPY.codeTitle}
      helper={
        isEmail
          ? ACCOUNT_COPY.emailHelper
          : testMode
            ? `DEV test account ${normalizeEmail(email)} — enter the code shown in your Mac terminal.`
            : ACCOUNT_COPY.codeHelper(normalizeEmail(email))
      }
      onBack={
        isEmail || testMode ? (router.canGoBack() ? () => router.back() : undefined) : () => setPhase('email')
      }
      contentKey={phase}
      footer={
        <>
          {error ? <AccountError text={error} /> : null}
          <OnboardingPrimaryButton
            label={busy ? ACCOUNT_COPY.busy : isEmail ? ACCOUNT_COPY.sendCode : ACCOUNT_COPY.continue}
            onPress={() => void (isEmail ? sendCode() : verify())}
            disabled={busy || (isEmail ? !emailLooksValid(email) || !consent : code.length < MIN_CODE || (testMode && !consent))}
          />
        </>
      }>
      {isEmail ? (
        <OnboardingTextField
          label={ACCOUNT_COPY.emailLabel}
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
        <ConsentRow checked={consent} onToggle={() => setConsent((c) => !c)} onOpenNotice={() => router.push('/privacy-notice')} />
      ) : (
        <>
          <OnboardingTextField
            label={ACCOUNT_COPY.codeLabel}
            value={code}
            onChangeText={(v) => {
              setCode(cleanCode(v));
              setError(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={MAX_CODE}
            onSubmitEditing={() => void verify()}
          />
          {testMode ? (
            <Text style={accountStyles.consentText} maxFontSizeMultiplier={1.6}>
              {`New code for ${normalizeEmail(email)}? On your Mac run: ${devCodeCommand(backend.env, normalizeEmail(email))}\n${devSwitchAccountHint(backend.env)}`}
            </Text>
          ) : null}
          {testMode ? (
            <ConsentRow checked={consent} onToggle={() => setConsent((c) => !c)} onOpenNotice={() => router.push('/privacy-notice')} />
          ) : null}
          {testMode ? null : (
          <AccountLink
            label={cooldown > 0 ? ACCOUNT_COPY.resendIn(cooldown) : ACCOUNT_COPY.resend}
            onPress={() => void sendCode()}
            disabled={cooldown > 0 || busy}
            accessibilityLabel={cooldown > 0 ? `Resend code in ${cooldown} seconds` : 'Resend code'}
          />
          )}
        </>
      )}
    </OnboardingScreen>
  );
}

