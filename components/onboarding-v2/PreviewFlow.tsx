// Connected onboarding V2 dev preview: Basics (1–6) → Compatibility (1–7) →
// Your Life (1–4) → Your World (1–6) → Your Dates (1–2) → Your Profile (1–7).
// Holds all in-memory drafts for this preview session only — Back/forward
// across the section boundary never resets answers; nothing is persisted,
// uploaded, sent anywhere or logged. Continue advances only when the answer is
// valid. Your Profile email/code and submission are SIMULATED (P07).
//
// LIVE mode (`live` prop, V2 persistence): the same screens, but every
// Continue saves that section on the server first (and stays on the step
// with an error if it can't), photos/selfie are uploaded, the email is the
// one verified at sign-in (email steps skipped), and "You're on the list!"
// appears only after the server has recorded the application.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, AppState, BackHandler, Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
import { ReceivedFields } from '@/components/onboarding-v2/yourProfile/ApplicationFields';
import { EditProfileSheet, type EditRow } from '@/components/onboarding-v2/yourProfile/EditProfileSheet';
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
import {
  saveSection,
  savePrompts,
  submitApplication,
  syncPhotos,
  uploadSelfie,
} from '@/lib/onboardingV2/remote';
import {
  basicsToServer,
  compatToServer,
  datesToServer,
  dobToIso,
  firstMissingPos,
  lifeToServer,
  worldToServer,
} from '@/lib/onboardingV2/serverMapping';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { DATES_SCREENS, DATE_TYPES, EMPTY_DATES_DRAFT, datesSummary, type DatesDraft } from '@/lib/onboardingV2/yourDates';
import { EMPTY_LIFE_DRAFT, LIFE_QUESTIONS, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import {
  EMPTY_PROFILE_DRAFT,
  PROFILE_SCREENS,
  PROFILE_STEP,
  buildProfilePreview,
  demoCodeMatches,
  emailChecked,
  emailLooksValid,
  firstMissingStep,
  normalizeEmail,
  usablePhotos,
  type PhotoUpdater,
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

export type LiveOptions = {
  userId: string;
  /** The address verified at sign-in (email OTP). */
  email: string;
  initial: {
    pos: FlowPos;
    basics: BasicsDraft;
    compat: CompatDraft;
    life: LifeDraft;
    world: WorldDraft;
    dates: DatesDraft;
    profile: ProfileDraft;
    serverPhotoIds: string[];
  };
  /** Reviewer asked for changes: shown on open and on the submit screen. */
  review?: { note: string | null; items: string[] } | null;
};

type Props = {
  /** Called when Back is pressed on Basics step 1. Omit to hide it there. */
  onExit?: () => void;
  /** Live persistence (omit for the local DEV preview). */
  live?: LiveOptions;
};

function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-8${h().slice(1)}-${h()}${h()}${h()}`;
}

type Action = { label: string; onPress: () => void; disabled?: boolean };

export function PreviewFlow({ onExit, live }: Props) {
  const [pos, setPos] = useState<FlowPos>(live?.initial.pos ?? FIRST_POS);
  const [basics, setBasics] = useState<BasicsDraft>(live?.initial.basics ?? EMPTY_BASICS_DRAFT);
  const [compat, setCompat] = useState<CompatDraft>(live?.initial.compat ?? EMPTY_COMPAT_DRAFT);
  const [life, setLife] = useState<LifeDraft>(live?.initial.life ?? EMPTY_LIFE_DRAFT);
  const [world, setWorld] = useState<WorldDraft>(live?.initial.world ?? EMPTY_WORLD_DRAFT);
  const [dates, setDates] = useState<DatesDraft>(live?.initial.dates ?? EMPTY_DATES_DRAFT);
  const [profile, setProfile] = useState<ProfileDraft>(live?.initial.profile ?? EMPTY_PROFILE_DRAFT);
  // Live mode: save/submit progress, the last error, and the server's photo ids.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const serverPhotoIdsRef = useRef<string[]>(live?.initial.serverPhotoIds ?? []);
  // One id for this application, reused by every retry (idempotent submit).
  const requestIdRef = useRef<string>(newRequestId());

  // ─── Live photo auto-save ────────────────────────────────────────────────
  // Photos are saved as soon as they are picked (short debounce) and when the
  // app goes to the background — not only on Continue — so closing the app
  // right after picking loses at most the upload that was in flight. Tiles
  // without a server id are marked "Not saved yet" until then.
  const photosRef = useRef(profile.photos);
  photosRef.current = profile.photos;
  const registeredRef = useRef(new Map<string, { serverId: string; path: string }>());
  const photoSyncRef = useRef({ running: false, again: false });
  const photoSyncErrorRef = useRef(false);
  const [photoSync, setPhotoSync] = useState<{ status: string | null; error: boolean }>({ status: null, error: false });

  const runPhotoSync = useCallback(async (): Promise<boolean> => {
    if (!live) return true;
    const st = photoSyncRef.current;
    if (st.running) {
      st.again = true;
      while (st.running) await new Promise((r) => setTimeout(r, 50));
      return !photoSyncErrorRef.current;
    }
    st.running = true;
    let ok = true;
    do {
      st.again = false;
      // Merge synchronously-known registrations (state may not have re-rendered yet).
      const list = photosRef.current.map((ph) => {
        const reg = registeredRef.current.get(ph.id);
        return reg && !ph.serverId ? { ...ph, ...reg } : ph;
      });
      const listIds = list.map((ph) => ph.serverId).filter(Boolean).join();
      const upToDate = list.every((ph) => ph.serverId || ph.broken) && listIds === serverPhotoIdsRef.current.join();
      if (upToDate) break;
      setPhotoSync({ status: 'Saving photos…', error: false });
      const r = await syncPhotos(live.userId, list, serverPhotoIdsRef.current, (localId, serverId, path) => {
        registeredRef.current.set(localId, { serverId, path });
        setProfile((d) => ({ ...d, photos: d.photos.map((ph) => (ph.id === localId ? { ...ph, serverId, path } : ph)) }));
      });
      if (r.ok) serverPhotoIdsRef.current = r.value.serverIds;
      else {
        ok = false;
        setPhotoSync({ status: `${r.message} Photos marked "Not saved yet" are not stored.`, error: true });
        break;
      }
    } while (st.again);
    st.running = false;
    photoSyncErrorRef.current = !ok;
    if (ok) setPhotoSync({ status: photosRef.current.length ? 'All photos saved.' : null, error: false });
    return ok;
  }, [live]);
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => void runPhotoSync(), 800);
    return () => clearTimeout(t);
  }, [live, profile.photos, runPhotoSync]);

  useEffect(() => {
    if (!live) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void runPhotoSync();
    });
    return () => sub.remove();
  }, [live, runPhotoSync]);
  // Editing from the profile preview: where "Back to preview" returns to.
  const [returnTo, setReturnTo] = useState<FlowPos | null>(null);
  // Preview opened from "You're on the list" (read-only review).
  const [reviewing, setReviewing] = useState(false);
  const [selfieCandidate, setSelfieCandidate] = useState<string | null>(null);
  const [selfieError, setSelfieError] = useState<SelfieError | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Profile preview scroll position, restored when returning from an edit.
  const previewScrollRef = useRef(0);
  const [restorePreview, setRestorePreview] = useState(false);
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
    setSaveError(null);
    setSelfieCandidate(null);
    setSelfieError(null);
    setCodeError(null);
    setRestorePreview(samePos(returnTo, next) && samePos(next, PREVIEW_POS));
    if (samePos(returnTo, next)) setReturnTo(null);
    if (samePos(RECEIVED_POS, next)) setReviewing(false);
    setPos(next);
  };

  // Live mode skips the email + code screens' email entry: the address was
  // verified at sign-in, so Selfie → the confirmation/submit screen.
  const nextOf = (p: FlowPos): FlowPos | null => {
    const n = nextPos(p);
    if (live && n && n.section === 'yourProfile' && n.step === PROFILE_STEP.email) {
      return { section: 'yourProfile', step: PROFILE_STEP.code };
    }
    return n;
  };
  const prevOf = (p: FlowPos): FlowPos | null => {
    const b = prevPos(p);
    if (live && b && b.section === 'yourProfile' && b.step === PROFILE_STEP.email) {
      return { section: 'yourProfile', step: PROFILE_STEP.selfie };
    }
    return b;
  };

  /** Saves what the current step owns. Returns false (and shows why) on failure. */
  const persistStep = async (from: FlowPos, to: FlowPos | null): Promise<boolean> => {
    if (!live) return true;
    const resume = to ?? from;
    let r: { ok: boolean; message?: string } = { ok: true };
    if (from.section === 'basics') {
      const dobNow = parseDob(basics.dobDay, basics.dobMonth, basics.dobYear);
      r = await saveSection('basics', basicsToServer(basics, dobToIso(dobNow.ok ? dobNow.date : null)), resume);
    } else if (from.section === 'compatibility') {
      r = await saveSection('compatibility', compatToServer(compat), resume);
    } else if (from.section === 'yourLife') {
      r = await saveSection('yourLife', lifeToServer(life), resume);
    } else if (from.section === 'yourWorld') {
      r = await saveSection('yourWorld', worldToServer(world), resume);
    } else if (from.section === 'yourDates') {
      r = await saveSection('yourDates', datesToServer(dates), resume);
    } else if (from.step === PROFILE_STEP.photos) {
      const synced = await runPhotoSync();
      r = synced ? await saveSection('yourProfile', {}, resume) : { ok: false, message: 'Some photos are not saved yet. Try again.' };
    } else if (from.step === PROFILE_STEP.prompts) {
      r = await savePrompts(profile.prompts);
      if (r.ok) r = await saveSection('yourProfile', {}, resume);
    } else if (from.step === PROFILE_STEP.selfie && profile.selfie) {
      r = await uploadSelfie(live.userId, profile.selfie);
      if (r.ok) {
        setProfile((d) => (d.selfie ? { ...d, selfie: { ...d.selfie, uploaded: true } } : d));
        r = await saveSection('yourProfile', {}, resume);
      }
    } else {
      r = await saveSection('yourProfile', {}, resume);
    }
    if (!r.ok) setSaveError(r.message ?? 'Could not save. Try again.');
    return r.ok;
  };

  const handleContinue = async () => {
    if (!valid || saving) return;
    const next = nextOf(pos);
    if (live) {
      setSaving(true);
      setSaveError(null);
      const ok = await persistStep(pos, next);
      setSaving(false);
      if (!ok) return;
    }
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
        : prevOf(pos);
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
  const openEditMenu = () => setEditOpen(true);
  const editTo = (to: FlowPos) => () => {
    setEditOpen(false);
    setReturnTo(PREVIEW_POS);
    goTo(to);
  };
  // Descriptions come from the real draft (counts, chosen answers).
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const photoCount = usablePhotos(profile.photos).length;
  const answerCount = profile.prompts.filter((a) => a.promptId && a.answer.trim()).length;
  const intentTitle = SINGLE_QUESTIONS[0].options.find((o) => o.key === compat.intent)?.title;
  const lifeAnswered = [life.smoking, life.drinking, life.pets, life.activity].filter(Boolean).length;
  const dateTypeLabels = dates.dateTypes
    .map((k) => DATE_TYPES.find((t) => t.key === k)?.label)
    .filter((x): x is string => !!x);
  const editRows: EditRow[] = [
    { key: 'photos', icon: 'images-outline', title: 'Photos', description: plural(photoCount, 'photo', 'photos'),
      onPress: editTo({ section: 'yourProfile', step: PROFILE_STEP.photos }) },
    { key: 'prompts', icon: 'chatbubble-ellipses-outline', title: 'Prompts', description: plural(answerCount, 'answer', 'answers'),
      onPress: editTo({ section: 'yourProfile', step: PROFILE_STEP.prompts }) },
    { key: 'basics', icon: 'person-outline', title: 'Basics', description: 'Name, birthday, location, height',
      onPress: editTo({ section: 'basics', step: 1 }) },
    { key: 'looking', icon: 'heart-outline', title: 'Looking for',
      description: [intentTitle, compat.values.length ? plural(compat.values.length, 'value', 'values') : null].filter(Boolean).join(' · ') || 'Not answered yet',
      onPress: editTo({ section: 'compatibility', step: 1 }) },
    { key: 'life', icon: 'leaf-outline', title: 'Lifestyle', description: `${lifeAnswered} of 4 answered`,
      onPress: editTo({ section: 'yourLife', step: 1 }) },
    { key: 'world', icon: 'globe-outline', title: 'Your world',
      description: [world.jobTitle.trim() || null, plural(world.interests.length, 'interest', 'interests')].filter(Boolean).join(' · '),
      onPress: editTo({ section: 'yourWorld', step: 1 }) },
    { key: 'dates', icon: 'cafe-outline', title: 'First dates',
      description: [dateTypeLabels.join(', ') || null, datesSummary(dates)].filter(Boolean).join(' · ') || 'Not answered yet',
      onPress: editTo({ section: 'yourDates', step: 1 }) },
  ];

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
    // Stay on this screen: it switches to "Email confirmed" + Submit. A
    // confirmed email never submits by itself (P07 R1).
    updateProfile({ emailCheck: { email: normalizeEmail(profile.email) } });
  };

  const MISSING_TEXT: Record<number, string> = {
    [PROFILE_STEP.photos]: 'Add at least 3 photos first.',
    [PROFILE_STEP.prompts]: 'Answer 2 questions first.',
    [PROFILE_STEP.selfie]: 'Take your selfie first.',
    [PROFILE_STEP.email]: 'Enter your email first.',
    [PROFILE_STEP.code]: 'Confirm your email first.',
  };

  const submitLive = async () => {
    if (submittingRef.current || !live) return;
    submittingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const outcome = await submitApplication(requestIdRef.current);
    setSaving(false);
    submittingRef.current = false;
    if (outcome.kind === 'submitted') {
      // Shown only now — the server has the application.
      updateProfile({ applicationPreview: { receivedAt: Date.now() } });
      goTo(RECEIVED_POS);
      return;
    }
    if (outcome.kind === 'missing') {
      const where = firstMissingPos(outcome.missing);
      Alert.alert(
        'Almost there',
        where
          ? 'Something still needs an answer.'
          : outcome.missing.includes('account.consent')
            ? 'Please accept the Privacy Notice first (sign in again with your email code).'
            : 'Your email is not confirmed yet. Sign in again with your email code.',
        where ? [{ text: 'OK', onPress: () => goTo(where) }] : [{ text: 'OK' }],
      );
      return;
    }
    setSaveError(outcome.message);
  };

  const submit = () => {
    if (live) return void submitLive();
    if (submittingRef.current) return;
    const missing = firstMissingStep(profile);
    if (missing !== null) {
      // Take the user to the first thing that still needs attention.
      Alert.alert('Almost there', MISSING_TEXT[missing], [
        { text: 'OK', onPress: () => goTo({ section: 'yourProfile', step: missing }) },
      ]);
      return;
    }
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
      secondary = live && profile.applicationPreview ? null : { label: 'Edit profile', onPress: openEditMenu };
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
    if (step === S.code) {
      primary = live
        ? profile.applicationPreview
          ? { label: 'Back to status', onPress: () => goTo(RECEIVED_POS) }
          : { label: saving ? 'Sending…' : live.review ? 'Submit again' : 'Submit application', onPress: submit, disabled: saving }
        : !valid
          ? { label: 'Verify email', onPress: verifyCode }
          : profile.applicationPreview
            ? { label: 'Back to status', onPress: () => goTo(RECEIVED_POS) }
            : { label: 'Submit application', onPress: submit };
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
  if (live && saving && primary.onPress === handleContinue) {
    primary = { ...primary, label: 'Saving…', disabled: true };
  }
  if (live && primary.onPress === handleContinue) {
    const run = primary;
    primary = { ...run, onPress: () => void handleContinue() };
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
  // Photo/prompt edits are functions of the CURRENT list (P07 R2): a late
  // callback can never overwrite newer photos with a stale array.
  const updatePhotos = (fn: PhotoUpdater) => setProfile((d) => ({ ...d, photos: fn(d.photos) }));
  const updatePrompts = (fn: (list: ProfileDraft['prompts']) => ProfileDraft['prompts']) =>
    setProfile((d) => ({ ...d, prompts: fn(d.prompts) }));
  // "Add later" advances like Continue: it keeps valid selections already
  // made; any uncommitted search text is dropped with the screen.
  const canSkip = inWorld && isWorldStepSkippable(step);

  // Live submit screen (step "code"): what it says follows the real state —
  // the email still needs confirming, the first application, or an update
  // after a reviewer asked for changes. It never implies approval.
  const liveCode: 'check' | 'verified' | 'update' | null =
    live && inProfile && step === PROFILE_STEP.code ? (!valid ? 'check' : live.review ? 'update' : 'verified') : null;
  const liveCodeCopy =
    liveCode === 'update'
      ? { title: 'Send your update', helper: "We'll look at your profile again after you send it." }
      : liveCode === 'verified'
        ? { title: 'Email verified', helper: "Send your application and we'll review your profile." }
        : liveCode === 'check'
          ? { title: 'Check your email', helper: 'Confirm your email before you send your application.' }
          : null;

  return (
    <OnboardingScreen
      sectionLabel={section.label}
      step={step}
      totalSteps={section.steps}
      title={liveCodeCopy ? liveCodeCopy.title : titleFor(pos)}
      helper={liveCodeCopy ? liveCodeCopy.helper : helperFor(pos)}
      compactTitle={pos.section !== 'basics'}
      reserveTitleBlock={!(inProfile && step === PROFILE_STEP.preview) && !liveCodeCopy}
      hideProgress={inProfile && step === PROFILE_STEP.preview && reviewing}
      onBack={handleBack}
      contentKey={`${pos.section}-${step}`}
      onScrollY={inProfile && step === PROFILE_STEP.preview ? (y) => (previewScrollRef.current = y) : undefined}
      restoreScrollY={inProfile && step === PROFILE_STEP.preview && restorePreview ? previewScrollRef.current : null}
      footer={
        <>
          {saveError ? (
            <Text style={styles.saveError} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {saveError}
            </Text>
          ) : null}
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
              onPress={() => void handleContinue()}
              disabled={saving}
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
      {inProfile && step === PROFILE_STEP.photos && (
        <PhotosFields
          photos={profile.photos}
          updatePhotos={updatePhotos}
          live={live ? { status: photoSync.status, statusIsError: photoSync.error } : undefined}
        />
      )}
      {inProfile && step === PROFILE_STEP.prompts && (
        <PromptsFields prompts={profile.prompts} updatePrompts={updatePrompts} />
      )}
      {inProfile && step === PROFILE_STEP.preview && (
        <ProfilePreview blocks={buildProfilePreview(basics, compat, life, world, dates, profile)} />
      )}
      {inProfile && step === PROFILE_STEP.selfie && (
        <SelfieFields
          savedPrivately={!!profile.selfie?.uploaded && !profile.selfie?.uri}
          selfieUri={profile.selfie?.uri || null}
          candidateUri={selfieCandidate}
          error={selfieError}
        />
      )}
      {inProfile && step === PROFILE_STEP.email && <EmailFields {...pProps} onSubmit={sendCode} />}
      {inProfile && step === PROFILE_STEP.code && live && liveCode === 'update' && live.review?.note?.trim() ? (
        <View style={styles.noteCard} accessible accessibilityLabel={`Our note. ${live.review.note.trim()}`}>
          <Text style={styles.noteTitle} maxFontSizeMultiplier={1.5}>
            Our note
          </Text>
          <Text style={styles.noteText} maxFontSizeMultiplier={1.6}>
            {live.review.note.trim()}
          </Text>
        </View>
      ) : null}
      {inProfile && step === PROFILE_STEP.code && live && liveCode === 'verified' ? (
        <View style={styles.emailRow} accessible accessibilityLabel={`Verified email ${live.email}`}>
          <Ionicons name="mail-outline" size={18} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.liveEmail} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            {live.email}
          </Text>
        </View>
      ) : null}
      {inProfile && step === PROFILE_STEP.code && live && liveCode === 'check' ? (
        <Text style={styles.liveEmail} maxFontSizeMultiplier={1.6}>
          Sign in again with the code we send to {live.email} to confirm it.
        </Text>
      ) : null}
      {inProfile && step === PROFILE_STEP.code && !live && (
        <CodeFields
          {...pProps}
          error={codeError}
          confirmed={valid}
          onResend={() => updateProfile({ codeSentAt: Date.now(), code: '' })}
          onChangeEmail={() => {
            // Changing the email drops the demo code and demo check.
            updateProfile({ codeSentTo: null, codeSentAt: null, code: '', emailCheck: null });
            goTo({ section: 'yourProfile', step: PROFILE_STEP.email });
          }}
        />
      )}
      {inProfile && step === PROFILE_STEP.received && <ReceivedFields live={!!live} />}
      <EditProfileSheet visible={editOpen} rows={editRows} onClose={() => setEditOpen(false)} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  noteCard: {
    backgroundColor: obColors.selectedFill, // pale sage
    borderRadius: 14,
    padding: obSpacing.lg,
    gap: obSpacing.xs,
  },
  noteTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: obColors.cta,
  },
  noteText: {
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
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
  secondaryDisabled: {
    color: obColors.textSecondary,
  },
  saveError: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: '#A33A2B',
    textAlign: 'center',
    marginBottom: 8,
  },
  liveEmail: {
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: obColors.textPrimary,
  },
});
