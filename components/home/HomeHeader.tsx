import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DailyLikeQuota } from '@/components/home/DailyLikeQuota';
import { HOME_BRAND_NAME, homeColors, homeSpacing } from '@/lib/homeTheme';

/**
 * In-body header (native header hidden for this screen, see `_layout.tsx`).
 *
 * 2026-09-17 fix: this used to be a fixed sibling above a separately-scrolled
 * `body`, and real-device testing found the profile card scrolling underneath
 * it (top of `WhyYouMatchCard` hidden behind the header). Root cause wasn't
 * pinned down with certainty, so the robust fix (explicitly an acceptable
 * fallback per the redesign brief, prioritized over precise scroll
 * animation) was taken instead: this component no longer owns its own top
 * safe-area handling as a "floating over everything" assumption — it is
 * rendered as the very first item inside the same ScrollView as the rest of
 * the profile card (see index.tsx), so it can never overlap content by
 * construction. It's still used standalone (not inside a ScrollView) for the
 * loading/error/empty states, which is safe since those never scroll.
 * Compacted at the same time (brief: header took too much vertical space) —
 * smaller wordmark, filter button's tap target now comes from `hitSlop`
 * instead of a fixed 44×44 box, tighter paddings throughout.
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
      <View style={styles.row}>
        <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
        <TouchableOpacity
          style={styles.filterBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Filters">
          <Ionicons name="options-outline" size={20} color={homeColors.textPrimary} />
        </TouchableOpacity>
      </View>
      <DailyLikeQuota remaining={likesRemaining} limit={likesLimit} loading={likesLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: homeColors.background,
    paddingHorizontal: homeSpacing.lg,
    paddingBottom: homeSpacing.sm,
    gap: homeSpacing.xs + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 19,
    fontWeight: '800',
    color: homeColors.textPrimary,
    textTransform: 'lowercase',
  },
  filterBtn: {
    padding: 4,
  },
});
