// Screen: Kullanıcı profili (karşı taraf) | Status: stable | Last updated: Mayıs 2026
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ZODIAC_EMOJI: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};
const ZODIAC_TR: Record<string, string> = {
  Aries: 'Koç',
  Taurus: 'Boğa',
  Gemini: 'İkizler',
  Cancer: 'Yengeç',
  Leo: 'Aslan',
  Virgo: 'Başak',
  Libra: 'Terazi',
  Scorpio: 'Akrep',
  Sagittarius: 'Yay',
  Capricorn: 'Oğlak',
  Aquarius: 'Kova',
  Pisces: 'Balık',
};

function zodiacLabel(sign: string | null) {
  if (!sign) return '';
  return `${ZODIAC_EMOJI[sign] ?? ''} ${ZODIAC_TR[sign] ?? sign}`;
}
function safeAge(dob: string | null): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}
function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  zodiac_sign: string | null;
  city: string | null;
  district: string | null;
  gender: string | null;
  languages: string[] | null;
  meeting_preferences: string[] | null;
  photos: string[] | null;
  morning_night: string | null;
  recharge_style: string | null;
  hobbies: string[] | null;
  drinking: string | null;
  smoking: string | null;
  education: string | null;
  religion: string | null;
  availability_days: string[] | null;
  availability_hours: string[] | null;
  meeting_environment: string[] | null;
  first_date_expectation: string | null;
  bio: string | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  favorite_activity: string | null;
  core_value: string | null;
  impressed_by: string | null;
  dealbreaker: string | null;
};

function SectionTitle({ title }: { title: string }) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}
function ChipList({ items }: { items: string[] }) {
  return (
    <View style={styles.chipsRow}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <ThemedText style={styles.chipText}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const userId = firstParam(params.userId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'pending' | 'accepted' | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select(
          `
          first_name, last_name, date_of_birth, zodiac_sign,
          city, district, gender, languages, meeting_preferences, photos,
          morning_night, recharge_style, hobbies, drinking, smoking,
          education, religion, availability_days, availability_hours,
          meeting_environment, first_date_expectation, bio,
          favorite_music, favorite_movie, favorite_book, favorite_activity,
          core_value, impressed_by, dealbreaker
        `,
        )
        .eq('id', userId)
        .single();

      if (!mounted) return;
      if (!data) {
        setLoading(false);
        return;
      }
      setProfile(data as UserProfile);

      if (data.photos && data.photos.length > 0) {
        const urls = await Promise.all(
          data.photos.map(async (path: string) => {
            const signed = await resolveProfilePhotoUrl(path, 3600);
            return signed ?? `https://i.pravatar.cc/300?u=${userId}`;
          }),
        );
        if (mounted) setPhotoUrls(urls);
      } else {
        if (mounted) setPhotoUrls([`https://i.pravatar.cc/300?u=${userId}`]);
      }

      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId || !userId) return;
    let mounted = true;
    (async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('status')
        .or(
          `and(user_a_id.eq.${currentUserId},user_b_id.eq.${userId}),` +
            `and(user_a_id.eq.${userId},user_b_id.eq.${currentUserId})`,
        )
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (mounted) setMatchStatus((matchData?.status as 'pending' | 'accepted') ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [currentUserId, userId]);

  async function handleBlock() {
    if (!currentUserId || !userId) return;
    Alert.alert(
      'Engelle',
      `${profile?.first_name ?? 'Bu kullanıcıyı'} engellemek istediğine emin misin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('blocks').insert({
              blocker_id: currentUserId,
              blocked_id: userId,
            });
            setBlocked(true);
            Alert.alert('Engellendi', 'Bu kullanıcı artık sana gösterilmeyecek.');
          },
        },
      ],
    );
  }

  async function handleReport() {
    if (!currentUserId || !userId || !reportReason.trim()) return;
    await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_id: userId,
      reason: reportReason.trim(),
    });
    setReportModalVisible(false);
    setReportReason('');
    Alert.alert('Şikayet İletildi', 'Geri bildiriminiz için teşekkürler.');
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <HomeTopIcon />
      </ScreenContainer>
    );
  }

  const age = safeAge(profile?.date_of_birth ?? null);

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Fotoğraflar */}
        <View style={styles.photoWrap}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photoUrls.map((url, idx) => (
              <Image key={idx} source={{ uri: url }} style={styles.photo} contentFit="cover" />
            ))}
          </ScrollView>
          {photoUrls.length > 1 && (
            <View style={styles.photoDots}>
              {photoUrls.map((_, idx) => (
                <View key={idx} style={styles.photoDot} />
              ))}
            </View>
          )}
        </View>

        {/* İsim + burç + konum */}
        <View style={styles.headerWrap}>
          <ThemedText style={styles.name}>
            {profile?.first_name ?? ''} {profile?.last_name ?? ''}
            {age > 0 ? `, ${age}` : ''}
          </ThemedText>
          {profile?.zodiac_sign ? (
            <ThemedText style={styles.zodiac}>{zodiacLabel(profile.zodiac_sign)}</ThemedText>
          ) : null}
          <ThemedText style={styles.location}>
            📍 {profile?.district ?? profile?.city ?? 'Bilinmiyor'}
          </ThemedText>
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <View style={styles.bioWrap}>
            <ThemedText style={styles.bioText}>{profile.bio}</ThemedText>
          </View>
        ) : null}

        {/* Hakkında */}
        <View style={styles.section}>
          <SectionTitle title="👤 Hakkında" />
          <View style={styles.card}>
            {profile?.gender ? <InfoRow label="Cinsiyet" value={profile.gender} /> : null}
            {profile?.education ? <InfoRow label="Eğitim" value={profile.education} /> : null}
            {profile?.religion ? <InfoRow label="Din" value={profile.religion} /> : null}
            {profile?.morning_night ? (
              <InfoRow label="Sabahçı / Gececi" value={profile.morning_night} />
            ) : null}
            {profile?.recharge_style ? (
              <InfoRow label="Enerji toplarken" value={profile.recharge_style} />
            ) : null}
            {profile?.drinking ? <InfoRow label="İçki" value={profile.drinking} /> : null}
            {profile?.smoking ? <InfoRow label="Sigara" value={profile.smoking} /> : null}
          </View>
        </View>

        {/* Diller */}
        {profile?.languages && profile.languages.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="🌍 Konuştuğu Diller" />
            <ChipList items={profile.languages} />
          </View>
        ) : null}

        {/* Hobiler */}
        {profile?.hobbies && profile.hobbies.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="🎯 İlgi Alanları" />
            <ChipList items={profile.hobbies} />
          </View>
        ) : null}

        {/* Seni tanıyalım */}
        {profile?.favorite_music || profile?.favorite_movie || profile?.favorite_book ? (
          <View style={styles.section}>
            <SectionTitle title="🎯 Seni Tanıyalım" />
            <View style={styles.card}>
              {profile?.favorite_music ? (
                <InfoRow label="🎵 Müzik" value={profile.favorite_music} />
              ) : null}
              {profile?.favorite_movie ? (
                <InfoRow label="🎬 Film" value={profile.favorite_movie} />
              ) : null}
              {profile?.favorite_book ? (
                <InfoRow label="📚 Kitap" value={profile.favorite_book} />
              ) : null}
              {profile?.favorite_activity ? (
                <InfoRow label="🏃 Aktivite" value={profile.favorite_activity} />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Değerler */}
        {profile?.core_value || profile?.impressed_by || profile?.dealbreaker ? (
          <View style={styles.section}>
            <SectionTitle title="💬 Değerleri" />
            <View style={styles.card}>
              {profile?.core_value ? (
                <InfoRow label="🙏 Değer verdiği" value={profile.core_value} />
              ) : null}
              {profile?.impressed_by ? (
                <InfoRow label="💡 Etkilendiği" value={profile.impressed_by} />
              ) : null}
              {profile?.dealbreaker ? (
                <InfoRow label="🚩 Uyuşamaz" value={profile.dealbreaker} />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Buluşma tercihleri */}
        {profile?.meeting_environment && profile.meeting_environment.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="☕ Buluşma Ortamı" />
            <ChipList items={profile.meeting_environment} />
          </View>
        ) : null}

        {/* Müsait günler */}
        {profile?.availability_days && profile.availability_days.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="📅 Müsait Günler" />
            <ChipList items={profile.availability_days} />
          </View>
        ) : null}

        {/* İlk buluşma beklentisi */}
        {profile?.first_date_expectation ? (
          <View style={styles.section}>
            <SectionTitle title="💬 İlk Buluşmadan Beklentisi" />
            <View style={styles.bioWrap}>
              <ThemedText style={styles.bioText}>{profile.first_date_expectation}</ThemedText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!blocked && matchStatus === 'accepted' && (
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() =>
              router.push({
                pathname: '/chat',
                params: {
                  userId,
                  userName: profile?.first_name ?? '',
                },
              } as any)
            }>
            <ThemedText style={styles.messageBtnText}>💬 Mesaj Gönder</ThemedText>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.reportBtn} onPress={() => setReportModalVisible(true)}>
              <ThemedText style={styles.reportBtnText}>⚠️ Şikayet Et</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.blockBtn} onPress={handleBlock}>
              <ThemedText style={styles.blockBtnText}>🚫 Engelle</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!blocked && matchStatus === 'pending' && (
        <View style={styles.actionsWrap}>
          <ThemedText style={styles.pendingText}>⏳ Buluşma isteği gönderildi</ThemedText>
        </View>
      )}

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Şikayet Sebebi</ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Ne olduğunu kısaca anlat..."
              placeholderTextColor="#AAA"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReportModalVisible(false)}>
                <ThemedText style={styles.modalCancelText}>Vazgeç</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, !reportReason.trim() && { opacity: 0.4 }]}
                onPress={handleReport}
                disabled={!reportReason.trim()}>
                <ThemedText style={styles.modalSendText}>Gönder</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  content: { paddingBottom: 48, gap: 20 },

  photoWrap: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  photo: { width: 350, height: 320 },
  photoDots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  headerWrap: { alignItems: 'center', gap: 4 },
  name: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  zodiac: { fontSize: 14, color: colors.accent, fontWeight: '500' },
  location: { fontSize: 14, color: '#888' },

  bioWrap: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  bioText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipText: { color: colors.accent, fontSize: 13, fontWeight: '500' },

  actionsWrap: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 32,
  },
  pendingText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    paddingVertical: 12,
  },
  messageBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  messageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  reportBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E8A000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportBtnText: { color: '#E8A000', fontWeight: '600', fontSize: 14 },
  blockBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E05555',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  blockBtnText: { color: '#E05555', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalSendBtn: {
    flex: 1,
    backgroundColor: '#E05555',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSendText: { color: '#FFF', fontWeight: '700' },
});
