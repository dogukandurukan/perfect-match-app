import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SetupScreenHeader } from '@/components/ui/SetupScreenHeader';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ALL_DAYS = [...DAY_LABELS];

const TIME_OPTIONS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)'] as const;
const TIME_ALWAYS = 'Always' as const;
const TIME_CHIPS = [...TIME_OPTIONS, TIME_ALWAYS] as const;

const VENUE_DEFS = [
  { label: 'Coffee' as const, spotKey: 'coffee', placeholder: "What's your favorite coffee place? (optional)" },
  { label: 'Walk in the park' as const, spotKey: 'park', placeholder: "What's your favorite park or area? (optional)" },
  { label: 'Dinner' as const, spotKey: 'dinner', placeholder: 'Any favorite restaurant or cuisine? (optional)' },
  { label: 'Drinks' as const, spotKey: 'drinks', placeholder: 'Any favorite bar or spot? (optional)' },
  { label: 'Something active' as const, spotKey: 'active', placeholder: 'What kind of activity do you enjoy? (optional)' },
];

const FIRST_MEETING_OPTIONS = [
  "See if there's a vibe",
  'Have a real conversation',
  'Have fun and laugh',
  'All of the above',
] as const;

const NEIGHBORHOOD_PRESETS = ['Kadıköy', 'Beşiktaş', 'Cihangir'] as const;

const MAX_NEIGHBORHOODS = 3;
const NEIGHBORHOOD_SUGGESTIONS = [
  'Kadıköy',
  'Beşiktaş',
  'Cihangir',
  'Beyoğlu',
  'Şişli',
  'Nişantaşı',
  'Karaköy',
  'Galata',
  'Taksim',
  'Bakırköy',
  'Etiler',
  'Levent',
  'Çamlıca',
  'Üsküdar',
  'Ataşehir',
  'Kurtköy',
  'Maltepe',
  'Kartal',
  'Kadıköy Moda',
  'Bomonti',
  'Sarıyer',
] as const;

export default function ProfileSetupStep4() {
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
  const [firstDateExpectation, setFirstDateExpectation] = useState<string | null>(null);
  const [bio, setBio] = useState('');

  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [neighborhoodInput, setNeighborhoodInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [staggerIdx, setStaggerIdx] = useState<number | null>(null);

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
    if (!alwaysOn) {
      setStaggerIdx(null);
      return;
    }
    let i = 0;
    setStaggerIdx(0);
    const id = setInterval(() => {
      i++;
      if (i > 6) {
        clearInterval(id);
        setStaggerIdx(null);
      } else {
        setStaggerIdx(i);
      }
    }, 50);
    return () => clearInterval(id);
  }, [alwaysOn]);

  const dayChipSelected = (d: string) => alwaysOn || selectedDays.includes(d);

  const dayVisualSelected = (d: string) => {
    const idx = DAY_LABELS.indexOf(d as (typeof DAY_LABELS)[number]);
    if (staggerIdx !== null) return staggerIdx >= idx;
    return dayChipSelected(d);
  };

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

  const normalizeLoc = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const addNeighborhood = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setPreferredLocations((prev) => {
      if (prev.length >= MAX_NEIGHBORHOODS) return prev;
      const nextNorm = new Set(prev.map((x) => normalizeLoc(x)));
      const tNorm = normalizeLoc(t);
      if (nextNorm.has(tNorm)) return prev;
      return [...prev, t];
    });
    setNeighborhoodInput('');
  };

  const filteredNeighborhoods = useMemo(() => {
    const q = neighborhoodInput.trim().toLowerCase();
    if (!q) return [...NEIGHBORHOOD_SUGGESTIONS];
    return NEIGHBORHOOD_SUGGESTIONS.filter((n) => n.toLowerCase().includes(q) || n.toLowerCase().startsWith(q));
  }, [neighborhoodInput]);

  const customNeighborhoods = useMemo(() => {
    const presetNorm = new Set(NEIGHBORHOOD_PRESETS.map((p) => normalizeLoc(p)));
    return preferredLocations.filter((loc) => !presetNorm.has(normalizeLoc(loc)));
  }, [preferredLocations]);

  const finish = async (skip: boolean) => {
    if (!userId) return;
    if (isDemoMode) {
      router.replace('/profile-setup/success?demo=1');
      return;
    }

    setSaving(true);
    try {
      const prefPayload = skip
        ? {
            availability_days: null,
            availability_hours: null,
            meeting_environment: null,
            favorite_spots: null,
            first_date_expectation: null,
            bio: null,
            availability: null,
            setup4_completed: true,
          }
        : {
            availability_days: persistDays.length ? persistDays : null,
            availability_hours: selectedHours.length ? selectedHours : null,
            meeting_environment: meetingEnvironment.length ? meetingEnvironment : null,
            favorite_spots:
              Object.keys(favoriteSpots).length > 0
                ? Object.fromEntries(
                    Object.entries(favoriteSpots).filter(([, v]) => String(v).trim().length > 0),
                  )
                : null,
            first_date_expectation: firstDateExpectation,
            bio: bio.trim() || null,
            availability: null,
            setup4_completed: true,
          };

      const { error: prefErr } = await supabase.from('preferences').update(prefPayload).eq('user_id', userId);
      if (prefErr) throw prefErr;

      const profilePayload = skip
        ? {
            availability_days: null,
            availability_hours: null,
            meeting_environment: null,
            favorite_spots: null,
            first_date_expectation: null,
            preferred_locations: null,
            bio: null,
          }
        : {
            availability_days: persistDays.length ? persistDays : null,
            availability_hours: selectedHours.length ? selectedHours : null,
            meeting_environment: meetingEnvironment.length ? meetingEnvironment : null,
            favorite_spots:
              Object.keys(favoriteSpots).length > 0
                ? Object.fromEntries(
                    Object.entries(favoriteSpots).filter(([, v]) => String(v).trim().length > 0),
                  )
                : null,
            first_date_expectation: firstDateExpectation,
            preferred_locations: preferredLocations.length ? preferredLocations : null,
            bio: bio.trim() || null,
          };
      const { error: profileErr } = await supabase.from('profiles').update(profilePayload).eq('id', userId);
      if (profileErr) console.warn('profiles setup4 update:', profileErr);

      router.replace('/profile-setup/success');
    } catch (e: any) {
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) return null;

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SetupScreenHeader step={4} />
        <ThemedText style={styles.title}>Last few things</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which days are you usually free to meet?</ThemedText>
          <View style={styles.chipRow}>
            {DAY_LABELS.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={dayVisualSelected(d)}
                onPress={() => toggleDay(d)}
                style={styles.profileChip}
              />
            ))}
            <Chip label="Always" selected={alwaysOn} onPress={toggleAlways} style={styles.profileChip} />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What time of day works best?</ThemedText>
          <View style={styles.chipRow}>
            {TIME_CHIPS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={opt === TIME_ALWAYS ? isAlwaysHoursSelected : selectedHours.includes(opt)}
                onPress={() => toggleHoursChip(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Where do you feel most comfortable on a first date?</ThemedText>
          <View style={styles.chipRow}>
            {VENUE_DEFS.map(({ label }) => (
              <Chip
                key={label}
                label={label}
                selected={meetingEnvironment.includes(label)}
                onPress={() => toggleVenue(label)}
                style={styles.profileChip}
              />
            ))}
          </View>
          {VENUE_DEFS.map(({ label, spotKey, placeholder }) =>
            meetingEnvironment.includes(label) ? (
              <OptionalFieldReveal key={spotKey} show animationKey={spotKey}>
                <TextInput
                  style={styles.optionalInput}
                  placeholder={placeholder}
                  placeholderTextColor="#AAAAAA"
                  value={favoriteSpots[spotKey] ?? ''}
                  onChangeText={(t) => setSpot(spotKey, t)}
                />
              </OptionalFieldReveal>
            ) : null,
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which neighborhoods do you prefer to meet in?</ThemedText>

          <View style={styles.neighborhoodInputWrap}>
            <View style={styles.neighborhoodPresetChips}>
              {NEIGHBORHOOD_PRESETS.map((p) => {
                const selected = preferredLocations.map(normalizeLoc).includes(normalizeLoc(p));
                return (
                  <Chip
                    key={p}
                    label={p}
                    selected={selected}
                    onPress={() => {
                      // chip already selected -> remove
                      if (selected) {
                        setPreferredLocations((prev) => prev.filter((x) => normalizeLoc(x) !== normalizeLoc(p)));
                        return;
                      }
                      if (preferredLocations.length >= MAX_NEIGHBORHOODS) return;
                      addNeighborhood(p);
                    }}
                    style={styles.profileChip}
                  />
                );
              })}
            </View>

            <TextInput
              style={styles.neighborhoodInput}
              placeholder={preferredLocations.length >= MAX_NEIGHBORHOODS ? 'Maximum 3 neighborhoods reached' : '+ Add a neighborhood'}
              placeholderTextColor="#AAAAAA"
              value={neighborhoodInput}
              editable={preferredLocations.length < MAX_NEIGHBORHOODS}
              onChangeText={setNeighborhoodInput}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (preferredLocations.length >= MAX_NEIGHBORHOODS) return;
                addNeighborhood(neighborhoodInput);
              }}
            />

            {neighborhoodInput.trim().length > 0 &&
            preferredLocations.length < MAX_NEIGHBORHOODS &&
            filteredNeighborhoods.length > 0 ? (
              <View style={styles.neighborhoodDropdown}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
                  {filteredNeighborhoods.slice(0, 8).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={styles.neighborhoodDropdownItem}
                      onPress={() => addNeighborhood(n)}>
                      <ThemedText style={styles.neighborhoodDropdownItemText}>{n}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {customNeighborhoods.length > 0 ? (
            <View style={styles.chipRow}>
              {customNeighborhoods.map((loc) => (
                <Chip
                  key={loc}
                  label={loc}
                  selected
                  onPress={() => {
                    setPreferredLocations((prev) => prev.filter((x) => normalizeLoc(x) !== normalizeLoc(loc)));
                  }}
                  style={styles.profileChip}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What do you hope to get out of a first meeting?</ThemedText>
          <View style={styles.chipRow}>
            {FIRST_MEETING_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={firstDateExpectation === opt}
                onPress={() => setFirstDateExpectation(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Anything you&apos;d like people to know?</ThemedText>
          <View style={styles.bioWrap}>
            <TextInput
              style={styles.bioInput}
              placeholder="Write a short bio... (optional)"
              placeholderTextColor="#AAAAAA"
              multiline
              maxLength={300}
              value={bio}
              onChangeText={setBio}
            />
            <ThemedText style={[styles.charCount, bio.length >= 280 && styles.charCountWarn]}>
              {bio.length}/300
            </ThemedText>
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={saving ? 'Saving…' : 'Complete Profile'} onPress={() => finish(false)} loading={saving} />
          <TouchableOpacity onPress={() => finish(true)}>
            <ThemedText style={styles.skipText}>Skip for now</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  keyboard: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
    paddingRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 14,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileChip: {
    borderRadius: 20,
  },
  optionalInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    marginTop: 12,
  },
  neighborhoodInputWrap: {
    position: 'relative',
    zIndex: 30,
    marginBottom: 6,
  },
  neighborhoodInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    color: colors.textPrimary,
  },
  neighborhoodDropdown: {
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
  neighborhoodDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  neighborhoodDropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  neighborhoodPresetChips: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bioWrap: {
    position: 'relative',
  },
  bioInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    color: '#AAAAAA',
    fontSize: 12,
  },
  charCountWarn: {
    color: colors.accent,
  },
  footer: {
    marginTop: 20,
    gap: 18,
    marginBottom: 24,
  },
  skipText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
  },
});
