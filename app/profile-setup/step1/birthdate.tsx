// Step1 screen 6/9 — birth date. Native spinner/wheel picker (matches the
// date picker already used elsewhere in the app — micro-intro.tsx) instead
// of typed DD/MM/YYYY boxes (user request, 2026-09-02).
import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { formatZodiacTooltip } from '@/lib/zodiac';
import { TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

function defaultBirthdate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

const MIN_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  return d;
})();

export default function Step1Birthdate() {
  const router = useRouter();
  const {
    setDobDay,
    setDobMonth,
    setDobYear,
    effectiveDob,
    zodiacInfo,
    ageYears,
  } = useStep1();

  const [draft, setDraft] = useState<Date>(effectiveDob ?? defaultBirthdate());
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const canProceed = effectiveDob !== null && ageYears !== null && ageYears >= 13 && ageYears <= 120;

  function commit(d: Date) {
    setDraft(d);
    setDobDay(String(d.getDate()));
    setDobMonth(String(d.getMonth() + 1));
    setDobYear(String(d.getFullYear()));
  }

  function onChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setAndroidPickerOpen(false);
      if (event.type === 'set' && selected) commit(selected);
      return;
    }
    if (selected) commit(selected);
  }

  return (
    <QuestionScreen
      step={6}
      totalSteps={TOTAL_SCREENS}
      title="When's your birthday?"
      onNext={() => router.push('/profile-setup/step1/location')}
      nextDisabled={!canProceed}>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          minimumDate={MIN_DATE}
          onChange={onChange}
        />
      ) : (
        <View>
          <TouchableOpacity
            style={styles.androidBtn}
            onPress={() => setAndroidPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Pick birth date">
            <ThemedText style={styles.androidBtnText}>
              {effectiveDob
                ? draft.toLocaleDateString()
                : 'Select your birth date'}
            </ThemedText>
          </TouchableOpacity>
          {androidPickerOpen ? (
            <DateTimePicker
              value={draft}
              mode="date"
              display="default"
              maximumDate={new Date()}
              minimumDate={MIN_DATE}
              onChange={onChange}
            />
          ) : null}
        </View>
      )}

      {zodiacInfo && ageYears !== null ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <ThemedText style={styles.zodiacLine}>
            {formatZodiacTooltip(zodiacInfo)} · Age {ageYears}
          </ThemedText>
        </Animated.View>
      ) : null}
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  androidBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  androidBtnText: {
    fontSize: 17,
    color: colors.textPrimary,
  },
  zodiacLine: {
    marginTop: 14,
    color: '#777777',
    fontSize: 14,
    fontWeight: '500',
  },
});
