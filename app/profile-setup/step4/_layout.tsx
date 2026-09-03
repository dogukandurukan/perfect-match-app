import { Stack } from 'expo-router';

import { Step4Provider } from '@/lib/onboardingStep4Context';

export default function Step4Layout() {
  return (
    <Step4Provider>
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
    </Step4Provider>
  );
}
