import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { colors } from '@/lib/designTokens';

export default function ComingSoonScreen() {
  const router = useRouter();

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.title}>
          Spor partneri özelliği yakında geliyor! 🏃
        </ThemedText>

        <View style={styles.actions}>
          <PrimaryButton
            label="Şu an dating eşleşmesi için devam et"
            onPress={() => router.replace('/profile-setup/step2')}
          />
          <SecondaryButton
            label="Ana sayfaya dön"
            style={styles.secondary}
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
  },
  actions: {
    gap: 12,
  },
  secondary: {
    borderColor: colors.accent,
    minHeight: 56,
    justifyContent: 'center',
  },
});
