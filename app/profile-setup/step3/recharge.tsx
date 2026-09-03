// Step3 screen 2/6 — recharge style. Multi-select, optional.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { RECHARGE_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Recharge() {
  const router = useRouter();
  const { recharge, toggleRecharge } = useStep3();

  return (
    <QuestionScreen
      step={2}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="How do you recharge after a long day?"
      onNext={() => router.push('/profile-setup/step3/hobbies' as never)}>
      <View style={styles.chipRow}>
        {RECHARGE_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={recharge.includes(opt)}
            onPress={() => toggleRecharge(opt)}
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
