import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';

type Props = {
  step: 1 | 2 | 3 | 4;
};

export function SetupScreenHeader({ step }: Props) {
  const progress = step / 4;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <ThemedText style={styles.stepLabel}>
        Step {step} of 4
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 16,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  stepLabel: {
    textAlign: 'center',
    color: colors.accent,
    fontSize: 14,
  },
});
