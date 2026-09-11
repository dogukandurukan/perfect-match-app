// Shared state for onboarding step4's screens (availability days → hours →
// first-date venue → neighborhoods → first-meeting expectation → bio). Was
// one long scrolling form with a single "Skip for now" that nulled every
// field; split into one-question-per-screen to match step1-3 (2026-09-03).
// Every field stays optional — Next is never disabled. This is the last
// leg of onboarding: submitAll() sets setup_completed=true and replace()s
// into the app (intentionally not push — no reason to go back into
// onboarding once it's done).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { logEvent } from '@/lib/analytics';
import { MEETING_VENUE_OPTIONS } from '@/lib/meetingVenues';
import { supabase } from '@/lib/supabaseClient';

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const ALL_DAYS = [...DAY_LABELS];

export const TIME_OPTIONS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)'] as const;
export const TIME_ALWAYS = 'Always' as const;
export const TIME_CHIPS = [...TIME_OPTIONS, TIME_ALWAYS] as const;

export const VENUE_DEFS = MEETING_VENUE_OPTIONS;

export const FIRST_MEETING_OPTIONS = [
  "See if there's a spark",
  'Have a real conversation',
  'Have fun and laugh',
  'All of the above',
] as const;

export const NEIGHBORHOOD_PRESETS = ['Kadıköy', 'Beşiktaş', 'Cihangir'] as const;
export const MAX_NEIGHBORHOODS = 3;
export const NEIGHBORHOOD_SUGGESTIONS = [
  'Kadıköy', 'Beşiktaş', 'Cihangir', 'Beyoğlu', 'Şişli', 'Nişantaşı', 'Karaköy',
  'Galata', 'Taksim', 'Bakırköy', 'Etiler', 'Levent', 'Çamlıca', 'Üsküdar',
  'Ataşehir', 'Kurtköy', 'Maltepe', 'Kartal', 'Kadıköy Moda', 'Bomonti', 'Sarıyer',
] as const;

export const TOTAL_SCREENS = 6;

const COMBINING_DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeLoc(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS_RE, '');
}

type Step4ContextValue = {
  userId: string | null;
  isDemoMode: boolean;
  saving: boolean;

  alwaysOn: boolean;
  selectedDays: string[];
  toggleAlways: () => void;
  toggleDay: (d: string) => void;

  selectedHours: string[];
  toggleHoursChip: (opt: string) => void;
  isAlwaysHoursSelected: boolean;

  meetingEnvironment: string[];
  toggleVenue: (label: string) => void;
  favoriteSpots: Record<string, string>;
  setSpot: (key: string, text: string) => void;

  preferredLocations: string[];
  addNeighborhood: (raw: string) => void;
  removeNeighborhood: (loc: string) => void;

  firstDateExpectation: string | null;
  setFirstDateExpectation: (v: string) => void;

  bio: string;
  setBio: (v: string) => void;

  submitAll: () => Promise<void>;
};

const Step4Context = createContext<Step4ContextValue | null>(null);

export function useStep4(): Step4ContextValue {
  const ctx = useContext(Step4Context);
  if (!ctx) throw new Error('useStep4 must be used within Step4Provider');
  return ctx;
}

export function Step4Provider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [alwaysOn, setAlwaysOn] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedHours, setSelectedHours] = useState<string[]>([]);
  const [meetingEnvironment, setMeetingEnvironment] = useState<string[]>([]);
  const [favoriteSpots, setFavoriteSpots] = useState<Record<string, string>>({});
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [firstDateExpectation, setFirstDateExpectation] = useState<string | null>(null);
  const [bio, setBio] = useState('');
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

  const toggleAlways = () => {
    if (alwaysOn) {
      setAlwaysOn(false);
      setSelectedDays([]);
    } else {
      setAlwaysOn(true);
      setSelectedDays([...ALL_DAYS]);
    }
  };

  const toggleDay = (d: string) => {
    if (alwaysOn) {
      setAlwaysOn(false);
      setSelectedDays(ALL_DAYS.filter((x) => x !== d));
      return;
    }
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const persistDays = useMemo(() => {
    if (alwaysOn || selectedDays.length === ALL_DAYS.length) return [...ALL_DAYS];
    return [...selectedDays];
  }, [alwaysOn, selectedDays]);

  const isAlwaysHoursSelected = useMemo(
    () => TIME_OPTIONS.every((t) => selectedHours.includes(t)) && selectedHours.length === TIME_OPTIONS.length,
    [selectedHours],
  );

  const toggleHoursChip = (opt: string) => {
    if (opt === TIME_ALWAYS) {
      if (isAlwaysHoursSelected) setSelectedHours([]);
      else setSelectedHours([...TIME_OPTIONS]);
      return;
    }
    setSelectedHours((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  const toggleVenue = (label: string) => {
    setMeetingEnvironment((prev) => {
      if (prev.includes(label)) {
        const def = VENUE_DEFS.find((v) => v.label === label);
        if (def) {
          setFavoriteSpots((spots) => {
            const next = { ...spots };
            delete next[def.spotKey];
            return next;
          });
        }
        return prev.filter((x) => x !== label);
      }
      return [...prev, label];
    });
  };

  const setSpot = (key: string, text: string) => {
    setFavoriteSpots((prev) => ({ ...prev, [key]: text }));
  };

  const addNeighborhood = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setPreferredLocations((prev) => {
      if (prev.length >= MAX_NEIGHBORHOODS) return prev;
      const existingNorm = new Set(prev.map(normalizeLoc));
      if (existingNorm.has(normalizeLoc(t))) return prev;
      return [...prev, t];
    });
  };

  const removeNeighborhood = (loc: string) => {
    setPreferredLocations((prev) => prev.filter((x) => normalizeLoc(x) !== normalizeLoc(loc)));
  };

  const submitAll = async () => {
    if (!userId) return;
    if (isDemoMode) {
      router.replace('/(tabs)' as never);
      return;
    }

    setSaving(true);
    try {
      await supabase.auth.getSession();

      const profilePayload = {
        availability_days: persistDays.length ? persistDays : null,
        availability_hours: selectedHours.length ? selectedHours : null,
        meeting_environment: meetingEnvironment.length ? meetingEnvironment : null,
        favorite_spots:
          Object.keys(favoriteSpots).length > 0
            ? Object.fromEntries(Object.entries(favoriteSpots).filter(([, v]) => String(v).trim().length > 0))
            : null,
        preferred_locations: preferredLocations.length ? preferredLocations : null,
        first_date_expectation: firstDateExpectation,
        bio: bio.trim() || null,
        current_step: 4,
        setup_completed: true,
      };
      const step4UpsertRow = { id: userId, ...profilePayload };

      const { error: profileErr } = await supabase.from('profiles').upsert(step4UpsertRow, { onConflict: 'id' });
      if (profileErr) throw profileErr;

      logEvent('onboarding_completed');
      router.replace('/(tabs)' as never);
    } catch (e: any) {
      console.error('STEP 4 - submitAll error:', e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const value: Step4ContextValue = {
    userId,
    isDemoMode,
    saving,
    alwaysOn,
    selectedDays,
    toggleAlways,
    toggleDay,
    selectedHours,
    toggleHoursChip,
    isAlwaysHoursSelected,
    meetingEnvironment,
    toggleVenue,
    favoriteSpots,
    setSpot,
    preferredLocations,
    addNeighborhood,
    removeNeighborhood,
    firstDateExpectation,
    setFirstDateExpectation,
    bio,
    setBio,
    submitAll,
  };

  if (checkingAuth) return null;

  return <Step4Context.Provider value={value}>{children}</Step4Context.Provider>;
}
