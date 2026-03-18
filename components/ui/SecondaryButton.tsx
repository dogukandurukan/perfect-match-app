import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type SecondaryButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function SecondaryButton({ label, onPress, style }: SecondaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, style]}
      onPress={onPress}>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1C2030',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  label: {
    color: '#F5F0E8',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});

