// Screen: Şifre değiştir | Status: stable | Last updated: Haziran 2026
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

const ACCENT = '#B8860B';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Şifre güncellenemedi', error.message);
      return;
    }

    Alert.alert('Başarılı', 'Şifren güncellendi.', [
      { text: 'Tamam', onPress: () => router.back() },
    ]);
  };

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={ACCENT} />
        <ThemedText style={styles.backText}>Ayarlar</ThemedText>
      </TouchableOpacity>

      <ThemedText type="title" style={styles.title}>
        Şifremi değiştir
      </ThemedText>
      <ThemedText style={styles.subtitle}>Yeni şifreni belirle.</ThemedText>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Yeni şifre"
          placeholderTextColor="#AAAAAA"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Yeni şifre (tekrar)"
          placeholderTextColor="#AAAAAA"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <PrimaryButton
          label={loading ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
          onPress={handleSubmit}
          loading={loading}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', paddingTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { color: ACCENT, fontSize: 16 },
  title: { color: ACCENT, fontSize: 24, marginBottom: 8 },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24 },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: colors.textPrimary,
  },
});
