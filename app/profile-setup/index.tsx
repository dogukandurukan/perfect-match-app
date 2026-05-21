// Screen: Profile setup giriş | Status: stable | Last updated: Mayıs 2026
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function ProfileSetupIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile-setup/step1');
  }, [router]);

  return null;
}

