// Step1 screen 2/8 — first + last name.
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

export default function Step1Name() {
  const router = useRouter();
  const { firstName, setFirstName, lastName, setLastName } = useStep1();
  const canProceed = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <QuestionScreen
      step={4}
      totalSteps={TOTAL_SCREENS}
      title="What's your name?"
      onNext={() => router.push('/profile-setup/step1/instagram')}
      nextDisabled={!canProceed}>
      <View style={styles.column}>
        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor="#AAAAAA"
          autoCapitalize="words"
          autoFocus
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor="#AAAAAA"
          autoCapitalize="words"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.textPrimary,
  },
});
