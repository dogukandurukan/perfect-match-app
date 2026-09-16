import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DailyLikeQuota } from '@/components/home/DailyLikeQuota';
import { HOME_BRAND_NAME, homeColors, homeSpacing } from '@/lib/homeTheme';

/**
 * Custom in-body header (native header hidden for this screen, see
 * `_layout.tsx`) — same approach Activity already uses for its own header,
 * needed here so the daily-like quota can sit fixed under the wordmark
 * without living inside the scrollable profile card.
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
    <View style={[styles.wrap, { paddingTop: insets.top + homeSpacing.sm }]}>
      <View style={styles.row}>
        <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
        <TouchableOpacity
          style={styles.filterBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Filters">
          <Ionicons name="options-outline" size={22} color={homeColors.textPrimary} />
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
    paddingBottom: homeSpacing.md,
    gap: homeSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '800',
    color: homeColors.textPrimary,
    textTransform: 'lowercase',
  },
  filterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
