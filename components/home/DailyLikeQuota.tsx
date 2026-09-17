import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeSpacing } from '@/lib/homeTheme';

// 2026-09-17: fixed, deliberately compact track width — this now lives in
// the CENTER slot of a single utility header row (wordmark | quota |
// filter), not its own full-width row, so it can no longer claim ~45% of
// the screen the way the two-row layout did. `flex:1` segments still split
// this evenly for both the 5-segment free tier and the 10-segment premium
// tier, just within a smaller budget.
const SEGMENTS_WIDTH = 96;
const SEGMENT_HEIGHT = 7;

/**
 * Compact "N left" + a row of small segments — real daily-like state, not
 * profile-scroll progress (must NOT change while scrolling the current
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

  // Short label for the compact single-row header (brief: "6 left" or
  // "6 likes left" if space allows) — full accessibility phrasing still
  // goes on accessibilityLabel below.
  const label = loading ? '…' : remaining === 1 ? '1 left' : `${remaining} left`;
  const a11yLabel = loading
    ? 'Loading your daily likes'
    : remaining === 1
      ? '1 like left today'
      : `${remaining} likes left today`;

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs + 2,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: homeColors.textSecondary,
  },
  segments: {
    width: SEGMENTS_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: SEGMENT_HEIGHT / 2,
  },
  segmentFilled: { backgroundColor: homeColors.accent },
  segmentEmpty: { backgroundColor: homeColors.segmentTrack },
});
