// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: 2026-09-18 (Warm Editorial redesign)
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { ConfirmedPlanCard, type ConfirmedPlan } from '@/components/matches/ConfirmedPlanCard';
import { MatchesHeader } from '@/components/matches/MatchesHeader';
import { MatchesSegmentedControl, type MatchesTabKey } from '@/components/matches/MatchesSegmentedControl';
import { PendingPlanCard, type PendingPlan } from '@/components/matches/PendingPlanCard';
import { ReadyMatchCard, type ReadyCardCta, type ReadyItem } from '@/components/matches/ReadyMatchCard';
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

/** A date-planning process has started with this person — either direction.
 * Never appears alongside the same person in `cards` (Ready) by
 * construction: a `matches` row with `invited_by` set is excluded from the
 * uninvited-candidates query that feeds `cards` (see `pendingRows` below). */
type PendingPlanRaw = {
  matchId: string;
  userId: string;
  name: string | null;
  age: number;
  photoUrl: string | null;
  venue: string | null;
  district: string | null;
  whenLabel: string | null;
  direction: 'outgoing' | 'incoming';
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

/** Real photo URL, or null if this person genuinely has no photo path
 * saved. 2026-09-18 (corrected): this used to ALSO reject any pravatar.cc
 * URL by domain name — wrong. This app's current demo data legitimately
 * uses pravatar URLs as real, reachable photos (curl-verified: HTTP 200
 * image/jpeg). Whether an image actually renders is PersonAvatar's job now
 * (real `onError`), not a guess based on the hostname here. */
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

type LiteProfile = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  district: string | null;
  photos: string[] | null;
};

/** A MatchCardData-shaped object for an OUTGOING-pending person (someone
 * already invited, not a fresh candidate) — built from the same light
 * profile fields already fetched for every `matches` row's other party (no
 * extra query). Rich optional fields (bio/hobbies/etc) are null: this
 * exists only so "View invitation" can reuse the exact same profile-detail
 * overlay + "Waiting for {name}" footer that Ready cards already use,
 * not to show a full rich profile. */
function buildLiteCard(matchId: string, matchScore: number, profile: LiteProfile): MatchCardData {
  const signedPhotos = (profile.photos ?? []).filter((p) => p?.trim()).map((path) => getProfilePhotoPublicUrl(path));
  return {
    user_id: profile.id,
    first_name: profile.first_name,
    date_of_birth: profile.date_of_birth,
    city: profile.city,
    district: profile.district,
    zodiac_sign: null,
    photos: signedPhotos.length > 0 ? signedPhotos : null,
    match_percentage: Math.round(matchScore) || 0,
    match_category: matchCategory(Math.round(matchScore) || 0),
    reasons: [],
    reason: null,
    favorite_music: null,
    favorite_movie: null,
    favorite_book: null,
    hobbies: null,
    availability_days: null,
    drinking: null,
    smoking: null,
    education: null,
    education_detail: null,
    morning_night: null,
    expires_at: null,
    status: 'pending',
    matchId,
    intent: null,
    languages: null,
    recharge_style: null,
    displayPhotoUrl: signedPhotos[0] ?? null,
    bio: null,
    first_date_expectation: null,
    favorite_spots: null,
  };
}

/** The proposed venue + first offered time from a set of intro answers
 * (already-existing `place`/`slot1` fields, see lib/matchInvite.ts) — the
 * same real data the "Plan your date" screen writes when an invite is
 * sent. Used for the Plans pending-card face (venue/date/district rows),
 * not a separate fetch. */
function proposedVenueAndTime(answers: IntroAnswers | null): {
  venue: string | null;
  district: string | null;
  whenLabel: string | null;
} {
  if (!answers) return { venue: null, district: null, whenLabel: null };
  const place = answers.place ?? answers.kafe ?? null;
  const { venue, district } = splitVenueText(place);
  const slot = answers.slot1 ?? answers.gun ?? null;
  const whenLabel = slot ? formatMeetingTime(slot) : null;
  return { venue, district, whenLabel };
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
  // Real tab bar height (react-navigation's own hook, already includes its
  // own bottom safe-area inset) — used as the list's bottom footer space so
  // the last Ready card's CTA / last Plans card's actions never render
  // underneath the tab bar (2026-09-18 V2 explicit requirement).
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<MatchesTabKey>('ready');
  const [cards, setCards] = useState<MatchCardData[]>([]);
  const [pendingPlans, setPendingPlans] = useState<PendingPlanRaw[]>([]);
  const [waitingCards, setWaitingCards] = useState<Record<string, MatchCardData>>({});
  const [confirmedPlans, setConfirmedPlans] = useState<ConfirmedPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [dailyInvites, setDailyInvites] = useState<DailyInvitesState | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);
  // Which footer the detail overlay shows for `selectedMatch` — set at open
  // time based on WHERE the tap came from, rather than re-deriving it from
  // invite state (Ready cards are, by construction, never-invited — see
  // `pendingRows`'s `.is('invited_by', null)` filter — so a live lookup
  // would always resolve to "none" there; 'waiting' is only ever set when
  // opened from a Plans "View invitation" tap).
  const [selectedMatchMode, setSelectedMatchMode] = useState<'candidate' | 'waiting'>('candidate');
  const hasLoadedRef = useRef(false);

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
            // No override — reads the real is_premium itself now (2026-09-18 fix).
            getDailyInvitesState(userId),
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

          const nextPending: PendingPlanRaw[] = [];
          const nextWaitingCards: Record<string, MatchCardData> = {};
          const nextConfirmed: ConfirmedPlan[] = [];

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
            // Confirmed = meeting_at set AND meetup_confirmed===true — NOT
            // `status`, deliberately: picking one of the inviter's own
            // offered time chips at accept time sets meetup_confirmed=true
            // immediately (see notifications.tsx's handleRespond) while
            // `status` can still read 'pending' under the gendered
            // chat-open rule. Checking status here would wrongly drop a
            // genuinely confirmed plan.
            const isConfirmedPlan = !!meetingAt && meetupConfirmed === true;

            if (isConfirmedPlan) {
              // "Cancelled veya geçmiş planları upcoming olarak gösterme" —
              // a meeting time already in the past is neither upcoming nor
              // does this app have a separate past-dates history screen to
              // route it to, so it's simply excluded here (not fabricated
              // as upcoming, not silently mis-shown elsewhere).
              if (new Date(meetingAt).getTime() > Date.now()) {
                const { venue, district } = splitVenueText((row.confirmed_place as string | null) ?? null);
                nextConfirmed.push({
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
              // Incoming — someone invited ME, awaiting my decision. Goes to
              // Plans (2026-09-18 V2: NOT Ready — a pending invitation is a
              // date-planning process already in motion, not a candidate
              // still awaiting "Plan a date").
              const inviterAnswers = introAnswersForUser(
                {
                  user_a_id: row.user_a_id,
                  user_b_id: row.user_b_id,
                  user_a_intro_answers: row.user_a_intro_answers as IntroAnswers | null,
                  user_b_intro_answers: row.user_b_intro_answers as IntroAnswers | null,
                },
                invitedBy,
              );
              const proposal = proposedVenueAndTime(inviterAnswers);
              nextPending.push({
                matchId: row.id,
                userId: otherId,
                name: firstName,
                age,
                photoUrl: displayPhotoUrl,
                ...proposal,
                direction: 'incoming',
              });
            } else if (invitedBy === userId) {
              // Outgoing — I invited them, awaiting their response. Also
              // Plans now (was briefly surfaced in Ready as a "Waiting for
              // {name}" card in the previous round — this V2 brief
              // explicitly corrects that: Ready must only hold uninvited
              // candidates). My OWN intro answers are what I proposed.
              const myAnswers = introAnswersForUser(
                {
                  user_a_id: row.user_a_id,
                  user_b_id: row.user_b_id,
                  user_a_intro_answers: row.user_a_intro_answers as IntroAnswers | null,
                  user_b_intro_answers: row.user_b_intro_answers as IntroAnswers | null,
                },
                userId,
              );
              const proposal = proposedVenueAndTime(myAnswers);
              nextPending.push({
                matchId: row.id,
                userId: otherId,
                name: firstName,
                age,
                photoUrl: displayPhotoUrl,
                ...proposal,
                direction: 'outgoing',
              });
              // Lightweight profile-detail-shaped object so "View
              // invitation" can reuse the exact same overlay Ready cards
              // use, without a second query — same light fields already
              // fetched above for every row's other party.
              if (profile) {
                nextWaitingCards[otherId] = buildLiteCard(row.id, Number(row.match_score) || 0, profile);
              }
            }
          }

          setPendingPlans(nextPending);
          setWaitingCards(nextWaitingCards);
          setConfirmedPlans(nextConfirmed);

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

  function handleViewPlan(plan: ConfirmedPlan) {
    router.push({
      pathname: '/plan-detail',
      params: { matchId: plan.matchId, otherUserId: plan.userId },
    });
  }

  function handleViewInvitation(userId: string) {
    const found = waitingCards[userId];
    if (!found) return;
    setSelectedMatchMode('waiting');
    setSelectedMatch(found);
  }

  function switchTab(next: MatchesTabKey) {
    // No LayoutAnimation here (2026-09-18 V2 fix) — it was a real
    // contributor to the reported header/card overlap: `configureNext`
    // animates ANY layout change in the next render pass, and combined
    // with the previous View+ScrollView structure this could visibly
    // overlap elements mid-transition. Each tab now renders its own
    // FlatList/SectionList, which unmounts/remounts cleanly on switch
    // (also resetting scroll position for free — no manual scrollTo
    // needed) instead of animating in place.
    setTab(next);
  }

  // --- Build the Ready list — candidates ONLY (2026-09-18 V2 fix) -------
  // Pending invitations (either direction) no longer feed into Ready at
  // all — they moved to Plans (see `pendingPlans` below). `cards` is
  // already guaranteed uninvited by construction (`pendingRows`'s
  // `.is('invited_by', null)` filter), so every item here is a genuine,
  // still-undecided candidate.
  const now = Date.now();
  const readyItems: ReadyItem[] = cards.map((match) => {
    const isExpired = !!match.expires_at && new Date(match.expires_at).getTime() < now;
    const cta: ReadyCardCta = isExpired
      ? { kind: 'expired', label: 'Expired' }
      : { kind: 'plan', label: 'Plan a date', onPress: () => handleLetsMeet(match) };
    return {
      key: match.matchId,
      userId: match.user_id,
      name: match.first_name ?? 'Someone',
      age: safeAge(match.date_of_birth),
      photoUrl: match.displayPhotoUrl,
      matchPercentage: match.match_percentage,
      reason: match.reason,
      expiresAt: isExpired ? null : match.expires_at ?? null,
      cta,
    };
  });

  const pendingPlanItems: PendingPlan[] = pendingPlans.map((p) => ({
    matchId: p.matchId,
    userId: p.userId,
    name: p.name ?? 'Someone',
    age: p.age,
    photoUrl: p.photoUrl,
    venue: p.venue,
    district: p.district,
    whenLabel: p.whenLabel,
    direction: p.direction,
  }));
  // Mockup copy assumes the outgoing case ("Waiting for them / We'll let
  // you know when they respond.") — when an incoming invitation is mixed
  // in too, that copy would be actively wrong (they're not the one
  // waiting), so the header falls back to a neutral label in that case.
  const allOutgoing = pendingPlanItems.every((p) => p.direction === 'outgoing');
  const pendingSectionTitle = allOutgoing ? 'Waiting for them' : 'Pending invitations';
  const pendingSectionSubtitle = allOutgoing
    ? "We'll let you know when they respond."
    : 'Respond to invitations or wait for updates.';

  function openDetailFor(readyItem: ReadyItem) {
    const found = cards.find((c) => c.matchId === readyItem.key);
    if (!found) return;
    setSelectedMatchMode('candidate');
    setSelectedMatch(found);
  }

  function handlePendingPrimaryAction(plan: PendingPlan) {
    if (plan.direction === 'incoming') handleReviewInvite();
    else handleViewInvitation(plan.userId);
  }

  // --- Detail overlay (unchanged behavior, re-skinned) ------------------
  if (selectedMatch) {
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
                {selectedMatchMode === 'waiting' ? (
                  // An outgoing-pending person's detail is always "waiting"
                  // — `cards` (mode 'candidate') and `waitingCards` (mode
                  // 'waiting') are mutually exclusive sets by construction,
                  // no live invite-state lookup needed.
                  <View style={styles.detailWaiting}>
                    <Ionicons name="time-outline" size={16} color={homeColors.textSecondary} />
                    <ThemedText style={styles.detailWaitingText}>Waiting for {displayName}</ThemedText>
                  </View>
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

  const listHeader = (
    <>
      <MatchesHeader />
      <View style={styles.segmentWrap}>
        <MatchesSegmentedControl
          value={tab}
          onChange={switchTab}
          readyCount={hasLoadedRef.current ? readyItems.length : undefined}
          plansCount={hasLoadedRef.current ? pendingPlanItems.length + confirmedPlans.length : undefined}
        />
      </View>
    </>
  );

  // Real tab bar height + homeSpacing.xxl(24) — the SAME margin value
  // Home's index.tsx already uses for its own list bottom padding
  // (`tabBarHeight + homeSpacing.xxl`), confirmed working on a real device
  // per that screen's own history, rather than picking an untested number
  // here.
  const listFooterSpace = <View style={{ height: tabBarHeight + homeSpacing.xxl }} />;

  if (loading && !hasLoadedRef.current) {
    return (
      <View style={styles.container}>
        {listHeader}
        <ActivityIndicator color={homeColors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error && readyItems.length === 0 && pendingPlanItems.length === 0 && confirmedPlans.length === 0) {
    return (
      <View style={styles.container}>
        {listHeader}
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      </View>
    );
  }

  if (tab === 'ready') {
    return (
      // Not ScreenContainer here on purpose — it applies its own insets.top
      // + 12 AND paddingHorizontal:24, which would double-count against
      // MatchesHeader's own insets.top handling and this list's own
      // horizontal padding (single safe-area/gutter source).
      <View style={styles.container}>
        <FlatList
          data={readyItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => <ReadyMatchCard item={item} onPress={() => openDetailFor(item)} />}
          // Fixed 12pt gap (2026-09-18, reverted the flexGrow attempt — it
          // stretched the GAPS, not the cards, which never made the 3 cards
          // denser and didn't match the mockup's tight spacing at all; see
          // the report for the actual height math showing 3×146pt cards +
          // fixed 12pt gaps already fit one viewport on a real device without
          // needing to manufacture extra space).
          ItemSeparatorComponent={() => <View style={{ height: homeSpacing.sm + 2 }} />}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooterSpace}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="heart-outline" size={40} color={homeColors.textSecondary} />
              <ThemedText style={styles.emptyText}>No one&apos;s ready yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Keep exploring on Discover — new matches will show up here
              </ThemedText>
            </View>
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  const plansSections: {
    key: string;
    title: string;
    subtitle: string | null;
    data: PlansSectionRow[];
  }[] = [];
  if (pendingPlanItems.length > 0) {
    plansSections.push({
      key: 'pending',
      title: pendingSectionTitle,
      subtitle: pendingSectionSubtitle,
      data: pendingPlanItems.map((plan) => ({ kind: 'pending' as const, plan })),
    });
  }
  plansSections.push({
    key: 'confirmed',
    title: 'Confirmed',
    subtitle: null,
    data:
      confirmedPlans.length > 0
        ? confirmedPlans.map((plan) => ({ kind: 'confirmed' as const, plan }))
        : [{ kind: 'confirmedEmpty' as const }],
  });

  return (
    <View style={styles.container}>
      <SectionList
        sections={plansSections}
        keyExtractor={(row, i) =>
          row.kind === 'pending' ? row.plan.matchId : row.kind === 'confirmed' ? row.plan.matchId : `empty-${i}`
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <ThemedText style={styles.sectionHeaderTitle}>{section.title}</ThemedText>
            {section.subtitle ? (
              <ThemedText style={styles.sectionHeaderSubtitle}>{section.subtitle}</ThemedText>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'pending') {
            return (
              <PendingPlanCard plan={item.plan} onPrimaryAction={() => handlePendingPrimaryAction(item.plan)} />
            );
          }
          if (item.kind === 'confirmed') {
            return (
              <ConfirmedPlanCard
                plan={item.plan}
                onViewPlan={() => handleViewPlan(item.plan)}
                onMessage={() => handleOpenChat(item.plan.userId, item.plan.name, item.plan.matchId)}
              />
            );
          }
          return (
            <View style={styles.confirmedEmptyWrap}>
              <Ionicons name="calendar-outline" size={28} color={homeColors.textSecondary} />
              <ThemedText style={styles.confirmedEmptyText}>Confirmed dates will appear here</ThemedText>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: homeSpacing.sm + 2 }} />}
        SectionSeparatorComponent={() => <View style={{ height: homeSpacing.lg }} />}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooterSpace}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

type PlansSectionRow =
  | { kind: 'pending'; plan: PendingPlan }
  | { kind: 'confirmed'; plan: ConfirmedPlan }
  | { kind: 'confirmedEmpty' };

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', backgroundColor: homeColors.background },
  // No horizontal padding here either — `content`'s paddingHorizontal
  // below is the single gutter source for the whole list (header +
  // segmented control + cards), so nothing here stacks a second one.
  segmentWrap: { paddingBottom: homeSpacing.md },
  content: { paddingHorizontal: homeSpacing.xl },

  emptyWrap: { marginTop: 48, alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  emptyText: {
    color: homeColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  emptySubtext: { color: homeColors.textSecondary, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },

  sectionHeaderWrap: {
    backgroundColor: homeColors.background,
    paddingBottom: homeSpacing.sm,
  },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', color: homeColors.textPrimary },
  sectionHeaderSubtitle: { fontSize: 13.5, color: homeColors.textSecondary, marginTop: 2 },
  confirmedEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: homeSpacing.lg,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.surface,
  },
  confirmedEmptyText: { fontSize: 13.5, color: homeColors.textSecondary, fontWeight: '600' },

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
