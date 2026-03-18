import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e‑posta ve şifre gir.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Giriş başarısız', error.message);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText type="title" style={styles.title}>
        Log in
      </ThemedText>

      <View style={styles.form}>
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

        <PrimaryButton label={loading ? 'Giriş yapılıyor…' : 'Log in'} onPress={handleLogin} loading={loading} />

        <ThemedText style={styles.linkText} onPress={() => router.push('/(auth)/register')}>
          Hesabın yok mu? Create account
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
    color: '#FFFFFF',
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
  linkText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9CA3AF',
  },
});

