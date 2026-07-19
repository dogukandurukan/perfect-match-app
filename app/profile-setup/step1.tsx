// Screen: Setup 1 — profil ve fotoğraf | Status: stable | Last updated: Mayıs 2026
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SetupScreenHeader } from '@/components/ui/SetupScreenHeader';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { USER_PHOTOS_BUCKET, profilePhotoObjectPath } from '@/lib/userPhotosStorage';
import { calculateAge, formatZodiacTooltip, getZodiacFromDate } from '@/lib/zodiac';

const GENDER_CHIPS = ['Man', 'Woman', 'Non-binary'] as const;
type GenderChip = (typeof GENDER_CHIPS)[number];
type MeetingPref = 'Men' | 'Women' | 'Non-binary' | 'Everyone';

const CITY_OPTIONS = ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'] as const;
type CityOption = (typeof CITY_OPTIONS)[number];

const PRESET_LANGUAGES = ['Turkish', 'English', 'German'] as const;
const LANGUAGE_SUGGESTIONS = [
  'French',
  'Spanish',
  'Arabic',
  'Italian',
  'Portuguese',
  'Russian',
  'Japanese',
  'Korean',
  'Chinese',
  'Dutch',
  'Swedish',
  'Polish',
  'Greek',
  'Hindi',
  'Persian',
] as const;
const MAX_LANGUAGES = 5;

const PHOTO_SLOTS = 3;
const PHOTO_SLOT_MAX = 72;
/** Vertical gap between blocks (compact single-page goal) */
const GAP = 14;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function parseDob(day: string, month: string, year: string): Date | null {
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
  console.log('STEP 1 - photo upload start', {
    bucket: USER_PHOTOS_BUCKET,
    userId,
    paths: uris.map((_, i) => profilePhotoObjectPath(userId, i)),
  });

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

      const blob = await response.blob();
      const uploadRes = await storage.upload(path, blob, {
        contentType,
        upsert: true,
      });

      if (uploadRes.error) {
        throw new Error(`${uploadRes.error.message ?? 'Fotoğraf yüklenemedi.'} (${path})`);
      }

      objectPaths.push(path);
      console.log('STEP 1 - photo upload ok:', path);
    }
  } catch (e) {
    console.log('STEP 1 - photo upload error:', e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  return objectPaths;
}

export default function ProfileSetupStep1() {
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const photoSlotSize = useMemo(() => {
    const horizontalPadding = 24 * 2;
    const gaps = 8 * (PHOTO_SLOTS - 1);
    const raw = Math.floor((windowWidth - horizontalPadding - gaps) / PHOTO_SLOTS);
    return Math.max(52, Math.min(PHOTO_SLOT_MAX, raw));
  }, [windowWidth]);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [photos, setPhotos] = useState<(string | null)[]>(() => Array(PHOTO_SLOTS).fill(null));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [city, setCity] = useState<CityOption>('Istanbul');
  const [district, setDistrict] = useState('Kadikoy');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [genderSelection, setGenderSelection] = useState<GenderChip | null>(null);
  const [meetingPreferences, setMeetingPreferences] = useState<MeetingPref[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [langInput, setLangInput] = useState('');

  const [saving, setSaving] = useState(false);

  const fullAddress = useMemo(() => {
    const d = district.trim();
    return d ? `${d}, ${city}` : city;
  }, [city, district]);

  const effectiveDob = useMemo(() => parseDob(dobDay, dobMonth, dobYear), [dobDay, dobMonth, dobYear]);
  const zodiacInfo = useMemo(() => (effectiveDob ? getZodiacFromDate(effectiveDob) : null), [effectiveDob]);
  const ageYears = useMemo(() => (effectiveDob ? calculateAge(effectiveDob) : null), [effectiveDob]);

  const resolvedGender = useMemo(() => genderSelection, [genderSelection]);

  const langSuggestionsFiltered = useMemo(() => {
    const q = langInput.trim().toLowerCase();
    if (!q) return [...LANGUAGE_SUGGESTIONS];
    return LANGUAGE_SUGGESTIONS.filter((l) => l.toLowerCase().startsWith(q) || l.toLowerCase().includes(q));
  }, [langInput]);

  const customLanguages = useMemo(
    () => languages.filter((l) => !PRESET_LANGUAGES.includes(l as (typeof PRESET_LANGUAGES)[number])),
    [languages],
  );

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

      const userId = session?.user?.id ?? user?.id;

      console.log('STEP 1 - session:', session?.user?.id);
      console.log('STEP 1 - user:', user?.id);

      if (!mounted) return;

      if (!userId) {
        router.replace('/(auth)/login');
        return;
      }

      setUserId(userId);
      setCheckingAuth(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isDemoMode, router]);

  const photoCount = useMemo(() => photos.filter(Boolean).length, [photos]);

  const canProceed = useMemo(() => {
    const photoOk = Platform.OS === 'web' ? true : photoCount >= 1;
    const dobOk = effectiveDob !== null && ageYears !== null && ageYears >= 13 && ageYears <= 120;
    const meetingOk = meetingPreferences.length > 0;
    return (
      photoOk &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      district.trim().length > 0 &&
      resolvedGender !== null &&
      meetingOk &&
      dobOk
    );
  }, [ageYears, district, effectiveDob, firstName, lastName, meetingPreferences.length, photoCount, resolvedGender]);

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
    setLangInput('');
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

  const handlePickPhoto = async (slotIndex: number) => {
    if (Platform.OS === 'web') {
      Alert.alert('Photos', 'Photo picker is not available on web in this build.');
      return;
    }

    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    console.log('STEP 1 - picker result:', result);

    if (result.canceled || result.assets.length === 0) return;

    const uri = result.assets[0].uri;
    setPhotos((prev) => {
      const next = [...prev];
      next[slotIndex] = uri;
      const selectedPhotoUris = next.filter(Boolean) as string[];
      console.log('STEP 1 - selectedPhotoUris:', selectedPhotoUris);
      return next;
    });
  };

  const handleNext = async () => {
    console.log('STEP 1 - handleNext called');
    if (!userId) return;
    console.log('STEP 1 - canProceed:', canProceed);
    if (!canProceed) {
      Alert.alert('Missing info', 'Please complete all required fields.');
      return;
    }

    if (!effectiveDob || !zodiacInfo) {
      Alert.alert('Birth date', 'Enter a valid date of birth.');
      return;
    }

    if (isDemoMode) {
      router.replace('/profile-setup/step2?demo=1');
      return;
    }

    setSaving(true);
    try {
      const selectedPhotoUris = photos.filter(Boolean) as string[];
      let uploadedPhotoPaths: string[] = [];
      try {
        uploadedPhotoPaths = await uploadPhotosToSupabase(userId, selectedPhotoUris);
      } catch (photoError) {
        console.log('STEP 1 - photo upload skipped:', photoError);
        uploadedPhotoPaths = [];
      }

      const isoDob = `${effectiveDob.getFullYear()}-${pad2(effectiveDob.getMonth() + 1)}-${pad2(effectiveDob.getDate())}`;

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const phoneFromSignup =
        typeof authUser?.user_metadata?.phone_number === 'string'
          ? authUser.user_metadata.phone_number.trim()
          : '';
      /** profiles.phone_number is text nullable — always send string | null (no optional spread). */
      const phone_number: string | null =
        phoneFromSignup.length > 0 ? phoneFromSignup : null;

      const photosForDb = uploadedPhotoPaths.length > 0 ? uploadedPhotoPaths : [];

      const baseProfile = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: fullAddress,
        city,
        district: district.trim(),
        lat,
        lng,
        gender: resolvedGender,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        current_step: 2,
        photos: photosForDb,
        phone_number,
      };

      const minimalProfile = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: fullAddress,
        city,
        district: district.trim(),
        gender: resolvedGender,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        current_step: 2,
        photos: photosForDb,
        phone_number,
      };

      const payloadWithPhotos = {
        ...baseProfile,
        photos: photosForDb,
      };

      console.log('STEP 1 - user id:', userId);
      console.log('STEP 1 - upsert data:', payloadWithPhotos);
      const { error: upsertError } = await supabase.from('profiles').upsert(payloadWithPhotos, {
        onConflict: 'id',
      });
      console.log('STEP 1 - upsert error:', upsertError);

      if (upsertError) {
        console.log('STEP 1 - user id:', userId);
        console.log('STEP 1 - upsert data:', baseProfile);
        const { error: fallbackError } = await supabase.from('profiles').upsert(baseProfile, {
          onConflict: 'id',
        });
        console.log('STEP 1 - upsert error:', fallbackError);
        if (fallbackError) {
          console.log('STEP 1 - user id:', userId);
          console.log('STEP 1 - upsert data:', minimalProfile);
          const { error: minimalError } = await supabase.from('profiles').upsert(minimalProfile, {
            onConflict: 'id',
          });
          console.log('STEP 1 - upsert error:', minimalError);
          if (minimalError) throw minimalError;
        }
      }

      router.replace('/profile-setup/step2');
    } catch (e: any) {
      console.error('STEP 1 - handleNext error:', e);
      console.warn(e);
      Alert.alert('Kayıt başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) return null;

  return (
    <ScreenContainer style={styles.screenTight}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <HomeTopIcon />
          <SetupScreenHeader step={1} />
          <ThemedText style={styles.title}>Let&apos;s build your profile</ThemedText>

          <View style={[styles.photoRow, { marginBottom: GAP }]}>
            {photos.map((uri, idx) => {
              const isFilled = !!uri;
              const showPlus = idx === 0 && !isFilled;
              const tileStyle = [
                styles.photoTile,
                { width: photoSlotSize, height: photoSlotSize, maxWidth: PHOTO_SLOT_MAX, maxHeight: PHOTO_SLOT_MAX },
              ];

              return (
                <Pressable
                  key={idx}
                  style={tileStyle}
                  onPress={() => handlePickPhoto(idx)}
                  accessibilityRole="button">
                  {isFilled ? (
                    <Image source={{ uri }} style={styles.photoImage} />
                  ) : showPlus ? (
                    <ThemedText style={styles.plus}>+</ThemedText>
                  ) : (
                    <ThemedText style={styles.emptySlot}> </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.sectionLabel}>What&apos;s your name?</ThemedText>
          <View style={[styles.nameColumn, { marginBottom: GAP }]}>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#AAAAAA"
              autoCapitalize="words"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#AAAAAA"
              autoCapitalize="words"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.blockLabel}>Birth date</ThemedText>
            <View style={styles.row3}>
              <TextInput
                style={[styles.dobInput, styles.dobInputDay]}
                placeholder="DD"
                placeholderTextColor="#AAAAAA"
                keyboardType="number-pad"
                maxLength={2}
                value={dobDay}
                onChangeText={setDobDay}
              />
              <TextInput
                style={[styles.dobInput, styles.dobInputMonth]}
                placeholder="MM"
                placeholderTextColor="#AAAAAA"
                keyboardType="number-pad"
                maxLength={2}
                value={dobMonth}
                onChangeText={setDobMonth}
              />
              <TextInput
                style={[styles.dobInput, styles.dobInputYear]}
                placeholder="YYYY"
                placeholderTextColor="#AAAAAA"
                keyboardType="number-pad"
                maxLength={4}
                value={dobYear}
                onChangeText={setDobYear}
              />
            </View>
            {zodiacInfo && ageYears !== null ? (
              <Animated.View entering={FadeIn.duration(220)}>
                <ThemedText style={styles.zodiacAgeLine}>
                  {formatZodiacTooltip(zodiacInfo)} · Age {ageYears}
                </ThemedText>
              </Animated.View>
            ) : null}
          </View>

          <ThemedText style={styles.sectionLabel}>Where are you based?</ThemedText>
          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.blockLabel}>Şehir</ThemedText>
            <View style={styles.chipRow}>
              {CITY_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={city === opt}
                  onPress={() => setCity(opt)}
                  style={styles.profileChip}
                />
              ))}
            </View>
          </View>
          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.blockLabel}>Semt / Mahalle</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="örn. Kadıköy, Moda, Beşiktaş"
              placeholderTextColor="#AAAAAA"
              autoCapitalize="words"
              value={district}
              onChangeText={setDistrict}
            />
          </View>
          <TouchableOpacity
            style={[styles.locationBtn, { marginBottom: GAP }]}
            onPress={() => {
              setDistrict('Kadikoy');
              setCity('Istanbul');
              setLat(40.9917);
              setLng(29.0277);
            }}>
            <ThemedText style={styles.locationBtnText}>Use my location</ThemedText>
          </TouchableOpacity>

          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.sectionLabel}>Which gender best describes you?</ThemedText>
            <View style={styles.chipRow}>
              {GENDER_CHIPS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={genderSelection === opt}
                  onPress={() => setGenderSelection(opt)}
                  style={styles.profileChip}
                />
              ))}
            </View>
          </View>

          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.sectionLabel}>Who would you like to meet?</ThemedText>
            <View style={styles.chipRow}>
              {(['Men', 'Women', 'Non-binary', 'Everyone'] as const).map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={meetingPreferences.includes(opt)}
                  onPress={() => toggleMeetingPref(opt)}
                  style={styles.profileChip}
                />
              ))}
            </View>
          </View>

          <View style={{ marginBottom: GAP }}>
            <ThemedText style={styles.sectionLabel}>Which languages do you speak?</ThemedText>
            <View style={styles.chipRow}>
              {PRESET_LANGUAGES.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={languages.includes(opt)}
                  onPress={() => toggleLanguage(opt)}
                  style={styles.profileChip}
                />
              ))}
              {customLanguages.map((lang) => (
                <Animated.View key={lang} entering={FadeIn.duration(200)}>
                  <Chip label={lang} selected onPress={() => toggleLanguage(lang)} style={styles.profileChip} />
                </Animated.View>
              ))}
            </View>
            <View style={styles.langInputWrap}>
              <TextInput
                style={styles.addInput}
                placeholder={languages.length >= MAX_LANGUAGES ? 'Maximum 5 reached' : '+ Add language'}
                placeholderTextColor="#AAAAAA"
                value={langInput}
                editable={languages.length < MAX_LANGUAGES}
                onChangeText={setLangInput}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const t = langInput.trim();
                  if (!t || languages.length >= MAX_LANGUAGES) return;
                  addLanguage(t);
                }}
              />
              {langInput.trim().length > 0 && languages.length < MAX_LANGUAGES && langSuggestionsFiltered.length > 0 ? (
                <View style={styles.dropdown}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
                    {langSuggestionsFiltered.slice(0, 8).map((lang) => (
                      <Pressable
                        key={lang}
                        style={styles.dropdownItem}
                        onPress={() => {
                          addLanguage(lang);
                        }}>
                        <ThemedText style={styles.dropdownItemText}>{lang}</ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.footer}>
            <PrimaryButton label={saving ? 'Saving…' : 'Next →'} onPress={handleNext} disabled={!canProceed || saving} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenTight: {
    justifyContent: 'flex-start',
    paddingVertical: 12,
  },
  keyboard: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: GAP,
    textAlign: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  photoTile: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  plus: {
    fontSize: 26,
    color: colors.accent,
    fontWeight: '700',
  },
  emptySlot: {
    color: '#E5E5E5',
    fontSize: 10,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    color: colors.textPrimary,
  },
  nameColumn: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 8,
  },
  blockLabel: {
    color: colors.accent,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  row3: {
    flexDirection: 'row',
    gap: 6,
  },
  dobInputDay: {
    width: 48,
  },
  dobInputMonth: {
    width: 48,
  },
  dobInputYear: {
    width: 72,
  },
  dobInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 4,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
  },
  zodiacAgeLine: {
    marginTop: 6,
    color: colors.accent,
    fontSize: 12,
  },
  locationBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  locationBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileChip: {
    borderRadius: 20,
  },
  addInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    color: colors.textPrimary,
  },
  langInputWrap: {
    marginTop: 8,
    position: 'relative',
    zIndex: 20,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    maxHeight: 160,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 160,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  dropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  footer: {
    marginTop: 8,
  },
});
