// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: 2026-09-18 (Warm Editorial redesign)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { MatchesHeader } from '@/components/matches/MatchesHeader';
import { MatchesSegmentedControl, type MatchesTabKey } from '@/components/matches/MatchesSegmentedControl';
import { ReadyMatchCard, type ReadyCardCta, type ReadyItem } from '@/components/matches/ReadyMatchCard';
import { UpcomingPlanCard, type UpcomingPlan } from '@/components/matches/UpcomingPlanCard';
import { HingeProfileCard } from '@/components/profile/HingeProfileCard';
import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';
import {
  formatMeetingTime,
  introAnswersForUser,
  orderedPair,
  upsertMatchPair,
  type IntroAnswers,
} from '@/lib/matchInvite';
import { getDailyInvitesState, type DailyInvitesState } from '@/lib/dailyInvites';
import { strongestReason } from '@/lib/matchReason';
import {
  hingeSafeAge,
  parseFavoriteSpots,
  type HingeProfilePerson,
} from '@/lib/hingeProfile';
import { supabase } from '@/lib/supabaseClient';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  displayPhotoUrl: string | null;
  intent: string | null;
  languages: string[] | null;
  recharge_style: string | string[] | null;
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
  /** Only ever populated for candidates freshly returned by get_top_matches
   * THIS session — existing, already-persisted pending matches have no
   * stored reasons (the RPC computes them on the fly, doesn't write them to
   * the matches row, and deliberately excludes already-matched pairs from
   * its own result set, so there is no way to recover a real reason for an
   * older pending row). Left undefined/empty in that case — the UI hides
   * the reason line rather than fabricating one. */
  reason: string | null;
};

type IncomingInvite = {
  matchId: string;
  userId: string;
  firstName: string | null;
  age: number;
  city: string | null;
  displayPhotoUrl: string | null;
  matchScore: number;
  introAnswers: IntroAnswers | null;
};

type WaitingInvite = {
  matchId: string;
  userId: string;
  firstName: string | null;
  displayPhotoUrl: string | null;
};

const MATCH_SLOT_COUNT = 3;
const MATCH_TTL_MS = 24 * 60 * 60 * 1000;

type PendingMatchRow = {
  id: string;
  user_b_id: string;
  match_score: number;
  expires_at: string;
  status: string;
  reasons?: string[] | null;
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

/** Real photo URL, or null if genuinely missing — no more pravatar.cc
 * fallback (2026-09-18 brief: no random third-party avatars, use a neutral
 * initials placeholder instead — see components/matches/PersonAvatar). */
function photoFor(photos: string[] | null | undefined): string | null {
  const first = photos?.[0];
  if (!first?.trim()) return null;
  return getProfilePhotoPublicUrl(first);
}

function buildCardFromPending(
  row: PendingMatchRow,
  profile: ProfileForCard,
  intent: string | null,
): MatchCardData {
  const signedPhotos = (profile.photos ?? [])
    .filter((p) => p?.trim())
    .map((path) => getProfilePhotoPublicUrl(path));

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
    reason: strongestReason(row.reasons),
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
    displayPhotoUrl: signedPhotos[0] ?? null,
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
    photoUrls: photos.length > 0 ? photos : match.displayPhotoUrl ? [match.displayPhotoUrl] : [],
  };
}

function safeAge(dob: string | null): number {
  return hingeSafeAge(dob);
}

/** "Walter's Coffee — Kadıköy · Near both of you" (older rows) or
 * "Walter's Coffee — Kadıköy" (rows saved by the redesigned Plan-your-date
 * screen) → { venue: "Walter's Coffee", district: "Kadıköy" }. A plain
 * custom-typed place with no " — " separator returns just `venue`, no
 * fabricated district. Real-text parsing of an existing free-text column,
 * not new data. */
function splitVenueText(raw: string | null): { venue: string | null; district: string | null } {
  if (!raw?.trim()) return { venue: null, district: null };
  const idx = raw.indexOf(' — ');
  if (idx === -1) return { venue: raw.trim(), district: null };
  const venue = raw.slice(0, idx).trim();
  let rest = raw.slice(idx + 3).trim();
  const dotIdx = rest.indexOf(' · ');
  if (dotIdx !== -1) rest = rest.slice(0, dotIdx).trim();
  return { venue: venue || null, district: rest || null };
}

export default function MatchesTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MatchesTabKey>('ready');
  const [cards, setCards] = useState<MatchCardData[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite[]>([]);
  const [waiting, setWaiting] = useState<WaitingInvite[]>([]);
  const [plans, setPlans] = useState<UpcomingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [inviteByOtherId, setInviteByOtherId] = useState<
    Record<string, { matchId: string; invitedBy: string | null; chatOpened: boolean }>
  >({});
  const [myCity, setMyCity] = useState<string | null>(null);
  const [dailyInvites, setDailyInvites] = useState<DailyInvitesState | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);
  const hasLoadedRef = useRef(false);
  // Ready/Plans switch below skips the fade entirely when the OS "Reduce
  // Motion" setting is on, per the brief's accessibility requirement.
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotionRef.current = v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = v;
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setSelectedMatch(null);

      (async () => {
        setLoading(true);
        setError(false);

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user;
          if (!user || !mounted) {
            setLoading(false);
            return;
          }

          const userId = user.id;
          const nowIso = new Date().toISOString();

          const [
            { data: meProfile },
            invitesState,
            { data: myMatches, error: myMatchesError },
            { data: pendingRows, error: pendingError },
          ] = await Promise.all([
            supabase.from('profiles').select('city').eq('id', userId).maybeSingle(),
            getDailyInvitesState(userId, false),
            supabase
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
              meeting_at,
              confirmed_place,
              meetup_confirmed,
              meetup_proposed_by
            `,
              )
              .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
              .not('status', 'in', '(expired,passed)'),
            supabase
              .from('matches')
              .select('id, user_a_id, user_b_id, match_score, expires_at, status, invited_by, chat_opened')
              .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
              .eq('status', 'pending')
              .is('invited_by', null)
              .order('created_at', { ascending: true })
              .limit(MATCH_SLOT_COUNT),
          ]);

          if (!mounted) return;
          setMyCity(typeof meProfile?.city === 'string' ? meProfile.city : null);
          setDailyInvites(invitesState);
          if (myMatchesError) {
            setError(true);
            setLoading(false);
            return;
          }

          const rows = myMatches ?? [];
          const otherIds = [
            ...new Set(rows.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id) as string)),
          ];

          const inviteMap: Record<string, { matchId: string; invitedBy: string | null; chatOpened: boolean }> = {};
          for (const row of rows) {
            const otherId = (row.user_a_id === userId ? row.user_b_id : row.user_a_id) as string;
            inviteMap[otherId] = {
              matchId: row.id,
              invitedBy: (row.invited_by as string | null) ?? null,
              chatOpened: row.chat_opened === true,
            };
          }

          if (pendingError) {
            setError(true);
            setLoading(false);
            return;
          }

          type ProfileRow = {
            id: string;
            first_name: string | null;
            date_of_birth: string | null;
            city: string | null;
            district: string | null;
            photos: string[] | null;
            gender: string | null;
          };
          type PendingRow = {
            id: string;
            user_a_id: string;
            user_b_id: string;
            match_score: number;
            expires_at: string;
            status: string;
            reasons?: string[] | null;
          };

          const [profilesOutcome, candidatesOutcome] = await Promise.all([
            (async () => {
              if (otherIds.length === 0) {
                return { profileById: new Map<string, ProfileRow>(), error: null as string | null };
              }
              const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, first_name, date_of_birth, city, district, photos, gender')
                .in('id', otherIds);
              if (profilesError) {
                return { profileById: new Map<string, ProfileRow>(), error: profilesError.message };
              }
              const map = new Map<string, ProfileRow>();
              for (const p of profiles ?? []) map.set(p.id, p as ProfileRow);
              return { profileById: map, error: null as string | null };
            })(),
            (async () => {
              const activePending: PendingRow[] = (pendingRows ?? []) as PendingRow[];
              const existingOtherIds = new Set(
                activePending.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id)),
              );

              const missingCount = MATCH_SLOT_COUNT - activePending.length;
              if (missingCount > 0) {
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_matches', {
                  p_user_id: userId,
                  p_limit: missingCount + 5,
                });
                if (rpcError) return { activePending, error: rpcError.message };

                const candidates = ((rpcData ?? []) as MatchResultItem[]).filter(
                  (c) => !existingOtherIds.has(c.user_id) && !inviteMap[c.user_id],
                );

                const backfilled = await Promise.all(
                  candidates.slice(0, missingCount).map(async (candidate) => {
                    const upserted = await upsertMatchPair(userId, candidate.user_id, candidate.match_percentage);
                    if (!upserted.matchId) return null;

                    const expiresAt = new Date(Date.now() + MATCH_TTL_MS).toISOString();
                    await supabase
                      .from('matches')
                      .update({ expires_at: expiresAt, status: 'pending', algo_version: 'v1' })
                      .eq('id', upserted.matchId)
                      .is('invited_by', null);

                    const [a, b] = orderedPair(userId, candidate.user_id);
                    return {
                      otherId: candidate.user_id,
                      row: {
                        id: upserted.matchId,
                        user_a_id: a,
                        user_b_id: b,
                        match_score: candidate.match_percentage,
                        expires_at: expiresAt,
                        status: 'pending',
                        reasons: candidate.reasons ?? null,
                      } as PendingRow,
                    };
                  }),
                );

                for (const item of backfilled) {
                  if (!item) continue;
                  activePending.push(item.row);
                  existingOtherIds.add(item.otherId);
                }
              }

              return { activePending, error: null as string | null };
            })(),
          ]);

          if (!mounted) return;

          if (profilesOutcome.error || candidatesOutcome.error) {
            setError(true);
            setLoading(false);
            return;
          }

          const profileById = profilesOutcome.profileById;
          const activePending = candidatesOutcome.activePending;

          const nextIncoming: IncomingInvite[] = [];
          const nextWaiting: WaitingInvite[] = [];
          const nextPlans: UpcomingPlan[] = [];

          for (const row of rows) {
            const otherId = (row.user_a_id === userId ? row.user_b_id : row.user_a_id) as string;
            const profile = profileById.get(otherId);
            const displayPhotoUrl = photoFor(profile?.photos);
            const firstName = profile?.first_name ?? null;
            const age = safeAge(profile?.date_of_birth ?? null);
            const invitedBy = (row.invited_by as string | null) ?? null;
            const chatOpened = row.chat_opened === true;

            const meetingAt = (row.meeting_at as string | null) ?? null;
            const meetupConfirmed = (row.meetup_confirmed as boolean | null) ?? null;
            const isConfirmedPlan = !!meetingAt && meetupConfirmed === true;

            if (isConfirmedPlan) {
              // "Cancelled veya geçmiş planları upcoming olarak gösterme" —
              // a meeting time already in the past is neither upcoming nor
              // does this app have a separate past-dates history screen to
              // route it to, so it's simply excluded here (not fabricated
              // as upcoming, not silently mis-shown elsewhere).
              if (new Date(meetingAt).getTime() > Date.now()) {
                const { venue, district } = splitVenueText((row.confirmed_place as string | null) ?? null);
                nextPlans.push({
                  matchId: row.id,
                  userId: otherId,
                  name: firstName ?? 'Someone',
                  photoUrl: displayPhotoUrl,
                  venue,
                  district,
                  whenLabel: formatMeetingTime(meetingAt),
                  canMessage: chatOpened,
                });
              }
              continue;
            }

            // Mutual-like open chats (invited_by never set) and algo-invite
            // chats already open (chat_opened && invited_by) are both
            // deliberately excluded here — Chats already lists every open
            // conversation, a second copy in Matches was redundant
            // (pre-existing decision, unchanged by this redesign).
            if (chatOpened && invitedBy) {
              // shown in Chats — nothing to do here
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
              });
            } else if (invitedBy === userId) {
              // Outgoing, awaiting their response — surfaced back in the
              // Ready tab as a "Waiting for {name}" card per this redesign
              // brief (previously moved out to Activity's own "Waiting on
              // them" grid, 2026-09-15 — that grid still exists too; this
              // is a deliberate, brief-requested overlap, see report).
              nextWaiting.push({ matchId: row.id, userId: otherId, firstName, displayPhotoUrl });
            }
          }

          setIncoming(nextIncoming);
          setWaiting(nextWaiting);
          setPlans(nextPlans);
          setInviteByOtherId(inviteMap);

          if (activePending.length === 0) {
            setCards([]);
            setLoading(false);
            hasLoadedRef.current = true;
            return;
          }

          const cardOtherIds = activePending.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id));
          const [
            { data: profileRows, error: profileError },
            { data: intentRows, error: intentError },
          ] = await Promise.all([
            supabase
              .from('profiles')
              .select(
                'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style, bio, first_date_expectation, favorite_spots',
              )
              .in('id', cardOtherIds),
            supabase.from('onboarding_answers').select('user_id, intent').in('user_id', cardOtherIds),
          ]);

          if (!mounted) return;

          if (intentError) {
            console.warn('[Matches] intent fetch failed', intentError);
          }

          let profilesForCards: ProfileForCard[] = [];
          if (profileError) {
            const { data: fallbackRows, error: fallbackError } = await supabase
              .from('profiles')
              .select(
                'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style',
              )
              .in('id', cardOtherIds);
            if (fallbackError) {
              setError(true);
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

          const intentMap = new Map<string, string | null>(
            (intentRows ?? []).map((row: { user_id: string; intent: string | null }) => [row.user_id, row.intent]),
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
                  reasons: row.reasons,
                };
                return buildCardFromPending(pendingForCard, profile, intentMap.get(profile.id) ?? null);
              }),
            )
          ).filter((card): card is MatchCardData => card !== null);

          if (mounted) {
            setCards(mappedCards);
            setLoading(false);
            hasLoadedRef.current = true;
          }
        } catch {
          if (mounted) {
            setError(true);
            setLoading(false);
          }
        }
      })();

      return () => {
        mounted = false;
      };
    }, [reloadKey]),
  );

  function handleLetsMeet(match: { user_id: string; first_name: string | null; date_of_birth: string | null; city: string | null; displayPhotoUrl: string | null; match_percentage: number; matchId: string }) {
    if (dailyInvites?.limitReached) {
      Alert.alert("You've used your invite for today", 'Come back tomorrow, or go Premium for 3/day ✨');
      return;
    }
    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId: match.user_id,
        matchName: match.first_name ?? 'them',
        matchAge: (() => {
          const age = safeAge(match.date_of_birth);
          return age > 0 ? String(age) : '';
        })(),
        matchCity: match.city ?? '',
        matchPhoto: match.displayPhotoUrl ?? '',
        matchPercentage: String(match.match_percentage),
        matchId: match.matchId,
      },
    });
  }

  function handleReviewInvite() {
    router.push('/(tabs)/notifications' as never);
  }

  function handleOpenChat(userId: string, firstName: string | null, matchId: string) {
    router.push({
      pathname: '/chat',
      params: { userId, userName: firstName ?? 'Chat', matchId },
    });
  }

  function handleViewPlan(plan: UpcomingPlan) {
    router.push({
      pathname: '/plan-detail',
      params: { matchId: plan.matchId, otherUserId: plan.userId },
    });
  }

  function switchTab(next: MatchesTabKey) {
    if (!reduceMotionRef.current) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setTab(next);
  }

  // --- Build the unified Ready list -----------------------------------
  const now = Date.now();
  const readyItems: ReadyItem[] = [];

  for (const match of cards) {
    const isExpired = !!match.expires_at && new Date(match.expires_at).getTime() < now;
    const cta: ReadyCardCta = isExpired
      ? { kind: 'expired', label: 'Expired' }
      : { kind: 'plan', label: 'Plan a date', onPress: () => handleLetsMeet(match) };
    readyItems.push({
      key: match.matchId,
      userId: match.user_id,
      name: match.first_name ?? 'Someone',
      age: safeAge(match.date_of_birth),
      photoUrl: match.displayPhotoUrl,
      matchPercentage: match.match_percentage,
      reason: match.reason,
      expiresAt: isExpired ? null : match.expires_at ?? null,
      cta,
    });
  }

  for (const invite of incoming) {
    readyItems.push({
      key: invite.matchId,
      userId: invite.userId,
      name: invite.firstName ?? 'Someone',
      age: invite.age,
      photoUrl: invite.displayPhotoUrl,
      matchPercentage: invite.matchScore > 0 ? invite.matchScore : null,
      reason: null,
      expiresAt: null,
      cta: { kind: 'review', label: 'Review invitation', onPress: handleReviewInvite },
    });
  }

  for (const w of waiting) {
    readyItems.push({
      key: w.matchId,
      userId: w.userId,
      name: w.firstName ?? 'Someone',
      age: 0,
      photoUrl: w.displayPhotoUrl,
      matchPercentage: null,
      reason: null,
      expiresAt: null,
      cta: { kind: 'waiting', label: `Waiting for ${w.firstName ?? 'them'}` },
    });
  }

  function openDetailFor(readyItem: ReadyItem) {
    const found = cards.find((c) => c.matchId === readyItem.key);
    if (found) setSelectedMatch(found);
    // Incoming/waiting items don't have full profile data loaded here (no
    // reasons/bio/etc. fetched for them) — tapping those opens the invite
    // review flow (incoming) or does nothing extra (waiting, already showing
    // everything relevant on the card) rather than a half-populated detail.
    else if (readyItem.cta.kind === 'review') handleReviewInvite();
  }

  // --- Detail overlay (unchanged behavior, re-skinned) ------------------
  if (selectedMatch) {
    const info = inviteByOtherId[selectedMatch.user_id];
    const inviteState: 'none' | 'sent' | 'open' = !info ? 'none' : info.chatOpened ? 'open' : info.invitedBy ? 'sent' : 'none';
    const displayName = selectedMatch.first_name ?? 'Someone';
    const isExpired = !!selectedMatch.expires_at && new Date(selectedMatch.expires_at).getTime() < now;
    return (
      <View style={[styles.detailRoot, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity
            onPress={() => setSelectedMatch(null)}
            hitSlop={12}
            style={styles.detailBackBtn}
            accessibilityLabel="Back to matches">
            <Ionicons name="chevron-back" size={28} color={homeColors.textPrimary} />
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
                  <View style={styles.detailWaiting}>
                    <Ionicons name="hourglass-outline" size={16} color={homeColors.textSecondary} />
                    <ThemedText style={styles.detailWaitingText}>Waiting for {displayName}</ThemedText>
                  </View>
                ) : inviteState === 'open' ? (
                  <TouchableOpacity
                    style={styles.detailPrimaryBtn}
                    onPress={() => handleOpenChat(selectedMatch.user_id, selectedMatch.first_name, selectedMatch.matchId)}
                    activeOpacity={0.85}>
                    <ThemedText style={styles.detailPrimaryText}>Message</ThemedText>
                  </TouchableOpacity>
                ) : isExpired ? (
                  <View style={[styles.detailPrimaryBtn, styles.detailPrimaryBtnDisabled]}>
                    <ThemedText style={styles.detailPrimaryTextDisabled}>Expired</ThemedText>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.detailPrimaryBtn}
                    onPress={() => handleLetsMeet(selectedMatch)}
                    activeOpacity={0.85}>
                    <ThemedText style={styles.detailPrimaryText}>Plan a date</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </ScrollView>
      </View>
    );
  }

  return (
    // Not ScreenContainer here on purpose — it applies its own insets.top +
    // 12 AND paddingHorizontal:24, which would double-count against
    // MatchesHeader's own insets.top handling and each section's own
    // homeSpacing.lg gutter below (single safe-area/gutter source, same
    // discipline Home's index.tsx already follows).
    <View style={styles.container}>
      <MatchesHeader />
      <View style={styles.segmentWrap}>
        <MatchesSegmentedControl
          value={tab}
          onChange={switchTab}
          readyCount={hasLoadedRef.current ? readyItems.length : undefined}
          plansCount={hasLoadedRef.current ? plans.length : undefined}
        />
      </View>

      {loading && !hasLoadedRef.current ? (
        <ActivityIndicator color={homeColors.accent} style={{ marginTop: 40 }} />
      ) : error && readyItems.length === 0 && plans.length === 0 ? (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'ready' ? (
            readyItems.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="heart-outline" size={40} color={homeColors.textSecondary} />
                <ThemedText style={styles.emptyText}>No one&apos;s ready yet</ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  Keep exploring on Discover — new matches will show up here
                </ThemedText>
              </View>
            ) : (
              <View style={styles.list}>
                {readyItems.map((item) => (
                  <ReadyMatchCard key={item.key} item={item} onPress={() => openDetailFor(item)} />
                ))}
              </View>
            )
          ) : plans.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={40} color={homeColors.textSecondary} />
              <ThemedText style={styles.emptyText}>No plans yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                When you both confirm a date, it&apos;ll appear here.
              </ThemedText>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => switchTab('ready')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Go to Ready matches">
                <ThemedText style={styles.emptyCtaText}>See who&apos;s ready</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {plans.map((plan) => (
                <UpcomingPlanCard
                  key={plan.matchId}
                  plan={plan}
                  onViewPlan={() => handleViewPlan(plan)}
                  onMessage={() => handleOpenChat(plan.userId, plan.name, plan.matchId)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', backgroundColor: homeColors.background },
  segmentWrap: { paddingHorizontal: homeSpacing.lg, paddingBottom: homeSpacing.md },
  content: { paddingHorizontal: homeSpacing.lg, paddingBottom: 40 },
  list: { gap: homeSpacing.md },

  emptyWrap: { marginTop: 48, alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  emptyText: {
    color: homeColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  emptySubtext: { color: homeColors.textSecondary, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  emptyCta: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },

  detailRoot: { flex: 1, backgroundColor: homeColors.background },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: homeColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeColors.border,
  },
  detailBackBtn: { padding: 8 },
  detailHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: homeColors.textPrimary,
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
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  detailPrimaryBtnDisabled: { backgroundColor: homeColors.mutedSurface },
  detailPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  detailPrimaryTextDisabled: { color: homeColors.textSecondary, fontSize: 16, fontWeight: '700' },
  detailWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: homeRadius.pill,
    borderWidth: 1,
    borderColor: homeColors.border,
  },
  detailWaitingText: { color: homeColors.textSecondary, fontSize: 15, fontWeight: '600' },
});
