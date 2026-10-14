// Another V2 member's full public profile, as they will see it in their own
// "This is how others will see you" preview: same blocks, same component
// (ProfilePreview). Data comes only from get_profile_v2, which selects the
// allowed fields on the server — never the raw onboarding draft. If the
// server says the profile is not available (blocked, hidden, deleted, no
// longer eligible), nothing about the person is shown.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AddTakeCard } from '@/components/interests/TakeCard';
import { ProfilePreview } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { loadPublicProfile } from '@/lib/onboardingV2/remote';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { buildPublicProfileBlocks, type PreviewBlock } from '@/lib/onboardingV2/yourProfile';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable' }
  | { kind: 'ready'; blocks: PreviewBlock[] };

/** `onAddTake` (own profile only): shows "Add a conversation starter" under
 * the main photo when there is none. `refreshKey` reloads from the server
 * (e.g. when the screen regains focus after editing). */
export function PublicProfileView({ userId, onAddTake, refreshKey = 0 }: { userId: string; onAddTake?: () => void; refreshKey?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const r = await loadPublicProfile(userId);
    if (!r.ok) return setState({ kind: 'error', message: r.message });
    if (!r.value) return setState({ kind: 'unavailable' });
    setState({ kind: 'ready', blocks: buildPublicProfileBlocks(r.value) });
  }, [userId]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setState({ kind: 'loading' });
      const r = await loadPublicProfile(userId);
      if (!live) return;
      if (!r.ok) return setState({ kind: 'error', message: r.message });
      if (!r.value) return setState({ kind: 'unavailable' });
      setState({ kind: 'ready', blocks: buildPublicProfileBlocks(r.value) });
    })();
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading profile" />
      </View>
    );
  }
  if (state.kind === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.text} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {state.message}
        </Text>
        <TouchableOpacity onPress={() => void load()} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.link}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (state.kind === 'unavailable') {
    return (
      <View style={styles.center}>
        <Text style={styles.text} maxFontSizeMultiplier={1.6}>
          This profile isn't available.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {onAddTake && !state.blocks.some((b) => b.type === 'take') ? (
        <>
          <ProfilePreview blocks={state.blocks.slice(0, 1)} />
          <AddTakeCard onPress={onAddTake} style={styles.addTake} />
          <ProfilePreview blocks={state.blocks.slice(1)} />
        </>
      ) : (
        <ProfilePreview blocks={state.blocks} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm },
  addTake: { marginVertical: obSpacing.md },
  center: { alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingVertical: 48, paddingHorizontal: obSpacing.gutter },
  text: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
});
