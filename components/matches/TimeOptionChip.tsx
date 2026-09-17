import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius } from '@/lib/homeTheme';

export function TimeOptionChip({
  label,
  selected,
  dashed,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Dashed border for the "add a custom time" affordance. */
  dashed?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, dashed && styles.chipDashed]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}>
      <ThemedText style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: homeRadius.cardSmall,
    backgroundColor: homeColors.surface,
    borderWidth: 1.5,
    borderColor: homeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: homeColors.accentSoft, borderColor: homeColors.accent },
  chipDashed: { borderStyle: 'dashed', borderColor: homeColors.accent },
  text: { fontSize: 13, fontWeight: '600', color: homeColors.textPrimary },
  textSelected: { color: homeColors.accent },
});
