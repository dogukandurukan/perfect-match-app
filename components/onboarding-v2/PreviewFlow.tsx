// Connected onboarding V2 dev preview: Basics (1–6) → Compatibility (1–7) →
// Your Life (1–4) → Your World (1–6) → Your Dates (1–2). Holds all in-memory
// drafts for this preview session only — Back/forward
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
import { DateTypesFields, DaysTimeFields } from '@/components/onboarding-v2/yourDates/YourDatesFields';
import { LifeQuestionFields } from '@/components/onboarding-v2/yourLife/YourLifeFields';
import {
  ArtistsFields,
  HometownFields,
  InterestsFields,
  MediaFields,
  SchoolFields,
  WorkFields,
} from '@/components/onboarding-v2/yourWorld/YourWorldFields';
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
  VALUES_HELPER,
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
import { DATES_SCREENS, EMPTY_DATES_DRAFT, type DatesDraft } from '@/lib/onboardingV2/yourDates';
import { EMPTY_LIFE_DRAFT, LIFE_QUESTIONS, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import {
  EMPTY_WORLD_DRAFT,
  WORLD_SCREENS,
  isWorldStepSkippable,
  type WorldDraft,
} from '@/lib/onboardingV2/yourWorld';

const BASICS_TITLES: Record<number, string> = {
  1: "What's your name?",
  2: "When's your birthday?",
  3: "What's your gender?",
  4: 'Who are you interested in?',
  5: 'Where do you live?',
  6: 'How tall are you?',
};

function helperFor(pos: FlowPos): string | undefined {
  if (pos.section === 'yourLife') return LIFE_QUESTIONS[pos.step - 1].helper;
  if (pos.section === 'yourWorld') return WORLD_SCREENS[pos.step - 1].helper;
  if (pos.section === 'yourDates') return DATES_SCREENS[pos.step - 1].helper;
  if (pos.section !== 'compatibility') return undefined;
  return pos.step <= SINGLE_QUESTIONS.length ? SINGLE_QUESTIONS[pos.step - 1].helper : VALUES_HELPER;
}

function titleFor(pos: FlowPos): string {
  if (pos.section === 'basics') return BASICS_TITLES[pos.step];
  if (pos.section === 'yourLife') return LIFE_QUESTIONS[pos.step - 1].title;
  if (pos.section === 'yourWorld') return WORLD_SCREENS[pos.step - 1].title;
  if (pos.section === 'yourDates') return DATES_SCREENS[pos.step - 1].title;
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
  const [life, setLife] = useState<LifeDraft>(EMPTY_LIFE_DRAFT);
  const [world, setWorld] = useState<WorldDraft>(EMPTY_WORLD_DRAFT);
  const [dates, setDates] = useState<DatesDraft>(EMPTY_DATES_DRAFT);
  const [finished, setFinished] = useState(false);

  const updateBasics = (patch: Partial<BasicsDraft>) => {
    setBasics((d) => ({ ...d, ...patch }));
    setFinished(false);
  };
  const updateCompat = (patch: Partial<CompatDraft>) => {
    setCompat((d) => ({ ...d, ...patch }));
    setFinished(false);
  };
  const updateLife = (patch: Partial<LifeDraft>) => {
    setLife((d) => ({ ...d, ...patch }));
    setFinished(false);
  };
  const updateWorld = (patch: Partial<WorldDraft>) => {
    setWorld((d) => ({ ...d, ...patch }));
    setFinished(false);
  };
  const updateDates = (patch: Partial<DatesDraft>) => {
    setDates((d) => ({ ...d, ...patch }));
    setFinished(false);
  };

  const valid = isPosValid(pos, basics, compat, life, world, dates);

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
  const lifeQuestion = pos.section === 'yourLife' ? LIFE_QUESTIONS[pos.step - 1] : null;
  const wProps = { draft: world, update: updateWorld };
  const inWorld = pos.section === 'yourWorld';
  const dProps = { draft: dates, update: updateDates };
  const inDates = pos.section === 'yourDates';
  const continueLabel = inDates && pos.step === 2 ? 'Continue to your profile' : 'Continue';
  // "Add later" advances like Continue: it keeps valid selections already
  // made; any uncommitted search text is dropped with the screen.
  const canSkip = inWorld && isWorldStepSkippable(pos.step);

  return (
    <OnboardingScreen
      sectionLabel={section.label}
      step={pos.step}
      totalSteps={section.steps}
      title={titleFor(pos)}
      helper={helperFor(pos)}
      compactTitle={pos.section !== 'basics'}
      onBack={handleBack}
      contentKey={`${pos.section}-${pos.step}`}
      footer={
        finished ? (
          <>
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeTitle}>Your Dates preview complete</Text>
              <Text style={styles.noticeText}>
                This is a development preview — nothing was saved. The next section isn&apos;t built
                yet.
              </Text>
            </View>
            <OnboardingPrimaryButton
              label="Review Your Dates"
              onPress={() => goTo({ section: 'yourDates', step: 1 })}
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
          <>
            <OnboardingPrimaryButton label={continueLabel} onPress={handleContinue} disabled={!valid} />
            {canSkip ? (
              <TouchableOpacity
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel="Add later"
                hitSlop={8}
                style={styles.secondary}>
                <Text style={styles.secondaryText}>Add later</Text>
              </TouchableOpacity>
            ) : null}
          </>
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
      {lifeQuestion && <LifeQuestionFields question={lifeQuestion} draft={life} update={updateLife} />}
      {inWorld && pos.step === 1 && <WorkFields {...wProps} />}
      {inWorld && pos.step === 2 && <SchoolFields {...wProps} />}
      {inWorld && pos.step === 3 && <HometownFields {...wProps} />}
      {inWorld && pos.step === 4 && <InterestsFields {...wProps} />}
      {inWorld && pos.step === 5 && <ArtistsFields {...wProps} />}
      {inWorld && pos.step === 6 && <MediaFields {...wProps} />}
      {inDates && pos.step === 1 && <DateTypesFields {...dProps} />}
      {inDates && pos.step === 2 && <DaysTimeFields {...dProps} />}
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
