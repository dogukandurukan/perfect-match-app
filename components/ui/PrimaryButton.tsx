import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type PrimaryButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, loading, style }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}>
      {loading ? <ActivityIndicator color="#0F1117" /> : <ThemedText style={styles.label}>{label}</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    width: '100%',
    minHeight: 56,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  label: {
    color: '#0F1117',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});

