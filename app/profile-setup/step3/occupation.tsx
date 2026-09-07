// Step3 screen 6/7 — occupation. Right after education (user request,
// 2026-09-07: kept separate from education's own follow-up detail since
// you can have a job without matching the education-level context, and
// separate from Instagram too — different kind of field, different screen).
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Occupation() {
  const router = useRouter();
  const { occupation, setOccupation } = useStep3();

  return (
    <QuestionScreen
      step={6}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="What do you do for work?"
      subtitle="Optional"
      onNext={() => router.push('/profile-setup/step3/religion' as never)}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Product Designer"
          placeholderTextColor="#AAAAAA"
          value={occupation}
          onChangeText={setOccupation}
        />
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  inputWrap: { marginTop: 4 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 16,
  },
});
