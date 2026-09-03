// Screen: Şifremi unuttum | Status: new | Last updated: Ağustos 2026
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen e‑posta adresini gir.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'datingapp://change-password',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Bir şeyler yanlış gitti', error.message);
      return;
    }
    setSent(true);
  };

  return (
    <ScreenContainer style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Reset password
      </ThemedText>

      {sent ? (
        <View style={styles.form}>
          <ThemedText style={styles.sentText}>
            E‑postana bir bağlantı gönderdik. Gelen kutunu kontrol et ve bağlantıya tıklayarak
            yeni şifreni belirle.
          </ThemedText>
          <ThemedText style={styles.linkText} onPress={() => router.replace('/(auth)/login')}>
            Log in'e dön
          </ThemedText>
        </View>
      ) : (
        <View style={styles.form}>
          <ThemedText style={styles.subtitle}>
            Hesabına kayıtlı e‑posta adresini gir, sana şifreni sıfırlaman için bir bağlantı
            gönderelim.
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="E‑posta"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="E-posta"
          />
          <PrimaryButton
            label={loading ? 'Gönderiliyor…' : 'Bağlantı gönder'}
            onPress={handleSend}
            loading={loading}
          />
          <ThemedText style={styles.linkText} onPress={() => router.back()}>
            Vazgeç
          </ThemedText>
        </View>
      )}
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
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 16,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#FFFFFF',
  },
  linkText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#9CA3AF',
  },
});
