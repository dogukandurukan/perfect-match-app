// DEV-ONLY: interactive preview of the proposed V2 Matches design (large
// photo cards). Local fixtures only — no Supabase reads or writes, so it
// never likes, messages, matches or resets anything on a real account. The
// real Matches tab is unchanged. In production builds (__DEV__ false) this
// route redirects to "/".
//
// Open it while signed in: Profile tab → "Matches design preview (DEV)",
// or Safari → datingapp://dev/matches-preview.
// See docs/tempa/work-packages/V2_MATCHES_DESIGN_PREVIEW_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { MatchesDesignPreview } from '@/components/dev/MatchesDesignPreview';

export default function MatchesPreviewRoute() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      {/* The preview steps back through its own views; swipe-back would
          close it mid-flow. */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <MatchesDesignPreview onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </>
  );
}
