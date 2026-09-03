// Step3 screen 1/6 — morning person or night owl. Optional, like every
// step3 field — Next is never disabled.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { MORNING_NIGHT_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3MorningNight() {
  const router = useRouter();
  const { morningNight, setMorningNight } = useStep3();

  return (
    <QuestionScreen
      step={1}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="Are you a morning person or a night owl?"
      onNext={() => router.push('/profile-setup/step3/recharge' as never)}>
      <View style={styles.chipRow}>
        {MORNING_NIGHT_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={morningNight === opt}
            onPress={() => setMorningNight(opt)}
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
