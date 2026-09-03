// Step4 screen 6/6 — bio, last screen of the entire onboarding. "Complete
// Profile" triggers submitAll() (sets setup_completed=true, replace()s
// into the app).
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep4 } from '@/lib/onboardingStep4Context';

export default function Step4Bio() {
  const { bio, setBio, saving, submitAll } = useStep4();

  return (
    <QuestionScreen
      step={6}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="Anything you'd like people to know about you?"
      onNext={() => void submitAll()}
      nextLabel={saving ? 'Saving…' : 'Complete Profile'}
      nextLoading={saving}>
      <View style={styles.bioWrap}>
        <TextInput
          style={styles.input}
          placeholder="Write a short bio... (optional)"
          placeholderTextColor="#AAAAAA"
          multiline
          maxLength={300}
          value={bio}
          onChangeText={setBio}
        />
        <ThemedText style={[styles.charCount, bio.length >= 280 && styles.charCountWarn]}>
          {bio.length}/300
        </ThemedText>
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  bioWrap: { position: 'relative' },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    minHeight: 140,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    color: colors.textPrimary,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    color: '#AAAAAA',
    fontSize: 12,
  },
  charCountWarn: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
});
