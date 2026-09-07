// Shared state for onboarding step3's screens (morning/night → recharge →
// hobbies → drinking/smoking → education → beliefs). Was one long scrolling
// form with a single "Skip for now" button that nulled every field at once;
// split into one-question-per-screen to match step1/step2 (2026-09-03).
// Every field here stays genuinely optional — Next is never disabled, so
// leaving a screen untouched and tapping through is the new equivalent of
// the old global skip.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { supabase } from '@/lib/supabaseClient';

export const PRESET_HOBBIES = ['Travel', 'Music', 'Fitness', 'Reading', 'Gaming', 'Cooking', 'Art', 'Sports'] as const;
export const HOBBY_SUGGESTIONS = [
  'Running', 'Reading', 'Gaming', 'Cooking', 'Photography', 'Hiking',
  'Dancing', 'Yoga', 'Cinema', 'Art', 'Sports', 'Coffee', 'Cycling',
] as const;
export const MAX_HOBBIES = 5;

export type RechargeOption =
  | 'Some quiet alone time'
  | 'Hanging out with people'
  | 'Quality time with my pet'
  | 'Depends on the day';
export type DrinkingSmoking = 'Both' | 'Only drinking' | 'Only smoking' | 'When socializing' | 'Neither';
export type EducationOption = 'High school' | 'University' | "Master's" | 'Other';
export type ReligionOption = 'Spiritual' | 'Religious' | 'Agnostic' | 'Atheist' | 'Prefer not to say';

export const MORNING_NIGHT_OPTIONS = ['Morning person', 'Night owl', 'Depends on the day'] as const;
export const RECHARGE_OPTIONS: readonly RechargeOption[] = [
  'Some quiet alone time', 'Hanging out with people', 'Quality time with my pet', 'Depends on the day',
];
export const DRINK_SMOKE_OPTIONS: { label: string; value: DrinkingSmoking }[] = [
  { label: 'I enjoy both', value: 'Both' },
  { label: 'Just drinks for me', value: 'Only drinking' },
  { label: 'Just smoking for me', value: 'Only smoking' },
  { label: 'Only when socializing', value: 'When socializing' },
  { label: 'Neither, not my thing', value: 'Neither' },
];
export const EDUCATION_OPTIONS: readonly EducationOption[] = ['High school', 'University', "Master's", 'Other'];
export const EDUCATION_FOLLOWUP_PLACEHOLDER: Record<EducationOption, string> = {
  'High school': 'Which high school? (optional)',
  University: 'Which university? (optional)',
  "Master's": 'Which university / field? (optional)',
  Other: "Any details you'd like to share? (optional)",
};
export const RELIGION_OPTIONS: readonly ReligionOption[] = [
  'Spiritual', 'Religious', 'Agnostic', 'Atheist', 'Prefer not to say',
];

export const TOTAL_SCREENS = 7;

type Step3ContextValue = {
  userId: string | null;
  isDemoMode: boolean;
  saving: boolean;

  morningNight: string | null;
  setMorningNight: (v: string) => void;
  recharge: RechargeOption[];
  toggleRecharge: (v: RechargeOption) => void;
  hobbies: string[];
  toggleHobby: (v: string) => void;
  addHobby: (v: string) => void;
  drinkingSmoking: DrinkingSmoking | null;
  setDrinkingSmoking: (v: DrinkingSmoking) => void;
  education: EducationOption | null;
  setEducation: (v: EducationOption) => void;
  educationDetail: string;
  setEducationDetail: (v: string) => void;
  occupation: string;
  setOccupation: (v: string) => void;
  religion: ReligionOption | null;
  setReligion: (v: ReligionOption) => void;

  submitAll: () => Promise<void>;
};

const Step3Context = createContext<Step3ContextValue | null>(null);

export function useStep3(): Step3ContextValue {
  const ctx = useContext(Step3Context);
  if (!ctx) throw new Error('useStep3 must be used within Step3Provider');
  return ctx;
}

export function Step3Provider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [morningNight, setMorningNight] = useState<string | null>(null);
  const [recharge, setRecharge] = useState<RechargeOption[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [drinkingSmoking, setDrinkingSmoking] = useState<DrinkingSmoking | null>(null);
  const [education, setEducation] = useState<EducationOption | null>(null);
  const [educationDetail, setEducationDetail] = useState('');
  const [occupation, setOccupation] = useState('');
  const [religion, setReligion] = useState<ReligionOption | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setCheckingAuth(false);
      setUserId('demo-user');
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
  }, [isDemoMode, router]);

  useEffect(() => {
    if (education === null) setEducationDetail('');
  }, [education]);

  const toggleRecharge = (opt: RechargeOption) => {
    setRecharge((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  const addHobby = (value: string) => {
    const t = value.trim();
    if (!t) return;
    setHobbies((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= MAX_HOBBIES) {
        Alert.alert('Limit', `You can add up to ${MAX_HOBBIES}.`);
        return prev;
      }
      return [...prev, t];
    });
  };

  const toggleHobby = (value: string) => {
    setHobbies((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= MAX_HOBBIES) {
        Alert.alert('Limit', `You can add up to ${MAX_HOBBIES}.`);
        return prev;
      }
      return [...prev, value];
    });
  };

  const submitAll = async () => {
    if (!userId) return;

    if (isDemoMode) {
      router.push('/profile-setup/step4?demo=1' as never);
      return;
    }

    setSaving(true);
    try {
      await supabase.auth.getSession();

      const educationDetailOut = education ? educationDetail.trim() || null : null;
      const drinkingValue =
        !drinkingSmoking
          ? null
          : drinkingSmoking === 'Both' || drinkingSmoking === 'Only drinking'
            ? 'Yes'
            : drinkingSmoking === 'When socializing'
              ? 'Socially'
              : 'No';
      const smokingValue =
        !drinkingSmoking
          ? null
          : drinkingSmoking === 'Both' || drinkingSmoking === 'Only smoking'
            ? 'Yes'
            : drinkingSmoking === 'When socializing'
              ? 'Socially'
              : 'No';
      const step3ProfilePayload = {
        id: userId,
        morning_night: morningNight,
        recharge_style: recharge.length ? recharge.join(', ') : null,
        hobbies: hobbies.length ? hobbies : null,
        drinking: drinkingValue,
        smoking: smokingValue,
        education,
        education_detail: educationDetailOut,
        occupation: occupation.trim() || null,
        religion,
        current_step: 4,
      };

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(step3ProfilePayload, { onConflict: 'id' });
      if (profileErr) throw profileErr;

      router.push('/profile-setup/step4' as never);
    } catch (e: any) {
      console.error('STEP 3 - submitAll error:', e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const value: Step3ContextValue = {
    userId,
    isDemoMode,
    saving,
    morningNight,
    setMorningNight,
    recharge,
    toggleRecharge,
    hobbies,
    toggleHobby,
    addHobby,
    drinkingSmoking,
    setDrinkingSmoking,
    education,
    setEducation,
    educationDetail,
    setEducationDetail,
    occupation,
    setOccupation,
    religion,
    setReligion,
    submitAll,
  };

  if (checkingAuth) return null;

  return <Step3Context.Provider value={value}>{children}</Step3Context.Provider>;
}
