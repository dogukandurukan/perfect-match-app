// DEV-ONLY preview for Tempa onboarding V2 — Section 2 Basics (P02).
// Route name kept from P01 so the same link opens the connected six-step flow.
// Isolated from the active onboarding/auth flow: nothing reads or writes
// Supabase, no session is required or created, answers live in memory only
// and are lost when the screen closes. In production builds (__DEV__ false)
// this route redirects to "/".
//
// Open it (dev-client running via `npx expo start --dev-client` from the P02
// worktree): Safari on the phone → datingapp://dev/onboarding-v2-name
// See docs/tempa/work-packages/P02_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { BasicsFlow } from '@/components/onboarding-v2/basics/BasicsFlow';

export default function OnboardingV2BasicsPreview() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      {/* Swipe-back would close the whole preview mid-flow; the header back
          steps through the flow instead. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <BasicsFlow onExit={router.canGoBack() ? () => router.back() : undefined} />
    </>
  );
}
