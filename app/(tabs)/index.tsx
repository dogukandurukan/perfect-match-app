import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';
import { getProfileSetupState, type ProfileSetupState } from '@/lib/profileCompletion';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
  const router = useRouter();

  const [profileState, setProfileState] = useState<ProfileSetupState | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setProfileState(null);
        setChecking(false);
        return;
      }

      const state = await getProfileSetupState(user.id);
      if (!mounted) return;

      if (state === 'setup1') router.replace('/profile-setup/step1');
      if (state === 'setup2') router.replace('/profile-setup/step2');
      if (state === 'setup3') router.replace('/profile-setup/step3');
      if (state === 'setup4') router.replace('/profile-setup/step4');

      setProfileState(state);
      setChecking(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleGetStarted = () => {
    router.push('/(auth)/register');
  };

  const handleFindMatch = () => {
    Alert.alert('Yakında', 'Match ekranı MVP sonrası eklenecek.');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />

      {checking ? null : profileState === 'complete' ? (
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Find Your Perfect Match
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            One-time meeting suggestion is coming soon.
          </ThemedText>

          <View style={styles.buttonsContainer}>
            <PrimaryButton label="Find match" onPress={handleFindMatch} />
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Dating App
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            Meet the one who fits your life
          </ThemedText>

          <View style={styles.buttonsContainer}>
            <PrimaryButton label="Get Started" onPress={handleGetStarted} />
            <PrimaryButton label="Log in" onPress={handleLogin} style={styles.loginButton} />
          </View>
        </View>
      )}
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
    alignSelf: 'center',
    width: 260,
    marginTop: 16,
  },
  loginButton: {
    backgroundColor: '#C9A96E',
  },
});
