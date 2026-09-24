// Section 2 Basics — per-step field content (P02). Presentational only; the
// draft lives in BasicsFlow. Unicode names/cities are kept exactly as typed.
import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import {
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  toggleInterestedIn,
  type BasicsDraft,
} from '@/lib/onboardingV2/basics';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type FieldProps = {
  draft: BasicsDraft;
  update: (patch: Partial<BasicsDraft>) => void;
  onSubmit: () => void;
};

export function Helper({ children }: { children: string }) {
  return (
    <Text style={styles.helper} maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
      {message}
    </Text>
  );
}

// 1 — What's your name?
export function NameFields({ draft, update, onSubmit }: FieldProps) {
  const lastNameRef = useRef<TextInput>(null);
  return (
    <>
      <OnboardingTextField
        label="First name"
        value={draft.firstName}
        onChangeText={(v) => update({ firstName: v })}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
        blurOnSubmit={false}
      />
      <View style={styles.group}>
        <OnboardingTextField
          ref={lastNameRef}
          label="Last name"
          value={draft.lastName}
          onChangeText={(v) => update({ lastName: v })}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
        <Helper>Only your first name appears on your profile.</Helper>
      </View>
    </>
  );
}

// 2 — When's your birthday? Separate, labelled Day / Month / Year fields:
// unambiguous order, nothing preselected.
export function BirthdayFields({
  draft,
  update,
  onSubmit,
  error,
}: FieldProps & { error: string | null }) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const digits = (v: string) => v.replace(/[^0-9]/g, '');
  return (
    <View style={styles.group}>
      <View style={styles.dobRow}>
        <OnboardingTextField
          label="Day"
          placeholder="DD"
          value={draft.dobDay}
          onChangeText={(v) => {
            const d = digits(v);
            update({ dobDay: d });
            if (d.length === 2) monthRef.current?.focus();
          }}
          keyboardType="number-pad"
          maxLength={2}
          textContentType="none"
          containerStyle={styles.dobShort}
        />
        <OnboardingTextField
          ref={monthRef}
          label="Month"
          placeholder="MM"
          value={draft.dobMonth}
          onChangeText={(v) => {
            const d = digits(v);
            update({ dobMonth: d });
            if (d.length === 2) yearRef.current?.focus();
          }}
          keyboardType="number-pad"
          maxLength={2}
          textContentType="none"
          containerStyle={styles.dobShort}
        />
        <OnboardingTextField
          ref={yearRef}
          label="Year"
          placeholder="YYYY"
          value={draft.dobYear}
          onChangeText={(v) => update({ dobYear: digits(v) })}
          keyboardType="number-pad"
          maxLength={4}
          textContentType="none"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          containerStyle={styles.dobYear}
        />
      </View>
      <FieldError message={error} />
      <Helper>Only your age appears on your profile.</Helper>
    </View>
  );
}

// 3 — What's your gender? Single choice, no default.
export function GenderFields({ draft, update }: FieldProps) {
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {GENDER_OPTIONS.map((o) => (
        <OnboardingOptionCard
          key={o.key}
          label={o.label}
          mode="single"
          selected={draft.gender === o.key}
          onPress={() => update({ gender: o.key })}
        />
      ))}
    </View>
  );
}

// 4 — Who are you interested in? Multi-select; Everyone is exclusive.
export function InterestedInFields({ draft, update }: FieldProps) {
  return (
    <View style={styles.options}>
      {INTERESTED_IN_OPTIONS.map((o) => (
        <OnboardingOptionCard
          key={o.key}
          label={o.label}
          mode="multi"
          selected={draft.interestedIn.includes(o.key)}
          onPress={() => update({ interestedIn: toggleInterestedIn(draft.interestedIn, o.key) })}
        />
      ))}
    </View>
  );
}

// 5 — Where do you live? Manual current city only (no GPS/lookup in preview).
export function LocationFields({ draft, update, onSubmit }: FieldProps) {
  return (
    <OnboardingTextField
      label="City"
      value={draft.city}
      onChangeText={(v) => update({ city: v })}
      autoCapitalize="words"
      autoCorrect={false}
      autoComplete="off"
      textContentType="addressCity"
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
  );
}

// 6 — How tall are you? Whole centimetres, visible unit.
export function HeightFields({ draft, update, onSubmit }: FieldProps) {
  return (
    <OnboardingTextField
      label="Height"
      suffix="cm"
      value={draft.heightCm}
      onChangeText={(v) => update({ heightCm: v.replace(/[^0-9]/g, '') })}
      keyboardType="number-pad"
      maxLength={3}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      containerStyle={styles.height}
    />
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  options: {
    gap: obSpacing.md,
  },
  dobRow: {
    flexDirection: 'row',
    gap: obSpacing.lg,
  },
  dobShort: {
    flex: 2,
    minWidth: 56,
  },
  dobYear: {
    flex: 3,
    minWidth: 80,
  },
  height: {
    maxWidth: 200,
  },
  helper: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  error: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.error,
  },
});
