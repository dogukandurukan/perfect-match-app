// Section 2 — "What's your name?" (P01). Presentational + local state only:
// no backend writes, no persistence. The caller decides what Continue does.
// No extra name-length/identity rules; accents and non-Latin scripts are kept
// as typed (autoCorrect/autoCapitalize only assist, never rewrite).
import { useRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';

export const BASICS_TOTAL_STEPS = 6;

type Props = {
  firstName: string;
  lastName: string;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  /** Optional content above the Continue button (e.g. a preview notice). */
  footerNotice?: ReactNode;
};

export function NameStep({
  firstName,
  lastName,
  onChangeFirstName,
  onChangeLastName,
  onContinue,
  onBack,
  footerNotice,
}: Props) {
  const lastNameRef = useRef<TextInput>(null);
  // Both names are part of the existing Basics contract (D12); required =
  // non-blank. No other rules are added here.
  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <OnboardingScreen
      step={1}
      totalSteps={BASICS_TOTAL_STEPS}
      title="What's your name?"
      onBack={onBack}
      footer={
        <>
          {footerNotice}
          <OnboardingPrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} />
        </>
      }>
      <OnboardingTextField
        label="First name"
        value={firstName}
        onChangeText={onChangeFirstName}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
        blurOnSubmit={false}
      />
      <View style={styles.lastNameGroup}>
        <OnboardingTextField
          ref={lastNameRef}
          label="Last name"
          value={lastName}
          onChangeText={onChangeLastName}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canContinue) onContinue();
          }}
        />
        <Text style={styles.helper} maxFontSizeMultiplier={1.6}>
          Only your first name appears on your profile.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  // Helper sits close under Last name; field-to-field spacing stays generous.
  lastNameGroup: {
    gap: 10,
  },
  helper: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
