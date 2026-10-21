// DEV-ONLY design preview for branding / onboarding work (round 1): Welcome,
// one onboarding question and the application status, with synthetic content.
// Nothing reads or writes Supabase; no session is needed or created. In
// production builds (__DEV__ false) this route redirects to "/".
//
// Open it: signed-out landing → "DEV · Design preview", or Safari →
// datingapp://dev/design-preview. See docs/collab/README.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { DesignPreview } from '@/components/dev/design/DesignPreview';

export default function DesignPreviewRoute() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <DesignPreview onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </>
  );
}
