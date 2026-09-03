// Step3 screen 6/6 — beliefs, last screen. Finish triggers submitAll()
// (upserts profiles.current_step=4, then pushes to step4).
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { RELIGION_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Religion() {
  const { religion, setReligion, saving, submitAll } = useStep3();

  return (
    <QuestionScreen
      step={6}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="How would you describe your beliefs?"
      onNext={() => void submitAll()}
      nextLabel={saving ? 'Saving…' : 'Finish'}
      nextLoading={saving}>
      <View style={styles.chipRow}>
        {RELIGION_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={religion === opt}
            onPress={() => setReligion(opt)}
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
