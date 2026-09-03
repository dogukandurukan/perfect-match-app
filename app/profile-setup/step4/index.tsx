// Step4 screen 1/6 — availability days. The "Always" stagger-fill animation
// is purely visual, so it stays local to this screen rather than in context.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { DAY_LABELS, TOTAL_SCREENS, useStep4 } from '@/lib/onboardingStep4Context';

export default function Step4Days() {
  const router = useRouter();
  const { alwaysOn, selectedDays, toggleAlways, toggleDay } = useStep4();
  const [staggerIdx, setStaggerIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!alwaysOn) {
      setStaggerIdx(null);
      return;
    }
    let i = 0;
    setStaggerIdx(0);
    const id = setInterval(() => {
      i++;
      if (i > 6) {
        clearInterval(id);
        setStaggerIdx(null);
      } else {
        setStaggerIdx(i);
      }
    }, 50);
    return () => clearInterval(id);
  }, [alwaysOn]);

  const dayChipSelected = (d: string) => alwaysOn || selectedDays.includes(d);
  const dayVisualSelected = (d: string) => {
    const idx = DAY_LABELS.indexOf(d as (typeof DAY_LABELS)[number]);
    if (staggerIdx !== null) return staggerIdx >= idx;
    return dayChipSelected(d);
  };

  return (
    <QuestionScreen
      step={1}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="Which days are you usually free?"
      onNext={() => router.push('/profile-setup/step4/hours' as never)}>
      <View style={styles.chipRow}>
        {DAY_LABELS.map((d) => (
          <Chip
            key={d}
            label={d}
            selected={dayVisualSelected(d)}
            onPress={() => toggleDay(d)}
            selectedColor="#1A1A1A"
          />
        ))}
        <Chip label="Always" selected={alwaysOn} onPress={toggleAlways} selectedColor="#1A1A1A" />
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
