// DEV-ONLY preview for Tempa onboarding V2 — Basics (P02) → Compatibility (P03).
// Route name kept from P01 so the same link opens the connected flow.
// Isolated from the active onboarding/auth flow: nothing reads or writes
// Supabase, no session is required or created, answers live in memory only
// and are lost when the screen closes. In production builds (__DEV__ false)
// this route redirects to "/".
//
// Open it (dev-client running via `npx expo start --dev-client` from the P03
// worktree): signed out, tap "Preview new onboarding" on the landing screen,
// or Safari → datingapp://dev/onboarding-v2-name.
// See docs/tempa/work-packages/P03_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { PreviewFlow } from '@/components/onboarding-v2/PreviewFlow';

export default function OnboardingV2Preview() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      {/* Swipe-back would close the whole preview mid-flow; the header back
          steps through the flow instead. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <PreviewFlow onExit={router.canGoBack() ? () => router.back() : undefined} />
    </>
  );
}
