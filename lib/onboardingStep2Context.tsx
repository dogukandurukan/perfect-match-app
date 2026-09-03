// Shared state for onboarding step2's screens (intent → q1 → q2 → q3).
// Was one long scrolling form (chip picker + up to 3 stacked follow-up
// sections revealed inline) in a single screen; split into one-question-
// per-screen to match step1's restructure (user request, 2026-09-03).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { IntentKey } from '@/lib/onboardingIntent';
import { normalizeIntentKey } from '@/lib/onboardingIntent';
import { supabase } from '@/lib/supabaseClient';

export type Setup2Answers = {
  friendship_value?: string;
  hangout_frequency?: string;
  social_preference?: string;
  casualness_expectation?: string;
  exclusivity_view?: string;
  connection_style?: string;
  relationship_pace?: string;
  life_priority?: string;
  relationship_vision?: string;
  excitement_factor?: string;
  commitment_view?: string;
  connection_energy?: string;
};

export const INTENT_OPTIONS: { label: string; key: IntentKey }[] = [
  { label: 'Just friends', key: 'just_friends' },
  { label: 'Something casual', key: 'keeping_it_casual' },
  { label: 'Open to something real', key: 'open_to_relationship' },
  { label: 'Figuring it out', key: 'not_sure_yet' },
];

export const TOTAL_SCREENS = 4;

export type QuestionDef = {
  key: keyof Setup2Answers;
  title: string;
  options: readonly string[];
};

const QUESTIONS_BY_INTENT: Record<IntentKey, QuestionDef[]> = {
  keeping_it_casual: [
    {
      key: 'casualness_expectation',
      title: 'What are you hoping for?',
      options: ['Fun & good vibes', 'New experiences', 'See where it goes', 'All of the above'],
    },
    {
      key: 'exclusivity_view',
      title: 'How do you feel about exclusivity?',
      options: ['Not important right now', 'Open to it eventually', 'Prefer to keep it open'],
    },
    {
      key: 'connection_style',
      title: "You know there's a vibe when...",
      options: ['Physical chemistry first', 'Good conversations', 'Shared experiences', 'A bit of everything'],
    },
  ],
  just_friends: [
    {
      key: 'friendship_value',
      title: 'What makes a friendship last for you?',
      options: ['Loyalty & trust', 'Shared adventures', 'Deep conversations', 'Just having fun'],
    },
    {
      key: 'hangout_frequency',
      title: 'How often do you see your close friends?',
      options: ['A few times a week', 'Once a week', 'A few times a month', 'Whenever it happens'],
    },
    {
      key: 'social_preference',
      title: 'Your ideal hangout looks like...',
      options: ['One-on-one', 'Small groups', 'Big groups', 'Mix of everything'],
    },
  ],
  open_to_relationship: [
    {
      key: 'relationship_pace',
      title: "What's your relationship pace?",
      options: ['Taking it slow', 'Going with the flow', 'Ready to commit', 'Not sure yet'],
    },
    {
      key: 'life_priority',
      title: 'What takes priority right now?',
      options: ['Career & ambition', 'Family & relationships', 'Personal growth', 'Balance of everything'],
    },
    {
      key: 'relationship_vision',
      title: 'What does a healthy relationship look like to you?',
      options: [
        "We support each other's independence",
        "We're each other's priority",
        'We grow together',
        'A balance of both',
      ],
    },
  ],
  not_sure_yet: [
    {
      key: 'excitement_factor',
      title: 'What would make you excited about meeting someone?',
      options: ['A great friendship', 'A romantic spark', 'An adventure buddy', 'Just seeing what happens'],
    },
    {
      key: 'commitment_view',
      title: 'How do you feel about commitment?',
      options: ['Taking it slow', 'Open to whatever feels right', 'Not thinking about it yet'],
    },
    {
      key: 'connection_energy',
      title: 'What kind of energy are you bringing?',
      options: ['Laid back & easy going', 'Curious & open minded', 'Fun & spontaneous', 'Still figuring it out'],
    },
  ],
};

type Step2ContextValue = {
  userId: string | null;
  isDemoMode: boolean;
  saving: boolean;
  intent: IntentKey | null;
  setIntent: (key: IntentKey) => void;
  answers: Setup2Answers;
  setAnswer: <K extends keyof Setup2Answers>(key: K, value: Setup2Answers[K]) => void;
  /** The 3 follow-up questions for the selected intent — [] until intent is set. */
  questions: QuestionDef[];
  submitAll: () => Promise<void>;
};

const Step2Context = createContext<Step2ContextValue | null>(null);

export function useStep2(): Step2ContextValue {
  const ctx = useContext(Step2Context);
  if (!ctx) throw new Error('useStep2 must be used within Step2Provider');
  return ctx;
}

export function Step2Provider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string; intent?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [intent, setIntentState] = useState<IntentKey | null>(null);
  const [answers, setAnswers] = useState<Setup2Answers>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setCheckingAuth(false);
      setUserId('demo-user');
      const raw = params.intent as string | undefined;
      setIntentState(raw ? normalizeIntentKey(raw) : null);
      return;
    }

    let mounted = true;
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (error || !user) {
        router.replace('/(auth)/login');
        return;
      }

      setUserId(user.id);
      setCheckingAuth(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isDemoMode, params.intent, router]);

  const setIntent = (key: IntentKey) => {
    if (intent !== null && intent !== key) setAnswers({});
    setIntentState(key);
  };

  const setAnswer = <K extends keyof Setup2Answers>(key: K, value: Setup2Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const questions = useMemo(() => (intent ? QUESTIONS_BY_INTENT[intent] : []), [intent]);

  const submitAll = async () => {
    if (!userId || !intent) return;

    if (isDemoMode) {
      router.push('/profile-setup/step3?demo=1' as never);
      return;
    }

    setSaving(true);
    try {
      await supabase.auth.getSession();

      const onboardingPayload = {
        user_id: userId,
        intent,
        friendship_value: answers.friendship_value ?? null,
        hangout_frequency: answers.hangout_frequency ?? null,
        social_preference: answers.social_preference ?? null,
        casualness_expectation: answers.casualness_expectation ?? null,
        exclusivity_view: answers.exclusivity_view ?? null,
        connection_style: answers.connection_style ?? null,
        relationship_pace: answers.relationship_pace ?? null,
        life_priority: answers.life_priority ?? null,
        relationship_vision: answers.relationship_vision ?? null,
        excitement_factor: answers.excitement_factor ?? null,
        commitment_view: answers.commitment_view ?? null,
        connection_energy: answers.connection_energy ?? null,
      };
      const profileStep2Payload = { id: userId, current_step: 3 as const };

      const { error: onboardingErr } = await supabase
        .from('onboarding_answers')
        .upsert(onboardingPayload, { onConflict: 'user_id' });
      if (onboardingErr) throw onboardingErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(profileStep2Payload, { onConflict: 'id' });
      if (profileErr) throw profileErr;

      router.push('/profile-setup/step3' as never);
    } catch (e: any) {
      console.error('STEP 2 - submitAll error:', e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const value: Step2ContextValue = {
    userId,
    isDemoMode,
    saving,
    intent,
    setIntent,
    answers,
    setAnswer,
    questions,
    submitAll,
  };

  if (checkingAuth) return null;

  return <Step2Context.Provider value={value}>{children}</Step2Context.Provider>;
}
