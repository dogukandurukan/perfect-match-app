// Section 2 Basics — per-step field content (P02). Presentational only; the
// draft lives in BasicsFlow. Unicode names/cities are kept exactly as typed.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { HeightRuler } from '@/components/onboarding-v2/basics/HeightRuler';
import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import {
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  editLocationQuery,
  selectLocation,
  toggleInterestedIn,
  type BasicsDraft,
} from '@/lib/onboardingV2/basics';
import {
  PREVIEW_COVERAGE_CITIES,
  searchLocations,
  type LocationResult,
} from '@/lib/onboardingV2/locationCatalog';
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

// 5 — Where do you live? (D49) Type → pick a real city or district from the
// suggestions below. Continue needs an actual selection; editing the text
// clears it. No GPS, address, neighborhood or distance here.
export function LocationFields({ draft, update }: FieldProps) {
  // Results are tagged with the query they answer, so a stale or pending
  // lookup never flashes "no matches" for the current text.
  const [found, setFound] = useState<{ q: string; results: LocationResult[] }>({ q: '', results: [] });
  const requestId = useRef(0);
  const query = draft.locationQuery;
  const selected = draft.location;
  const showResults = !selected && query.trim().length > 0;

  useEffect(() => {
    if (!showResults) return;
    const id = ++requestId.current;
    void searchLocations(query).then((r) => {
      if (id === requestId.current) setFound({ q: query, results: r });
    });
  }, [query, showResults]);

  const results = found.q === query ? found.results : [];
  const answered = found.q === query;

  return (
    <View style={styles.group}>
      <OnboardingTextField
        label="City or district"
        value={query}
        onChangeText={(v) => update(editLocationQuery(draft, v))}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        returnKeyType="search"
        suffix={selected ? '✓' : undefined}
      />
      {showResults ? (
        results.length > 0 ? (
          <View style={styles.results} accessibilityRole="list">
            {results.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => {
                  update(selectLocation(draft, r));
                  Keyboard.dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                style={styles.resultRow}>
                <Ionicons name="location-outline" size={18} color={obColors.textSecondary} />
                <Text style={styles.resultText} maxFontSizeMultiplier={1.6}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : answered ? (
          <Text style={styles.noResults} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
            No matching city or district in this preview.
          </Text>
        ) : null
      ) : null}
      <Helper>{`Preview search covers ${PREVIEW_COVERAGE_CITIES.join(', ')} and their districts only.`}</Helper>
    </View>
  );
}

// 6 — How tall are you? (D48) Large number + cm, tap to type, 1 cm ruler.
export function HeightFields({ draft, update }: FieldProps) {
  return <HeightRuler valueText={draft.heightCm} onChangeText={(v) => update({ heightCm: v })} />;
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
  results: {
    borderTopWidth: 1,
    borderTopColor: obColors.border,
  },
  resultRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    paddingVertical: obSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
  },
  resultText: {
    flex: 1,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  noResults: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textPrimary,
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
