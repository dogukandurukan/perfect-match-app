// Screen: Chip UI | Status: stable | Last updated: Mayıs 2026
import React from 'react';
import { GestureResponderEvent, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, style]}
      activeOpacity={0.85}
      onPress={onPress}>
      <ThemedText style={[styles.label, selected && styles.labelSelected]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderWidth: 0,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

