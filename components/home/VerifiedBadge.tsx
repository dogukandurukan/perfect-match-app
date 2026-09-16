import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/** Dark, neutral pill over the hero photo — no emoji, single outline icon. */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Photo verified">
      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
      <ThemedText style={styles.text}>Photo verified</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs,
    paddingHorizontal: homeSpacing.md,
    paddingVertical: homeSpacing.xs + 2,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.verifiedBadge,
  },
  text: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
});
