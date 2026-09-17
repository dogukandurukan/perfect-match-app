import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyLikeQuota } from '@/components/home/DailyLikeQuota';
import { HeaderFilterButton } from '@/components/home/HeaderFilterButton';
import { ThemedText } from '@/components/themed-text';
import { HOME_BRAND_NAME, homeColors, homeSpacing } from '@/lib/homeTheme';

// Content height only (safe-area excluded) — the header's real on-screen
// height is this plus insets.top, applied as its own paddingTop below.
// Exported so index.tsx's heroHeight formula subtracts the exact same
// number this component actually renders at, instead of a second,
// independently-guessed constant that could drift out of sync.
export const APP_BAR_CONTENT_HEIGHT = 50;
// Gap between this bar and the hero photo below it — also exported and
// reused as the ScrollView's own paddingTop in index.tsx, so the gap the
// hero-height formula assumes is the same gap actually applied.
export const APP_BAR_HERO_GAP = 8;

/**
 * Persistent single-row utility bar (2026-09-17 brief) — reintroduced after
 * the previous round removed the header row entirely and floated quota +
 * filter over the hero photo instead. That fully-image-first layout didn't
 * match the Bumble reference: Bumble keeps a slim, ALWAYS-VISIBLE top bar
 * (wordmark + daily quota + filter) above the photo, not floating controls
 * on top of it. Unlike the old in-ScrollView header (round 3-8), this is a
 * real, non-scrolling sibling ABOVE the ScrollView — it takes real layout
 * space rather than floating/absolute, so it can never overlap scrolled
 * content (the bug that drove it into the ScrollView in the first place is
 * structurally impossible here: nothing scrolls underneath it, it's not
 * positioned on top of anything).
 *
 * Rendered unconditionally at the feed root (see index.tsx) regardless of
 * loading/error/empty/active-card state — Filters and the daily quota are
 * always reachable, so there's no separate "fallback filter" needed for
 * the no-card states anymore.
 */
export function HomeHeader({
  likesRemaining,
  likesLimit,
  likesLoading,
}: {
  likesRemaining: number;
  likesLimit: number;
  likesLoading: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
        <View style={styles.utilityCluster}>
          <DailyLikeQuota remaining={likesRemaining} limit={likesLimit} loading={likesLoading} />
          <HeaderFilterButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: homeColors.background,
  },
  row: {
    height: APP_BAR_CONTENT_HEIGHT,
    paddingHorizontal: homeSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 29,
    fontWeight: '800',
    color: homeColors.textPrimary,
  },
  utilityCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.md,
  },
});
