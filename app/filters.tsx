// Screen: Filters (discovery preferences) | Status: stable | New 2026-09-06
// Split out of settings.tsx's "Discovery preferences" section — Hinge keeps
// "who you see" (filters) and "account/app config" (settings) as two
// separate icons/screens instead of one long settings page (user reference
// screenshots, 2026-09-06). Expanded 2026-09-07 with city + relationship-
// type — "filters daha dolu olabilir" (user request): city and intent were
// only editable during onboarding before, no way to change them later.
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import type { IntentKey } from '@/lib/onboardingIntent';
import { INTENT_OPTIONS } from '@/lib/onboardingStep2Context';
import {
  DISCOVERY_DISTANCE_OPTIONS,
  MEETING_PREF_OPTIONS,
  fetchProfileSettings,
  updateProfileSettings,
  type DiscoveryDistance,
  type MeetingPref,
  type ProfileSettingsRow,
} from '@/lib/profileSettings';
import { supabase } from '@/lib/supabaseClient';
import { CITY_OPTIONS, type CityOption } from '@/lib/turkishGeo';

const ACCENT = '#1A1A1A';

const DEFAULT_SETTINGS: ProfileSettingsRow = {
  discovery_age_min: 18,
  discovery_age_max: 60,
  discovery_max_distance: 'whole_city',
  meeting_preferences: [],
  notify_new_match: true,
  notify_messages: true,
  notify_meeting_invite: true,
  is_hidden: false,
  hide_location: false,
};

// Bumble splits filters into two tabs (user reference screenshots,
// 2026-09-10): Basic = who/age/city/distance, Advanced = deeper
// preferences (their "what are they looking for" maps to our intent
// filter). Not premium-gated here — Bumble locks Advanced behind
// premium, but that's a separate monetization call, not asked for yet.
type FilterTab = 'basic' | 'advanced';

export default function FiltersScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProfileSettingsRow>(DEFAULT_SETTINGS);
  const [city, setCity] = useState<CityOption | null>(null);
  const [intent, setIntent] = useState<IntentKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('basic');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    setUserId(user.id);

    const [row, { data: profileRow }, { data: intentRow }] = await Promise.all([
      fetchProfileSettings(user.id),
      supabase.from('profiles').select('city').eq('id', user.id).maybeSingle(),
      supabase.from('onboarding_answers').select('intent').eq('user_id', user.id).maybeSingle(),
    ]);
    if (row) setSettings(row);
    const rowCity = typeof profileRow?.city === 'string' ? profileRow.city : null;
    setCity(CITY_OPTIONS.find((c) => c === rowCity) ?? null);
    setIntent((intentRow?.intent as IntentKey | null) ?? null);
    setLoading(false);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const persist = useCallback(
    async (patch: Partial<ProfileSettingsRow>, rollback: ProfileSettingsRow) => {
      if (!userId) return;
      const { error } = await updateProfileSettings(userId, patch);
      if (error) {
        setSettings(rollback);
        Alert.alert("Couldn't save", error);
      }
    },
    [userId],
  );

  const applySettings = useCallback(
    (updater: (prev: ProfileSettingsRow) => ProfileSettingsRow) => {
      setSettings((prev) => {
        const next = updater(prev);
        const patch: Partial<ProfileSettingsRow> = {};
        (Object.keys(next) as (keyof ProfileSettingsRow)[]).forEach((key) => {
          if (next[key] !== prev[key]) {
            (patch as Record<string, unknown>)[key] = next[key];
          }
        });
        if (Object.keys(patch).length > 0) {
          void persist(patch, prev);
        }
        return next;
      });
    },
    [persist],
  );

  const toggleMeetingPref = (value: MeetingPref) => {
    applySettings((prev) => {
      const current = prev.meeting_preferences ?? [];
      let next: string[];
      if (value === 'Everyone') {
        next = current.includes('Everyone') ? [] : ['Everyone'];
      } else {
        const withoutEveryone = current.filter((x) => x !== 'Everyone');
        next = withoutEveryone.includes(value)
          ? withoutEveryone.filter((x) => x !== value)
          : [...withoutEveryone, value];
      }
      return { ...prev, meeting_preferences: next };
    });
  };

  const pickCity = async (opt: CityOption) => {
    const prev = city;
    setCity(opt);
    if (!userId) return;
    const { error } = await supabase.from('profiles').update({ city: opt }).eq('id', userId);
    if (error) {
      setCity(prev);
      Alert.alert("Couldn't save", error.message);
    }
  };

  const pickIntent = async (key: IntentKey) => {
    const prev = intent;
    setIntent(key);
    if (!userId) return;
    const { error } = await supabase
      .from('onboarding_answers')
      .upsert({ user_id: userId, intent: key }, { onConflict: 'user_id' });
    if (error) {
      setIntent(prev);
      Alert.alert("Couldn't save", error.message);
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading…</ThemedText>
      </ScreenContainer>
    );
  }

  const distanceLabel =
    DISCOVERY_DISTANCE_OPTIONS.find((o) => o.value === settings.discovery_max_distance)?.label ??
    'Whole city';

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={ACCENT} />
        <ThemedText style={styles.backText}>Back</ThemedText>
      </TouchableOpacity>

      <ThemedText type="title" style={styles.pageTitle}>
        Filters
      </ThemedText>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'basic' && styles.tabBtnActive]}
          onPress={() => setActiveTab('basic')}
          activeOpacity={0.85}>
          <ThemedText style={[styles.tabBtnText, activeTab === 'basic' && styles.tabBtnTextActive]}>
            Basic filters
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'advanced' && styles.tabBtnActive]}
          onPress={() => setActiveTab('advanced')}
          activeOpacity={0.85}>
          <ThemedText
            style={[styles.tabBtnText, activeTab === 'advanced' && styles.tabBtnTextActive]}>
            Advanced filters
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'basic' ? (
          <>
            <View style={styles.card}>
              <ThemedText style={styles.subLabel}>Your city</ThemedText>
              <View style={styles.chipRow}>
                {CITY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={city === opt}
                    onPress={() => void pickCity(opt)}
                    style={styles.chip}
                  />
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.subLabel}>Who you want to meet</ThemedText>
              <View style={styles.chipRow}>
                {MEETING_PREF_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={(settings.meeting_preferences ?? []).includes(opt)}
                    onPress={() => toggleMeetingPref(opt)}
                    style={styles.chip}
                  />
                ))}
              </View>

              <ThemedText style={styles.sliderLabel}>
                Age range: {settings.discovery_age_min} – {settings.discovery_age_max}
              </ThemedText>
              <ThemedText style={styles.sliderHint}>Minimum age</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={60}
                step={1}
                minimumTrackTintColor={ACCENT}
                maximumTrackTintColor="#DDD"
                thumbTintColor={ACCENT}
                value={settings.discovery_age_min}
                onValueChange={(v) => {
                  const min = Math.round(v);
                  applySettings((prev) => ({
                    ...prev,
                    discovery_age_min: Math.min(min, prev.discovery_age_max),
                  }));
                }}
              />
              <ThemedText style={styles.sliderHint}>Maximum age</ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={60}
                step={1}
                minimumTrackTintColor={ACCENT}
                maximumTrackTintColor="#DDD"
                thumbTintColor={ACCENT}
                value={settings.discovery_age_max}
                onValueChange={(v) => {
                  const max = Math.round(v);
                  applySettings((prev) => ({
                    ...prev,
                    discovery_age_max: Math.max(max, prev.discovery_age_min),
                  }));
                }}
              />
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.subLabel}>Distance</ThemedText>
              <View style={styles.chipRow}>
                {DISCOVERY_DISTANCE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={settings.discovery_max_distance === opt.value}
                    onPress={() =>
                      applySettings((prev) => ({
                        ...prev,
                        discovery_max_distance: opt.value as DiscoveryDistance,
                      }))
                    }
                    style={styles.chip}
                  />
                ))}
              </View>
              <ThemedText style={styles.hint}>Current: {distanceLabel}</ThemedText>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <ThemedText style={styles.subLabel}>What are you looking for?</ThemedText>
            <View style={styles.chipRow}>
              {INTENT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={intent === opt.key}
                  onPress={() => void pickIntent(opt.key)}
                  style={styles.chip}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: ACCENT, fontSize: 16 },
  pageTitle: { color: ACCENT, fontSize: 26, fontWeight: '700', marginBottom: 16 },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
  },
  tabBtnActive: { backgroundColor: ACCENT },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  tabBtnTextActive: { color: '#FFFFFF' },
  scroll: { paddingBottom: 40, gap: 12 },
  loadingText: { color: '#888', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sliderLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 8 },
  sliderHint: { fontSize: 12, color: '#888', marginTop: 4 },
  slider: { width: '100%', height: 36 },
  subLabel: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20 },
  hint: { fontSize: 12, color: '#888', marginTop: -2, marginBottom: 4 },
});
