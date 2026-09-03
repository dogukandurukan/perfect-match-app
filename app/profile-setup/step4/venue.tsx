// Step4 screen 3/6 — first-date venue preference. Each selected venue can
// reveal its own optional "favorite spot" follow-up text field.
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, VENUE_DEFS, useStep4 } from '@/lib/onboardingStep4Context';

export default function Step4Venue() {
  const router = useRouter();
  const { meetingEnvironment, toggleVenue, favoriteSpots, setSpot } = useStep4();

  return (
    <QuestionScreen
      step={3}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="What kind of first date sounds fun to you?"
      onNext={() => router.push('/profile-setup/step4/neighborhoods' as never)}>
      <View style={styles.chipRow}>
        {VENUE_DEFS.map(({ label }) => (
          <Chip
            key={label}
            label={label}
            selected={meetingEnvironment.includes(label)}
            onPress={() => toggleVenue(label)}
            selectedColor="#1A1A1A"
          />
        ))}
      </View>
      {VENUE_DEFS.map(({ label, spotKey, placeholder }) =>
        meetingEnvironment.includes(label) ? (
          <OptionalFieldReveal key={spotKey} show animationKey={spotKey}>
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#AAAAAA"
              value={favoriteSpots[spotKey] ?? ''}
              onChangeText={(t) => setSpot(spotKey, t)}
            />
          </OptionalFieldReveal>
        ) : null,
      )}
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
    marginTop: 12,
  },
});
