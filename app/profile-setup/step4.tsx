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
import { supabase } from '@/lib/supabaseClient';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const ALL_DAYS = [...DAY_LABELS];

const TIME_OPTIONS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)'] as const;

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

  const toggleMulti = (value: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else setList([...list, value]);
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

  const finish = async (skip: boolean) => {
    if (!userId) return;
    if (isDemoMode) {
      router.replace('/(tabs)');
      return;
    }

    setSaving(true);
    try {
      const prefPayload = skip
        ? {
            user_id: userId,
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
            user_id: userId,
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

      const { error: prefErr } = await supabase.from('preferences').upsert(prefPayload, { onConflict: 'user_id' });
      if (prefErr) throw prefErr;

      const profilePayload = skip
        ? {
            availability_days: null,
            availability_hours: null,
            meeting_environment: null,
            favorite_spots: null,
            first_date_expectation: null,
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
            bio: bio.trim() || null,
          };
      const { error: profileErr } = await supabase.from('profiles').update(profilePayload).eq('id', userId);
      if (profileErr) console.warn('profiles setup4 update:', profileErr);

      router.replace('/(tabs)');
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
          <ThemedText style={styles.sectionLabel}>What time of day works best for you?</ThemedText>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={selectedHours.includes(opt)}
                onPress={() => toggleMulti(opt, selectedHours, setSelectedHours)}
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
                  placeholderTextColor="#9CA3AF"
                  value={favoriteSpots[spotKey] ?? ''}
                  onChangeText={(t) => setSpot(spotKey, t)}
                />
              </OptionalFieldReveal>
            ) : null,
          )}
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
              placeholderTextColor="#9CA3AF"
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
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#C9A96E',
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
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: '#F5F0E8',
    marginTop: 12,
  },
  bioWrap: {
    position: 'relative',
  },
  bioInput: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    color: '#F5F0E8',
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    color: '#9CA3AF',
    fontSize: 12,
  },
  charCountWarn: {
    color: '#C9A96E',
  },
  footer: {
    marginTop: 20,
    gap: 18,
    marginBottom: 24,
  },
  skipText: {
    color: 'rgba(245, 240, 232, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});
