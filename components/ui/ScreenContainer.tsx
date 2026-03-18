import React, { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View, ViewStyle } from 'react-native';

type ScreenContainerProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function ScreenContainer({ children, style }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
});

