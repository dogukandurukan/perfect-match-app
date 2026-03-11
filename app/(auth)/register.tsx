import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (password && password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      },
      {
        emailRedirectTo: undefined,
      },
    );
    setLoading(false);

    if (error) {
      Alert.alert('Kayıt başarısız', error.message);
      return;
    }

    Alert.alert('Başarılı', 'Hesap oluşturuldu. Şimdi seni daha yakından tanıyalım.');
    router.replace('/onboarding');
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Create account
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Kullanıcı adı"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="E‑posta"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre tekrar"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          activeOpacity={0.9}
          onPress={handleRegister}
          disabled={loading}>
          <ThemedText style={styles.buttonText}>
            {loading ? 'Oluşturuluyor…' : 'Create account'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/onboarding')}>
          <ThemedText style={styles.linkText}>Hesap oluşturmadan devam et</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <ThemedText style={styles.linkText}>Zaten hesabın var mı? Log in</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#9CA3AF',
  },
});

