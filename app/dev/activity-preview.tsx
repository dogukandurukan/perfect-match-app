// DEV-ONLY: interactive preview of the proposed Activity tab design ("Likes
// you" + "New matches"). Local fixtures only — no Supabase reads or writes,
// so it never accepts a like, creates a match, marks anything read or sends
// a message on a real account. The real Activity tab is unchanged. In
// production builds (__DEV__ false) this route redirects to "/".
//
// Open it while signed in: Profile tab → "Activity design preview (DEV)",
// or Safari → datingapp://dev/activity-preview.
// See docs/tempa/work-packages/V2_ACTIVITY_DESIGN_PREVIEW_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';

import { ActivityDesignPreview } from '@/components/dev/activity/ActivityDesignPreview';

export default function ActivityPreviewRoute() {
  const router = useRouter();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ActivityDesignPreview onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </>
  );
}
