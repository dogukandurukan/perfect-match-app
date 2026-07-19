import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';

const TOTAL_STEPS = 4;

type SetupScreenHeaderProps = {
  step: number;
};

export function SetupScreenHeader({ step }: SetupScreenHeaderProps) {
  const clamped = Math.min(Math.max(step, 1), TOTAL_STEPS);

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.progress}>
        {clamped} of {TOTAL_STEPS}
      </ThemedText>
      <View style={styles.dots}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < clamped ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  progress: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: '#E0E0E0',
  },
});
