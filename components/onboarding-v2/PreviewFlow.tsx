// Connected onboarding V2 dev preview: Basics (1–6) → Compatibility (1–7).
// Holds both in-memory drafts for this preview session only — Back/forward
// across the section boundary never resets answers; nothing is persisted,
// sent anywhere or logged. Continue advances only when the answer is valid.
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  BirthdayFields,
  GenderFields,
  HeightFields,
  InterestedInFields,
  LocationFields,
  NameFields,
} from '@/components/onboarding-v2/basics/BasicsFields';
import {
  SingleChoiceFields,
  ValuesFields,
} from '@/components/onboarding-v2/compatibility/CompatibilityFields';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import {
  EMPTY_BASICS_DRAFT,
  dobErrorMessage,
  parseDob,
  type BasicsDraft,
} from '@/lib/onboardingV2/basics';
import {
  EMPTY_COMPAT_DRAFT,
  SINGLE_QUESTIONS,
  VALUES_TITLE,
  type CompatDraft,
} from '@/lib/onboardingV2/compatibility';
import {
  FIRST_POS,
  isPosValid,
  nextPos,
  prevPos,
  sectionOf,
  type FlowPos,
} from '@/lib/onboardingV2/previewFlow';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const BASICS_TITLES: Record<number, string> = {
  1: "What's your name?",
  2: "When's your birthday?",
  3: "What's your gender?",
  4: 'Who are you interested in?',
  5: 'Where do you live?',
  6: 'How tall are you?',
};

function titleFor(pos: FlowPos): string {
  if (pos.section === 'basics') return BASICS_TITLES[pos.step];
  return pos.step <= SINGLE_QUESTIONS.length ? SINGLE_QUESTIONS[pos.step - 1].title : VALUES_TITLE;
}

type Props = {
  /** Called when Back is pressed on Basics step 1. Omit to hide it there. */
  onExit?: () => void;
};

export function PreviewFlow({ onExit }: Props) {
  const [pos, setPos] = useState<FlowPos>(FIRST_POS);
  const [basics, setBasics] = useState<BasicsDraft>(EMPTY_BASICS_DRAFT);
  const [compat, setCompat] = useState<CompatDraft>(EMPTY_COMPAT_DRAFT);
  const [finished, setFinished] = useState(false);

  const updateBasics = (patch: Partial<BasicsDraft>) => {
    setBasics((d) => ({ ...d, ...patch }));
    setFinished(false);
  };
  const updateCompat = (patch: Partial<CompatDraft>) => {
    setCompat((d) => ({ ...d, ...patch }));
    setFinished(false);
  };

  const valid = isPosValid(pos, basics, compat);

  const goTo = (next: FlowPos) => {
    Keyboard.dismiss();
    setFinished(false);
    setPos(next);
  };

  const handleContinue = () => {
    if (!valid) return;
    const next = nextPos(pos);
    if (next) goTo(next);
    else {
      Keyboard.dismiss();
      setFinished(true);
    }
  };

  const prev = prevPos(pos);
  const handleBack = prev ? () => goTo(prev) : onExit;

  // Android hardware back mirrors the header back within the flow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const p = prevPos(pos);
      if (p) {
        goTo(p);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pos]);

  const dob = parseDob(basics.dobDay, basics.dobMonth, basics.dobYear);
  const dobError = dob.ok ? null : dobErrorMessage(dob.reason);
  const section = sectionOf(pos);
  const bProps = { draft: basics, update: updateBasics, onSubmit: handleContinue };
  const cProps = { draft: compat, update: updateCompat };

  return (
    <OnboardingScreen
      sectionLabel={section.label}
      step={pos.step}
      totalSteps={section.steps}
      title={titleFor(pos)}
      onBack={handleBack}
      contentKey={`${pos.section}-${pos.step}`}
      footer={
        finished ? (
          <>
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeTitle}>Compatibility preview complete</Text>
              <Text style={styles.noticeText}>
                This is a development preview — nothing was saved. The next section isn&apos;t built
                yet.
              </Text>
            </View>
            <OnboardingPrimaryButton
              label="Review Compatibility"
              onPress={() => goTo({ section: 'compatibility', step: 1 })}
            />
            <TouchableOpacity
              onPress={() => goTo(FIRST_POS)}
              accessibilityRole="button"
              accessibilityLabel="Review from Basics"
              hitSlop={8}
              style={styles.secondary}>
              <Text style={styles.secondaryText}>Review from Basics</Text>
            </TouchableOpacity>
          </>
        ) : (
          <OnboardingPrimaryButton label="Continue" onPress={handleContinue} disabled={!valid} />
        )
      }>
      {pos.section === 'basics' && pos.step === 1 && <NameFields {...bProps} />}
      {pos.section === 'basics' && pos.step === 2 && <BirthdayFields {...bProps} error={dobError} />}
      {pos.section === 'basics' && pos.step === 3 && <GenderFields {...bProps} />}
      {pos.section === 'basics' && pos.step === 4 && <InterestedInFields {...bProps} />}
      {pos.section === 'basics' && pos.step === 5 && <LocationFields {...bProps} />}
      {pos.section === 'basics' && pos.step === 6 && <HeightFields {...bProps} />}
      {pos.section === 'compatibility' && pos.step <= SINGLE_QUESTIONS.length && (
        <SingleChoiceFields question={SINGLE_QUESTIONS[pos.step - 1]} {...cProps} />
      )}
      {pos.section === 'compatibility' && pos.step === SINGLE_QUESTIONS.length + 1 && (
        <ValuesFields {...cProps} />
      )}
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
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.cta,
    textDecorationLine: 'underline',
  },
});
