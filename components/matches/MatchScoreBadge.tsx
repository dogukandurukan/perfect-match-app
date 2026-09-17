import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/**
 * Small coral-soft pill — "78% match" — used on Matches cards/screens.
 * Deliberately a separate component from components/home/MatchScoreBadge
 * (that one is styled to float on a photo with a dark semi-transparent
 * surface); this one sits on a plain light card background, matching the
 * Matches mockup's pill treatment.
 */
export function MatchScoreBadge({ percentage }: { percentage: number }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.text}>{Math.round(percentage)}% match</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.pill,
    paddingHorizontal: homeSpacing.sm + 2,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12.5,
    fontWeight: '700',
    color: homeColors.accent,
  },
});
