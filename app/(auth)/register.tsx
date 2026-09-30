// Screen: Kayıt (Register) | Status: stable | Last updated: Eylül 2026
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { logEvent } from '@/lib/analytics';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { friendlyNetworkError, withTimeout } from '@/lib/withTimeout';

const ACCENT = '#1A1A1A';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // KVKK consent (2026-09-15) — required before account creation, not
  // pre-checked. See privacy-notice.tsx for the actual aydınlatma metni.
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleRegister = async () => {
    if (loading) return; // one attempt at a time
    if (!email || !password || !privacyAccepted) {
      return;
    }

    if (password.length < 8) {
      return;
    }

    setLoading(true);
    const emailRedirectTo = Linking.createURL('/profile-setup/step1');
    // Step names only — never the email or password — so Metro shows where
    // a stalled sign-up stopped (2026-09-30: two attempts hung after signUp).
    const step = (name: string) => console.log(`[register] ${name}`);
    try {
      step('signUp: start');
      const { data: upData, error } = await withTimeout(
        supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo } }),
        20000,
        'signUp',
      );
      step(`signUp: done (session: ${!!upData?.session}, error: ${error ? error.name : 'none'})`);

      if (error) {
        const already = /already registered|already exists/i.test(error.message);
        Alert.alert(
          already ? 'You already have an account' : 'Sign up failed',
          already ? 'This email is already registered. Log in instead.' : error.message,
        );
        return;
      }

      // With email confirmation off, signUp already returns a session — no
      // second sign-in needed.
      let session = upData?.session ?? null;
      if (!session) {
        step('signInWithPassword: start');
        const { data: signInData, error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim(), password }),
          20000,
          'signInWithPassword',
        );
        step(`signInWithPassword: done (session: ${!!signInData?.session})`);
        session = signInError ? null : signInData.session;
      }

      if (session) {
        // Record consent before any other profile data is collected — a
        // minimal stub row here, step1's own upsert fills in the rest.
        step('consent: start');
        const { error: consentError } = await withTimeout(
          supabase.from('profiles').upsert({ id: session.user.id, privacy_consent_at: new Date().toISOString() }),
          20000,
          'consent',
        );
        step(`consent: done (error: ${consentError ? consentError.code : 'none'})`);
        if (consentError) console.error('SIGNUP - consent write failed:', consentError.message);

        logEvent('signup_completed');
        router.replace('/profile-setup/step1');
        return;
      }

      Alert.alert(
        'Verify your email',
        'We sent you a confirmation link. Please verify your email, then log in to continue setup.',
      );
      router.replace('/(auth)/login?verify=1');
    } catch (e) {
      step(`failed: ${e instanceof Error ? e.message : 'unknown'}`);
      Alert.alert(
        'Sign up did not finish',
        `${friendlyNetworkError(e, 'Something went wrong. Please try again.')} If an account was already created, log in with the same email.`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Create account
          </ThemedText>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#AAAAAA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#AAAAAA"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setPrivacyAccepted((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
              accessibilityLabel="I've read and agree to the Privacy Notice">
              <Ionicons
                name={privacyAccepted ? 'checkbox' : 'square-outline'}
                size={22}
                color={ACCENT}
              />
              <ThemedText style={styles.consentText}>
                I&apos;ve read and agree to the{' '}
                <ThemedText
                  style={styles.consentLink}
                  onPress={() => router.push('/privacy-notice')}>
                  Privacy Notice
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>

            <PrimaryButton
              label={loading ? 'Signing up…' : 'Sign up'}
              onPress={handleRegister}
              loading={loading}
              disabled={!email.trim() || !password || password.length < 8 || !privacyAccepted}
            />

            <ThemedText style={styles.linkText} onPress={() => router.push('/(auth)/login')}>
              Already have an account? Log in
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  container: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 24,
    textAlign: 'left',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.textPrimary,
  },
  linkText: {
    marginTop: 16,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 14,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  consentLink: {
    fontSize: 13,
    lineHeight: 19,
    color: ACCENT,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
