// Step3 screen 8/9 — height. Next goes to pets (last screen). Optional,
// self-reported, NOT scored in get_top_matches — filter-only (Advanced
// filters, premium).
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep3 } from '@/lib/onboardingStep3Context';

export default function Step3Height() {
  const router = useRouter();
  const { heightCm, setHeightCm } = useStep3();

  return (
    <QuestionScreen
      step={8}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="How tall are you?"
      subtitle="Optional — in cm"
      onNext={() => router.push('/profile-setup/step3/pets' as never)}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="e.g. 175"
          placeholderTextColor="#AAAAAA"
          value={heightCm}
          onChangeText={(v) => setHeightCm(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
        />
        <ThemedText style={styles.unitSuffix}>cm</ThemedText>
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  inputWrap: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 16,
  },
  unitSuffix: {
    fontSize: 16,
    color: '#888888',
    width: 32,
  },
});
