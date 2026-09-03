// Step3 screen 4/6 — drinking & smoking, combined single-select.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { DRINK_SMOKE_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Drinking() {
  const router = useRouter();
  const { drinkingSmoking, setDrinkingSmoking } = useStep3();

  return (
    <QuestionScreen
      step={4}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="What's your take on drinking and smoking?"
      onNext={() => router.push('/profile-setup/step3/education' as never)}>
      <View style={styles.chipRow}>
        {DRINK_SMOKE_OPTIONS.map(({ label, value }) => (
          <Chip
            key={value}
            label={label}
            selected={drinkingSmoking === value}
            onPress={() => setDrinkingSmoking(value)}
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
