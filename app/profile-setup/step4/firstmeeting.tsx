// Step4 screen 5/6 — what you hope to get out of a first meeting.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { FIRST_MEETING_OPTIONS, TOTAL_SCREENS, useStep4 } from '@/lib/onboardingStep4Context';

export default function Step4FirstMeeting() {
  const router = useRouter();
  const { firstDateExpectation, setFirstDateExpectation } = useStep4();

  return (
    <QuestionScreen
      step={5}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="What are you hoping to get out of a first meeting?"
      onNext={() => router.push('/profile-setup/step4/bio' as never)}>
      <View style={styles.chipRow}>
        {FIRST_MEETING_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={firstDateExpectation === opt}
            onPress={() => setFirstDateExpectation(opt)}
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
