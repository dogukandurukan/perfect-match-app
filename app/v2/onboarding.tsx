// V2 onboarding (live): loads the signed-in user's saved answers from the
// server, resumes at the saved step, and runs the approved V2 screens in
// live mode (PreviewFlow `live`). A submitted application goes to /v2/status.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PreviewFlow, type LiveOptions } from '@/components/onboarding-v2/PreviewFlow';
import { loadMyOnboarding, photosForBundle } from '@/lib/onboardingV2/remote';
import {
  basicsFromServer,
  compatFromServer,
  datesFromServer,
  lifeFromServer,
  promptsFromServer,
  resumePos,
  worldFromServer,
} from '@/lib/onboardingV2/serverMapping';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';
import { EMPTY_PROFILE_DRAFT, normalizeEmail } from '@/lib/onboardingV2/yourProfile';
import { supabase } from '@/lib/supabaseClient';

export default function V2Onboarding() {
  const router = useRouter();
  const [live, setLive] = useState<LiveOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      router.replace('/v2/welcome');
      return;
    }
    const res = await loadMyOnboarding();
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const b = res.value;
    const status = b.state?.application_status;
    if (status && status !== 'draft' && status !== 'changes_requested') {
      router.replace('/v2/status');
      return;
    }
    const d = b.draft ?? {};
    const photos = await photosForBundle(b);
    const email = b.email?.address ?? user.email ?? '';
    setLive({
      userId: user.id,
      email,
      initial: {
        pos: resumePos(d),
        basics: basicsFromServer(d),
        compat: compatFromServer(d),
        life: lifeFromServer(d),
        world: worldFromServer(d),
        dates: datesFromServer(d),
        profile: {
          ...EMPTY_PROFILE_DRAFT,
          photos,
          prompts: promptsFromServer(b.prompts),
          selfie: b.state?.has_selfie ? { uri: '', uploaded: true } : null,
          email,
          emailCheck: b.email?.confirmed ? { email: normalizeEmail(email) } : null,
        },
        serverPhotoIds: b.photos.map((p) => p.id),
      },
    });
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (live) return <PreviewFlow live={live} />;
  return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.text} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => void load()} accessibilityRole="button" hitSlop={10} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading your answers" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: obColors.background },
  text: { fontFamily: obFonts.body, fontSize: 17, lineHeight: 24, color: obColors.textPrimary, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', marginTop: 12 },
  retryText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, color: obColors.cta, textDecorationLine: 'underline' },
});
