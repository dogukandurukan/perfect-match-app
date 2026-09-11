// Step3 screen 9/9 — pets, last screen. Optional. NOT scored in
// get_top_matches — filter-only (Advanced filters, premium). Finish
// triggers submitAll() (upserts profiles.current_step=4, then pushes to
// step4).
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { PETS_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Pets() {
  const { pets, setPets, saving, submitAll } = useStep3();

  return (
    <QuestionScreen
      step={9}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="Do you have any pets?"
      subtitle="Optional"
      onNext={() => void submitAll()}
      nextLabel={saving ? 'Saving…' : 'Finish'}
      nextLoading={saving}>
      <View style={styles.chipRow}>
        {PETS_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={pets === opt}
            onPress={() => setPets(opt)}
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
