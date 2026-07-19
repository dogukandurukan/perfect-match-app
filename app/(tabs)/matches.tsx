// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: Mayıs 2026
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ACCENT = '#B8860B';

const INTENT_LABELS: Record<string, string> = {
  keeping_it_casual: 'Eğlenceli bir şeyler',
  open_to_relationship: 'Ciddi bir ilişki',
  not_sure_yet: 'Ne olursa',
  just_friends: 'Arkadaşlık',
};

const DAY_TR: Record<string, string> = {
  Mon: 'Pzt',
  Tue: 'Sal',
  Wed: 'Çar',
  Thu: 'Per',
  Fri: 'Cum',
  Sat: 'Cmt',
  Sun: 'Paz',
  Monday: 'Pzt',
  Tuesday: 'Sal',
  Wednesday: 'Çar',
  Thursday: 'Per',
  Friday: 'Cum',
  Saturday: 'Cmt',
  Sunday: 'Paz',
};

function matchCategory(score: number): string {
  if (score >= 85) return '🔥 Mükemmel uyum';
  if (score >= 70) return '✨ Çok iyi eşleşme';
  if (score >= 55) return '👍 İyi eşleşme';
  return '🤝 Ortak noktalarınız var';
}

function formatIntent(intent: string | null): string {
  if (!intent) return 'Belirtilmemiş';
  return INTENT_LABELS[intent] ?? intent;
}

function formatDays(days: string[] | null): string {
  if (!days?.length) return 'Belirtilmemiş';
  return days.map((d) => DAY_TR[d] ?? d).join(', ');
}

function formatHabit(value: string | null): string {
  if (!value) return '—';
  const map: Record<string, string> = {
    Yes: 'Evet',
    No: 'Hayır',
    Socially: 'Sosyal',
  };
  return map[value] ?? value;
}

function formatRechargeStyle(value: string | string[] | null): string {
  if (!value) return 'Belirtilmemiş';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Belirtilmemiş';
  return value;
}

function formatEducation(education: string | null, detail: string | null): string {
  if (!education && !detail) return 'Belirtilmemiş';
  if (education && detail) return `${education} (${detail})`;
  return education ?? detail ?? 'Belirtilmemiş';
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineIcon}>{icon}</Text>
      <ThemedText style={styles.infoLineText}>{text}</ThemedText>
    </View>
  );
}

type MatchResultItem = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  district: string | null;
  zodiac_sign: string | null;
  photos: string[] | null;
  match_percentage: number;
  match_category: string;
  reasons: string[];
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  hobbies: string[] | null;
  availability_days: string[] | null;
  drinking: string | null;
  smoking: string | null;
  education: string | null;
  education_detail: string | null;
  morning_night: string | null;
  expires_at?: string | null;
  status?: string | null;
};

type MatchCardData = MatchResultItem & {
  matchId: string;
  displayPhotoUrl: string;
  intent: string | null;
  languages: string[] | null;
  recharge_style: string | string[] | null;
};

type IncomingInvite = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  city: string | null;
  displayPhotoUrl: string;
  matchScore: number;
  introAnswers: { kafe?: string; gun?: string; saat?: string } | null;
};

type AcceptedMatch = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  displayPhotoUrl: string;
  isUserA: boolean;
  checkinDone: boolean;
};

const MATCH_SLOT_COUNT = 3;
const MATCH_TTL_MS = 24 * 60 * 60 * 1000;

function formatCountdown(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Süre doldu';

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(diff / (1000 * 60 * 60));

  if (totalHours >= 24) return null;

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `⏳ ${hours}s ${minutes}dk kaldı`;
  }

  return `⏳ ${totalMinutes} dk kaldı`;
}

function CountdownText({ expiresAt }: { expiresAt: string }) {
  const [text, setText] = useState(() => formatCountdown(expiresAt));

  useEffect(() => {
    const update = () => setText(formatCountdown(expiresAt));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!text) return null;
  return <ThemedText style={styles.timeLeftText}>{text}</ThemedText>;
}

type PendingMatchRow = {
  id: string;
  user_b_id: string;
  match_score: number;
  expires_at: string;
  status: string;
};

type ProfileForCard = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  district: string | null;
  zodiac_sign: string | null;
  photos: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  hobbies: string[] | null;
  availability_days: string[] | null;
  drinking: string | null;
  smoking: string | null;
  education: string | null;
  education_detail: string | null;
  morning_night: string | null;
  languages: string[] | null;
  recharge_style: string | string[] | null;
};

async function buildCardFromPending(
  row: PendingMatchRow,
  profile: ProfileForCard,
  intent: string | null,
): Promise<MatchCardData> {
  const signedPhotos =
    profile.photos && profile.photos.length > 0
      ? await Promise.all(
          profile.photos.map(async (path, i) => {
            const url = await resolveProfilePhotoUrl(path, 3600);
            return url ?? `https://i.pravatar.cc/300?u=${profile.id}&n=${i}`;
          }),
        )
      : [];
  const displayPhotoUrl = signedPhotos[0] ?? `https://i.pravatar.cc/300?u=${profile.id}`;

  return {
    user_id: profile.id,
    first_name: profile.first_name,
    date_of_birth: profile.date_of_birth,
    city: profile.city,
    district: profile.district,
    zodiac_sign: profile.zodiac_sign,
    photos: signedPhotos.length > 0 ? signedPhotos : null,
    match_percentage: Math.round(row.match_score),
    match_category: matchCategory(Math.round(row.match_score)),
    reasons: [],
    favorite_music: profile.favorite_music,
    favorite_movie: profile.favorite_movie,
    favorite_book: profile.favorite_book,
    hobbies: profile.hobbies,
    availability_days: profile.availability_days,
    drinking: profile.drinking,
    smoking: profile.smoking,
    education: profile.education,
    education_detail: profile.education_detail,
    morning_night: profile.morning_night,
    expires_at: row.expires_at,
    status: row.status,
    matchId: row.id,
    intent,
    languages: profile.languages,
    recharge_style: profile.recharge_style,
    displayPhotoUrl,
  };
}

function morningNightIcon(value: string | null): string {
  if (!value) return '🌅';
  return value.toLowerCase().includes('night') ? '🌙' : '🌅';
}

function morningNightLabel(value: string | null): string {
  if (!value) return 'Belirtilmemiş';
  const lower = value.toLowerCase();
  if (lower.includes('morning')) return 'Sabah insanı';
  if (lower.includes('night')) return 'Gece insanı';
  return value;
}

function getPhotoUrl(photos: string[] | null | undefined, index: number): string | null {
  const url = photos?.[index];
  if (typeof url !== 'string' || url.trim() === '') return null;
  return url;
}

function InlinePhoto({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={styles.inlinePhoto} resizeMode="cover" />;
}

type MatchProfileCardProps = {
  match: MatchCardData;
  timeLeft: string | null;
  requestSent: boolean;
  onTanis: () => void;
  onGec: () => void;
};

function MatchProfileCard({
  match,
  timeLeft,
  requestSent,
  onTanis,
  onGec,
}: MatchProfileCardProps) {
  const photos = match.photos ?? [];
  const heroPhoto = getPhotoUrl(photos, 0) ?? match.displayPhotoUrl;
  const photoBeforeSim = getPhotoUrl(photos, 1);
  const photoAfterSim = getPhotoUrl(photos, 2);
  const extraPhotos = photos
    .map((uri, index) => ({ uri, index }))
    .filter(({ uri, index }) => index >= 3 && typeof uri === 'string' && uri.trim() !== '');
  const displayName = match.first_name ?? 'Kullanıcı';
  const displayAge = safeAge(match.date_of_birth);

  return (
    <ScrollView
      style={styles.matchScroll}
      contentContainerStyle={styles.matchScrollContent}
      nestedScrollEnabled
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: heroPhoto }} style={styles.heroPhoto} resizeMode="cover" />
        <View style={styles.heroNameOverlay}>
          <ThemedText style={styles.heroName}>
            {displayName}, {displayAge}
          </ThemedText>
        </View>
        <View style={styles.heroPctBadge}>
          <ThemedText style={styles.heroPctText}>%{match.match_percentage}</ThemedText>
        </View>
        <View style={styles.heroCategoryBadge}>
          <ThemedText style={styles.heroCategoryText}>{match.match_category}</ThemedText>
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoLine icon="📍" text={match.district ?? match.city ?? 'Belirtilmemiş'} />
        <InfoLine icon="🎯" text={formatIntent(match.intent)} />
        <InfoLine icon="⏰" text={formatDays(match.availability_days)} />
        <InfoLine icon={morningNightIcon(match.morning_night)} text={morningNightLabel(match.morning_night)} />
        <InfoLine icon="⚡" text={formatRechargeStyle(match.recharge_style)} />
        <InfoLine
          icon="🍺"
          text={`İçki: ${formatHabit(match.drinking)} · Sigara: ${formatHabit(match.smoking)}`}
        />
        <InfoLine icon="🎓" text={formatEducation(match.education, match.education_detail)} />
        <InfoLine
          icon="🌍"
          text={match.languages?.length ? match.languages.join(', ') : 'Belirtilmemiş'}
        />
      </View>

      {photoBeforeSim ? <InlinePhoto uri={photoBeforeSim} /> : null}

      <View style={styles.simCard}>
        <ThemedText style={styles.simCardTitle}>Ortak noktalar 🤝</ThemedText>
        {(match.hobbies ?? []).length > 0 ? (
          <View style={styles.chipRow}>
            {(match.hobbies ?? []).map((hobby) => (
              <View key={hobby} style={styles.hobbyChip}>
                <ThemedText style={styles.hobbyChipText}>{hobby}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {match.favorite_music ? <InfoLine icon="🎵" text={match.favorite_music} /> : null}
        {match.favorite_movie ? <InfoLine icon="🎬" text={match.favorite_movie} /> : null}
        {match.favorite_book ? <InfoLine icon="📚" text={match.favorite_book} /> : null}
      </View>

      {photoAfterSim ? <InlinePhoto uri={photoAfterSim} /> : null}
      {extraPhotos.map(({ uri, index }) => (
        <InlinePhoto key={`photo-${index}`} uri={uri} />
      ))}

      <View style={styles.buttonsWrap}>
        {timeLeft ? <CountdownText expiresAt={timeLeft} /> : null}
        {requestSent ? (
          <ThemedText style={styles.sentText}>☕ Buluşma isteği gönderildi</ThemedText>
        ) : (
          <>
            <TouchableOpacity style={styles.tanisBtn} onPress={onTanis} activeOpacity={0.85}>
              <ThemedText style={styles.tanisBtnText}>Tanış</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gecBtn} onPress={onGec} activeOpacity={0.85}>
              <ThemedText style={styles.gecBtnText}>Geç</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function safeAge(dob: string | null): number {
  if (!dob) return 28;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 28;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(18, age);
}

export default function MatchesTab() {
  const router = useRouter();
  const [cards, setCards] = useState<MatchCardData[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const [acceptedMatches, setAcceptedMatches] = useState<AcceptedMatch[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      (async () => {
        setLoading(true);
        setNoMatches(false);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const userId = user.id;

        // 1. Gelen davetleri çek
        // (user_b = ben, user_a kabul etti ama ben henüz kabul etmedim)
        const { data: incomingRaw } = await supabase
          .from('matches')
          .select(
            `
            id,
            user_a_id,
            match_score,
            user_a_intro_answers,
            profiles!matches_user_a_id_fkey (
              id, first_name, date_of_birth, city, photos
            )
          `,
          )
          .eq('user_b_id', userId)
          .eq('user_a_accepted', true)
          .eq('user_b_accepted', false)
          .eq('status', 'pending');

        if (mounted && incomingRaw) {
          const mappedIncoming: IncomingInvite[] = await Promise.all(
            incomingRaw.map(async (row: any) => {
              const p = row.profiles;
              const firstPhoto = p?.photos?.[0];
              const signed = firstPhoto ? await resolveProfilePhotoUrl(firstPhoto, 3600) : null;
              return {
                matchId: row.id,
                userId: row.user_a_id,
                firstName: p?.first_name ?? null,
                age: safeAge(p?.date_of_birth ?? null),
                city: p?.city ?? null,
                displayPhotoUrl: signed ?? `https://i.pravatar.cc/300?u=${row.user_a_id}`,
                matchScore: Math.round(row.match_score),
                introAnswers: row.user_a_intro_answers,
              };
            }),
          );
          if (mounted) setIncoming(mappedIncoming);
        }

        // 1.5 Accepted buluşmaları çek
        const { data: acceptedRaw } = await supabase
          .from('matches')
          .select('id, user_a_id, user_b_id, checkin_a, checkin_b')
          .eq('status', 'accepted')
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

        if (mounted && acceptedRaw) {
          const mappedAccepted: AcceptedMatch[] = await Promise.all(
            acceptedRaw.map(async (row: any) => {
              const isUserA = row.user_a_id === userId;
              const otherId = isUserA ? row.user_b_id : row.user_a_id;

              const { data: otherProfile } = await supabase
                .from('profiles')
                .select('first_name, date_of_birth, photos')
                .eq('id', otherId)
                .single();

              const firstPhoto = otherProfile?.photos?.[0];
              const signed = firstPhoto
                ? await resolveProfilePhotoUrl(firstPhoto, 3600)
                : null;
              const checkinDone = isUserA
                ? row.checkin_a !== null
                : row.checkin_b !== null;

              return {
                matchId: row.id,
                userId: otherId,
                firstName: otherProfile?.first_name ?? null,
                age: safeAge(otherProfile?.date_of_birth ?? null),
                displayPhotoUrl: signed ?? `https://i.pravatar.cc/300?u=${otherId}`,
                isUserA,
                checkinDone,
              };
            }),
          );
          if (mounted) setAcceptedMatches(mappedAccepted);
        }

        // 2. Kendi eşleşmelerini çek — önce matches tablosu, eksikse RPC ile doldur
        const nowIso = new Date().toISOString();

        const { data: pendingRows, error: pendingError } = await supabase
          .from('matches')
          .select('id, user_b_id, match_score, expires_at, status')
          .eq('user_a_id', userId)
          .eq('status', 'pending')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: true })
          .limit(MATCH_SLOT_COUNT);

        if (!mounted) return;

        if (pendingError) {
          Alert.alert('Hata', pendingError.message);
          setLoading(false);
          return;
        }

        let activePending: PendingMatchRow[] = (pendingRows ?? []) as PendingMatchRow[];
        const existingOtherIds = new Set(activePending.map((r) => r.user_b_id));

        const missingCount = MATCH_SLOT_COUNT - activePending.length;
        if (missingCount > 0) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_matches', {
            p_user_id: userId,
            p_limit: missingCount + 5,
          });

          if (!mounted) return;

          if (rpcError) {
            Alert.alert('Hata', rpcError.message);
            setLoading(false);
            return;
          }

          const candidates = ((rpcData ?? []) as MatchResultItem[]).filter(
            (c) => !existingOtherIds.has(c.user_id),
          );

          for (const candidate of candidates.slice(0, missingCount)) {
            const expiresAt = new Date(Date.now() + MATCH_TTL_MS).toISOString();
            const { data: inserted, error: insertError } = await supabase
              .from('matches')
              .insert({
                user_a_id: userId,
                user_b_id: candidate.user_id,
                match_score: candidate.match_percentage,
                status: 'pending',
                expires_at: expiresAt,
                algo_version: 'v1',
              })
              .select('id, user_b_id, match_score, expires_at, status')
              .single();

            if (!insertError && inserted) {
              activePending.push(inserted as PendingMatchRow);
              existingOtherIds.add(candidate.user_id);
            }
          }
        }

        if (!mounted) return;

        if (activePending.length === 0) {
          setCards([]);
          setNoMatches(true);
          setLoading(false);
          return;
        }

        const otherIds = activePending.map((r) => r.user_b_id);
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style',
          )
          .in('id', otherIds);

        if (!mounted) return;

        if (profileError) {
          Alert.alert('Hata', profileError.message);
          setLoading(false);
          return;
        }

        const { data: intentRows } = await supabase
          .from('onboarding_answers')
          .select('user_id, intent')
          .in('user_id', otherIds);

        if (!mounted) return;

        const intentMap = new Map<string, string | null>(
          (intentRows ?? []).map((row: { user_id: string; intent: string | null }) => [
            row.user_id,
            row.intent,
          ]),
        );

        const profileById = new Map(
          (profileRows ?? []).map((p) => [p.id as string, p as ProfileForCard]),
        );

        const mappedCards = (
          await Promise.all(
            activePending.map(async (row) => {
              const profile = profileById.get(row.user_b_id);
              if (!profile) return null;
              return buildCardFromPending(row, profile, intentMap.get(profile.id) ?? null);
            }),
          )
        ).filter((card): card is MatchCardData => card !== null);

        if (mounted) {
          setCards(mappedCards);
          setNoMatches(mappedCards.length === 0);
          setLoading(false);
        }
      })();

      return () => {
        mounted = false;
      };
    }, []),
  );

  async function handleAccept(invite: IncomingInvite) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId: invite.userId,
        matchName: invite.firstName ?? 'Kullanıcı',
        matchAge: String(invite.age),
        matchCity: invite.city ?? '',
        matchPhoto: invite.displayPhotoUrl,
        matchPercentage: String(invite.matchScore),
        isAccepting: '1',
      },
    } as unknown as Parameters<typeof router.push>[0]);
  }

  async function handleReject(invite: IncomingInvite) {
    Alert.alert(
      'Reddet',
      `${invite.firstName ?? 'Bu kişi'} ile eşleşmeyi reddetmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('matches').update({ status: 'expired' }).eq('id', invite.matchId);
            setIncoming((prev) => prev.filter((i) => i.matchId !== invite.matchId));
          },
        },
      ],
    );
  }

  function handleTanis(match: MatchCardData) {
    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId: match.user_id,
        matchName: match.first_name ?? 'Kullanıcı',
        matchAge: String(safeAge(match.date_of_birth)),
        matchCity: match.city ?? '',
        matchPhoto: match.displayPhotoUrl,
        matchPercentage: String(match.match_percentage),
        isAccepting: '0',
      },
    } as unknown as Parameters<typeof router.push>[0]);
  }

  function handleGec(match: MatchCardData) {
    Alert.alert(
      'Geç',
      `${match.first_name ?? 'Bu kişiyi'} geçmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Geç',
          onPress: async () => {
            await supabase.from('matches').update({ status: 'expired' }).eq('id', match.matchId);
            setCards((prev) => {
              const next = prev.filter((c) => c.matchId !== match.matchId);
              if (next.length === 0) setNoMatches(true);
              return next;
            });
          },
        },
      ],
    );
  }

  const acceptedUserIds = new Set(acceptedMatches.map((am) => am.userId));

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.pageTitle}>Eşleşmeler</ThemedText>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Onaylanan Buluşmalar */}
            {acceptedMatches.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>☕ Onaylanan Buluşmalar</ThemedText>
                {acceptedMatches.map((am) => (
                  <View key={am.matchId} style={styles.acceptedCard}>
                    <Image
                      source={{ uri: am.displayPhotoUrl }}
                      style={styles.acceptedPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.acceptedInfo}>
                      <ThemedText style={styles.acceptedName}>
                        {am.firstName ?? 'Kullanıcı'}, {am.age}
                      </ThemedText>
                      <ThemedText style={styles.acceptedStatus}>
                        {am.checkinDone ? '✅ Check-in yapıldı' : '⏳ Buluşma bekleniyor'}
                      </ThemedText>
                    </View>
                    {!am.checkinDone && (
                      <TouchableOpacity
                        style={styles.checkinBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/checkin',
                            params: {
                              matchId: am.matchId,
                              matchName: am.firstName ?? 'Kullanıcı',
                              isUserA: am.isUserA ? '1' : '0',
                            },
                          } as any)
                        }
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.checkinBtnText}>Check-in Yap</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Gelen davetler */}
            {incoming.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>📬 Seni Davet Etti</ThemedText>
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{incoming.length}</ThemedText>
                  </View>
                </View>
                {incoming.map((invite) => (
                  <View key={invite.matchId} style={styles.inviteCard}>
                    <Image
                      source={{ uri: invite.displayPhotoUrl }}
                      style={styles.invitePhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.inviteInfo}>
                      <ThemedText style={styles.inviteName}>
                        {invite.firstName ?? 'Kullanıcı'}, {invite.age}
                      </ThemedText>
                      <ThemedText style={styles.inviteCity}>📍 {invite.city ?? 'Bilinmiyor'}</ThemedText>
                      {invite.introAnswers && (
                        <View style={styles.inviteAnswers}>
                          {invite.introAnswers.kafe && (
                            <ThemedText style={styles.inviteAnswer}>{invite.introAnswers.kafe}</ThemedText>
                          )}
                          {invite.introAnswers.gun && (
                            <ThemedText style={styles.inviteAnswer}>{invite.introAnswers.gun}</ThemedText>
                          )}
                          {invite.introAnswers.saat && (
                            <ThemedText style={styles.inviteAnswer}>{invite.introAnswers.saat}</ThemedText>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={styles.inviteScoreBadge}>
                      <ThemedText style={styles.inviteScore}>%{invite.matchScore}</ThemedText>
                    </View>
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(invite)}
                        activeOpacity={0.8}>
                        <ThemedText style={styles.acceptBtnText}>Kabul Et ✓</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleReject(invite)}
                        activeOpacity={0.8}>
                        <ThemedText style={styles.rejectBtnText}>Reddet</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Kendi eşleşmelerin */}
            <View style={styles.section}>
              {noMatches ? (
                <View style={styles.emptyWrap}>
                  <ThemedText style={styles.emptyText}>
                    Henüz eşleşme bulunamadı.{'\n'}Profil bilgilerini tamamladıktan sonra tekrar dene.
                  </ThemedText>
                </View>
              ) : (
                cards.map((match) => {
                  const now = new Date();
                  const isExpired =
                    match.expires_at && new Date(match.expires_at) < now;
                  if (isExpired) return null;

                  const timeLeft =
                    match.status === 'pending' && match.expires_at
                      ? match.expires_at
                      : null;

                  return (
                    <MatchProfileCard
                      key={match.matchId}
                      match={match}
                      timeLeft={timeLeft}
                      requestSent={acceptedUserIds.has(match.user_id)}
                      onTanis={() => handleTanis(match)}
                      onGec={() => handleGec(match)}
                    />
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  content: { paddingBottom: 40, gap: 16 },

  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },

  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  acceptedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  acceptedPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DDD',
  },
  acceptedInfo: { flex: 1, gap: 4 },
  acceptedName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  acceptedStatus: { fontSize: 13, color: '#888' },
  checkinBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkinBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  // Gelen davet kartı
  inviteCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: 12,
    gap: 10,
  },
  invitePhoto: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#DDD',
  },
  inviteInfo: { gap: 4 },
  inviteName: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  inviteCity: { fontSize: 13, color: '#888' },
  inviteAnswers: { marginTop: 6, gap: 3 },
  inviteAnswer: { fontSize: 13, color: colors.accent },
  inviteScoreBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inviteScore: { color: '#fff', fontSize: 13, fontWeight: '700' },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#888', fontSize: 14 },

  matchScroll: { marginBottom: 24 },
  matchScrollContent: { gap: 0 },

  heroWrap: {
    position: 'relative',
    width: '100%',
    height: 380,
    backgroundColor: '#DDDDDD',
  },
  heroPhoto: { width: '100%', height: '100%' },
  heroNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroPctBadge: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroPctText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  heroCategoryBadge: {
    position: 'absolute',
    top: 14,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroCategoryText: { color: ACCENT, fontSize: 12, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLineIcon: { fontSize: 16, width: 24 },
  infoLineText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  inlinePhoto: {
    width: '100%',
    height: 280,
    marginTop: 12,
    backgroundColor: '#DDDDDD',
  },

  simCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  simCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hobbyChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hobbyChipText: { color: ACCENT, fontSize: 13 },

  buttonsWrap: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  tanisBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tanisBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  gecBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  gecBtnText: { color: '#888888', fontSize: 16, fontWeight: '500' },
  sentText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    paddingVertical: 12,
  },
  timeLeftText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
  },

  emptyWrap: { marginTop: 20, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24 },
});
