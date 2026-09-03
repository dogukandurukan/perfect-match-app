// Step1 screen 7/8 — gender + who to meet (grouped, per user request — same
// real-world topic).
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { GENDER_CHIPS, TOTAL_SCREENS, useStep1, type MeetingPref } from '@/lib/onboardingStep1Context';

const MEETING_OPTIONS: MeetingPref[] = ['Men', 'Women', 'Non-binary', 'Everyone'];

export default function Step1Gender() {
  const router = useRouter();
  const { genderSelection, setGenderSelection, meetingPreferences, toggleMeetingPref } = useStep1();
  const canProceed = genderSelection !== null && meetingPreferences.length > 0;

  return (
    <QuestionScreen
      step={8}
      totalSteps={TOTAL_SCREENS}
      title="Who are you, and who are you looking for?"
      onNext={() => router.push('/profile-setup/step1/languages')}
      nextDisabled={!canProceed}>
      <View style={styles.block}>
        <ThemedText style={styles.label}>Which gender best describes you?</ThemedText>
        <View style={styles.chipRow}>
          {GENDER_CHIPS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={genderSelection === opt}
              onPress={() => setGenderSelection(opt)}
              selectedColor="#1A1A1A"
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <ThemedText style={styles.label}>Who would you like to meet?</ThemedText>
        <View style={styles.chipRow}>
          {MEETING_OPTIONS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={meetingPreferences.includes(opt)}
              onPress={() => toggleMeetingPref(opt)}
              selectedColor="#1A1A1A"
            />
          ))}
        </View>
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 28 },
  label: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
