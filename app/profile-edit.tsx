// Screen: Edit profile | Status: stable | Last updated: Ağustos 2026
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Chip } from '@/components/ui/Chip';
import { colors } from '@/lib/designTokens';
import type { ChipIcon } from '@/lib/hingeProfile';
import { MEETING_VENUE_OPTIONS } from '@/lib/meetingVenues';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

const MAX_PHOTOS = 5;
const PHOTOS_BUCKET = 'user-photos';
const BIO_MAX_LENGTH = 300;

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HOUR_OPTIONS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)', 'Always'] as const;

function SectionTitle({ icon, title }: { icon: ChipIcon; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

function ChipInput({
  icon,
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  icon: ChipIcon;
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
}) {
  const [input, setInput] = useState('');

  function handleSubmit() {
    const t = input.trim();
    if (!t) return;
    onAdd(t);
    setInput('');
  }

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={14} color={colors.textPrimary} />
        <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      </View>
      {items.length > 0 && (
        <View style={styles.chipsColumn}>
          {items.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.chipAdded}
              onPress={() => onRemove(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item}`}>
              <ThemedText style={styles.chipAddedText}>{item} ✕</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.inputFlex}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor="#AAAAAA"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Add to ${label}`}>
          <ThemedText style={styles.addBtnText}>+ Add</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function parseField(val: string | string[] | null): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolvePhotoUrls(refs: string[]): Promise<string[]> {
  const urls = await Promise.all(
    refs.map(async (ref) => {
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        return ref;
      }
      const signed = await resolveProfilePhotoUrl(ref);
      return signed || ref;
    }),
  );
  return urls;
}

export default function ProfileEditScreen() {
  const router = useRouter();

  const [bio, setBio] = useState('');
  const [idealDate, setIdealDate] = useState('');
  const [availDays, setAvailDays] = useState<string[]>([]);
  const [availHours, setAvailHours] = useState<string[]>([]);
  const [meetingEnv, setMeetingEnv] = useState<string[]>([]);
  const [favoriteSpots, setFavoriteSpots] = useState<Record<string, string>>({});

  const [musicItems, setMusicItems] = useState<string[]>([]);
  const [movieItems, setMovieItems] = useState<string[]>([]);
  const [bookItems, setBookItems] = useState<string[]>([]);
  const [activityItems, setActivityItems] = useState<string[]>([]);
  const [coreValueItems, setCoreValueItems] = useState<string[]>([]);
  const [impressedByItems, setImpressedByItems] = useState<string[]>([]);
  const [dealbreakerItems, setDealbreakerItems] = useState<string[]>([]);

  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoStorageRefs, setPhotoStorageRefs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        const { data } = await supabase
          .from('profiles')
          .select(
            `
            bio, photos, availability_days, availability_hours, meeting_environment,
            favorite_spots, first_date_expectation,
            favorite_music, favorite_movie, favorite_book, favorite_activity,
            core_value, impressed_by, dealbreaker
          `,
          )
          .eq('id', user.id)
          .single();

        if (!mounted || !data) return;

        const refs = data.photos ?? [];
        setPhotoStorageRefs(refs);
        setPhotoUrls(await resolvePhotoUrls(refs));

        setBio(data.bio ?? '');
        setIdealDate(data.first_date_expectation ?? '');
        setAvailDays(data.availability_days ?? []);
        setAvailHours(data.availability_hours ?? []);
        setMeetingEnv(data.meeting_environment ?? []);
        setFavoriteSpots(
          data.favorite_spots && typeof data.favorite_spots === 'object'
            ? (data.favorite_spots as Record<string, string>)
            : {},
        );

        setMusicItems(parseField(data.favorite_music));
        setMovieItems(parseField(data.favorite_movie));
        setBookItems(parseField(data.favorite_book));
        setActivityItems(parseField(data.favorite_activity));
        setCoreValueItems(parseField(data.core_value));
        setImpressedByItems(parseField(data.impressed_by));
        setDealbreakerItems(parseField(data.dealbreaker));
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  function addTo(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    return (val: string) => setter((prev) => (prev.includes(val) ? prev : [...prev, val]));
  }
  function removeFrom(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    return (val: string) => setter((prev) => prev.filter((v) => v !== val));
  }
  function toggleChip(
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
  ) {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function toggleVenue(label: string) {
    setMeetingEnv((prev) => {
      if (prev.includes(label)) {
        const def = MEETING_VENUE_OPTIONS.find((v) => v.label === label);
        if (def) {
          setFavoriteSpots((spots) => {
            const next = { ...spots };
            delete next[def.spotKey];
            return next;
          });
        }
        return prev.filter((v) => v !== label);
      }
      return [...prev, label];
    });
  }

  function setSpot(key: string, text: string) {
    setFavoriteSpots((prev) => ({ ...prev, [key]: text }));
  }

  async function persistPhotosOnly(refs: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ photos: refs.length ? refs : null })
      .eq('id', user.id);

    if (error) {
      console.warn('[ProfileEdit] persistPhotosOnly failed', error);
      Alert.alert('Could not save photos', 'Please try again.');
    }
  }

  async function handlePickPhoto() {
    if (photoStorageRefs.length >= MAX_PHOTOS) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session.');

      const uri = result.assets[0].uri;
      const storagePath = `${user.id}/${Date.now()}.jpg`;

      const response = await fetch(uri);
      if (!response.ok) throw new Error('Could not read photo.');

      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const nextRefs = [...photoStorageRefs, storagePath];
      setPhotoStorageRefs(nextRefs);
      setPhotoUrls(await resolvePhotoUrls(nextRefs));
      await persistPhotosOnly(nextRefs);
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(index: number) {
    const nextRefs = photoStorageRefs.filter((_, i) => i !== index);
    setPhotoStorageRefs(nextRefs);
    setPhotoUrls(await resolvePhotoUrls(nextRefs));
    await persistPhotosOnly(nextRefs);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session.');

      const cleanedSpots = Object.fromEntries(
        Object.entries(favoriteSpots).filter(([, v]) => String(v ?? '').trim().length > 0),
      );

      const { error } = await supabase
        .from('profiles')
        .update({
          bio: bio.trim() || null,
          first_date_expectation: idealDate.trim() || null,
          availability_days: availDays.length ? availDays : null,
          availability_hours: availHours.length ? availHours : null,
          meeting_environment: meetingEnv.length ? meetingEnv : null,
          favorite_spots: Object.keys(cleanedSpots).length ? cleanedSpots : null,
          favorite_music: musicItems.length ? musicItems.join(', ') : null,
          favorite_movie: movieItems.length ? movieItems.join(', ') : null,
          favorite_book: bookItems.length ? bookItems.join(', ') : null,
          favorite_activity: activityItems.length ? activityItems.join(', ') : null,
          core_value: coreValueItems.length ? coreValueItems.join(', ') : null,
          impressed_by: impressedByItems.length ? impressedByItems.join(', ') : null,
          dealbreaker: dealbreakerItems.length ? dealbreakerItems.join(', ') : null,
          photos: photoStorageRefs.length ? photoStorageRefs : null,
        })
        .eq('id', user.id);

      if (error) throw new Error(error.message);

      Alert.alert('Saved ✓', 'Your profile has been updated.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.pageTitle}>Edit your profile</ThemedText>

          {/* Photos */}
          <View style={styles.section}>
            <SectionTitle icon="camera-outline" title="Photos" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosRow}>
              {photoUrls.map((url, index) => (
                <View key={`${url}-${index}`} style={styles.photoSlot}>
                  <Image source={{ uri: url }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => handleRemovePhoto(index)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo">
                    <ThemedText style={styles.photoRemoveText}>✕</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
              {photoUrls.length < MAX_PHOTOS && (
                <TouchableOpacity
                  style={styles.photoAddSlot}
                  onPress={handlePickPhoto}
                  disabled={uploading}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo">
                  {uploading ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <ThemedText style={styles.photoAddText}>+</ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* About */}
          <View style={styles.section}>
            <SectionTitle icon="create-outline" title="About me" />
            <View style={styles.fieldWrap}>
              <ThemedText style={styles.fieldLabel}>A little about yourself</ThemedText>
              <TextInput
                style={[styles.inputFlex, styles.inputMulti]}
                value={bio}
                onChangeText={setBio}
                placeholder="A couple of sentences about you..."
                placeholderTextColor="#AAAAAA"
                multiline
                numberOfLines={3}
                maxLength={BIO_MAX_LENGTH}
              />
              <ThemedText style={styles.charCount}>
                {bio.length}/{BIO_MAX_LENGTH}
              </ThemedText>
            </View>
          </View>

          {/* Prompts */}
          <View style={styles.section}>
            <SectionTitle icon="heart-outline" title="My ideal date" />
            <View style={styles.fieldWrap}>
              <TextInput
                style={[styles.inputFlex, styles.inputMulti]}
                value={idealDate}
                onChangeText={setIdealDate}
                placeholder="What does your ideal date look like?"
                placeholderTextColor="#AAAAAA"
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <SectionTitle icon="calendar-outline" title="Available days" />
            <View style={styles.chipsRow}>
              {DAY_OPTIONS.map((day) => (
                <Chip
                  key={day}
                  label={day}
                  selected={availDays.includes(day)}
                  onPress={() => toggleChip(availDays, setAvailDays, day)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle icon="time-outline" title="Available hours" />
            <View style={styles.chipsRow}>
              {HOUR_OPTIONS.map((hour) => (
                <Chip
                  key={hour}
                  label={hour}
                  selected={availHours.includes(hour)}
                  onPress={() => toggleChip(availHours, setAvailHours, hour)}
                />
              ))}
            </View>
          </View>

          {/* Meeting preferences */}
          <View style={styles.section}>
            <SectionTitle icon="cafe-outline" title="What kind of date sounds fun to you?" />
            <View style={styles.chipsRow}>
              {MEETING_VENUE_OPTIONS.map(({ label }) => (
                <Chip
                  key={label}
                  label={label}
                  selected={meetingEnv.includes(label)}
                  onPress={() => toggleVenue(label)}
                />
              ))}
            </View>
            {MEETING_VENUE_OPTIONS.map(({ label, spotKey, placeholder }) =>
              meetingEnv.includes(label) ? (
                <OptionalFieldReveal key={spotKey} show animationKey={spotKey}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder={placeholder}
                    placeholderTextColor="#AAAAAA"
                    value={favoriteSpots[spotKey] ?? ''}
                    onChangeText={(t) => setSpot(spotKey, t)}
                  />
                </OptionalFieldReveal>
              ) : null,
            )}
          </View>

          {/* Interests & Taste */}
          <View style={styles.section}>
            <SectionTitle icon="sparkles-outline" title="Interests & taste" />
            <ThemedText style={styles.sectionSubtitle}>
              Every field you fill in improves your match score.
            </ThemedText>

            <ChipInput
              icon="musical-notes-outline"
              label="Music (genre or artist)"
              placeholder="e.g. Jazz, Radiohead, Daft Punk"
              items={musicItems}
              onAdd={addTo(setMusicItems)}
              onRemove={removeFrom(setMusicItems)}
            />
            <ChipInput
              icon="film-outline"
              label="Movies & shows"
              placeholder="e.g. Eternal Sunshine, Breaking Bad..."
              items={movieItems}
              onAdd={addTo(setMovieItems)}
              onRemove={removeFrom(setMovieItems)}
            />
            <ChipInput
              icon="book-outline"
              label="Books"
              placeholder="e.g. The Little Prince, Sapiens..."
              items={bookItems}
              onAdd={addTo(setBookItems)}
              onRemove={removeFrom(setBookItems)}
            />
            <ChipInput
              icon="star-outline"
              label="Hobbies"
              placeholder="e.g. Hiking, photography, reading..."
              items={activityItems}
              onAdd={addTo(setActivityItems)}
              onRemove={removeFrom(setActivityItems)}
            />
          </View>

          {/* Values */}
          <View style={styles.section}>
            <SectionTitle icon="diamond-outline" title="Your values" />
            <ChipInput
              icon="diamond-outline"
              label="What matters most to you in life"
              placeholder="e.g. Honesty, freedom..."
              items={coreValueItems}
              onAdd={addTo(setCoreValueItems)}
              onRemove={removeFrom(setCoreValueItems)}
            />
            <ChipInput
              icon="flash-outline"
              label="What impresses you"
              placeholder="e.g. Curiosity, a good listener..."
              items={impressedByItems}
              onAdd={addTo(setImpressedByItems)}
              onRemove={removeFrom(setImpressedByItems)}
            />
            <ChipInput
              icon="close-circle-outline"
              label="Dealbreakers"
              placeholder="e.g. Chronic lateness, rudeness..."
              items={dealbreakerItems}
              onAdd={addTo(setDealbreakerItems)}
              onRemove={removeFrom(setDealbreakerItems)}
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save profile">
            <ThemedText style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save ✓'}</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  keyboard: { flex: 1 },
  content: { paddingBottom: 48, gap: 20 },

  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },

  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: -6,
  },

  fieldWrap: { gap: 8 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  charCount: { fontSize: 11, color: '#AAAAAA', textAlign: 'right' },

  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  chipAdded: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipAddedText: { color: colors.accent, fontSize: 13, fontWeight: '500' },

  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  photosRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  photoSlot: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  photoAddSlot: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CCC',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontSize: 32, color: '#AAA', fontWeight: '300' },
});
