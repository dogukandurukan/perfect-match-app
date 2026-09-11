import { logEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabaseClient';

export type IntroAnswers = {
  place?: string;
  /** ISO datetime strings (2026-08-21+) — see suggestMeetingTimes/formatMeetingTime.
   * Older rows may hold free-text labels like "Saturday afternoon" instead;
   * formatIntroLines() detects and falls back for those. */
  slot1?: string;
  slot2?: string;
  slot3?: string;
  /** Legacy keys still shown if present in older rows */
  kafe?: string;
  gun?: string;
  saat?: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0, pazar: 0, paz: 0,
  mon: 1, monday: 1, pazartesi: 1, pzt: 1,
  tue: 2, tuesday: 2, salı: 2, sal: 2,
  wed: 3, wednesday: 3, çarşamba: 3, çar: 3,
  thu: 4, thursday: 4, perşembe: 4, per: 4,
  fri: 5, friday: 5, cuma: 5, cum: 5,
  sat: 6, saturday: 6, cumartesi: 6, cmt: 6,
};

const WEEKDAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAME = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Next real calendar date (>= today) matching a weekday name/abbreviation. */
function nextDateForWeekday(dayToken: string, from: Date): Date | null {
  const idx = WEEKDAY_INDEX[dayToken.trim().toLowerCase()];
  if (idx === undefined) return null;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (idx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Representative start hour for an availability_hours bucket label. */
function hourForBucket(bucket: string): number {
  // Midpoint of the range, not the start — "Afternoon (12-18)" should land
  // around 3pm, not exactly noon (2026-08-24: start-of-range made every
  // suggested slot in the same bucket show up as the same clock-adjacent
  // time, e.g. every "Afternoon" pick read as "12 PM").
  const match = bucket.match(/\((\d{1,2})-(\d{1,2})\)/);
  if (match) return Math.round((Number(match[1]) + Number(match[2])) / 2);
  const lower = bucket.toLowerCase();
  if (lower.includes('morning')) return 10;
  if (lower.includes('afternoon')) return 15;
  if (lower.includes('evening')) return 19;
  return 12; // "Always" / unrecognized — a neutral midday default
}

/** "2026-08-30T13:00:00.000Z" → "Sat, Aug 30 · 1:00 PM" (local time). */
/** "2026-08-30T17:00:00.000Z" → "Sun, Aug 30 · 17:00" (local time, 24h). */
export function formatMeetingTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // not really an ISO date — show as-is
  const weekday = WEEKDAY_NAME[d.getDay()];
  const month = MONTH_NAME[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${weekday}, ${month} ${d.getDate()} · ${hh}:${mm}`;
}

function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export type GenderValue = string | null | undefined;

/** Stable pair order matching DB LEAST/GREATEST normalization. */
export function orderedPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

export function isHeteroCouple(genderA: GenderValue, genderB: GenderValue): boolean {
  const a = genderA ?? '';
  const b = genderB ?? '';
  return (a === 'Man' && b === 'Woman') || (a === 'Woman' && b === 'Man');
}

/** On invite: hetero + woman inviting → open immediately; otherwise stay closed. */
export function shouldOpenChatOnInvite(
  inviterGender: GenderValue,
  inviteeGender: GenderValue,
): boolean {
  if (!isHeteroCouple(inviterGender, inviteeGender)) return false;
  return inviterGender === 'Woman';
}

/**
 * On accept by invitee: hetero → only woman opens; all other pairs → open.
 * Unexpected genders fall through to the "other" rule (open on accept).
 */
export function shouldOpenChatOnAccept(
  accepterGender: GenderValue,
  otherGender: GenderValue,
): boolean {
  if (isHeteroCouple(accepterGender, otherGender)) {
    return accepterGender === 'Woman';
  }
  return true;
}

export function introAnswersForUser(
  match: {
    user_a_id: string;
    user_b_id: string;
    user_a_intro_answers?: IntroAnswers | null;
    user_b_intro_answers?: IntroAnswers | null;
  },
  userId: string,
): IntroAnswers | null {
  if (match.user_a_id === userId) return match.user_a_intro_answers ?? null;
  if (match.user_b_id === userId) return match.user_b_intro_answers ?? null;
  return null;
}

function formatSlot(raw: string): string {
  return looksLikeIsoDate(raw) ? formatMeetingTime(raw) : raw;
}

export function formatIntroLines(answers: IntroAnswers | null | undefined): string[] {
  if (!answers) return [];
  const lines: string[] = [];
  const place = answers.place ?? answers.kafe;
  if (place) lines.push(place);
  if (answers.slot1) lines.push(formatSlot(answers.slot1));
  if (answers.slot2) lines.push(formatSlot(answers.slot2));
  if (answers.slot3) lines.push(formatSlot(answers.slot3));
  if (!answers.slot1 && answers.gun) lines.push(answers.gun);
  if (!answers.slot2 && answers.saat) lines.push(answers.saat);
  return lines;
}

export type TrySendInviteResult = {
  allowed: boolean;
  limitReached: boolean;
  error: string | null;
};

/** Rate-limit gate before writing an invite. Fail-open if RPC is missing/errors. */
export async function trySendInvite(
  userId: string,
  isPremium = false,
): Promise<TrySendInviteResult> {
  const { data, error } = await supabase.rpc('try_send_invite', {
    p_user: userId,
    p_is_premium: isPremium,
  });
  // Defensive: don't lock the invite flow if the RPC is unavailable.
  if (error) return { allowed: true, limitReached: false, error: null };
  if (data === true) return { allowed: true, limitReached: false, error: null };
  return { allowed: false, limitReached: true, error: null };
}

export type UpsertMatchResult = { matchId: string | null; error: string | null };

export async function upsertMatchPair(
  userA: string,
  userB: string,
  matchScore: number,
): Promise<UpsertMatchResult> {
  const [a, b] = orderedPair(userA, userB);
  const { data, error } = await supabase.rpc('upsert_match', {
    p_user_a: a,
    p_user_b: b,
    p_match_score: matchScore,
  });
  if (error) return { matchId: null, error: error.message };

  if (typeof data === 'string') return { matchId: data, error: null };
  if (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string') {
    return { matchId: (data as { id: string }).id, error: null };
  }

  // Fallback: read the normalized row
  const { data: row, error: selectError } = await supabase
    .from('matches')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();

  if (selectError) return { matchId: null, error: selectError.message };
  return { matchId: row?.id ?? null, error: row?.id ? null : 'Match row not found after upsert' };
}

export type SendInviteParams = {
  currentUserId: string;
  otherUserId: string;
  matchScore: number;
  introAnswers: IntroAnswers;
  currentUserGender: GenderValue;
  otherUserGender: GenderValue;
  matchId?: string | null;
  isPremium?: boolean;
};

export type SendInviteResult = {
  ok: boolean;
  matchId: string | null;
  chatOpened: boolean;
  error: string | null;
  limitReached: boolean;
};

export async function sendMatchInvite(params: SendInviteParams): Promise<SendInviteResult> {
  const limit = await trySendInvite(params.currentUserId, params.isPremium ?? false);
  if (!limit.allowed) {
    return {
      ok: false,
      matchId: null,
      chatOpened: false,
      error: null,
      limitReached: true,
    };
  }

  let matchId = params.matchId ?? null;
  if (!matchId) {
    const upserted = await upsertMatchPair(
      params.currentUserId,
      params.otherUserId,
      params.matchScore,
    );
    if (!upserted.matchId) {
      return {
        ok: false,
        matchId: null,
        chatOpened: false,
        error: upserted.error,
        limitReached: false,
      };
    }
    matchId = upserted.matchId;
  }

  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('id, user_a_id, user_b_id, invited_by, chat_opened')
    .eq('id', matchId)
    .maybeSingle();

  if (fetchError || !match) {
    return {
      ok: false,
      matchId,
      chatOpened: false,
      error: fetchError?.message ?? 'Match not found',
      limitReached: false,
    };
  }

  const openNow = shouldOpenChatOnInvite(params.currentUserGender, params.otherUserGender);
  const isUserA = match.user_a_id === params.currentUserId;
  const isUserB = match.user_b_id === params.currentUserId;
  if (!isUserA && !isUserB) {
    return {
      ok: false,
      matchId,
      chatOpened: false,
      error: 'You are not part of this match',
      limitReached: false,
    };
  }

  const patch: Record<string, unknown> = {
    invited_by: params.currentUserId,
    chat_opened: openNow,
    status: 'pending',
  };
  if (isUserA) patch.user_a_intro_answers = params.introAnswers;
  else patch.user_b_intro_answers = params.introAnswers;
  // `meeting_at` stays null here — these are 3 proposed times, not a
  // confirmed one yet. Set once the invitee actually picks one (accept flow).

  const { error: updateError } = await supabase.from('matches').update(patch).eq('id', matchId);
  if (updateError) {
    return {
      ok: false,
      matchId,
      chatOpened: false,
      error: updateError.message,
      limitReached: false,
    };
  }

  logEvent('invite_sent', { match_id: matchId, chat_opened: openNow });
  return { ok: true, matchId, chatOpened: openNow, error: null, limitReached: false };
}

export type AcceptInviteResult = {
  ok: boolean;
  chatOpened: boolean;
  error: string | null;
};

export async function acceptMatchInvite(params: {
  matchId: string;
  currentUserId: string;
  currentUserGender: GenderValue;
  otherUserGender: GenderValue;
}): Promise<AcceptInviteResult> {
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('id, invited_by, chat_opened, user_a_id, user_b_id')
    .eq('id', params.matchId)
    .maybeSingle();

  if (fetchError || !match) {
    return { ok: false, chatOpened: false, error: fetchError?.message ?? 'Match not found' };
  }

  if (match.invited_by === params.currentUserId) {
    return { ok: false, chatOpened: !!match.chat_opened, error: 'You sent this invite' };
  }

  if (match.chat_opened) {
    return { ok: true, chatOpened: true, error: null };
  }

  const openNow = shouldOpenChatOnAccept(params.currentUserGender, params.otherUserGender);
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      chat_opened: openNow,
      status: openNow ? 'accepted' : 'pending',
    })
    .eq('id', params.matchId);

  if (updateError) {
    return { ok: false, chatOpened: false, error: updateError.message };
  }

  logEvent('invite_accepted', { match_id: params.matchId, chat_opened: openNow });
  return { ok: true, chatOpened: openNow, error: null };
}

/**
 * Build up to 6 suggested meeting times as real ISO datetimes — the next
 * calendar occurrence of each availability day, at a representative hour
 * from each availability_hours bucket. Falls back to the next two weekends
 * (no availability set) instead of vague day-of-week-only labels, so every
 * suggestion is always a real, pickable date (2026-08-21 — CLAUDE.md §4).
 */
export function suggestMeetingTimes(
  days: string[] | null | undefined,
  hours: string[] | null | undefined,
): string[] {
  const now = new Date();
  const dayList = (days ?? []).filter(Boolean).slice(0, 4);
  const hourList = (hours ?? []).filter(Boolean).slice(0, 3);

  const atHour = (date: Date, hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    // If that time already passed today, push to the same time next week.
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d.toISOString();
  };

  if (dayList.length === 0 && hourList.length === 0) {
    const nextSat = nextDateForWeekday('sat', now)!;
    const nextSun = nextDateForWeekday('sun', now)!;
    return [atHour(nextSat, 10), atHour(nextSat, 15), atHour(nextSun, 10)];
  }

  const effectiveDays = dayList.length > 0 ? dayList : ['sat', 'sun'];
  const effectiveHours = hourList.length > 0 ? hourList : ['Morning (9-12)', 'Afternoon (12-18)'];

  const slots: string[] = [];
  for (const day of effectiveDays) {
    const date = nextDateForWeekday(day, now);
    if (!date) continue;
    for (const hour of effectiveHours) {
      slots.push(atHour(date, hourForBucket(hour)));
      if (slots.length >= 6) return slots;
    }
  }
  return slots;
}
