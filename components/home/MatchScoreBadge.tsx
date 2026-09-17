import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/**
 * Small, confident accent-colored pill — replaces the old large black
 * score box. Accent color is reserved for exactly this kind of primary
 * signal (brief: "match score, like action, daily like indicator").
 *
 * 2026-09-17: was noticeably oversized/dominant on real devices (too much
 * padding + font size for a secondary hero signal) — shrunk to match
 * VerifiedBadge's exact scale (same padding/font values) so the two read as
 * one badge family instead of two different sizes competing for attention.
 */
export function MatchScoreBadge({ percentage }: { percentage: number }) {
  return (
    <View style={styles.badge} accessibilityLabel={`${percentage} percent match`}>
      <ThemedText style={styles.text}>{percentage}% match</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: homeSpacing.sm,
    paddingVertical: 3,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
  },
  text: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
});
