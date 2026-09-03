// Step4 screen 2/6 — time of day.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { TIME_CHIPS, TIME_ALWAYS, TOTAL_SCREENS, useStep4 } from '@/lib/onboardingStep4Context';

export default function Step4Hours() {
  const router = useRouter();
  const { selectedHours, toggleHoursChip, isAlwaysHoursSelected } = useStep4();

  return (
    <QuestionScreen
      step={2}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="What time of day works best for you?"
      onNext={() => router.push('/profile-setup/step4/venue' as never)}>
      <View style={styles.chipRow}>
        {TIME_CHIPS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={opt === TIME_ALWAYS ? isAlwaysHoursSelected : selectedHours.includes(opt)}
            onPress={() => toggleHoursChip(opt)}
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
