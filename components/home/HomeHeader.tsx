import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DailyLikeQuota } from '@/components/home/DailyLikeQuota';
import { HOME_BRAND_NAME, homeColors, homeSpacing } from '@/lib/homeTheme';

/**
 * In-body header (native header hidden for this screen, see `_layout.tsx`).
 * Rendered as the first item inside the per-card ScrollView (active-card
 * state) or as a fixed sibling above `body` (loading/error/empty states) —
 * see index.tsx's `showFixedHeader`; that split, and the separate
 * `statusBarBackdrop` layer that keeps the status bar readable regardless
 * of which of those two this is, are unchanged by this pass.
 *
 * 2026-09-17: collapsed from two stacked rows (wordmark+filter, then
 * quota+segments on its own line) into ONE compact utility row —
 * wordmark | quota | filter — so the hero photo starts noticeably higher.
 * Photo-first was the whole point: this screen's job is to get out of the
 * photo's way, not to be a second piece of chrome under the native status
 * bar. Quota sits centered between the other two via a `flex:1` wrapper so
 * it reads as genuinely "in the middle" even though wordmark/filter have
 * different widths.
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + homeSpacing.xs }]}>
      <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
      <View style={styles.center}>
        <DailyLikeQuota remaining={likesRemaining} limit={likesLimit} loading={likesLoading} />
      </View>
      <TouchableOpacity
        style={styles.filterBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Filters">
        <Ionicons name="options-outline" size={20} color={homeColors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// Only ONE source of top spacing — `insets.top` (+4px buffer) on `wrap` —
// nothing else in the render tree adds its own safe-area padding on top of
// this.
//
// Height budget (excluding insets.top): the row's tallest child is the
// wordmark's own line box (~34pt at 28pt/bold), not the filter button —
// that keeps its 44×44 TOUCH target via `hitSlop={6}` around a smaller
// ~32×32 visual box instead of forcing the row itself to 44pt, which
// would have fought the "no unnecessary top/bottom space" and "hero
// starts noticeably higher" goals directly. ~4 (paddingTop extra) + ~34
// (wordmark) + ~4 (paddingBottom) ≈ 42pt — under the suggested ~52-60pt,
// a deliberate call in favor of the brief's own higher-priority goals;
// flagged in the handoff report in case a real 44×44 visual button was
// intended literally.
const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.background,
    paddingHorizontal: homeSpacing.xl,
    paddingBottom: homeSpacing.xs,
    gap: homeSpacing.sm,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: homeColors.textPrimary,
    textTransform: 'lowercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  filterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
