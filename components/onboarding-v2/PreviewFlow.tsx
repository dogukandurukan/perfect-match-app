// Connected onboarding V2 dev preview: Basics (1–6) → Compatibility (1–7) →
// Your Life (1–4) → Your World (1–6) → Your Dates (1–2) → Your Profile (1–8).
// Holds all in-memory drafts for this preview session only — Back/forward
// across the section boundary never resets answers; nothing is persisted,
// uploaded, sent anywhere or logged. Continue advances only when the answer is
// valid. Your Profile email/code and submission are SIMULATED (P07).
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, BackHandler, Keyboard, StyleSheet, Text, TouchableOpacity } from 'react-native';

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
import { ReceivedFields, SubmitFields } from '@/components/onboarding-v2/yourProfile/ApplicationFields';
import { CodeFields, EmailFields } from '@/components/onboarding-v2/yourProfile/EmailFields';
import { PhotosFields } from '@/components/onboarding-v2/yourProfile/PhotosFields';
import { ProfilePreview } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { PromptsFields } from '@/components/onboarding-v2/yourProfile/PromptsFields';
import {
  SelfieFields,
  captureSelfie,
  type SelfieError,
} from '@/components/onboarding-v2/yourProfile/SelfieFields';
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
import { obColors, obFonts } from '@/lib/onboardingV2/theme';
import { DATES_SCREENS, EMPTY_DATES_DRAFT, type DatesDraft } from '@/lib/onboardingV2/yourDates';
import { EMPTY_LIFE_DRAFT, LIFE_QUESTIONS, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import {
  EMPTY_PROFILE_DRAFT,
  PROFILE_SCREENS,
  PROFILE_STEP,
  buildProfilePreview,
  canSubmit,
  checklist,
  demoCodeMatches,
  emailChecked,
  emailLooksValid,
  normalizeEmail,
  type ProfileDraft,
} from '@/lib/onboardingV2/yourProfile';
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
  if (pos.section === 'yourProfile') return PROFILE_SCREENS[pos.step - 1].helper;
  if (pos.section !== 'compatibility') return undefined;
  return pos.step <= SINGLE_QUESTIONS.length ? SINGLE_QUESTIONS[pos.step - 1].helper : VALUES_HELPER;
}

function titleFor(pos: FlowPos): string {
  if (pos.section === 'basics') return BASICS_TITLES[pos.step];
  if (pos.section === 'yourLife') return LIFE_QUESTIONS[pos.step - 1].title;
  if (pos.section === 'yourWorld') return WORLD_SCREENS[pos.step - 1].title;
  if (pos.section === 'yourDates') return DATES_SCREENS[pos.step - 1].title;
  if (pos.section === 'yourProfile') return PROFILE_SCREENS[pos.step - 1].title;
  return pos.step <= SINGLE_QUESTIONS.length ? SINGLE_QUESTIONS[pos.step - 1].title : VALUES_TITLE;
}

const PREVIEW_POS: FlowPos = { section: 'yourProfile', step: PROFILE_STEP.preview };
const RECEIVED_POS: FlowPos = { section: 'yourProfile', step: PROFILE_STEP.received };

const samePos = (a: FlowPos | null, b: FlowPos) => !!a && a.section === b.section && a.step === b.step;

type Props = {
  /** Called when Back is pressed on Basics step 1. Omit to hide it there. */
  onExit?: () => void;
};

type Action = { label: string; onPress: () => void; disabled?: boolean };

export function PreviewFlow({ onExit }: Props) {
  const [pos, setPos] = useState<FlowPos>(FIRST_POS);
  const [basics, setBasics] = useState<BasicsDraft>(EMPTY_BASICS_DRAFT);
  const [compat, setCompat] = useState<CompatDraft>(EMPTY_COMPAT_DRAFT);
  const [life, setLife] = useState<LifeDraft>(EMPTY_LIFE_DRAFT);
  const [world, setWorld] = useState<WorldDraft>(EMPTY_WORLD_DRAFT);
  const [dates, setDates] = useState<DatesDraft>(EMPTY_DATES_DRAFT);
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
  // Editing from the profile preview: where "Back to preview" returns to.
  const [returnTo, setReturnTo] = useState<FlowPos | null>(null);
  // Preview opened from "You're on the list" (read-only review).
  const [reviewing, setReviewing] = useState(false);
  const [selfieCandidate, setSelfieCandidate] = useState<string | null>(null);
  const [selfieError, setSelfieError] = useState<SelfieError | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const patcher =
    <T,>(set: Dispatch<SetStateAction<T>>) =>
    (patch: Partial<T>) =>
      set((d) => ({ ...d, ...patch }));
  const updateBasics = patcher(setBasics);
  const updateCompat = patcher(setCompat);
  const updateLife = patcher(setLife);
  const updateWorld = patcher(setWorld);
  const updateDates = patcher(setDates);
  const updateProfile = (patch: Partial<ProfileDraft>) => {
    if ('code' in patch) setCodeError(null);
    setProfile((d) => ({ ...d, ...patch }));
  };

  const valid = isPosValid(pos, basics, compat, life, world, dates, profile);

  const goTo = (next: FlowPos) => {
    Keyboard.dismiss();
    setSelfieCandidate(null);
    setSelfieError(null);
    setCodeError(null);
    if (samePos(returnTo, next)) setReturnTo(null);
    if (samePos(RECEIVED_POS, next)) setReviewing(false);
    setPos(next);
  };

  const handleContinue = () => {
    if (!valid) return;
    const next = nextPos(pos);
    if (next) goTo(next);
  };

  const inProfile = pos.section === 'yourProfile';
  const step = pos.step;

  // Back: never out of "received"; review mode returns to it.
  const backTarget: FlowPos | null =
    inProfile && step === PROFILE_STEP.received
      ? null
      : inProfile && step === PROFILE_STEP.preview && reviewing
        ? RECEIVED_POS
        : prevPos(pos);
  const handleBack = backTarget
    ? () => goTo(backTarget)
    : inProfile && step === PROFILE_STEP.received
      ? undefined
      : onExit;

  // Android hardware back mirrors the header back within the flow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backTarget) {
        goTo(backTarget);
        return true;
      }
      return inProfile && step === PROFILE_STEP.received;
    });
    return () => sub.remove();
  });

  // ─── Your Profile actions ────────────────────────────────────────────────
  const openEditMenu = () => {
    const edit = (to: FlowPos) => () => {
      setReturnTo(PREVIEW_POS);
      goTo(to);
    };
    Alert.alert('Edit profile', 'Your answers are kept. Use "Back to preview" when you are done.', [
      { text: 'Photos', onPress: edit({ section: 'yourProfile', step: PROFILE_STEP.photos }) },
      { text: 'Answers', onPress: edit({ section: 'yourProfile', step: PROFILE_STEP.prompts }) },
      { text: 'Name, age, location, height', onPress: edit({ section: 'basics', step: 1 }) },
      { text: 'Work, school, interests, favorites', onPress: edit({ section: 'yourWorld', step: 1 }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takeSelfie = async () => {
    if (capturing) return;
    setCapturing(true);
    setSelfieError(null);
    const r = await captureSelfie();
    setCapturing(false);
    if (!r) return; // cancelled: keep whatever was there
    if ('error' in r) return setSelfieError(r.error);
    setSelfieCandidate(r.uri);
  };

  const sendCode = () => {
    if (!emailLooksValid(profile.email)) return;
    const email = normalizeEmail(profile.email);
    // Already checked for this exact email: nothing to resend.
    if (!emailChecked(profile.email, profile.emailCheck)) {
      updateProfile({ codeSentTo: email, codeSentAt: Date.now(), code: '' });
    }
    goTo({ section: 'yourProfile', step: PROFILE_STEP.code });
  };

  const verifyCode = () => {
    if (profile.code.length < 6) return setCodeError('Enter the 6-digit code.');
    if (!demoCodeMatches(profile.code)) return setCodeError("That code isn't right. Try again.");
    updateProfile({ emailCheck: { email: normalizeEmail(profile.email) } });
    goTo({ section: 'yourProfile', step: PROFILE_STEP.submit });
  };

  const submit = () => {
    if (submittingRef.current || !canSubmit(profile)) return;
    submittingRef.current = true;
    updateProfile({ applicationPreview: { receivedAt: Date.now() } });
    goTo(RECEIVED_POS);
    setTimeout(() => {
      submittingRef.current = false;
    }, 800);
  };

  let primary: Action & { variant?: 'solid' | 'outline' } = {
    label: pos.section === 'yourDates' && step === 2 ? 'Continue to your profile' : 'Continue',
    onPress: handleContinue,
    disabled: !valid,
  };
  let secondary: Action | null = null;

  if (inProfile) {
    const S = PROFILE_STEP;
    if (step === S.prompts) primary = { label: 'Preview my profile', onPress: handleContinue, disabled: !valid };
    if (step === S.preview) {
      primary = reviewing
        ? { label: 'Back to status', onPress: () => goTo(RECEIVED_POS), disabled: !valid }
        : { label: 'Continue', onPress: handleContinue, disabled: !valid };
      secondary = { label: 'Edit profile', onPress: openEditMenu };
    }
    if (step === S.selfie) {
      if (selfieCandidate) {
        primary = {
          label: 'Use selfie',
          onPress: () => {
            updateProfile({ selfie: { uri: selfieCandidate } });
            setSelfieCandidate(null);
          },
        };
        secondary = { label: 'Retake', onPress: () => void takeSelfie(), disabled: capturing };
      } else if (profile.selfie) {
        secondary = { label: 'Retake', onPress: () => void takeSelfie(), disabled: capturing };
      } else {
        primary = { label: 'Take selfie', onPress: () => void takeSelfie(), disabled: capturing };
      }
    }
    if (step === S.email) primary = { label: 'Send code', onPress: sendCode, disabled: !valid };
    if (step === S.code && !valid) primary = { label: 'Verify email', onPress: verifyCode };
    if (step === S.submit) {
      primary = profile.applicationPreview
        ? { label: 'Back to status', onPress: () => goTo(RECEIVED_POS) }
        : { label: 'Submit application', onPress: submit, disabled: !valid };
    }
    if (step === S.received) {
      primary = {
        label: 'Review my profile',
        variant: 'outline',
        onPress: () => {
          setReviewing(true);
          goTo(PREVIEW_POS);
        },
      };
    }
  }
  if (returnTo && !samePos(returnTo, pos) && !secondary) {
    secondary = { label: 'Back to preview', onPress: () => goTo(returnTo), disabled: !valid };
  }

  const dob = parseDob(basics.dobDay, basics.dobMonth, basics.dobYear);
  const dobError = dob.ok ? null : dobErrorMessage(dob.reason);
  const section = sectionOf(pos);
  const bProps = { draft: basics, update: updateBasics, onSubmit: handleContinue };
  const cProps = { draft: compat, update: updateCompat };
  const lifeQuestion = pos.section === 'yourLife' ? LIFE_QUESTIONS[step - 1] : null;
  const wProps = { draft: world, update: updateWorld };
  const inWorld = pos.section === 'yourWorld';
  const dProps = { draft: dates, update: updateDates };
  const inDates = pos.section === 'yourDates';
  const pProps = { draft: profile, update: updateProfile };
  // "Add later" advances like Continue: it keeps valid selections already
  // made; any uncommitted search text is dropped with the screen.
  const canSkip = inWorld && isWorldStepSkippable(step);

  return (
    <OnboardingScreen
      sectionLabel={section.label}
      step={step}
      totalSteps={section.steps}
      title={titleFor(pos)}
      helper={helperFor(pos)}
      compactTitle={pos.section !== 'basics'}
      onBack={handleBack}
      contentKey={`${pos.section}-${step}`}
      footer={
        <>
          <OnboardingPrimaryButton
            label={primary.label}
            onPress={primary.onPress}
            disabled={primary.disabled}
            variant={primary.variant}
          />
          {secondary ? (
            <TouchableOpacity
              onPress={secondary.onPress}
              disabled={secondary.disabled}
              accessibilityRole="button"
              accessibilityLabel={secondary.label}
              accessibilityState={{ disabled: !!secondary.disabled }}
              hitSlop={8}
              style={styles.secondary}>
              <Text style={[styles.secondaryText, secondary.disabled && styles.secondaryDisabled]}>
                {secondary.label}
              </Text>
            </TouchableOpacity>
          ) : canSkip ? (
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
      }>
      {pos.section === 'basics' && step === 1 && <NameFields {...bProps} />}
      {pos.section === 'basics' && step === 2 && <BirthdayFields {...bProps} error={dobError} />}
      {pos.section === 'basics' && step === 3 && <GenderFields {...bProps} />}
      {pos.section === 'basics' && step === 4 && <InterestedInFields {...bProps} />}
      {pos.section === 'basics' && step === 5 && <LocationFields {...bProps} />}
      {pos.section === 'basics' && step === 6 && <HeightFields {...bProps} />}
      {pos.section === 'compatibility' && step <= SINGLE_QUESTIONS.length && (
        <SingleChoiceFields question={SINGLE_QUESTIONS[step - 1]} {...cProps} />
      )}
      {pos.section === 'compatibility' && step === SINGLE_QUESTIONS.length + 1 && (
        <ValuesFields {...cProps} />
      )}
      {lifeQuestion && <LifeQuestionFields question={lifeQuestion} draft={life} update={updateLife} />}
      {inWorld && step === 1 && <WorkFields {...wProps} />}
      {inWorld && step === 2 && <SchoolFields {...wProps} />}
      {inWorld && step === 3 && <HometownFields {...wProps} />}
      {inWorld && step === 4 && <InterestsFields {...wProps} />}
      {inWorld && step === 5 && <ArtistsFields {...wProps} />}
      {inWorld && step === 6 && <MediaFields {...wProps} />}
      {inDates && step === 1 && <DateTypesFields {...dProps} />}
      {inDates && step === 2 && <DaysTimeFields {...dProps} />}
      {inProfile && step === PROFILE_STEP.photos && <PhotosFields {...pProps} />}
      {inProfile && step === PROFILE_STEP.prompts && <PromptsFields {...pProps} />}
      {inProfile && step === PROFILE_STEP.preview && (
        <ProfilePreview blocks={buildProfilePreview(basics, world, profile)} />
      )}
      {inProfile && step === PROFILE_STEP.selfie && (
        <SelfieFields
          selfieUri={profile.selfie?.uri ?? null}
          candidateUri={selfieCandidate}
          error={selfieError}
        />
      )}
      {inProfile && step === PROFILE_STEP.email && <EmailFields {...pProps} onSubmit={sendCode} />}
      {inProfile && step === PROFILE_STEP.code && (
        <CodeFields
          {...pProps}
          error={codeError}
          onResend={() => updateProfile({ codeSentAt: Date.now(), code: '' })}
          onChangeEmail={() => {
            // Changing the email drops the demo code and demo check.
            updateProfile({ codeSentTo: null, codeSentAt: null, code: '', emailCheck: null });
            goTo({ section: 'yourProfile', step: PROFILE_STEP.email });
          }}
        />
      )}
      {inProfile && step === PROFILE_STEP.submit && <SubmitFields list={checklist(profile)} />}
      {inProfile && step === PROFILE_STEP.received && <ReceivedFields />}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
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
  secondaryDisabled: {
    color: obColors.textSecondary,
  },
});
