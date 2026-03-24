import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function ProfileSetupIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile-setup/step1');
  }, [router]);

  return null;
}

