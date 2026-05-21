// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: Mayıs 2026
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

function parseTokens(val: string | null | undefined): string[] {
  if (!val) return [];
  return val
    .split(',')
    .map((s) => s.replace(/^[🎵🎤🎬📺📚🏃]\s*/, '').trim().toLowerCase())
    .filter(Boolean);
}

function findOverlap(a: string | null, b: string | null): string[] {
  const tokensA = parseTokens(a);
  const tokensB = new Set(parseTokens(b));
  return tokensA.filter((t) => tokensB.has(t));
}

type MyProfile = {
  district: string | null;
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
};

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

function zodiacLabel(sign: string | null): string {
  if (!sign) return '';
  const emoji = ZODIAC_EMOJI[sign] ?? '';
  const tr = ZODIAC_TR[sign] ?? sign;
  return `${emoji} ${tr}`;
}

function matchCategory(score: number): string {
  if (score >= 85) return '🔥 Mükemmel uyum';
  if (score >= 70) return '✨ Çok iyi eşleşme';
  if (score >= 55) return '👍 İyi eşleşme';
  return '🤝 Ortak noktalarınız var';
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
};

function buildSmartReasons(me: MyProfile, match: MatchResultItem): string[] {
  const reasons: string[] = [];

  // Semt
  if (me.district && match.district && me.district === match.district) {
    reasons.push(`📍 ${match.district}`);
  }

  // Ortak müzik
  const musicOverlap = findOverlap(me.favorite_music, match.favorite_music);
  musicOverlap.slice(0, 2).forEach((m) => reasons.push(`🎵 ${m}`));

  // Ortak film
  const movieOverlap = findOverlap(me.favorite_movie, match.favorite_movie);
  if (movieOverlap.length > 0) reasons.push(`🎬 ${movieOverlap[0]}`);

  // Ortak kitap
  const bookOverlap = findOverlap(me.favorite_book, match.favorite_book);
  if (bookOverlap.length > 0) reasons.push(`📚 ${bookOverlap[0]}`);

  // Ortak hobiler
  const myHobbies = new Set((me.hobbies ?? []).map((h) => h.toLowerCase()));
  const commonHobbies = (match.hobbies ?? []).filter((h) => myHobbies.has(h.toLowerCase()));
  commonHobbies.slice(0, 2).forEach((h) => reasons.push(`🎯 ${h}`));

  // Müsait günler
  const myDays = new Set(me.availability_days ?? []);
  const commonDays = (match.availability_days ?? []).filter((d) => myDays.has(d));
  if (commonDays.length >= 2) {
    reasons.push(`📅 ${commonDays.slice(0, 2).join(', ')}`);
  }

  // Sabahçı / gececi
  if (me.morning_night && match.morning_night && me.morning_night === match.morning_night) {
    const label =
      me.morning_night === 'Morning person' ? '🌅 İkimiz de sabahçıyız' : '🌙 İkimiz de gececiyiz';
    reasons.push(label);
  }

  // Alkol
  if (me.drinking && match.drinking) {
    if (me.drinking === match.drinking) {
      reasons.push(`🍷 Alkol tercihi uyuşuyor`);
    }
  }

  // Sigara
  if (me.smoking && match.smoking) {
    if (me.smoking === match.smoking) {
      reasons.push(`🚬 Sigara tercihi uyuşuyor`);
    }
  }

  // Eğitim
  if (me.education && match.education && me.education === match.education) {
    if (
      me.education_detail &&
      match.education_detail &&
      me.education_detail.toLowerCase() === match.education_detail?.toLowerCase()
    ) {
      reasons.push(`🎓 ${match.education_detail}`);
    } else {
      reasons.push(`🎓 ${match.education} mezunu`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('✨ Uyumlu eşleşme');
  }

  return reasons.slice(0, 6);
}

type MatchCardData = MatchResultItem & { displayPhotoUrl: string };

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
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

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

        const { data: myData } = await supabase
          .from('profiles')
          .select('district, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night')
          .eq('id', userId)
          .single();

        if (mounted && myData) setMyProfile(myData as MyProfile);

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

        // 2. Kendi eşleşmelerini çek
        const { data, error } = await supabase.rpc('get_top_matches', {
          p_user_id: userId,
          p_limit: 3,
        });

        if (!mounted) return;

        if (error) {
          Alert.alert('Hata', error.message);
          setLoading(false);
          return;
        }

        if (!data || (data as MatchResultItem[]).length === 0) {
          setNoMatches(true);
          setLoading(false);
          return;
        }

        const mapped = await Promise.all(
          (data as MatchResultItem[]).map(async (row) => {
            const signedPhotos =
              row.photos && row.photos.length > 0
                ? await Promise.all(
                    row.photos.map(async (path, i) => {
                      const url = await resolveProfilePhotoUrl(path, 3600);
                      return url ?? `https://i.pravatar.cc/300?u=${row.user_id}&n=${i}`;
                    }),
                  )
                : [];
            const displayPhotoUrl =
              signedPhotos[0] ?? `https://i.pravatar.cc/300?u=${row.user_id}`;
            return {
              ...row,
              photos: signedPhotos.length > 0 ? signedPhotos : null,
              displayPhotoUrl,
            };
          }),
        );

        if (mounted) {
          setCards(mapped);
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

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.pageTitle}>Eşleşmeler</ThemedText>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
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
                    <Image source={{ uri: invite.displayPhotoUrl }} style={styles.invitePhoto} />
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
              <ThemedText style={styles.sectionTitle}>✨ Eşleşmelerin</ThemedText>
              {noMatches ? (
                <View style={styles.emptyWrap}>
                  <ThemedText style={styles.emptyText}>
                    Henüz eşleşme bulunamadı.{'\n'}Profil bilgilerini tamamladıktan sonra tekrar dene.
                  </ThemedText>
                </View>
              ) : (
                cards.map((match) => (
                  <View key={match.user_id} style={styles.card}>
                    <View style={styles.photoWrap}>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.photoScroll}>
                        {(match.photos && match.photos.length > 0
                          ? match.photos
                          : [match.displayPhotoUrl]
                        ).map((photoUrl, photoIdx) => (
                          <Image
                            key={`${match.user_id}-photo-${photoIdx}`}
                            source={{ uri: photoUrl }}
                            style={styles.photo}
                          />
                        ))}
                      </ScrollView>
                      <View style={styles.percentageBadge}>
                        <ThemedText style={styles.percentageText}>
                          %{match.match_percentage}
                        </ThemedText>
                      </View>
                      {match.photos && match.photos.length > 1 && (
                        <View style={styles.photoDots}>
                          {match.photos.map((_, dotIdx) => (
                            <View key={dotIdx} style={styles.photoDot} />
                          ))}
                        </View>
                      )}
                    </View>
                    <View style={styles.infoWrap}>
                      <View style={styles.nameRow}>
                        <ThemedText style={styles.name}>
                          {match.first_name ?? 'Kullanıcı'}, {safeAge(match.date_of_birth)}
                        </ThemedText>
                        {match.zodiac_sign ? (
                          <ThemedText style={styles.zodiacLabel}>
                            {zodiacLabel(match.zodiac_sign)}
                          </ThemedText>
                        ) : null}
                        <ThemedText style={styles.city}>
                          📍 {match.district ?? match.city ?? 'Bilinmiyor'}
                        </ThemedText>
                      </View>
                      <View style={styles.categoryWrap}>
                        <ThemedText style={styles.categoryText}>
                          {matchCategory(match.match_percentage)}
                        </ThemedText>
                      </View>
                      <View style={styles.chipsRow}>
                        {(myProfile
                          ? buildSmartReasons(myProfile, match)
                          : match.reasons.slice(0, 4)
                        ).map((reason, idx) => (
                          <View key={`reason-${idx}`} style={styles.chip}>
                            <ThemedText style={styles.chipText}>{reason}</ThemedText>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={styles.tanisBtn}
                        onPress={() => handleTanis(match)}
                        activeOpacity={0.8}>
                        <ThemedText style={styles.tanisBtnText}>Tanış →</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
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

  // Eşleşme kartı
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  photoWrap: { position: 'relative', width: '100%', height: 220 },
  photoScroll: {
    width: '100%',
    height: '100%',
  },
  photo: { width: '100%', height: '100%', backgroundColor: '#DDD' },
  photoDots: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 5,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  percentageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  percentageText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoWrap: { padding: 14, gap: 10 },
  nameRow: {
    gap: 2,
  },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  zodiacLabel: {
    fontSize: 12,
    color: '#888',
  },
  city: { color: '#888', fontSize: 13 },
  categoryWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: { color: colors.accent, fontSize: 12, fontWeight: '500' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  chipText: { color: '#555', fontSize: 12 },
  tanisBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  tanisBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  emptyWrap: { marginTop: 20, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24 },
});
