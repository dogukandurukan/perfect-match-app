import { Stack } from 'expo-router';

import { Step1Provider } from '@/lib/onboardingStep1Context';

export default function Step1Layout() {
  return (
    <Step1Provider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }} />
    </Step1Provider>
  );
}
