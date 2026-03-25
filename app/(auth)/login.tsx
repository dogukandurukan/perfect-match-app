import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';
import { getProfileSetupState } from '@/lib/profileCompletion';

export default function LoginScreen() {
  const router = useRouter();
  const { verify } = useLocalSearchParams<{ verify?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (verify === '1') {
      Alert.alert(
        'Verify your email',
        'Please confirm your email from the link we sent before continuing to profile setup.',
      );
    }
  }, [verify]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/(tabs)');
      return;
    }

    if (!user.is_anonymous && user.email && !user.email_confirmed_at) {
      await supabase.auth.signOut();
      Alert.alert(
        'Verify your email',
        'Check your inbox and tap the confirmation link before signing in.',
      );
      return;
    }

    const state = await getProfileSetupState(user.id);

    if (state === 'setup1') router.replace('/profile-setup/step1');
    else if (state === 'setup2') router.replace('/profile-setup/step2');
    else if (state === 'setup3') router.replace('/profile-setup/step3');
    else if (state === 'setup4') router.replace('/profile-setup/step4');
    else router.replace('/(tabs)');
  };

  const handleSendReset = async () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    const redirectTo = Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    setForgotLoading(false);

    if (error) {
      Alert.alert('Error', 'No account found with this email.');
      return;
    }

    setForgotOpen(false);
    setForgotEmail('');
    Alert.alert('Password reset', 'Password reset link sent! Check your email.');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText type="title" style={styles.title}>
        Welcome back
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <PrimaryButton label={loading ? 'Signing in…' : 'Log in'} onPress={handleLogin} loading={loading} />

        <Pressable onPress={() => setForgotOpen(true)} style={styles.forgotWrap}>
          <ThemedText style={styles.forgotText}>Forgot password?</ThemedText>
        </Pressable>

        <ThemedText style={styles.signUpLink} onPress={() => router.push('/(auth)/register')}>
          Don&apos;t have an account? Sign up
        </ThemedText>
      </View>

      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setForgotOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Reset your password</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={forgotEmail}
              onChangeText={setForgotEmail}
            />
            <PrimaryButton
              label={forgotLoading ? 'Sending…' : 'Send reset link'}
              onPress={handleSendReset}
              loading={forgotLoading}
            />
            <Pressable onPress={() => setForgotOpen(false)} style={styles.modalCancel}>
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#C9A96E',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 16,
    marginTop: 24,
  },
  input: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#FFFFFF',
  },
  forgotWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  forgotText: {
    fontSize: 14,
    color: '#C9A96E',
    textAlign: 'center',
  },
  signUpLink: {
    marginTop: 16,
    textAlign: 'center',
    color: '#F5F0E8',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#15182A',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F0E8',
    marginBottom: 4,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
});
