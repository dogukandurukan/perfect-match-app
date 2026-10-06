// DEV-ONLY: interactive preview of the proposed Discover (home) full-profile
// design with inline comments. Local fixtures only — no Supabase reads or
// writes, so it never likes, passes, comments on or resets anything on a real
// account. The real Discover tab is unchanged. In production builds
// (__DEV__ false) this route redirects to "/".
//
// Open it while signed in: Profile tab → "Discover design preview (DEV)",
// or Safari → datingapp://dev/discover-preview.
// See docs/tempa/work-packages/V2_DISCOVER_DESIGN_PREVIEW_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { DiscoverDesignPreview } from '@/components/dev/discover/DiscoverDesignPreview';

export default function DiscoverPreviewRoute() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <DiscoverDesignPreview onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </>
  );
}
