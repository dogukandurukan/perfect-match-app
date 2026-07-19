import { supabase } from '@/lib/supabaseClient';

export type IntroAnswers = {
  place?: string;
  slot1?: string;
  slot2?: string;
  slot3?: string;
  /** Legacy keys still shown if present in older rows */
  kafe?: string;
  gun?: string;
  saat?: string;
};

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

export function formatIntroLines(answers: IntroAnswers | null | undefined): string[] {
  if (!answers) return [];
  const lines: string[] = [];
  const place = answers.place ?? answers.kafe;
  if (place) lines.push(place);
  if (answers.slot1) lines.push(answers.slot1);
  if (answers.slot2) lines.push(answers.slot2);
  if (answers.slot3) lines.push(answers.slot3);
  if (!answers.slot1 && answers.gun) lines.push(answers.gun);
  if (!answers.slot2 && answers.saat) lines.push(answers.saat);
  return lines;
}

export type TrySendInviteResult = { allowed: boolean; error: string | null };

/** Rate-limit gate before writing an invite. */
export async function trySendInvite(
  userId: string,
  isPremium = false,
): Promise<TrySendInviteResult> {
  const { data, error } = await supabase.rpc('try_send_invite', {
    p_user: userId,
    p_is_premium: isPremium,
  });
  if (error) return { allowed: false, error: error.message };
  return { allowed: data === true, error: null };
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
};

export async function sendMatchInvite(params: SendInviteParams): Promise<SendInviteResult> {
  const limit = await trySendInvite(params.currentUserId, params.isPremium ?? false);
  if (!limit.allowed) {
    return {
      ok: false,
      matchId: null,
      chatOpened: false,
      error: limit.error ?? 'Invite limit reached. Try again later.',
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
      return { ok: false, matchId: null, chatOpened: false, error: upserted.error };
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
    };
  }

  const openNow = shouldOpenChatOnInvite(params.currentUserGender, params.otherUserGender);
  const isUserA = match.user_a_id === params.currentUserId;
  const isUserB = match.user_b_id === params.currentUserId;
  if (!isUserA && !isUserB) {
    return { ok: false, matchId, chatOpened: false, error: 'You are not part of this match' };
  }

  const patch: Record<string, unknown> = {
    invited_by: params.currentUserId,
    chat_opened: openNow,
    status: 'pending',
  };
  if (isUserA) patch.user_a_intro_answers = params.introAnswers;
  else patch.user_b_intro_answers = params.introAnswers;

  const meetingAt = parseMeetingAt(params.introAnswers);
  if (meetingAt) patch.meeting_at = meetingAt;

  const { error: updateError } = await supabase.from('matches').update(patch).eq('id', matchId);
  if (updateError) {
    return { ok: false, matchId, chatOpened: false, error: updateError.message };
  }

  return { ok: true, matchId, chatOpened: openNow, error: null };
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

  return { ok: true, chatOpened: openNow, error: null };
}

function parseMeetingAt(answers: IntroAnswers): string | null {
  // Best-effort: leave null unless we have an ISO-like slot later.
  void answers;
  return null;
}

/** Build up to 6 suggested time slots from availability days/hours. */
export function suggestTimeSlots(
  days: string[] | null | undefined,
  hours: string[] | null | undefined,
): string[] {
  const dayList = (days ?? []).filter(Boolean).slice(0, 4);
  const hourList = (hours ?? []).filter(Boolean).slice(0, 3);

  if (dayList.length === 0 && hourList.length === 0) {
    return [
      'Saturday morning',
      'Saturday afternoon',
      'Sunday morning',
      'Sunday afternoon',
      'Weekday evening',
      'This weekend',
    ];
  }

  const slots: string[] = [];
  if (dayList.length && hourList.length) {
    for (const day of dayList) {
      for (const hour of hourList) {
        slots.push(`${day} · ${hour}`);
        if (slots.length >= 6) return slots;
      }
    }
  } else if (dayList.length) {
    for (const day of dayList) {
      slots.push(day);
      if (slots.length >= 6) break;
    }
  } else {
    for (const hour of hourList) {
      slots.push(hour);
      if (slots.length >= 6) break;
    }
  }
  return slots;
}
