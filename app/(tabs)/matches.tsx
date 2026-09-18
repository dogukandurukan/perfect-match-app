// Screen: Eşleşmeler sekmesi | Status: stable | Last updated: 2026-09-18 (Warm Editorial redesign)
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { ErrorState } from '@/components/ErrorState';
import { ConfirmedPlanCard, type ConfirmedPlan } from '@/components/matches/ConfirmedPlanCard';
import { MatchesHeader } from '@/components/matches/MatchesHeader';
import { MatchesSegmentedControl, type MatchesTabKey } from '@/components/matches/MatchesSegmentedControl';
import { PendingPlanCard, type PendingPlan } from '@/components/matches/PendingPlanCard';
import { ReadyMatchCard, type ReadyCardCta, type ReadyItem } from '@/components/matches/ReadyMatchCard';
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
import { computeFallbackReason, strongestReason, type ReasonCompareProfile } from '@/lib/matchReason';
import { hingeSafeAge, parseFavoriteSpots } from '@/lib/hingeProfile';
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
  /** Real `matches.expires_at` — see the 2026-09-18 investigation in
   * PendingPlanCard.tsx's docstring: this is the SAME candidate-freshness
   * TTL reused as the invitation's expiry (there is no separate
   * invitation-response deadline in this schema), but it's real, live DB
   * data either way, not fabricated. */
  expiresAt: string | null;
};

const MATCH_SLOT_COUNT = 3;
const MATCH_TTL_MS = 24 * 60 * 60 * 1000;

// Ready-list dynamic card sizing (2026-09-18) — the actual available height
// is measured live via onLayout (see the 'ready' tab render below), these
// are just its top/bottom/gap inputs and the clamp band.
const READY_LIST_TOP_PADDING = homeSpacing.sm; // 8pt — brief: "8-10pt"
// 2026-09-18 (V3 fix) — this used to be `tabBarHeight + 8`, which
// double-subtracted the tab bar: `readyListHeight` is measured via
// `onLayout` on a View that's already a descendant of this screen's own
// content area, and this app's tab bar has no `tabBarStyle.position:
// 'absolute'` override anywhere (grepped — none exists), which is the ONLY
// thing that would make a screen render behind the tab bar. With the
// default (non-absolute) tab bar, React Navigation already sizes each
// screen's content area to stop above the tab bar, so the space `onLayout`
// reports here NEVER included the tab bar to begin with — subtracting
// `tabBarHeight` again on top of that pushed the last card's safety margin
// a full tab-bar-height too far up, which is exactly the reported gap
// under the 3rd Ready card. A plain small safety margin is all that's
// needed now (brief: "4-8pt").
const READY_LIST_BOTTOM_PADDING = homeSpacing.xs + 2; // 6pt
const READY_LIST_GAP = homeSpacing.sm + 2; // 10pt — brief: "10-12pt"
const READY_CARD_HEIGHT_MIN = 150;
// 176→184 (2026-09-18, live device feedback: "çok az boşluk kalıyor... çok
// çok az daha büyütebiliriz"): the formula was already computing a value
// ABOVE 176 on the user's device (real measured space allowed it) and
// getting capped there, leaving that reported sliver of unused space —
// raising the ceiling lets the SAME real measurement use it, this isn't a
// new guessed number replacing the formula, just letting it run a little
// further.
const READY_CARD_HEIGHT_MAX = 184;
// Used only before the first onLayout fires, or when there isn't exactly
// 1-3 candidates to divide the measured space among — a plain constant,
// not a guess about what SHOULD fit (real measurement takes over the
// moment it's available).
const READY_CARD_HEIGHT_DEFAULT = 160;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  meeting_environment: string[] | null;
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
  me: ReasonCompareProfile,
): MatchCardData {
  const signedPhotos = (profile.photos ?? [])
    .filter((p) => p?.trim())
    .map((path) => getProfilePhotoPublicUrl(path));

  // Real RPC-computed reason when this candidate was freshly backfilled
  // this session; otherwise a client-side fallback that mirrors the SAME
  // field comparisons/priority the RPC itself uses (see
  // lib/matchReason.ts's computeFallbackReason for why the RPC can't just
  // be asked again for an already-pending candidate). Never fabricated —
  // both paths are real data, just computed in two different places
  // depending on when this candidate was found.
  const reason =
    strongestReason(row.reasons) ??
    computeFallbackReason(me, {
      hobbies: profile.hobbies,
      intent,
      drinking: profile.drinking,
      smoking: profile.smoking,
      district: profile.district,
      zodiac_sign: profile.zodiac_sign,
      favorite_spots: parseFavoriteSpots(profile.favorite_spots),
      meeting_environment: profile.meeting_environment,
    });

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
    reason,
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

function safeAge(dob: string | null): number {
  return hingeSafeAge(dob);
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
  const [tab, setTab] = useState<MatchesTabKey>('ready');
  const [cards, setCards] = useState<MatchCardData[]>([]);
  const [pendingPlans, setPendingPlans] = useState<PendingPlanRaw[]>([]);
  const [confirmedPlans, setConfirmedPlans] = useState<ConfirmedPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dailyInvites, setDailyInvites] = useState<DailyInvitesState | null>(null);
  // Real measured height of the space between the segmented control and
  // the tab bar (onLayout on the Ready list's flex:1 wrapper) — drives the
  // dynamic card-height formula below instead of a guessed constant.
  const [readyListHeight, setReadyListHeight] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

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
            { data: meIntentRow },
            invitesState,
            { data: myMatches, error: myMatchesError },
            { data: pendingRows, error: pendingError },
          ] = await Promise.all([
            // Comparison fields for the client-side reason fallback (see
            // computeFallbackReason) — real profile data, same fields the
            // RPC itself compares, no new columns.
            supabase
              .from('profiles')
              .select('district, zodiac_sign, hobbies, drinking, smoking, favorite_spots, meeting_environment')
              .eq('id', userId)
              .maybeSingle(),
            supabase.from('onboarding_answers').select('intent').eq('user_id', userId).maybeSingle(),
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
              meetup_proposed_by,
              expires_at
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
          setDailyInvites(invitesState);
          const meCompareProfile: ReasonCompareProfile = {
            hobbies: meProfile?.hobbies ?? null,
            intent: meIntentRow?.intent ?? null,
            drinking: meProfile?.drinking ?? null,
            smoking: meProfile?.smoking ?? null,
            district: meProfile?.district ?? null,
            zodiac_sign: meProfile?.zodiac_sign ?? null,
            favorite_spots: parseFavoriteSpots(meProfile?.favorite_spots),
            meeting_environment: meProfile?.meeting_environment ?? null,
          };
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
                expiresAt: (row.expires_at as string | null) ?? null,
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
                expiresAt: (row.expires_at as string | null) ?? null,
              });
            }
          }

          setPendingPlans(nextPending);
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
                'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style, bio, first_date_expectation, favorite_spots, meeting_environment',
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
                'id, first_name, date_of_birth, city, district, zodiac_sign, photos, favorite_music, favorite_movie, favorite_book, hobbies, availability_days, drinking, smoking, education, education_detail, morning_night, languages, recharge_style, meeting_environment',
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
                return buildCardFromPending(pendingForCard, profile, intentMap.get(profile.id) ?? null, meCompareProfile);
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

  function handleViewInvitation(userId: string, matchId: string) {
    router.push({ pathname: '/candidate-profile', params: { matchUserId: userId, matchId } });
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
    expiresAt: p.expiresAt,
  }));
  // Two SEPARATE sections now (2026-09-18 correction) — outgoing and
  // incoming used to share one section with a copy that guessed which
  // label fit better when both were mixed together. Splitting them means
  // each section's title is always literally true for every card under
  // it, no guessing needed.
  const outgoingPlanItems = pendingPlanItems.filter((p) => p.direction === 'outgoing');
  const incomingPlanItems = pendingPlanItems.filter((p) => p.direction === 'incoming');

  function openDetailFor(readyItem: ReadyItem) {
    router.push({ pathname: '/candidate-profile', params: { matchUserId: readyItem.userId, matchId: readyItem.key } });
  }

  function handlePendingPrimaryAction(plan: PendingPlan) {
    if (plan.direction === 'incoming') handleReviewInvite();
    else handleViewInvitation(plan.userId, plan.matchId);
  }

  // Single, unconditional header (2026-09-18 V3 fix) — previously this was
  // recreated per render-branch (`paddedListHeader` for loading/error/Ready
  // vs a SectionList `ListHeaderComponent` for Plans). Even though both
  // paths used the same `homeSpacing.xl` padding value, they were still two
  // structurally different render trees — one that scrolls away with
  // Plans' content and one that doesn't for Ready — which is itself a real
  // divergence, not just a hypothetical one. Rendering ONE instance here,
  // always in the exact same position above whichever body renders below
  // it, makes "the header never moves and always aligns identically
  // between tabs" true by construction instead of by two numbers matching.
  const header = (
    <View style={styles.headerWrap}>
      <MatchesHeader />
      <View style={styles.segmentWrap}>
        <MatchesSegmentedControl
          value={tab}
          onChange={switchTab}
          readyCount={hasLoadedRef.current ? readyItems.length : undefined}
          plansCount={hasLoadedRef.current ? pendingPlanItems.length + confirmedPlans.length : undefined}
        />
      </View>
    </View>
  );

  // homeSpacing.xxl(24) only — no `tabBarHeight` here anymore (2026-09-18 V3
  // fix, same root cause as the Ready card-height formula below: this
  // screen's content area already stops above the tab bar by default, so
  // adding `tabBarHeight` on top double-subtracted it).
  const listFooterSpace = <View style={{ height: homeSpacing.xxl }} />;

  let body: ReactNode;

  if (loading && !hasLoadedRef.current) {
    body = <ActivityIndicator color={homeColors.accent} style={{ marginTop: 40 }} />;
  } else if (error && readyItems.length === 0 && pendingPlanItems.length === 0 && confirmedPlans.length === 0) {
    body = <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />;
  } else if (tab === 'ready') {
    // Real available space for the 3 cards, measured — not guessed.
    // `onLayout` on the flex:1 wrapper below gives the exact pixel height
    // of the remaining area between the header and the bottom of this
    // screen's own content area.
    //
    // 2026-09-18 V3 fix: this used to also subtract `tabBarHeight` here,
    // which double-counted it — this app's tab bar has no
    // `tabBarStyle.position:'absolute'` override anywhere (the only thing
    // that would make a screen render BEHIND the tab bar), so with the
    // default (non-absolute, non-overlapping) tab bar, React Navigation
    // already sizes this screen's content area to stop above the tab bar.
    // `readyListHeight` therefore never included the tab bar in the first
    // place; subtracting it again pushed the whole 3-card layout up by a
    // full tab-bar-height, which is exactly the reported gap under the 3rd
    // card. `READY_LIST_BOTTOM_PADDING` (6pt) is now the ONLY bottom
    // safety margin.
    let cardHeight = READY_CARD_HEIGHT_DEFAULT;
    if (readyListHeight != null && readyItems.length > 0 && readyItems.length <= MATCH_SLOT_COUNT) {
      const totalGaps = READY_LIST_GAP * (readyItems.length - 1);
      const usable = readyListHeight - READY_LIST_TOP_PADDING - READY_LIST_BOTTOM_PADDING - totalGaps;
      cardHeight = clamp(Math.floor(usable / readyItems.length), READY_CARD_HEIGHT_MIN, READY_CARD_HEIGHT_MAX);
    }

    body = (
      <View style={{ flex: 1 }} onLayout={(e) => setReadyListHeight(e.nativeEvent.layout.height)}>
        <FlatList
          data={readyItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <ReadyMatchCard item={item} height={cardHeight} onPress={() => openDetailFor(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: READY_LIST_GAP }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="heart-outline" size={40} color={homeColors.textSecondary} />
              <ThemedText style={styles.emptyText}>No one&apos;s ready yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Keep exploring on Discover — new matches will show up here
              </ThemedText>
            </View>
          }
          contentContainerStyle={[
            styles.content,
            { paddingTop: READY_LIST_TOP_PADDING, paddingBottom: READY_LIST_BOTTOM_PADDING },
          ]}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  } else {
    // Three POSSIBLE sections, each shown only when it actually has data
    // (2026-09-18: a section with nothing in it no longer renders an empty
    // sub-card under its own header — if literally none of the three have
    // anything, the whole sectioned view is replaced by one combined empty
    // state below instead, see `plansIsEmpty`).
    const plansSections: {
      key: string;
      title: string;
      subtitle: string | null;
      data: PlansSectionRow[];
    }[] = [];
    if (outgoingPlanItems.length > 0) {
      plansSections.push({
        key: 'waiting',
        title: 'Waiting for them',
        subtitle: "We'll let you know when they respond.",
        data: outgoingPlanItems.map((plan) => ({ kind: 'pending' as const, plan })),
      });
    }
    if (incomingPlanItems.length > 0) {
      plansSections.push({
        key: 'invitations',
        title: 'Invitations for you',
        subtitle: null,
        data: incomingPlanItems.map((plan) => ({ kind: 'pending' as const, plan })),
      });
    }
    if (confirmedPlans.length > 0) {
      plansSections.push({
        key: 'confirmed',
        title: 'Confirmed',
        subtitle: null,
        data: confirmedPlans.map((plan) => ({ kind: 'confirmed' as const, plan })),
      });
    }
    const plansIsEmpty = plansSections.length === 0;

    body = (
      <SectionList
        sections={plansSections}
        keyExtractor={(row) => row.plan.matchId}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <ThemedText style={styles.sectionHeaderTitle}>{section.title}</ThemedText>
            {section.subtitle ? (
              <ThemedText style={styles.sectionHeaderSubtitle}>{section.subtitle}</ThemedText>
            ) : null}
          </View>
        )}
        renderItem={({ item }) =>
          item.kind === 'pending' ? (
            <PendingPlanCard plan={item.plan} onPrimaryAction={() => handlePendingPrimaryAction(item.plan)} />
          ) : (
            <ConfirmedPlanCard
              plan={item.plan}
              onViewPlan={() => handleViewPlan(item.plan)}
              onMessage={() => handleOpenChat(item.plan.userId, item.plan.name, item.plan.matchId)}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: homeSpacing.sm + 2 }} />}
        SectionSeparatorComponent={() => <View style={{ height: homeSpacing.lg }} />}
        ListFooterComponent={plansIsEmpty ? null : listFooterSpace}
        ListEmptyComponent={
          plansIsEmpty ? (
            <View style={styles.plansEmptyCard}>
              <Ionicons name="calendar-outline" size={30} color={homeColors.textSecondary} />
              <ThemedText style={styles.plansEmptyTitle}>No plans yet</ThemedText>
              <ThemedText style={styles.plansEmptySubtitle}>
                When you send an invitation, it&apos;ll appear here.
              </ThemedText>
              <TouchableOpacity
                style={styles.plansEmptyAction}
                onPress={() => switchTab('ready')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View ready matches">
                <ThemedText style={styles.plansEmptyActionText}>View ready matches</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    // Not ScreenContainer here on purpose — it applies its own insets.top +
    // 12 AND paddingHorizontal:24, which would double-count against
    // MatchesHeader's own insets.top handling and headerWrap's own
    // horizontal padding (single safe-area/gutter source).
    <View style={styles.container}>
      {header}
      {body}
    </View>
  );
}

type PlansSectionRow = { kind: 'pending'; plan: PendingPlan } | { kind: 'confirmed'; plan: ConfirmedPlan };

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', backgroundColor: homeColors.background },
  // Single horizontal-gutter source for the header (2026-09-18 V3 fix) —
  // `headerWrap` is now the ONLY place that pads MatchesHeader/
  // segmentWrap horizontally, since the header is rendered once, outside
  // both the Ready FlatList and the Plans SectionList (their own
  // `content.paddingHorizontal` below is a SEPARATE, independent gutter
  // for the list items only — same token value, not the same source).
  headerWrap: { paddingHorizontal: homeSpacing.xl },
  segmentWrap: { paddingBottom: homeSpacing.md },
  content: { paddingHorizontal: homeSpacing.xl },

  emptyWrap: { marginTop: 48, alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  emptyText: {
    color: homeColors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  emptySubtext: { color: homeColors.textSecondary, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },

  sectionHeaderWrap: {
    backgroundColor: homeColors.background,
    paddingBottom: homeSpacing.sm,
  },
  sectionHeaderTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', color: homeColors.textPrimary },
  sectionHeaderSubtitle: { fontSize: 13.5, color: homeColors.textSecondary, marginTop: 2 },
  // Single combined empty state for Plans (2026-09-18) — replaces the old
  // per-section "Confirmed dates will appear here" compact card, which
  // used to render even while a "Waiting for them"/"Invitations for you"
  // header sat empty above it. ~190pt tall (within the requested
  // 180-220pt band), not a full-screen block.
  plansEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: homeSpacing.xxl,
    paddingHorizontal: homeSpacing.lg,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.surface,
  },
  // Explicit lineHeight — proactive, same missing-lineHeight class already
  // found 4 times elsewhere in this screen (MatchesHeader's title,
  // PersonAvatar's initial, ReadyMatchCard's name, its scorePillText).
  plansEmptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: homeColors.textPrimary, marginTop: 4 },
  plansEmptySubtitle: {
    fontSize: 14,
    color: homeColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  plansEmptyAction: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  plansEmptyActionText: { fontSize: 14.5, fontWeight: '700', color: homeColors.accent },
});
