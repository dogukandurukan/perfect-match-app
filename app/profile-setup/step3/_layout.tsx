import { Stack } from 'expo-router';

import { Step3Provider } from '@/lib/onboardingStep3Context';

export default function Step3Layout() {
  return (
    <Step3Provider>
      <Stack
        screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
    </Step3Provider>
  );
}
