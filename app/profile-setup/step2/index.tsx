// Step2 screen 1/4 — intent. Restructured to match step1's one-question-
// per-screen pattern (2026-09-03).
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { INTENT_OPTIONS, TOTAL_SCREENS, useStep2 } from '@/lib/onboardingStep2Context';

export default function Step2Intent() {
  const router = useRouter();
  const { intent, setIntent } = useStep2();

  return (
    <QuestionScreen
      step={1}
      totalSteps={TOTAL_SCREENS}
      macroStep={2}
      title="What brings you here?"
      onNext={() => router.push('/profile-setup/step2/q1' as never)}
      nextDisabled={!intent}>
      <View style={styles.chipRow}>
        {INTENT_OPTIONS.map(({ label, key }) => (
          <Chip
            key={key}
            label={label}
            selected={intent === key}
            onPress={() => setIntent(key)}
            selectedColor="#1A1A1A"
          />
        ))}
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
