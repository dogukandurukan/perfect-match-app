// Screen: Onboarding | Status: stable | Last updated: Mayıs 2026
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function OnboardingIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(auth)/register');
  }, [router]);

  return null;
}
