import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/** Dark, neutral pill over the hero photo — no emoji, single outline icon. */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Photo verified">
      <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
      <ThemedText style={styles.text}>Photo verified</ThemedText>
    </View>
  );
}

// Same padding/font scale as MatchScoreBadge (2026-09-17) — the two sit
// side by side and should read as one badge family, not two different sizes.
const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs,
    paddingHorizontal: homeSpacing.sm + 2,
    paddingVertical: 4,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.verifiedBadge,
  },
  text: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },
});
