import { Dimensions, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeSpacing } from '@/lib/homeTheme';

const SCREEN_WIDTH = Dimensions.get('window').width;
// ~45% of screen width (brief's 42-48% range) — a fixed track width so 5
// and 10 segment counts both get a deliberately-sized, easy-to-read row
// instead of shrinking to whatever the label's leftover space happens to be.
const SEGMENTS_WIDTH = Math.round(SCREEN_WIDTH * 0.45);

/**
 * "N likes left today" + a row of small segments — real daily-like state,
 * not profile-scroll progress (must NOT change while scrolling the current
 * card). Filled/accent segments = likes still available; muted segments =
 * already used today. `loading` renders a stable-height all-muted
 * placeholder at the free-tier width so nothing jumps once real data
 * arrives.
 *
 * 2026-09-17: label and segments share one row (was stacked). Segments
 * were also too small/faint to register at a glance — track is now a fixed
 * ~45%-of-screen width with `flex:1` segments splitting it evenly (works
 * for both the 5-segment free tier and the 10-segment premium tier without
 * a min-width squeeze), taller (7pt vs 4pt), and the unfilled state uses a
 * more visible `segmentTrack` tone instead of the barely-there `border`.
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
            style={[styles.segment, i < filled ? styles.segmentFilled : styles.segmentEmpty]}
          />
        ))}
      </View>
    </View>
  );
}

const SEGMENT_HEIGHT = 7;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: homeSpacing.sm,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: homeColors.textSecondary,
  },
  segments: {
    width: SEGMENTS_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: SEGMENT_HEIGHT / 2,
  },
  segmentFilled: { backgroundColor: homeColors.accent },
  segmentEmpty: { backgroundColor: homeColors.segmentTrack },
});
