// Screen: Ayarlar | Status: stable | Last updated: Haziran 2026
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
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
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const PRIVACY_URL = 'https://perfectmatch.app/privacy';
const TERMS_URL = 'https://perfectmatch.app/terms';

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

function RowLabel({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      {value ? <ThemedText style={styles.rowValue}>{value}</ThemedText> : null}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D0D0D0', true: ACCENT }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.7}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <Ionicons name="open-outline" size={18} color="#888" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProfileSettingsRow>(DEFAULT_SETTINGS);
  const [darkMode, setDarkMode] = useState(false);
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

    const row = await fetchProfileSettings(user.id);
    if (row) setSettings(row);
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
        Alert.alert('Kaydedilemedi', error);
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
    Alert.alert(
      'Hesabını sil',
      'Hesabın gizlenecek ve oturumun kapatılacak. Bu işlem geri alınamaz. Devam etmek istiyor musun?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı sil',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const { error } = await softDeleteAccount(userId);
            if (error) {
              Alert.alert('Hata', error);
              return;
            }
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <ThemedText style={styles.loadingText}>Yükleniyor…</ThemedText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={ACCENT} />
        <ThemedText style={styles.backText}>Geri</ThemedText>
      </TouchableOpacity>

      <ThemedText type="title" style={styles.pageTitle}>
        Ayarlar
      </ThemedText>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* HESAP */}
        <View style={styles.card}>
          <SectionTitle title="Hesap" />
          <RowLabel label="E-posta" value={email} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/change-password')}
            activeOpacity={0.7}>
            <ThemedText style={styles.rowLabel}>Şifremi değiştir</ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerLink} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <ThemedText style={styles.dangerText}>Hesabımı sil</ThemedText>
          </TouchableOpacity>
        </View>

        {/* KEŞİF TERCİHLERİ */}
        <View style={styles.card}>
          <SectionTitle title="Keşif tercihleri" />
          <ThemedText style={styles.sliderLabel}>
            Yaş aralığı: {settings.discovery_age_min} – {settings.discovery_age_max}
          </ThemedText>
          <ThemedText style={styles.sliderHint}>Minimum yaş</ThemedText>
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
          <ThemedText style={styles.sliderHint}>Maksimum yaş</ThemedText>
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

          <ThemedText style={styles.subLabel}>Maksimum mesafe</ThemedText>
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

          <ThemedText style={styles.subLabel}>Kiminle eşleşeyim</ThemedText>
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
        </View>

        {/* BİLDİRİMLER */}
        <View style={styles.card}>
          <SectionTitle title="Bildirimler" />
          <ToggleRow
            label="Yeni eşleşme bildirimi"
            value={settings.notify_new_match}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_new_match: v }))}
          />
          <ToggleRow
            label="Mesaj bildirimi"
            value={settings.notify_messages}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_messages: v }))}
          />
          <ToggleRow
            label="Buluşma daveti bildirimi"
            value={settings.notify_meeting_invite}
            onChange={(v) => applySettings((prev) => ({ ...prev, notify_meeting_invite: v }))}
          />
        </View>

        {/* GİZLİLİK */}
        <View style={styles.card}>
          <SectionTitle title="Gizlilik" />
          <ToggleRow
            label="Profilimi gizle"
            value={settings.is_hidden}
            onChange={(v) => applySettings((prev) => ({ ...prev, is_hidden: v }))}
          />
          <ThemedText style={styles.hint}>
            Aktifken keşif ve eşleşme önerilerinde görünmezsin.
          </ThemedText>
          <ToggleRow
            label="Konumumu gösterme"
            value={settings.hide_location}
            onChange={(v) => applySettings((prev) => ({ ...prev, hide_location: v }))}
          />
          <ThemedText style={styles.hint}>Harita ekranında konumun görünmez.</ThemedText>
        </View>

        {/* UYGULAMA */}
        <View style={styles.card}>
          <SectionTitle title="Uygulama" />
          <ToggleRow label="Karanlık mod" value={darkMode} onChange={setDarkMode} />
          <RowLabel label="Uygulama versiyonu" value={`v${APP_VERSION}`} />
          <LinkRow label="Gizlilik politikası" onPress={() => void Linking.openURL(PRIVACY_URL)} />
          <LinkRow label="Kullanım koşulları" onPress={() => void Linking.openURL(TERMS_URL)} />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <ThemedText style={styles.signOutText}>Çıkış yap</ThemedText>
        </TouchableOpacity>
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
  row: { gap: 4 },
  rowLabel: { fontSize: 15, color: colors.textPrimary },
  rowValue: { fontSize: 14, color: '#666' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dangerLink: { paddingVertical: 6 },
  dangerText: { fontSize: 15, color: '#D32F2F' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sliderLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  sliderHint: { fontSize: 12, color: '#888', marginTop: 4 },
  slider: { width: '100%', height: 36 },
  subLabel: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20 },
  hint: { fontSize: 12, color: '#888', marginTop: -4, marginBottom: 4 },
  signOutBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E53935',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: { color: '#E53935', fontSize: 16, fontWeight: '600' },
});
