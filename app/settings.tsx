// Screen: Settings | Status: stable | Last updated: 2026-09-06
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
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import {
  fetchProfileSettings,
  softDeleteAccount,
  updateProfileSettings,
  type ProfileSettingsRow,
} from '@/lib/profileSettings';
import { supabase } from '@/lib/supabaseClient';

const ACCENT = '#1A1A1A';
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
  discovery_verified_only: false,
  discovery_nonsmokers_only: false,
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
        {value ? (
          <ThemedText style={styles.rowValue} numberOfLines={1} ellipsizeMode="tail">
            {value}
          </ThemedText>
        ) : null}
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
          <NavRow label="Change password" onPress={() => router.push('/change-password')} />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Discovery" />
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
            onPress={() => router.push('/blocked-users')}
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
  // No paddingTop override — ScreenContainer already adds safe-area top
  // padding; a fixed 8 here was crushing it flat, pushing "Back"/title up
  // under the status bar (found 2026-09-07, device screenshot).
  container: { justifyContent: 'flex-start' },
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
  rowValue: { fontSize: 14, color: '#666', maxWidth: 210, textAlign: 'right' },
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
  hint: { fontSize: 12, color: '#888', marginTop: -2, marginBottom: 4 },
});
