import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleGetStarted = () => {
    router.push('/onboarding/step2');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />

      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Dating App
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Meet the one who fits your life
        </ThemedText>
      </View>

      <View style={styles.buttonsContainer}>
        <PrimaryButton label="Get Started" onPress={handleGetStarted} />
        <PrimaryButton label="Log in" onPress={handleLogin} style={styles.loginButton} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#C9A96E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#F5F0E8',
    textAlign: 'center',
    maxWidth: 320,
  },
  buttonsContainer: {
    gap: 16,
    marginBottom: 16,
    alignSelf: 'center',
    width: 260,
  },
  loginButton: {
    backgroundColor: '#C9A96E',
  },
});
