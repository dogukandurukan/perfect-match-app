import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/**
 * Small, confident accent-colored pill — replaces the old large black
 * score box. Accent color is reserved for exactly this kind of primary
 * signal (brief: "match score, like action, daily like indicator").
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
    paddingHorizontal: homeSpacing.md,
    paddingVertical: homeSpacing.xs + 2,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
  },
  text: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
});
