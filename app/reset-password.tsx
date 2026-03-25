import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }

    Alert.alert('Success', 'Your password was updated. You can log in.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/login') },
    ]);
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText type="title" style={styles.title}>
        New password
      </ThemedText>
      <ThemedText style={styles.subtitle}>Choose a new password for your account.</ThemedText>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <PrimaryButton
          label={loading ? 'Saving…' : 'Update password'}
          onPress={handleSubmit}
          loading={loading}
        />
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
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 24,
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
});
