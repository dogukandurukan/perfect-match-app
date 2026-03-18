import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleRegister = async () => {
    // Eğer email veya şifre hiç girilmemişse, direkt onboarding'e geç
    if (!email || !password) {
      router.replace('/onboarding');
      return;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      Alert.alert('Hata', 'Şifre ve şifre tekrarı eşleşmiyor.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Kayıt başarısız', error.message);
      return;
    }

    Alert.alert('Başarılı', 'Hesap oluşturuldu. Şimdi seni daha yakından tanıyalım.');
    router.replace('/onboarding');
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
          placeholder="Full Name"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
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
        <ThemedText style={[styles.helperText, passwordStrength.style]}>
          {password ? `Strength: ${passwordStrength.label}` : 'Min 8 characters'}
        </ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <PrimaryButton
          label={loading ? 'Oluşturuluyor…' : 'Create account'}
          onPress={handleRegister}
          loading={loading}
        />

        <ThemedText style={styles.linkText} onPress={() => router.replace('/onboarding')}>
          Hesap oluşturmadan devam et
        </ThemedText>

        <ThemedText style={styles.linkText} onPress={() => router.push('/(auth)/login')}>
          Zaten hesabın var mı? Log in
        </ThemedText>
      </View>
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
    textAlign: 'left',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#F5F0E8',
  },
  helperText: {
    marginTop: -8,
    marginBottom: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  linkText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#F5F0E8',
    fontSize: 14,
  },
});

function getPasswordStrength(password: string): { label: 'Weak' | 'Mid' | 'Strong'; style: any } {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;

  if (score >= 4) {
    return { label: 'Strong', style: { color: '#C9A96E' } };
  }
  if (score >= 2) {
    return { label: 'Mid', style: { color: '#F5F0E8' } };
  }
  return { label: 'Weak', style: { color: '#EF4444' } };
}

