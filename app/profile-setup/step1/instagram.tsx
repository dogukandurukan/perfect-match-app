// Step1 screen 3/8 — Instagram (optional, matches Raya's dedicated screen).
import { StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

export default function Step1Instagram() {
  const router = useRouter();
  const { instagramHandle, setInstagramHandle } = useStep1();

  return (
    <QuestionScreen
      step={5}
      totalSteps={TOTAL_SCREENS}
      title="What's your Instagram?"
      subtitle="Optional — helps us confirm you're really you."
      onNext={() => router.push('/profile-setup/step1/birthdate')}>
      <TextInput
        style={styles.input}
        placeholder="@yourusername"
        placeholderTextColor="#AAAAAA"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        value={instagramHandle}
        onChangeText={setInstagramHandle}
      />
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.textPrimary,
  },
});
