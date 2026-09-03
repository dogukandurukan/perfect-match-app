import { Stack } from 'expo-router';

// profile-setup/ has no root-level route file of its own (step1 is a
// subdirectory, step2-4 are siblings) — without this, expo-router
// auto-generates a default navigator for this level that shows its own
// header (route path as title), stacked on top of step1's own header-less
// layout. Found via device testing (2026-09-02): the phone screen showed a
// "profile-setup/step1" native header above the custom QuestionScreen UI,
// pushing the keyboard-avoiding content (and the Next button) down.
export default function ProfileSetupLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}
    />
  );
}
