// Step2 screen 3/4 — second follow-up question.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { TOTAL_SCREENS, useStep2 } from '@/lib/onboardingStep2Context';

export default function Step2Q2() {
  const router = useRouter();
  const { questions, answers, setAnswer } = useStep2();
  const q = questions[1];

  useEffect(() => {
    if (!q) router.replace('/profile-setup/step2' as never);
  }, [q, router]);

  if (!q) return null;

  return (
    <QuestionScreen
      step={3}
      totalSteps={TOTAL_SCREENS}
      macroStep={2}
      title={q.title}
      onNext={() => router.push('/profile-setup/step2/q3' as never)}
      nextDisabled={!answers[q.key]}>
      <View style={styles.chipRow}>
        {q.options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={answers[q.key] === opt}
            onPress={() => setAnswer(q.key, opt)}
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
