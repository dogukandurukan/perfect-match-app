import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius } from '@/lib/homeTheme';

/**
 * Two-line date chip for the Time step's upcoming-date row ("Mon" / "21
 * Sep") — visually distinct from `TimeOptionChip`'s single-line HH:mm
 * chips per the mockup, same selected-state language (blush bg, terracotta
 * border/text).
 */
export function DateOptionChip({
  weekday,
  dayMonth,
  selected,
  onPress,
}: {
  weekday: string;
  dayMonth: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${weekday}, ${dayMonth}`}
      accessibilityState={{ selected }}>
      <View>
        <ThemedText style={[styles.weekday, selected && styles.textSelected]}>{weekday}</ThemedText>
        <ThemedText style={[styles.dayMonth, selected && styles.textSelected]}>{dayMonth}</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 64,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: homeRadius.cardSmall,
    backgroundColor: homeColors.surface,
    borderWidth: 1.5,
    borderColor: homeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: homeColors.accentSoft, borderColor: homeColors.accent },
  weekday: { fontSize: 13.5, fontWeight: '700', color: homeColors.textPrimary, textAlign: 'center' },
  dayMonth: { fontSize: 12, color: homeColors.textSecondary, textAlign: 'center', marginTop: 1 },
  textSelected: { color: homeColors.accent },
});
