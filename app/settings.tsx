// Screen: Settings | Status: stable | Last updated: Haziran 2026
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import {
  DISCOVERY_DISTANCE_OPTIONS,
  MEETING_PREF_OPTIONS,
  fetchProfileSettings,
  softDeleteAccount,
  updateProfileSettings,
  type DiscoveryDistance,
  type MeetingPref,
  type ProfileSettingsRow,
} from '@/lib/profileSettings';
import { supabase } from '@/lib/supabaseClient';

const ACCENT = '#B8860B';
const PRIVACY_URL = 'https://perfectmatch.app/privacy';
const TERMS_URL = 'https://perfectmatch.app/terms';
const HELP_URL = 'https://perfectmatch.app/help';

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

function SectionTitle({ title }: { title: string }) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}

function NavRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.linkRow}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <View style={styles.rowRight}>
        {value ? <ThemedText style={styles.rowValue}>{value}</ThemedText> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color="#888" /> : null}
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleBlock}>
      <View style={styles.toggleRow}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: '#D0D0D0', true: ACCENT }}
          thumbColor="#FFFFFF"
        />
      </View>
      {description ? <ThemedText style={styles.hint}>{description}</ThemedText> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProfileSettingsRow>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

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
    setEmail(user.email ?? '—');

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number, languages, meeting_preferences')
      .eq('id', user.id)
      .maybeSingle();

    setPhone(
      typeof profile?.phone_number === 'string' && profile.phone_number.trim()
        ? profile.phone_number.trim()
        : null,
    );
    setLanguages(Array.isArray(profile?.languages) ? (profile.languages as string[]) : []);

    const row = await fetchProfileSettings(user.id);
    if (row) {
      setSettings({
        ...row,
        meeting_preferences:
          row.meeting_preferences?.length
            ? row.meeting_preferences
            : Array.isArray(profile?.meeting_preferences)
              ? (profile.meeting_preferences as string[])
              : [],
      });
    }
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

  const handleDeleteAccount = () => {
    Alert.alert('Delete your account?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          const { error } = await softDeleteAccount(userId);
          if (error) {
            Alert.alert('Error', error);
            return;
          }
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Log out of your account?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
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
        Settings
      </ThemedText>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <SectionTitle title="Account" />
          <NavRow label="Edit profile" onPress={() => router.push('/profile-edit')} />
          <NavRow label="Photos" onPress={() => router.push('/profile-edit')} />
          <NavRow label="Email" value={email} />
          <NavRow label="Phone number" value={phone ?? 'Not set'} />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Discovery preferences" />
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

          <NavRow
            label="Languages"
            value={languages.length > 0 ? languages.join(', ') : 'Not set'}
            onPress={() => router.push('/profile-edit')}
          />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Notifications" />
          <ToggleRow
            label="Push notifications"
            value={settings.notify_meeting_invite}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_meeting_invite: v }))}
          />
          <ToggleRow
            label="Match alerts"
            value={settings.notify_new_match}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_new_match: v }))}
          />
          <ToggleRow
            label="Message alerts"
            value={settings.notify_messages}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_messages: v }))}
          />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Privacy" />
          <ToggleRow
            label="Hide my profile"
            description="You won't appear in Home"
            value={settings.is_hidden}
            onChange={(v) => applySettings((prev) => ({ ...prev, is_hidden: v }))}
          />
          <ToggleRow
            label="Hide my location"
            description="Others won't see your neighbourhood"
            value={settings.hide_location}
            onChange={(v) => applySettings((prev) => ({ ...prev, hide_location: v }))}
          />
          <NavRow
            label="Blocked users"
            onPress={() => Alert.alert('Blocked users', 'Coming soon.')}
          />
        </View>

        <View style={styles.card}>
          <SectionTitle title="App" />
          <NavRow label="Help" onPress={() => void Linking.openURL(HELP_URL)} />
          <NavRow label="Terms of service" onPress={() => void Linking.openURL(TERMS_URL)} />
          <NavRow label="Privacy policy" onPress={() => void Linking.openURL(PRIVACY_URL)} />
          <TouchableOpacity style={styles.linkRow} onPress={handleSignOut} activeOpacity={0.7}>
            <ThemedText style={styles.rowLabel}>Log out</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerLink} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <ThemedText style={styles.dangerText}>Delete account</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', paddingTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: ACCENT, fontSize: 16 },
  pageTitle: { color: ACCENT, fontSize: 26, fontWeight: '700', marginBottom: 16 },
  scroll: { paddingBottom: 40, gap: 12 },
  loadingText: { color: '#888', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rowLabel: { fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
  rowValue: { fontSize: 14, color: '#666', maxWidth: 180, textAlign: 'right' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dangerLink: { paddingVertical: 6 },
  dangerText: { fontSize: 15, color: '#D32F2F' },
  toggleBlock: { gap: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sliderLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 8 },
  sliderHint: { fontSize: 12, color: '#888', marginTop: 4 },
  slider: { width: '100%', height: 36 },
  subLabel: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20 },
  hint: { fontSize: 12, color: '#888', marginTop: -2, marginBottom: 4 },
});
