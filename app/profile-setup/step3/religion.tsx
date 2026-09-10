// Step3 screen 7/8 — beliefs. Next goes to height (last screen).
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { RELIGION_OPTIONS, TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Religion() {
  const router = useRouter();
  const { religion, setReligion } = useStep3();

  return (
    <QuestionScreen
      step={7}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="How would you describe your beliefs?"
      onNext={() => router.push('/profile-setup/step3/height' as never)}>
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
