import React from 'react';
import { GestureResponderEvent, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

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
    backgroundColor: '#1C2030',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  chipSelected: {
    backgroundColor: '#C9A96E',
    borderColor: '#C9A96E',
  },
  label: {
    color: '#F5F0E8',
    fontSize: 13,
  },
  labelSelected: {
    color: '#0F1117',
    fontWeight: '600',
  },
});

