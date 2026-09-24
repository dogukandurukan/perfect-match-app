// Section 2 Basics — connected six-step flow (P02). Holds the in-memory draft
// for this preview session only: Back restores answers, nothing is persisted
// or sent anywhere. Continue advances only when the current answer is valid.
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, Text, View } from 'react-native';

import {
  BirthdayFields,
  GenderFields,
  HeightFields,
  InterestedInFields,
  LocationFields,
  NameFields,
} from '@/components/onboarding-v2/basics/BasicsFields';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import {
  BASICS_TOTAL_STEPS,
  EMPTY_BASICS_DRAFT,
  dobErrorMessage,
  isStepValid,
  parseDob,
  type BasicsDraft,
} from '@/lib/onboardingV2/basics';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const TITLES: Record<number, string> = {
  1: "What's your name?",
  2: "When's your birthday?",
  3: "What's your gender?",
  4: 'Who are you interested in?',
  5: 'Where do you live?',
  6: 'How tall are you?',
};

type Props = {
  /** Called when Back is pressed on step 1 (leave the flow). Omit to hide it. */
  onExit?: () => void;
};

export function BasicsFlow({ onExit }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BasicsDraft>(EMPTY_BASICS_DRAFT);
  const [finished, setFinished] = useState(false);

  const update = (patch: Partial<BasicsDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setFinished(false);
  };

  const valid = isStepValid(step, draft);

  const goTo = (next: number) => {
    Keyboard.dismiss();
    setFinished(false);
    setStep(next);
  };

  const handleContinue = () => {
    if (!valid) return;
    if (step < BASICS_TOTAL_STEPS) goTo(step + 1);
    else {
      Keyboard.dismiss();
      setFinished(true);
    }
  };

  const handleBack = step > 1 ? () => goTo(step - 1) : onExit;

  // Android hardware back mirrors the header back within the flow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) {
        goTo(step - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const dob = parseDob(draft.dobDay, draft.dobMonth, draft.dobYear);
  const dobError = dob.ok ? null : dobErrorMessage(dob.reason);

  const fieldProps = { draft, update, onSubmit: handleContinue };

  return (
    <OnboardingScreen
      step={step}
      totalSteps={BASICS_TOTAL_STEPS}
      title={TITLES[step]}
      onBack={handleBack}
      contentKey={step}
      footer={
        finished ? (
          <>
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeTitle}>Basics preview complete</Text>
              <Text style={styles.noticeText}>
                This is a preview — nothing was saved. The next section isn&apos;t built yet.
              </Text>
            </View>
            <OnboardingPrimaryButton label="Review previous steps" onPress={() => goTo(1)} />
          </>
        ) : (
          <OnboardingPrimaryButton label="Continue" onPress={handleContinue} disabled={!valid} />
        )
      }>
      {step === 1 && <NameFields {...fieldProps} />}
      {step === 2 && <BirthdayFields {...fieldProps} error={dobError} />}
      {step === 3 && <GenderFields {...fieldProps} />}
      {step === 4 && <InterestedInFields {...fieldProps} />}
      {step === 5 && <LocationFields {...fieldProps} />}
      {step === 6 && <HeightFields {...fieldProps} />}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: obColors.notice,
    borderRadius: 12,
    padding: obSpacing.md,
    gap: obSpacing.xs,
  },
  noticeTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  noticeText: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
});
