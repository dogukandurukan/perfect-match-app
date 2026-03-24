import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';
import { calculateAge, formatZodiacTooltip, getZodiacFromDate } from '@/lib/zodiac';

type Gender = 'Man' | 'Woman' | 'Non-binary';
type MeetingPref = 'Men' | 'Women' | 'Non-binary' | 'Everyone';
type HeightUnit = 'cm' | 'ft';

const PRESET_LANGUAGES = ['Turkish', 'English', 'German'] as const;
const MAX_LANGUAGES = 5;

const PHOTO_SLOTS = 3;
/** Per doc: each slot max 100×100, responsive below that */
const PHOTO_SLOT_MAX = 100;
const PROFILE_PHOTOS_BUCKET = 'profile-photos';

function getMimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateDisplay(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseWebDob(day: string, month: string, year: string): Date | null {
  const dd = Number(day);
  const mm = Number(month);
  const yyyy = Number(year);
  if (!yyyy || !mm || !dd || yyyy < 1900 || mm > 12 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

async function uploadPhotosToSupabase(userId: string, uris: string[]): Promise<string[]> {
  try {
    const urls: string[] = [];
    const storage = supabase.storage.from(PROFILE_PHOTOS_BUCKET);

    await Promise.all(
      uris.map(async (uri, index) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const contentType = getMimeTypeFromUri(uri);

        const path = `${userId}/photo_${index}.jpg`;
        const uploadRes = await storage.upload(path, blob, {
          contentType,
          upsert: true,
        });

        if (uploadRes.error) throw uploadRes.error;

        const publicUrl = storage.getPublicUrl(path).data.publicUrl;
        urls.push(publicUrl);
      }),
    );

    return urls;
  } catch (e) {
    console.warn('Photo upload failed (continuing without blocking):', e);
    return [];
  }
}

export default function ProfileSetupStep1() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const photoSlotSize = useMemo(() => {
    const horizontalPadding = 24 * 2;
    const gaps = 12 * (PHOTO_SLOTS - 1);
    const raw = Math.floor((windowWidth - horizontalPadding - gaps) / PHOTO_SLOTS);
    return Math.max(56, Math.min(PHOTO_SLOT_MAX, raw));
  }, [windowWidth]);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [photos, setPhotos] = useState<(string | null)[]>(() => Array(PHOTO_SLOTS).fill(null));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [webDobDay, setWebDobDay] = useState('');
  const [webDobMonth, setWebDobMonth] = useState('');
  const [webDobYear, setWebDobYear] = useState('');

  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');

  const [location, setLocation] = useState('Kadikoy, Istanbul');
  const [city, setCity] = useState('Istanbul');
  const [district, setDistrict] = useState('Kadikoy');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [meetingPreferences, setMeetingPreferences] = useState<MeetingPref[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState('');

  const [saving, setSaving] = useState(false);

  const effectiveDob = useMemo(() => {
    if (Platform.OS === 'web') {
      return parseWebDob(webDobDay, webDobMonth, webDobYear);
    }
    return dateOfBirth;
  }, [dateOfBirth, webDobDay, webDobMonth, webDobYear]);

  const zodiacInfo = useMemo(() => (effectiveDob ? getZodiacFromDate(effectiveDob) : null), [effectiveDob]);
  const ageYears = useMemo(() => (effectiveDob ? calculateAge(effectiveDob) : null), [effectiveDob]);

  const maxDobDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d;
  }, []);

  const minDobDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    return d;
  }, []);

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

  const photoCount = useMemo(() => photos.filter(Boolean).length, [photos]);

  const canProceed = useMemo(() => {
    const photoOk = Platform.OS === 'web' ? true : photoCount >= 1;
    const dobOk = effectiveDob !== null && ageYears !== null && ageYears >= 13 && ageYears <= 120;
    const meetingOk = meetingPreferences.length > 0;
    return (
      photoOk &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      location.trim().length > 0 &&
      gender !== null &&
      meetingOk &&
      dobOk
    );
  }, [ageYears, effectiveDob, firstName, gender, lastName, location, meetingPreferences.length, photoCount]);

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

  const customLanguages = useMemo(
    () => languages.filter((l) => !PRESET_LANGUAGES.includes(l as (typeof PRESET_LANGUAGES)[number])),
    [languages],
  );

  const handlePickPhoto = async (slotIndex: number) => {
    if (Platform.OS === 'web') {
      Alert.alert('Photo yükleme', 'Şu an web üzerinde fotoğraf seçimi desteklenmiyor.');
      return;
    }

    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraflara erişim izni vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const uri = result.assets[0].uri;
    setPhotos((prev) => {
      const next = [...prev];
      next[slotIndex] = uri;
      return next;
    });
  };

  const onDobChange = (event: { type?: string }, selected?: Date) => {
    if (Platform.OS === 'android') setShowDobPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setDateOfBirth(selected);
  };

  const handleNext = async () => {
    if (!userId) return;
    if (!canProceed) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm zorunlu alanları tamamlayın.');
      return;
    }

    if (!effectiveDob || !zodiacInfo) {
      Alert.alert('Doğum tarihi', 'Geçerli bir doğum tarihi gir.');
      return;
    }

    if (isDemoMode) {
      router.replace('/profile-setup/step2?demo=1');
      return;
    }

    setSaving(true);
    try {
      const selectedPhotoUris = photos.filter(Boolean) as string[];
      const uploadedPhotoUrls = await uploadPhotosToSupabase(userId, selectedPhotoUris);

      const isoDob = `${effectiveDob.getFullYear()}-${pad2(effectiveDob.getMonth() + 1)}-${pad2(effectiveDob.getDate())}`;

      const baseProfile = {
        id: userId,
        username: `${firstName.trim()} ${lastName.trim()}`.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: location.trim(),
        city,
        district,
        lat,
        lng,
        gender,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        height: height.trim() ? Number(height.replace(',', '.')) : null,
        height_unit: height.trim() ? heightUnit : null,
        setup1_completed: true,
      };

      const minimalProfile = {
        id: userId,
        username: `${firstName.trim()} ${lastName.trim()}`.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_address: location.trim(),
        city,
        district,
        gender,
        meeting_preferences: meetingPreferences,
        languages: languages.length ? languages : null,
        date_of_birth: isoDob,
        zodiac_sign: zodiacInfo.sign,
        setup1_completed: true,
      };

      const payloadWithPhotos = {
        ...baseProfile,
        photo_urls: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : null,
      };

      const { error: upsertError } = await supabase.from('profiles').upsert(payloadWithPhotos, {
        onConflict: 'id',
      });

      if (upsertError) {
        const { error: fallbackError } = await supabase.from('profiles').upsert(baseProfile, {
          onConflict: 'id',
        });
        if (fallbackError) {
          const { error: minimalError } = await supabase.from('profiles').upsert(minimalProfile, {
            onConflict: 'id',
          });
          if (minimalError) throw minimalError;
        }
      }

      router.replace('/profile-setup/step2');
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) return null;

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.progress}>Step 1 of 4</ThemedText>
        <ThemedText style={styles.title}>Let's build your profile</ThemedText>

        <View style={styles.photoRow}>
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

        <ThemedText style={styles.sectionLabel}>What's your name?</ThemedText>
        <View style={styles.inlineInputs}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="First name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Last name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        <ThemedText style={styles.sectionLabel}>When were you born?</ThemedText>
        {Platform.OS === 'web' ? (
          <View style={styles.row3}>
            <TextInput
              style={[styles.input, styles.third]}
              placeholder="DD"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={2}
              value={webDobDay}
              onChangeText={setWebDobDay}
            />
            <TextInput
              style={[styles.input, styles.third]}
              placeholder="MM"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={2}
              value={webDobMonth}
              onChangeText={setWebDobMonth}
            />
            <TextInput
              style={[styles.input, styles.third]}
              placeholder="YYYY"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              value={webDobYear}
              onChangeText={setWebDobYear}
            />
          </View>
        ) : (
          <>
            <View style={styles.dobRow}>
              <Pressable style={[styles.input, styles.dobPressable]} onPress={() => setShowDobPicker(true)}>
                <ThemedText style={styles.dobText}>
                  {dateOfBirth ? formatDateDisplay(dateOfBirth) : 'Tap to choose date'}
                </ThemedText>
              </Pressable>
              {zodiacInfo ? (
                <View style={styles.zodiacTooltip}>
                  <ThemedText style={styles.zodiacTooltipText}>{formatZodiacTooltip(zodiacInfo)}</ThemedText>
                </View>
              ) : null}
            </View>
            {ageYears !== null && effectiveDob ? (
              <ThemedText style={styles.ageHint}>Age: {ageYears}</ThemedText>
            ) : null}
            {showDobPicker && Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide" visible={showDobPicker}>
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <DateTimePicker
                      value={dateOfBirth ?? maxDobDate}
                      mode="date"
                      display="spinner"
                      themeVariant="dark"
                      minimumDate={minDobDate}
                      maximumDate={maxDobDate}
                      onChange={onDobChange}
                    />
                    <PrimaryButton label="Done" onPress={() => setShowDobPicker(false)} />
                  </View>
                </View>
              </Modal>
            ) : null}
            {showDobPicker && Platform.OS === 'android' ? (
              <DateTimePicker
                value={dateOfBirth ?? maxDobDate}
                mode="date"
                display="default"
                minimumDate={minDobDate}
                maximumDate={maxDobDate}
                onChange={onDobChange}
              />
            ) : null}
          </>
        )}

        {Platform.OS === 'web' && zodiacInfo ? (
          <View style={styles.webZodiacRow}>
            <View style={styles.zodiacTooltip}>
              <ThemedText style={styles.zodiacTooltipText}>{formatZodiacTooltip(zodiacInfo)}</ThemedText>
            </View>
            {ageYears !== null ? (
              <ThemedText style={styles.ageHint}>Age: {ageYears}</ThemedText>
            ) : null}
          </View>
        ) : null}

        <ThemedText style={styles.sectionLabel}>How tall are you? (optional)</ThemedText>
        <View style={styles.rowHeight}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Height"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            value={height}
            onChangeText={setHeight}
          />
          <Chip label="cm" selected={heightUnit === 'cm'} onPress={() => setHeightUnit('cm')} style={styles.unitChip} />
          <Chip label="ft" selected={heightUnit === 'ft'} onPress={() => setHeightUnit('ft')} style={styles.unitChip} />
        </View>

        <ThemedText style={styles.sectionLabel}>Where are you based?</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Kadikoy, Istanbul"
          placeholderTextColor="#9CA3AF"
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            const parts = value.split(',').map((x) => x.trim());
            if (parts[0]) setDistrict(parts[0]);
            if (parts[1]) setCity(parts[1]);
          }}
        />
        <TouchableOpacity
          style={styles.locationBtn}
          onPress={() => {
            setLocation('Kadikoy, Istanbul');
            setDistrict('Kadikoy');
            setCity('Istanbul');
            setLat(40.9917);
            setLng(29.0277);
          }}>
          <ThemedText style={styles.locationBtnText}>Use my location</ThemedText>
        </TouchableOpacity>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which gender best describes you?</ThemedText>
          <View style={styles.chipRow}>
            {(['Man', 'Woman', 'Non-binary'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={gender === opt}
                onPress={() => setGender(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which gender(s) are you open to meeting?</ThemedText>
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

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which languages do you speak?</ThemedText>
          <ThemedText style={styles.langSubtitle}>Optional — add up to 5 for better matches</ThemedText>
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
          </View>
          <View style={styles.addInputWrap}>
            <TextInput
              style={styles.addInput}
              placeholder="+ Add your own"
              placeholderTextColor="#9CA3AF"
              value={newLanguage}
              onChangeText={setNewLanguage}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = newLanguage.trim();
                if (!t) return;
                setNewLanguage('');
                toggleLanguage(t);
              }}
            />
          </View>
          {customLanguages.length > 0 ? (
            <View style={styles.customLangRow}>
              {customLanguages.map((lang) => (
                <Chip
                  key={lang}
                  label={lang}
                  selected
                  onPress={() => toggleLanguage(lang)}
                  style={styles.profileChip}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={saving ? 'Saving…' : 'Next →'} onPress={handleNext} disabled={!canProceed || saving} loading={saving} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  content: {
    paddingBottom: 40,
  },
  progress: {
    textAlign: 'center',
    color: '#C9A96E',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 24,
  },
  title: {
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 12,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  photoTile: {
    backgroundColor: '#1C2030',
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
    fontSize: 30,
    color: '#C9A96E',
    fontWeight: '700',
  },
  emptySlot: {
    color: '#2B3249',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#F5F0E8',
    marginBottom: 12,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  row3: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  third: {
    flex: 1,
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  dobPressable: {
    flex: 1,
    minWidth: 160,
    justifyContent: 'center',
    marginBottom: 0,
  },
  dobText: {
    color: '#F5F0E8',
    fontSize: 16,
  },
  zodiacTooltip: {
    backgroundColor: '#2B3249',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9A96E',
  },
  zodiacTooltipText: {
    color: '#C9A96E',
    fontSize: 14,
    fontWeight: '600',
  },
  webZodiacRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  ageHint: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1C2030',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
  },
  rowHeight: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
    marginBottom: 0,
  },
  unitChip: {
    height: 44,
    justifyContent: 'center',
    minWidth: 58,
  },
  locationBtn: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2B3249',
  },
  locationBtnText: {
    color: '#F5F0E8',
    fontSize: 14,
  },
  section: {
    marginTop: 6,
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#C9A96E',
    fontSize: 14,
    marginBottom: 12,
  },
  langSubtitle: {
    color: 'rgba(245, 240, 232, 0.5)',
    fontSize: 13,
    marginBottom: 12,
    marginTop: -6,
  },
  addInputWrap: {
    marginTop: 12,
  },
  addInput: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F5F0E8',
  },
  customLangRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileChip: {
    borderRadius: 20,
  },
  footer: {
    marginTop: 12,
  },
});
