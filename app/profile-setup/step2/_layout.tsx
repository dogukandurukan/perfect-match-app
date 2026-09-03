import { Stack } from 'expo-router';

import { Step2Provider } from '@/lib/onboardingStep2Context';

export default function Step2Layout() {
  return (
    <Step2Provider>
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
    </Step2Provider>
  );
}
