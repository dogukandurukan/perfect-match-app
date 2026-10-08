// V2 match → chat → date suggestion: thin client over the server RPCs of
// supabase/proposed/20261001120000_v2_match_chat_date.sql. Every rule
// (participants only, active chat only, one pending suggestion, no accepting
// your own, idempotent retries, block / unmatch) is enforced on the server;
// this file only calls it and turns errors into short messages.
import { supabase } from '@/lib/supabaseClient';

export type MyMatch = {
  match_id: string;
  other_id: string;
  first_name: string | null;
  photo_path: string | null;
  matched_at: string;
  last_message: string | null;
  last_message_at: string | null;
  last_from_me: boolean | null;
  unread: number;
  /** The other account is suspended: history readable, no new messages
   * (servers without the 2026-10-09 package don't send it → false). */
  unavailable?: boolean;
};

export type DatePlan = {
  proposal_id: string;
  match_id: string;
  other_id: string;
  first_name: string | null;
  photo_path: string | null;
  place: string | null;
  meeting_at: string;
  status: 'pending' | 'accepted';
  mine: boolean;
  created_at: string;
};

export type Proposal = {
  id: string;
  match_id: string;
  mine: boolean;
  place: string | null;
  meeting_at: string;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled';
  reply_to: string | null;
  responded_at: string | null;
  created_at: string;
};

/** A like between the two, shown as chat context (never a message). */
export type LikeContext = {
  from_me: boolean;
  target_type: 'photo' | 'prompt' | 'profile';
  note: string | null;
  created_at: string;
  photo_path: string | null;
  prompt_id: string | null;
  answer: string | null;
};

export type ChatState = {
  match_id: string;
  active: boolean;
  /** 'unavailable' = the other account is suspended (read-only history).
   * Older servers only send `active`. */
  state?: 'active' | 'ended' | 'unavailable';
  proposals: Proposal[];
  likes?: LikeContext[];
};

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

function friendly(e: { message?: string } | null | undefined, fallback: string): string {
  const m = e?.message ?? '';
  if (/Network request failed|fetch failed|timeout/i.test(m)) return 'No connection. Check your internet and try again.';
  if (m.includes('chat_not_active')) return 'This conversation is no longer active.';
  if (m.includes('proposal_pending')) return 'Your suggestion is still waiting for a reply.';
  if (m.includes('reply_to_pending')) return 'Reply to their suggestion first.';
  if (m.includes('proposal_not_pending')) return 'This suggestion was already answered.';
  if (m.includes('invalid_time')) return 'Pick a time in the future.';
  return fallback;
}

export async function loadMyMatches(): Promise<Result<MyMatch[]>> {
  const { data, error } = await supabase.rpc('get_my_matches_v2');
  if (error) return { ok: false, message: friendly(error, 'Could not load your matches. Try again.') };
  return { ok: true, value: (data ?? []) as MyMatch[] };
}

export async function loadDatePlans(): Promise<Result<DatePlan[]>> {
  const { data, error } = await supabase.rpc('get_my_date_plans_v2');
  if (error) return { ok: false, message: friendly(error, 'Could not load your plans. Try again.') };
  return { ok: true, value: (data ?? []) as DatePlan[] };
}

/** null value = not your chat. */
export async function loadChatState(matchId: string): Promise<Result<ChatState | null>> {
  const { data, error } = await supabase.rpc('get_chat_v2', { p_match: matchId });
  if (error) return { ok: false, message: friendly(error, 'Could not load this chat. Try again.') };
  return { ok: true, value: (data as ChatState | null) ?? null };
}

export async function proposeDate(matchId: string, meetingAt: string, place: string | null, requestId: string): Promise<Result<Proposal>> {
  const { data, error } = await supabase.rpc('propose_date_v2', {
    p_match: matchId,
    p_meeting_at: meetingAt,
    p_place: place,
    p_request_id: requestId,
  });
  if (error) return { ok: false, message: friendly(error, 'Could not send your suggestion. Try again.') };
  return { ok: true, value: data as Proposal };
}

export async function respondDate(
  proposalId: string,
  action: 'accept' | 'decline' | 'counter',
  counter?: { meetingAt: string; place: string | null; requestId: string },
): Promise<Result<Proposal>> {
  const { data, error } = await supabase.rpc('respond_date_v2', {
    p_proposal: proposalId,
    p_action: action,
    p_meeting_at: counter?.meetingAt ?? null,
    p_place: counter?.place ?? null,
    p_request_id: counter?.requestId ?? null,
  });
  if (error) return { ok: false, message: friendly(error, 'Could not send your answer. Try again.') };
  return { ok: true, value: data as Proposal };
}

export async function unmatch(matchId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('unmatch_v2', { p_match: matchId });
  if (error) return { ok: false, message: friendly(error, 'Could not unmatch. Try again.') };
  return { ok: true, value: undefined };
}

export function newRequestId(): string {
  // RFC 4122 v4 from Math.random — only an idempotency key, not a secret.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
