import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeSpacing } from '@/lib/homeTheme';

/**
 * "N likes left today" + a row of small segments — real daily-like state,
 * not profile-scroll progress (must NOT change while scrolling the current
 * card). Filled/accent segments = likes still available; muted segments =
 * already used today. `loading` renders a stable-height all-muted
 * placeholder at the free-tier width so nothing jumps once real data
 * arrives.
 */
export function DailyLikeQuota({
  remaining,
  limit,
  loading = false,
}: {
  remaining: number;
  limit: number;
  loading?: boolean;
}) {
  const segmentCount = loading ? 5 : limit;
  const filled = loading ? 0 : remaining;
  // Premium's 10-segment row needs thinner segments than free's 5 to stay
  // a compact single line instead of wrapping/crowding.
  const segmentWidth = segmentCount > 6 ? 12 : 22;

  const label = loading
    ? 'Loading your daily likes'
    : remaining === 1
      ? '1 like left today'
      : `${remaining} likes left today`;

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: segmentCount, now: filled }}>
        {Array.from({ length: segmentCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { width: segmentWidth },
              i < filled ? styles.segmentFilled : styles.segmentEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: homeSpacing.xs },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: homeColors.textSecondary,
  },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { height: 4, borderRadius: 2 },
  segmentFilled: { backgroundColor: homeColors.accent },
  segmentEmpty: { backgroundColor: homeColors.border },
});
