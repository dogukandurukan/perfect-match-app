// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: Temmuz 2026
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HingeProfileCard } from '@/components/profile/HingeProfileCard';
import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import {
  acceptMatchInvite,
  formatIntroLines,
  introAnswersForUser,
  orderedPair,
  upsertMatchPair,
  type IntroAnswers,
} from '@/lib/matchInvite';
import {
  getDailyInvitesState,
  remainingInvitesLabel,
  type DailyInvitesState,
} from '@/lib/dailyInvites';
import {
  hingeSafeAge,
  parseFavoriteSpots,
  strongestCommonLine,
  type CommonSelf,
  type HingeProfilePerson,
} from '@/lib/hingeProfile';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ACCENT = '#B8860B';

function matchCategory(score: number): string {
  if (score >= 85) return '🔥 Perfect match';
  if (score >= 70) return '✨ Great match';
  if (score >= 55) return '👍 Good match';
  return '🤝 You have things in common';
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
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
};

type IncomingInvite = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  city: string | null;
  displayPhotoUrl: string;
  matchScore: number;
  introAnswers: IntroAnswers | null;
  otherGender: string | null;
};

type OutgoingInvite = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  displayPhotoUrl: string;
};

type OpenChatRow = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  displayPhotoUrl: string;
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
  if (diff <= 0) return 'Expired';

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(diff / (1000 * 60 * 60));

  if (totalHours >= 24) return null;

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `⏳ ${hours}h ${minutes}m left`;
  }

  return `⏳ ${totalMinutes}m left`;
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
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
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
    bio: profile.bio,
    first_date_expectation: profile.first_date_expectation,
    favorite_spots: parseFavoriteSpots(profile.favorite_spots),
  };
}

function matchToHingePerson(match: MatchCardData): HingeProfilePerson {
  const photos = (match.photos ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0);
  return {
    first_name: match.first_name,
    date_of_birth: match.date_of_birth,
    district: match.district,
    city: match.city,
    match_percentage: match.match_percentage,
    intent: match.intent,
    availability_days: match.availability_days,
    drinking: match.drinking,
    smoking: match.smoking,
    hobbies: match.hobbies,
    favorite_music: match.favorite_music,
    favorite_movie: match.favorite_movie,
    favorite_book: match.favorite_book,
    bio: match.bio,
    first_date_expectation: match.first_date_expectation,
    favorite_spots: match.favorite_spots,
    photoUrls: photos.length > 0 ? photos : [match.displayPhotoUrl],
  };
}

type CompactMatchCardProps = {
  match: MatchCardData;
  commonLine: string | null;
  inviteState: 'none' | 'sent' | 'open';
  timeLeft: string | null;
  onOpenDetail: () => void;
  onLetsMeet: () => void;
  onOpenChat: () => void;
  onPass: () => void;
};

function CompactMatchCard({
  match,
  commonLine,
  inviteState,
  timeLeft,
  onOpenDetail,
  onLetsMeet,
  onOpenChat,
  onPass,
}: CompactMatchCardProps) {
  const displayName = match.first_name ?? 'Someone';
  const displayAge = safeAge(match.date_of_birth);

  return (
    <View style={styles.compactCard}>
      <TouchableOpacity
        style={styles.compactMain}
        activeOpacity={0.85}
        onPress={onOpenDetail}>
        <Image
          source={{ uri: match.displayPhotoUrl }}
          style={styles.compactPhoto}
          resizeMode="cover"
        />
        <View style={styles.compactInfo}>
          <ThemedText style={styles.compactName}>
            {displayName}, {displayAge}
          </ThemedText>
          <View style={styles.compactPctBadge}>
            <ThemedText style={styles.compactPctText}>%{match.match_percentage}</ThemedText>
          </View>
          {commonLine ? (
            <ThemedText style={styles.compactCommon} numberOfLines={1}>
              {commonLine}
            </ThemedText>
          ) : null}
          {timeLeft ? <CountdownText expiresAt={timeLeft} /> : null}
        </View>
      </TouchableOpacity>

      <View style={styles.compactActions}>
        {inviteState === 'sent' ? (
          <ThemedText style={styles.compactWaiting}>
            Waiting for {displayName} ⏳
          </ThemedText>
        ) : inviteState === 'open' ? (
          <TouchableOpacity style={styles.compactMeetBtn} onPress={onOpenChat} activeOpacity={0.85}>
            <ThemedText style={styles.compactMeetText}>💬 Message</ThemedText>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.compactMeetBtn}
              onPress={onLetsMeet}
              activeOpacity={0.85}>
              <ThemedText style={styles.compactMeetText}>☕ Let&apos;s meet</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactPassBtn} onPress={onPass} activeOpacity={0.85}>
              <ThemedText style={styles.compactPassText}>👋</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function safeAge(dob: string | null): number {
  const age = hingeSafeAge(dob);
  return age > 0 ? age : 28;
}

export default function MatchesTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<MatchCardData[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingInvite[]>([]);
  const [openChats, setOpenChats] = useState<OpenChatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const [acceptedMatches, setAcceptedMatches] = useState<AcceptedMatch[]>([]);
  const [inviteByOtherId, setInviteByOtherId] = useState<
    Record<string, { matchId: string; invitedBy: string | null; chatOpened: boolean }>
  >({});
  const [myGender, setMyGender] = useState<string | null>(null);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [commonSelf, setCommonSelf] = useState<CommonSelf | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dailyInvites, setDailyInvites] = useState<DailyInvitesState | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setSelectedMatch(null);

      (async () => {
        setLoading(true);
        setNoMatches(false);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const userId = user.id;

        const [{ data: meProfile }, invitesState] = await Promise.all([
          supabase
            .from('profiles')
            .select('gender, city, district, hobbies, favorite_music, favorite_movie, favorite_book')
            .eq('id', userId)
            .maybeSingle(),
          getDailyInvitesState(userId, false),
        ]);
        if (!mounted) return;
        setMyGender(meProfile?.gender ?? null);
        setMyCity(typeof meProfile?.city === 'string' ? meProfile.city : null);
        setCommonSelf({
          hobbies: Array.isArray(meProfile?.hobbies) ? (meProfile.hobbies as string[]) : null,
          favorite_music:
            typeof meProfile?.favorite_music === 'string' ? meProfile.favorite_music : null,
          favorite_movie:
            typeof meProfile?.favorite_movie === 'string' ? meProfile.favorite_movie : null,
          favorite_book:
            typeof meProfile?.favorite_book === 'string' ? meProfile.favorite_book : null,
          district: typeof meProfile?.district === 'string' ? meProfile.district : null,
        });
        setDailyInvites(invitesState);

        // All matches involving me (invite / chat state)
        const { data: myMatches } = await supabase
          .from('matches')
          .select(
            `
            id,
            user_a_id,
            user_b_id,
            match_score,
            status,
            invited_by,
            chat_opened,
            user_a_intro_answers,
            user_b_intro_answers,
            checkin_a,
            checkin_b
          `,
          )
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
          .neq('status', 'expired');

        const rows = myMatches ?? [];
        const otherIds = [
          ...new Set(
            rows.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id) as string),
          ),
        ];

        const profileById = new Map<
          string,
          {
            id: string;
            first_name: string | null;
            date_of_birth: string | null;
            city: string | null;
            photos: string[] | null;
            gender: string | null;
          }
        >();

        if (otherIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, date_of_birth, city, district, photos, gender')
            .in('id', otherIds);
          for (const p of profiles ?? []) {
            profileById.set(p.id, p);
          }
        }

        async function photoFor(uid: string, photos: string[] | null | undefined): Promise<string> {
          const first = photos?.[0];
          const signed = first ? await resolveProfilePhotoUrl(first, 3600) : null;
          return signed ?? `https://i.pravatar.cc/300?u=${uid}`;
        }

        const nextIncoming: IncomingInvite[] = [];
        const nextOutgoing: OutgoingInvite[] = [];
        const nextOpen: OpenChatRow[] = [];
        const nextAccepted: AcceptedMatch[] = [];
        const inviteMap: Record<
          string,
          { matchId: string; invitedBy: string | null; chatOpened: boolean }
        > = {};

        for (const row of rows) {
          const otherId = (row.user_a_id === userId ? row.user_b_id : row.user_a_id) as string;
          const profile = profileById.get(otherId);
          const displayPhotoUrl = await photoFor(otherId, profile?.photos);
          const firstName = profile?.first_name ?? null;
          const age = safeAge(profile?.date_of_birth ?? null);
          const invitedBy = (row.invited_by as string | null) ?? null;
          const chatOpened = row.chat_opened === true;

          inviteMap[otherId] = {
            matchId: row.id,
            invitedBy,
            chatOpened,
          };

          if (chatOpened) {
            nextOpen.push({
              matchId: row.id,
              userId: otherId,
              firstName,
              age,
              displayPhotoUrl,
            });
          } else if (invitedBy && invitedBy !== userId) {
            const inviterAnswers = introAnswersForUser(
              {
                user_a_id: row.user_a_id,
                user_b_id: row.user_b_id,
                user_a_intro_answers: row.user_a_intro_answers as IntroAnswers | null,
                user_b_intro_answers: row.user_b_intro_answers as IntroAnswers | null,
              },
              invitedBy,
            );
            nextIncoming.push({
              matchId: row.id,
              userId: otherId,
              firstName,
              age,
              city: profile?.city ?? null,
              displayPhotoUrl,
              matchScore: Math.round(Number(row.match_score) || 0),
              introAnswers: inviterAnswers,
              otherGender: profile?.gender ?? null,
            });
          } else if (invitedBy === userId) {
            nextOutgoing.push({
              matchId: row.id,
              userId: otherId,
              firstName,
              age,
              displayPhotoUrl,
            });
          }

          if (row.status === 'accepted') {
            const isUserA = row.user_a_id === userId;
            const checkinDone = isUserA ? row.checkin_a !== null : row.checkin_b !== null;
            nextAccepted.push({
              matchId: row.id,
              userId: otherId,
              firstName,
              age,
              displayPhotoUrl,
              isUserA,
              checkinDone,
            });
          }
        }

        if (!mounted) return;
        setIncoming(nextIncoming);
        setOutgoing(nextOutgoing);
        setOpenChats(nextOpen);
        setAcceptedMatches(nextAccepted);
        setInviteByOtherId(inviteMap);

        // Candidate cards — pending slots for discovery
        const nowIso = new Date().toISOString();
        const { data: pendingRows, error: pendingError } = await supabase
          .from('matches')
          .select('id, user_a_id, user_b_id, match_score, expires_at, status, invited_by, chat_opened')
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
          .eq('status', 'pending')
          .is('invited_by', null)
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: true })
          .limit(MATCH_SLOT_COUNT);

        if (!mounted) return;

        if (pendingError) {
          Alert.alert('Error', pendingError.message);
          setLoading(false);
          return;
        }

        type PendingRow = {
          id: string;
          user_a_id: string;
          user_b_id: string;
          match_score: number;
          expires_at: string;
          status: string;
        };

        let activePending: PendingRow[] = (pendingRows ?? []) as PendingRow[];
        const existingOtherIds = new Set(
          activePending.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id)),
        );

        const missingCount = MATCH_SLOT_COUNT - activePending.length;
        if (missingCount > 0) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_matches', {
            p_user_id: userId,
            p_limit: missingCount + 5,
          });

          if (!mounted) return;

          if (rpcError) {
            Alert.alert('Error', rpcError.message);
            setLoading(false);
            return;
          }

          const candidates = ((rpcData ?? []) as MatchResultItem[]).filter(
            (c) => !existingOtherIds.has(c.user_id) && !inviteMap[c.user_id],
          );

          for (const candidate of candidates.slice(0, missingCount)) {
            const upserted = await upsertMatchPair(
              userId,
              candidate.user_id,
              candidate.match_percentage,
            );
            if (!upserted.matchId) continue;

            const expiresAt = new Date(Date.now() + MATCH_TTL_MS).toISOString();
            await supabase
              .from('matches')
              .update({ expires_at: expiresAt, status: 'pending', algo_version: 'v1' })
              .eq('id', upserted.matchId)
              .is('invited_by', null);

            const [a, b] = orderedPair(userId, candidate.user_id);
            activePending.push({
              id: upserted.matchId,
              user_a_id: a,
              user_b_id: b,
              match_score: candidate.match_percentage,
              expires_at: expiresAt,
              status: 'pending',
            });
            existingOtherIds.add(candidate.user_id);
          }
        }

        if (!mounted) return;

        if (activePending.length === 0) {
          setCards([]);
          setNoMatches(true);
          setLoading(false);
          return;
        }

        const cardOtherIds = activePending.map((r) =>
          r.user_a_id === userId ? r.user_b_id : r.user_a_id,
        );
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style, bio, first_date_expectation, favorite_spots',
          )
          .in('id', cardOtherIds);

        if (!mounted) return;

        let profilesForCards: ProfileForCard[] = [];
        if (profileError) {
          const { data: fallbackRows, error: fallbackError } = await supabase
            .from('profiles')
            .select(
              'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style',
            )
            .in('id', cardOtherIds);
          if (fallbackError) {
            Alert.alert('Error', fallbackError.message);
            setLoading(false);
            return;
          }
          profilesForCards = (fallbackRows ?? []).map((p) => ({
            ...(p as Omit<ProfileForCard, 'bio' | 'first_date_expectation' | 'favorite_spots'>),
            bio: null,
            first_date_expectation: null,
            favorite_spots: null,
          }));
        } else {
          profilesForCards = (profileRows ?? []).map((p) => ({
            ...(p as ProfileForCard),
            favorite_spots: parseFavoriteSpots((p as ProfileForCard).favorite_spots),
          }));
        }

        const { data: intentRows } = await supabase
          .from('onboarding_answers')
          .select('user_id, intent')
          .in('user_id', cardOtherIds);

        if (!mounted) return;

        const intentMap = new Map<string, string | null>(
          (intentRows ?? []).map((row: { user_id: string; intent: string | null }) => [
            row.user_id,
            row.intent,
          ]),
        );

        const cardProfileById = new Map(profilesForCards.map((p) => [p.id, p]));

        const mappedCards = (
          await Promise.all(
            activePending.map(async (row) => {
              const otherId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;
              const profile = cardProfileById.get(otherId);
              if (!profile) return null;
              const pendingForCard: PendingMatchRow = {
                id: row.id,
                user_b_id: otherId,
                match_score: row.match_score,
                expires_at: row.expires_at,
                status: row.status,
              };
              return buildCardFromPending(
                pendingForCard,
                profile,
                intentMap.get(profile.id) ?? null,
              );
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

    setAcceptingId(invite.matchId);
    const result = await acceptMatchInvite({
      matchId: invite.matchId,
      currentUserId: user.id,
      currentUserGender: myGender,
      otherUserGender: invite.otherGender,
    });
    setAcceptingId(null);

    if (!result.ok) {
      Alert.alert('Could not accept', result.error ?? 'Something went wrong.');
      return;
    }

    setIncoming((prev) => prev.filter((i) => i.matchId !== invite.matchId));

    if (result.chatOpened) {
      setOpenChats((prev) => [
        {
          matchId: invite.matchId,
          userId: invite.userId,
          firstName: invite.firstName,
          age: invite.age,
          displayPhotoUrl: invite.displayPhotoUrl,
        },
        ...prev.filter((c) => c.matchId !== invite.matchId),
      ]);
      router.push({
        pathname: '/chat',
        params: {
          userId: invite.userId,
          userName: invite.firstName ?? 'Chat',
          matchId: invite.matchId,
        },
      });
    }
  }

  async function handleMaybeLater(invite: IncomingInvite) {
    setIncoming((prev) => prev.filter((i) => i.matchId !== invite.matchId));
  }

  function handleLetsMeet(match: MatchCardData) {
    if (dailyInvites?.limitReached) {
      Alert.alert(
        "You've used your invite for today",
        'Come back tomorrow, or go Premium for 3/day ✨',
      );
      return;
    }
    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId: match.user_id,
        matchName: match.first_name ?? 'them',
        matchAge: String(safeAge(match.date_of_birth)),
        matchCity: match.city ?? '',
        matchPhoto: match.displayPhotoUrl,
        matchPercentage: String(match.match_percentage),
        matchId: match.matchId,
      },
    });
  }

  function handleOpenChat(match: MatchCardData) {
    router.push({
      pathname: '/chat',
      params: {
        userId: match.user_id,
        userName: match.first_name ?? 'Chat',
        matchId: match.matchId,
      },
    });
  }

  function handlePass(match: MatchCardData) {
    Alert.alert('Maybe later', `Pass on ${match.first_name ?? 'this person'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Maybe later',
        onPress: () => {
          void (async () => {
            await supabase.from('matches').update({ status: 'expired' }).eq('id', match.matchId);
            setSelectedMatch(null);
            setCards((prev) => {
              const next = prev.filter((c) => c.matchId !== match.matchId);
              if (next.length === 0) setNoMatches(true);
              return next;
            });
          })();
        },
      },
    ]);
  }

  function cardInviteState(match: MatchCardData): 'none' | 'sent' | 'open' {
    const info = inviteByOtherId[match.user_id];
    if (!info) return 'none';
    if (info.chatOpened) return 'open';
    if (info.invitedBy) return 'sent';
    return 'none';
  }

  if (selectedMatch) {
    const inviteState = cardInviteState(selectedMatch);
    const displayName = selectedMatch.first_name ?? 'Someone';
    return (
      <View style={[styles.detailRoot, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity
            onPress={() => setSelectedMatch(null)}
            hitSlop={12}
            style={styles.detailBackBtn}
            accessibilityLabel="Back to matches">
            <Ionicons name="chevron-back" size={28} color={ACCENT} />
          </TouchableOpacity>
          <ThemedText style={styles.detailHeaderTitle}>Profile</ThemedText>
          <View style={styles.detailHeaderSpacer} />
        </View>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}>
          <HingeProfileCard
            person={matchToHingePerson(selectedMatch)}
            viewerCity={myCity}
            footer={
              <View style={styles.detailFooter}>
                {inviteState === 'sent' ? (
                  <ThemedText style={styles.compactWaiting}>
                    Waiting for {displayName} ⏳
                  </ThemedText>
                ) : inviteState === 'open' ? (
                  <TouchableOpacity
                    style={styles.detailPrimaryBtn}
                    onPress={() => handleOpenChat(selectedMatch)}
                    activeOpacity={0.85}>
                    <ThemedText style={styles.detailPrimaryText}>💬 Message</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.detailPrimaryBtn}
                      onPress={() => handleLetsMeet(selectedMatch)}
                      activeOpacity={0.85}>
                      <ThemedText style={styles.detailPrimaryText}>☕ Let&apos;s meet</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailSecondaryBtn}
                      onPress={() => handlePass(selectedMatch)}
                      activeOpacity={0.85}>
                      <ThemedText style={styles.detailSecondaryText}>👋 Maybe later</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            }
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.pageTitle}>Matches</ThemedText>
        {dailyInvites ? (
          <ThemedText style={styles.invitesLeftText}>
            {remainingInvitesLabel(dailyInvites)}
          </ThemedText>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {openChats.length > 0 ? (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Open chats</ThemedText>
                {openChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.matchId}
                    style={styles.acceptedCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: '/chat',
                        params: {
                          userId: chat.userId,
                          userName: chat.firstName ?? 'Chat',
                          matchId: chat.matchId,
                        },
                      })
                    }>
                    <Image
                      source={{ uri: chat.displayPhotoUrl }}
                      style={styles.acceptedPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.acceptedInfo}>
                      <ThemedText style={styles.acceptedName}>
                        {chat.firstName ?? 'Someone'}, {chat.age}
                      </ThemedText>
                      <ThemedText style={styles.acceptedStatus}>Tap to open chat</ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {acceptedMatches.length > 0 ? (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Confirmed meetups</ThemedText>
                {acceptedMatches.map((am) => (
                  <View key={am.matchId} style={styles.acceptedCard}>
                    <Image
                      source={{ uri: am.displayPhotoUrl }}
                      style={styles.acceptedPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.acceptedInfo}>
                      <ThemedText style={styles.acceptedName}>
                        {am.firstName ?? 'Someone'}, {am.age}
                      </ThemedText>
                      <ThemedText style={styles.acceptedStatus}>
                        {am.checkinDone ? 'Check-in done' : 'Meetup pending'}
                      </ThemedText>
                    </View>
                    {!am.checkinDone ? (
                      <TouchableOpacity
                        style={styles.checkinBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/checkin',
                            params: {
                              matchId: am.matchId,
                              matchName: am.firstName ?? 'Someone',
                              isUserA: am.isUserA ? '1' : '0',
                            },
                          })
                        }
                        activeOpacity={0.8}>
                        <ThemedText style={styles.checkinBtnText}>Check in</ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {incoming.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Invites for you</ThemedText>
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{incoming.length}</ThemedText>
                  </View>
                </View>
                {incoming.map((invite) => {
                  const lines = formatIntroLines(invite.introAnswers);
                  return (
                    <View key={invite.matchId} style={styles.inviteCard}>
                      <Image
                        source={{ uri: invite.displayPhotoUrl }}
                        style={styles.invitePhoto}
                        resizeMode="cover"
                      />
                      <View style={styles.inviteInfo}>
                        <ThemedText style={styles.inviteName}>
                          {invite.firstName ?? 'Someone'}, {invite.age}
                        </ThemedText>
                        <ThemedText style={styles.inviteCity}>
                          📍 {invite.city ?? 'Unknown'}
                        </ThemedText>
                        {lines.length > 0 ? (
                          <View style={styles.inviteAnswers}>
                            {lines.map((line) => (
                              <ThemedText key={line} style={styles.inviteAnswer}>
                                {line}
                              </ThemedText>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.inviteScoreBadge}>
                        <ThemedText style={styles.inviteScore}>%{invite.matchScore}</ThemedText>
                      </View>
                      <View style={styles.inviteActions}>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => void handleAccept(invite)}
                          disabled={acceptingId === invite.matchId}
                          activeOpacity={0.8}>
                          <ThemedText style={styles.acceptBtnText}>
                            {acceptingId === invite.matchId
                              ? 'Opening…'
                              : 'Accept & open chat'}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() => void handleMaybeLater(invite)}
                          activeOpacity={0.8}>
                          <ThemedText style={styles.rejectBtnText}>Maybe later</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {outgoing.length > 0 ? (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Waiting on them</ThemedText>
                {outgoing.map((invite) => (
                  <View key={invite.matchId} style={styles.acceptedCard}>
                    <Image
                      source={{ uri: invite.displayPhotoUrl }}
                      style={styles.acceptedPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.acceptedInfo}>
                      <ThemedText style={styles.acceptedName}>
                        {invite.firstName ?? 'Someone'}, {invite.age}
                      </ThemedText>
                      <ThemedText style={styles.acceptedStatus}>
                        Waiting for {invite.firstName ?? 'them'} to accept ⏳
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              {noMatches ? (
                <View style={styles.emptyWrap}>
                  <ThemedText style={styles.emptyText}>No matches yet</ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    Keep exploring — they&apos;ll show up here
                  </ThemedText>
                </View>
              ) : (
                cards.map((match) => {
                  const now = new Date();
                  const isExpired = match.expires_at && new Date(match.expires_at) < now;
                  if (isExpired) return null;

                  const timeLeft =
                    match.status === 'pending' && match.expires_at ? match.expires_at : null;

                  return (
                    <CompactMatchCard
                      key={match.matchId}
                      match={match}
                      commonLine={strongestCommonLine(commonSelf, match)}
                      timeLeft={timeLeft}
                      inviteState={cardInviteState(match)}
                      onOpenDetail={() => setSelectedMatch(match)}
                      onLetsMeet={() => handleLetsMeet(match)}
                      onOpenChat={() => handleOpenChat(match)}
                      onPass={() => handlePass(match)}
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
  invitesLeftText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
    textAlign: 'center',
    marginBottom: 12,
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

  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDEDED',
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  compactMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactPhoto: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#DDD',
  },
  compactInfo: { flex: 1, gap: 6 },
  compactName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  compactPctBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  compactPctText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  compactCommon: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactMeetBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  compactMeetText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  compactPassBtn: {
    width: 48,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPassText: { fontSize: 18 },
  compactWaiting: {
    flex: 1,
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    paddingVertical: 8,
  },

  detailRoot: { flex: 1, backgroundColor: '#FAFAFA' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  detailBackBtn: { padding: 8 },
  detailHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailHeaderSpacer: { width: 44 },
  detailScroll: { flex: 1 },
  detailScrollContent: { paddingBottom: 40 },
  detailFooter: {
    marginHorizontal: 14,
    marginTop: 18,
    gap: 10,
  },
  detailPrimaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  detailPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  detailSecondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailSecondaryText: { color: '#666666', fontSize: 15, fontWeight: '500' },

  timeLeftText: {
    color: '#888',
    fontSize: 12,
  },

  emptyWrap: { marginTop: 20, alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  emptyText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
