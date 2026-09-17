import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors } from '@/lib/homeTheme';

export type DatePlanStep = 'place' | 'time' | 'review';

const STEPS: { key: DatePlanStep; index: number; label: string }[] = [
  { key: 'place', index: 1, label: 'Place' },
  { key: 'time', index: 2, label: 'Time' },
  { key: 'review', index: 3, label: 'Review' },
];

/**
 * Compact 3-step indicator — purely a reflection of local selection state
 * (place chosen? / time chosen? / both?), not a real navigation stack. The
 * "Plan your date" flow still submits from one screen (see micro-intro.tsx)
 * — the brief explicitly said not to invent a new navigation stack when the
 * existing flow already works on a single screen.
 */
export function DatePlanProgress({ current }: { current: DatePlanStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={`Step ${currentIndex + 1} of 3: ${STEPS[currentIndex].label}`}>
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'upcoming';
        return (
          <View key={step.key} style={styles.stepGroup}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.dot,
                  state === 'active' && styles.dotActive,
                  state === 'done' && styles.dotDone,
                ]}>
                {state === 'done' ? (
                  <Ionicons name="checkmark" size={14} color={homeColors.accent} />
                ) : (
                  <ThemedText style={[styles.dotText, state === 'active' && styles.dotTextActive]}>
                    {step.index}
                  </ThemedText>
                )}
              </View>
              <ThemedText style={[styles.label, state === 'active' && styles.labelActive]}>
                {step.label}
              </ThemedText>
            </View>
            {i < STEPS.length - 1 ? (
              <View style={[styles.connector, state === 'done' && styles.connectorDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepGroup: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepItem: { alignItems: 'center', gap: 4 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: homeColors.border,
    backgroundColor: homeColors.surface,
  },
  dotActive: { backgroundColor: homeColors.accent, borderColor: homeColors.accent },
  dotDone: { backgroundColor: homeColors.accentSoft, borderColor: homeColors.accent },
  dotText: { fontSize: 12.5, fontWeight: '700', color: homeColors.textSecondary },
  dotTextActive: { color: '#FFFFFF' },
  label: { fontSize: 11.5, fontWeight: '600', color: homeColors.textSecondary },
  labelActive: { color: homeColors.accent, fontWeight: '700' },
  connector: {
    flex: 1,
    height: 1.5,
    backgroundColor: homeColors.border,
    marginHorizontal: 6,
    marginBottom: 16,
  },
  connectorDone: { backgroundColor: homeColors.accent },
});
