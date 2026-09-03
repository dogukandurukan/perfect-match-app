// Step3 screen 5/6 — education, with an optional follow-up detail field
// that reveals once an option is picked.
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import {
  EDUCATION_FOLLOWUP_PLACEHOLDER,
  EDUCATION_OPTIONS,
  TOTAL_SCREENS,
  useStep3,
} from '@/lib/onboardingStep3Context';

export default function Step3Education() {
  const router = useRouter();
  const { education, setEducation, educationDetail, setEducationDetail } = useStep3();

  return (
    <QuestionScreen
      step={5}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="What's your education background?"
      onNext={() => router.push('/profile-setup/step3/religion' as never)}>
      <View style={styles.chipRow}>
        {EDUCATION_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={education === opt}
            onPress={() => setEducation(opt)}
            selectedColor="#1A1A1A"
          />
        ))}
      </View>
      <OptionalFieldReveal show={!!education} animationKey={education ?? 'none'}>
        <TextInput
          style={styles.input}
          placeholder={education ? EDUCATION_FOLLOWUP_PLACEHOLDER[education] : undefined}
          placeholderTextColor="#AAAAAA"
          value={educationDetail}
          onChangeText={setEducationDetail}
        />
      </OptionalFieldReveal>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 16,
  },
});
