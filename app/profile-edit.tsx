// Screen: Profil düzenleme | Status: stable | Last updated: Mayıs 2026
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
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Chip } from '@/components/ui/Chip';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

const MAX_PHOTOS = 3;
const PHOTOS_BUCKET = 'user-photos';

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HOUR_OPTIONS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)', 'Always'] as const;
const MEETING_ENV_OPTIONS = [
  'Coffee',
  'Walk in the park',
  'Dinner',
  'Drinks',
  'Something active',
] as const;

function ChipInput({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
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
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {items.length > 0 && (
        <View style={styles.chipsColumn}>
          {items.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.chipAdded}
              onPress={() => onRemove(item)}
              activeOpacity={0.7}>
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
          activeOpacity={0.8}>
          <ThemedText style={styles.addBtnText}>+ Ekle</ThemedText>
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
      console.log('[resolvePhotoUrls] ref:', ref);
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        return ref;
      }
      const signed = await resolveProfilePhotoUrl(ref);
      console.log('[resolvePhotoUrls] signed:', signed);
      return signed || ref;
    }),
  );
  return urls;
}

export default function ProfileEditScreen() {
  const router = useRouter();

  const [bio, setBio] = useState('');
  const [availDays, setAvailDays] = useState<string[]>([]);
  const [availHours, setAvailHours] = useState<string[]>([]);
  const [meetingEnv, setMeetingEnv] = useState<string[]>([]);

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
        setAvailDays(data.availability_days ?? []);
        setAvailHours(data.availability_hours ?? []);
        setMeetingEnv(data.meeting_environment ?? []);

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

  async function persistPhotosOnly(refs: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ photos: refs.length ? refs : null })
      .eq('id', user.id);
  }

  async function handlePickPhoto() {
    if (photoStorageRefs.length >= MAX_PHOTOS) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Fotoğraf erişimine izin vermeniz gerekiyor');
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
      if (!user) throw new Error('Oturum bulunamadı.');

      const uri = result.assets[0].uri;
      const storagePath = `${user.id}/${Date.now()}.jpg`;

      const response = await fetch(uri);
      if (!response.ok) throw new Error('Fotoğraf okunamadı.');

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
      Alert.alert('Fotoğraf yüklenemedi, tekrar dene');
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
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('profiles')
        .update({
          bio: bio.trim() || null,
          availability_days: availDays.length ? availDays : null,
          availability_hours: availHours.length ? availHours : null,
          meeting_environment: meetingEnv.length ? meetingEnv : null,
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

      Alert.alert('Kaydedildi ✓', 'Profilin güncellendi.', [
        {
          text: 'Tamam',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Bir hata oluştu.';
      Alert.alert('Hata', message);
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
          <ThemedText style={styles.pageTitle}>Profilini Düzenle ✏️</ThemedText>

          {/* Fotoğraflar */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📷 Fotoğraflar</ThemedText>
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
                    activeOpacity={0.8}>
                    <ThemedText style={styles.photoRemoveText}>✕</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
              {photoUrls.length < MAX_PHOTOS && (
                <TouchableOpacity
                  style={styles.photoAddSlot}
                  onPress={handlePickPhoto}
                  disabled={uploading}
                  activeOpacity={0.8}>
                  {uploading ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <ThemedText style={styles.photoAddText}>+</ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📝 Hakkında</ThemedText>
            <View style={styles.fieldWrap}>
              <ThemedText style={styles.fieldLabel}>Kendini kısaca anlat</ThemedText>
              <TextInput
                style={[styles.inputFlex, styles.inputMulti]}
                value={bio}
                onChangeText={setBio}
                placeholder="Birkaç cümleyle kendinizden bahsedin..."
                placeholderTextColor="#AAAAAA"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Müsait günler */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📅 Müsait Günler</ThemedText>
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

          {/* Müsait saatler */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>🕐 Müsait Saatler</ThemedText>
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

          {/* Buluşma ortamı */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>☕ Buluşma Ortamı</ThemedText>
            <View style={styles.chipsRow}>
              {MEETING_ENV_OPTIONS.map((env) => (
                <Chip
                  key={env}
                  label={env}
                  selected={meetingEnv.includes(env)}
                  onPress={() => toggleChip(meetingEnv, setMeetingEnv, env)}
                />
              ))}
            </View>
          </View>

          {/* Interests & Taste */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Interests & Taste</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              Her alan eşleşme puanını artırır ✨
            </ThemedText>

            <ChipInput
              label="Favori müzik (tür veya sanatçı)"
              placeholder="örn. Jazz, Radiohead, Daft Punk"
              items={musicItems}
              onAdd={addTo(setMusicItems)}
              onRemove={removeFrom(setMusicItems)}
            />
            <ChipInput
              label="🎬 Movies & Shows"
              placeholder="ör. Eternal Sunshine, Breaking Bad..."
              items={movieItems}
              onAdd={addTo(setMovieItems)}
              onRemove={removeFrom(setMovieItems)}
            />
            <ChipInput
              label="📚 Books"
              placeholder="ör. Küçük Prens, Suç ve Ceza..."
              items={bookItems}
              onAdd={addTo(setBookItems)}
              onRemove={removeFrom(setBookItems)}
            />
            <ChipInput
              label="🎯 Hobbies"
              placeholder="ör. Yürüyüş, fotoğrafçılık, okuma..."
              items={activityItems}
              onAdd={addTo(setActivityItems)}
              onRemove={removeFrom(setActivityItems)}
            />
          </View>

          {/* Değerler */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>💬 Değerlerin</ThemedText>
            <ChipInput
              label="🙏 Hayatta değer verdiklerin"
              placeholder="ör. Dürüstlük, özgürlük..."
              items={coreValueItems}
              onAdd={addTo(setCoreValueItems)}
              onRemove={removeFrom(setCoreValueItems)}
            />
            <ChipInput
              label="💡 Seni etkileyen şeyler"
              placeholder="ör. Meraklı biri, iyi dinleyici..."
              items={impressedByItems}
              onAdd={addTo(setImpressedByItems)}
              onRemove={removeFrom(setImpressedByItems)}
            />
            <ChipInput
              label="🚩 Uyuşamayacağın şeyler"
              placeholder="ör. Dakiksizlik, saygısızlık..."
              items={dealbreakerItems}
              onAdd={addTo(setDealbreakerItems)}
              onRemove={removeFrom(setDealbreakerItems)}
            />
          </View>

          {/* Kaydet */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}>
            <ThemedText style={styles.saveBtnText}>
              {saving ? 'Kaydediliyor...' : 'Kaydet ✓'}
            </ThemedText>
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
  fieldLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },

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
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
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
