import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Overrides the selected fill/border color (default colors.accent).
   * Onboarding passes '#1A1A1A' explicitly — now the same as the default
   * since colors.accent switched to black app-wide (2026-09-03), kept for
   * screens that want a specific override regardless of the token. */
  selectedColor?: string;
};

export function Chip({ label, selected = false, onPress, style, selectedColor }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        selected && selectedColor ? { backgroundColor: selectedColor, borderColor: selectedColor } : null,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <ThemedText style={[styles.label, selected && styles.labelSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
