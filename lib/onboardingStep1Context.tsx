// Shared state for onboarding step1's screens (photos → name → instagram →
// verify → birthdate → location → gender → languages). Was one long
// scrolling form in a single screen; split into one-question-per-screen
// (Raya/Hinge pattern, CLAUDE.md §5, 2026-09-02) — this Context is what lets
// each screen read/write its slice without route-param plumbing, and keeps
// the upload+upsert logic (previously handleNext) firing exactly once, on
// the last screen, unchanged from the original single-page version.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { COUNTRIES } from '@/lib/countries';
import { DISCOVERY_DISTANCE_OPTIONS, type DiscoveryDistance } from '@/lib/profileSettings';
import { supabase } from '@/lib/supabaseClient';
import { CITY_OPTIONS, type CityOption } from '@/lib/turkishGeo';
import {
  USER_PHOTOS_BUCKET,
  profilePhotoObjectPath,
  verificationSelfiePath,
} from '@/lib/userPhotosStorage';
import { calculateAge, formatZodiacTooltip, getZodiacFromDate } from '@/lib/zodiac';

export const GENDER_CHIPS = ['Man', 'Woman', 'Non-binary'] as const;
export type GenderChip = (typeof GENDER_CHIPS)[number];
export type MeetingPref = 'Men' | 'Women' | 'Non-binary' | 'Everyone';

export { CITY_OPTIONS, type CityOption };

export const PRESET_LANGUAGES = ['Turkish', 'English', 'German'] as const;
export const LANGUAGE_SUGGESTIONS = [
  'French', 'Spanish', 'Arabic', 'Italian', 'Portuguese', 'Russian', 'Japanese',
  'Korean', 'Chinese', 'Dutch', 'Swedish', 'Polish', 'Greek', 'Hindi', 'Persian',
] as const;
export const MAX_LANGUAGES = 5;
export const PHOTO_SLOTS = 6;
export const TOTAL_SCREENS = 9;
export const DEFAULT_COUNTRY_CODE = 'TR';
export { DISCOVERY_DISTANCE_OPTIONS, type DiscoveryDistance };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function parseDob(day: string, month: string, year: string): Date | null {
  const dd = Number(day);
  const mm = Number(month);
  const yyyy = Number(year);
  if (!yyyy || !mm || !dd || yyyy < 1900 || mm > 12 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function getMimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function uploadPhotosToSupabase(userId: string, uris: string[]): Promise<string[]> {
  const objectPaths: string[] = [];
  const storage = supabase.storage.from(USER_PHOTOS_BUCKET);

  try {
    for (let index = 0; index < uris.length; index++) {
      const uri = uris[index];
      const path = profilePhotoObjectPath(userId, index);
      const contentType = getMimeTypeFromUri(uri);

      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Fotoğraf okunamadı (${response.status}) — ${path}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uploadRes = await storage.upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadRes.error) {
        throw new Error(`${uploadRes.error.message ?? 'Fotoğraf yüklenemedi.'} (${path})`);
      }

      objectPaths.push(path);
    }
  } catch (e) {
    console.warn('[profile-setup] photo upload failed', e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  return objectPaths;
}

async function uploadSelfieToSupabase(userId: string, uri: string): Promise<string> {
  const path = verificationSelfiePath(userId);
  const contentType = getMimeTypeFromUri(uri);
  const storage = supabase.storage.from(USER_PHOTOS_BUCKET);

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Selfie okunamadı (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uploadRes = await storage.upload(path, arrayBuffer, { contentType, upsert: true });
  if (uploadRes.error) {
    throw new Error(uploadRes.error.message ?? 'Selfie yüklenemedi.');
  }

  return path;
}

type Step1ContextValue = {
  userId: string | null;
  isDemoMode: boolean;
  saving: boolean;

  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  photos: (string | null)[];
  setPhotos: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  selfieUri: string | null;
  setSelfieUri: (uri: string | null) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  instagramHandle: string;
  setInstagramHandle: (v: string) => void;
  dobDay: string;
  setDobDay: (v: string) => void;
  dobMonth: string;
  setDobMonth: (v: string) => void;
  dobYear: string;
  setDobYear: (v: string) => void;
  city: CityOption;
  setCity: (v: CityOption) => void;
  district: string;
  setDistrict: (v: string) => void;
  discoveryDistance: DiscoveryDistance;
  setDiscoveryDistance: (v: DiscoveryDistance) => void;
  lat: number | null;
  lng: number | null;
  setLatLng: (lat: number | null, lng: number | null) => void;
  genderSelection: GenderChip | null;
  setGenderSelection: (v: GenderChip) => void;
  meetingPreferences: MeetingPref[];
  toggleMeetingPref: (v: MeetingPref) => void;
  languages: string[];
  toggleLanguage: (v: string) => void;
  addLanguage: (v: string) => void;

  effectiveDob: Date | null;
  zodiacInfo: ReturnType<typeof getZodiacFromDate> | null;
  ageYears: number | null;

  submitAll: () => Promise<void>;
};

const Step1Context = createContext<Step1ContextValue | null>(null);

export function useStep1(): Step1ContextValue {
  const ctx = useContext(Step1Context);
  if (!ctx) throw new Error('useStep1 must be used within Step1Provider');
  return ctx;
}

export function Step1Provider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [photos, setPhotos] = useState<(string | null)[]>(() => Array(PHOTO_SLOTS).fill(null));
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [city, setCity] = useState<CityOption>('Istanbul');
  const [district, setDistrict] = useState('Kadıköy');
  const [discoveryDistance, setDiscoveryDistance] = useState<DiscoveryDistance>('whole_city');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [genderSelection, setGenderSelection] = useState<GenderChip | null>(null);
  const [meetingPreferences, setMeetingPreferences] = useState<MeetingPref[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fullAddress = useMemo(() => {
    const d = district.trim();
    return d ? `${d}, ${city}` : city;
  }, [city, district]);

  const effectiveDob = useMemo(() => parseDob(dobDay, dobMonth, dobYear), [dobDay, dobMonth, dobYear]);
  const zodiacInfo = useMemo(() => (effectiveDob ? getZodiacFromDate(effectiveDob) : null), [effectiveDob]);
  const ageYears = useMemo(() => (effectiveDob ? calculateAge(effectiveDob) : null), [effectiveDob]);

  useEffect(() => {
    if (isDemoMode) {
      setCheckingAuth(false);
      setUserId('demo-user');
      return;
    }

    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = session?.user?.id ?? user?.id;
      if (!mounted) return;

      if (!uid) {
        router.replace('/(auth)/login');
        return;
      }

      setUserId(uid);
      setCheckingAuth(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isDemoMode, router]);

  const toggleMeetingPref = (value: MeetingPref) => {
    setMeetingPreferences((prev) => {
      if (value === 'Everyone') {
        if (prev.includes('Everyone')) return [];
        return ['Everyone'];
      }
      const withoutEveryone = prev.filter((x) => x !== 'Everyone');
      if (withoutEveryone.includes(value)) {
        return withoutEveryone.filter((x) => x !== value);
      }
      return [...withoutEveryone, value];
    });
  };

  const addLanguage = (value: string) => {
    const t = value.trim();
    if (!t) return;
    setLanguages((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= MAX_LANGUAGES) {
        Alert.alert('Limit', `You can add up to ${MAX_LANGUAGES} languages.`);
        return prev;
      }
      return [...prev, t];
    });
  };

  const toggleLanguage = (value: string) => {
    setLanguages((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= MAX_LANGUAGES) {
        Alert.alert('Limit', `You can add up to ${MAX_LANGUAGES} languages.`);
        return prev;
      }
      return [...prev, value];
    });
  };

  const setLatLng = (nextLat: number | null, nextLng: number | null) => {
    setLat(nextLat);
    setLng(nextLng);
  };

  const submitAll = async () => {
    if (!userId) return;

    if (!effectiveDob || !zodiacInfo) {
      Alert.alert('Birth date', 'Enter a valid date of birth.');
      return;
    }

    if (isDemoMode) {
      router.push('/profile-setup/step2?demo=1' as never);
      return;
    }

    setSaving(true);
    try {
      // Step1's auth check runs once on mount; if the user lingers across
      // the 9 screens for a while (or the app was backgrounded overnight —
      // found via device testing, 2026-09-03: an access token issued the
      // day before caused "new row violates row-level security policy" on
      // upload), that token can be stale by the time we get here.
      // getSession() forces the SDK to refresh it first if needed.
      await supabase.auth.getSession();

      const selectedPhotoUris = photos.filter(Boolean) as string[];
      let uploadedPhotoPaths: string[] = [];
      if (selectedPhotoUris.length > 0) {
        try {
          uploadedPhotoPaths = await uploadPhotosToSupabase(userId, selectedPhotoUris);
        } catch (photoError: any) {
          Alert.alert(
            'Photo upload failed',
            photoError?.message ?? 'Could not upload your photos. Please try again.',
          );
          setSaving(false);
          return;
        }
      }

      let verificationSelfiePathValue: string | null = null;
      if (selfieUri) {
        try {
          verificationSelfiePathValue = await uploadSelfieToSupabase(userId, selfieUri);
        } catch (selfieError: any) {
          Alert.alert(
            'Selfie upload failed',
            selfieError?.message ?? 'Could not upload your selfie. Please try again.',
          );
          setSaving(false);
          return;
        }
      }

      const isoDob = `${effectiveDob.getFullYear()}-${pad2(effectiveDob.getMonth() + 1)}-${pad2(effectiveDob.getDate())}`;

      const trimmedPhone = phoneNumber.trim();
      const phone_number: string | null = trimmedPhone.length > 0 ? trimmedPhone : null;
      const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
      const dial_code: string | null = trimmedPhone.length > 0 ? selectedCountry.dial : null;
      const country_code: string | null = trimmedPhone.length > 0 ? selectedCountry.code : null;

      const photosForDb = uploadedPhotoPaths.length > 0 ? uploadedPhotoPaths : [];
      const instagram_handle = instagramHandle.trim() || null;

      const baseProfile = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: fullAddress,
        city,
        district: district.trim(),
        discovery_max_distance: discoveryDistance,
        lat,
        lng,
        gender: genderSelection,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        current_step: 2,
        photos: photosForDb,
        phone_number,
        dial_code,
        country_code,
        instagram_handle,
        verification_selfie_path: verificationSelfiePathValue,
      };

      const minimalProfile = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: fullAddress,
        city,
        district: district.trim(),
        discovery_max_distance: discoveryDistance,
        gender: genderSelection,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        current_step: 2,
        photos: photosForDb,
        phone_number,
        dial_code,
        country_code,
        instagram_handle,
        verification_selfie_path: verificationSelfiePathValue,
      };

      const { error: upsertError } = await supabase.from('profiles').upsert(baseProfile, {
        onConflict: 'id',
      });

      if (upsertError) {
        const { error: minimalError } = await supabase.from('profiles').upsert(minimalProfile, {
          onConflict: 'id',
        });
        if (minimalError) throw minimalError;
      }

      // push (not replace) so the answers given across step1's 9 screens
      // stay in history — user can swipe/tap back into step1 and still see
      // them (2026-09-03, user found they were unrecoverable after
      // replace() tore the step1 stack entry down).
      router.push('/profile-setup/step2' as never);
    } catch (e: any) {
      console.error('STEP 1 - submitAll error:', e);
      Alert.alert('Kayıt başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const value: Step1ContextValue = {
    userId,
    isDemoMode,
    saving,
    phoneNumber,
    setPhoneNumber,
    countryCode,
    setCountryCode,
    photos,
    setPhotos,
    selfieUri,
    setSelfieUri,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    instagramHandle,
    setInstagramHandle,
    dobDay,
    setDobDay,
    dobMonth,
    setDobMonth,
    dobYear,
    setDobYear,
    city,
    setCity,
    district,
    setDistrict,
    discoveryDistance,
    setDiscoveryDistance,
    lat,
    lng,
    setLatLng,
    genderSelection,
    setGenderSelection,
    meetingPreferences,
    toggleMeetingPref,
    languages,
    toggleLanguage,
    addLanguage,
    effectiveDob,
    zodiacInfo,
    ageYears,
    submitAll,
  };

  if (checkingAuth) return null;

  return <Step1Context.Provider value={value}>{children}</Step1Context.Provider>;
}
