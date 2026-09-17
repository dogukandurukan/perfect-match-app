import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

const SEGMENTS_WIDTH = 84;
const SEGMENT_HEIGHT = 6;

/**
 * Floating capsule showing "N left" + a row of small segments — real
 * daily-like state, not profile-scroll progress (must NOT change while
 * scrolling the current card). Filled/accent segments = likes still
 * available; muted segments = already used today.
 *
 * 2026-09-17: this is now the ONLY place this renders (was a two-row
 * in-body header, then a compact single-row header — both retired; the
 * header no longer exists as a separate visual area at all, per the
 * brief). Positioning (top-left over the hero photo) is the CALLER's
 * job (see ProfileHeroCard) — this component only renders the capsule's
 * own surface/border/shadow, not its placement, so it stays a plain,
 * reusable visual unit rather than baking in "floats over a photo"
 * as an assumption. No `variant` prop: there is exactly one consumer
 * and one look now, so a variant switch would be speculative.
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

  const label = loading ? '…' : remaining === 1 ? '1 left' : `${remaining} left`;
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
    height: 40,
    paddingHorizontal: homeSpacing.md,
    borderRadius: homeRadius.pill,
    backgroundColor: 'rgba(255,253,252,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(23,23,23,0.08)',
    shadowColor: '#3A2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
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
