// V2 onboarding (live): email-code sign-in → persistent questionnaire →
// application status. Headerless; every screen draws its own chrome.
import { Stack } from 'expo-router';

export default function V2Layout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
