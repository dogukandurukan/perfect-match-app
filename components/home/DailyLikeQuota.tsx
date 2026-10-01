import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeFonts, homeSpacing } from '@/lib/homeTheme';

const SEGMENTS_WIDTH = 58;
const SEGMENT_HEIGHT = 5;

/**
 * "N left" + a row of small segments — real daily-like state, not
 * profile-scroll progress (must NOT change while scrolling the current
 * card). Filled/accent segments = likes still available; muted segments =
 * already used today.
 *
 * 2026-09-17: moved OFF the hero photo into HomeHeader's persistent
 * utility bar (was a floating capsule over the photo — two rounds before
 * that, a two-row in-body header; both retired). No surface/border/shadow
 * anymore — it sits directly on the header's own opaque background, not a
 * card floating over a photo, so there's nothing to visually separate it
 * from. No `variant` prop: there is exactly one consumer and one look.
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

  // Counts likes only (passes are free) against the daily limit from
  // lib/dailyViews.ts (5, or 10 with is_premium; 24 h window) — label only.
  const label = loading ? '…' : remaining === 1 ? '1 like left' : `${remaining} likes left`;
  const a11yLabel = loading
    ? 'Loading your daily likes'
    : remaining === 1
      ? '1 like left today'
      : `${remaining} likes left today`;

  return (
    <View style={styles.capsule}>
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
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs + 2,
    height: 34,
  },
  label: {
    fontFamily: homeFonts.bodySemiBold,
    fontSize: 14.5,
    lineHeight: 20,
    color: homeColors.textPrimary,
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
