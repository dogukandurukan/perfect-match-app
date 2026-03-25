import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      return;
    }

    if (password.length < 8) {
      return;
    }

    setLoading(true);
    const emailRedirectTo = Linking.createURL('/profile-setup/step1');
    const meta: Record<string, string> = {};
    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone) meta.phone_number = trimmedPhone;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        ...(Object.keys(meta).length ? { data: meta } : {}),
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data.session) {
      router.replace('/profile-setup/step1');
      return;
    }

    setVerifyModal(true);
  };

  const openMailApp = () => {
    Linking.openURL('mailto:').catch(() => {});
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText type="title" style={styles.title}>
        Create account
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
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <PrimaryButton
          label={loading ? 'Signing up…' : 'Sign up'}
          onPress={handleRegister}
          loading={loading}
          disabled={!email.trim() || !password || password.length < 8}
        />

        <ThemedText style={styles.linkText} onPress={() => router.push('/(auth)/login')}>
          Already have an account? Log in
        </ThemedText>
      </View>

      <Modal visible={verifyModal} transparent animationType="fade" onRequestClose={() => setVerifyModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVerifyModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.verifyIcon}>✉️</ThemedText>
            <ThemedText style={styles.verifyTitle}>Check your email!</ThemedText>
            <ThemedText style={styles.verifyBody}>
              We sent you a confirmation link. Click it to get started.
            </ThemedText>
            <PrimaryButton label="Open email app" onPress={openMailApp} />
            <Pressable onPress={() => setVerifyModal(false)} style={styles.modalDismiss}>
              <ThemedText style={styles.modalDismissText}>Close</ThemedText>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  verifyIcon: {
    fontSize: 40,
    textAlign: 'center',
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  verifyBody: {
    fontSize: 15,
    color: colors.textPrimary,
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalDismiss: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDismissText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
