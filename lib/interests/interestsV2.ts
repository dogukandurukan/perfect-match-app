// "Interests & conversation starter": thin client over the narrow server
// operations of supabase/proposed/20261014090000_v2_interests_takes.sql.
// Only accepted, active members can change anything, only their own
// selections / take, and only these fields — enforced on the server.
import { SERVER_ERROR_TEXT, type Selections, type Take } from '@/lib/interests/takes';
import { supabase } from '@/lib/supabaseClient';

export type MyInterests = Selections & { editable: boolean; take: Take | null };

export type Loaded =
  | { kind: 'ok'; value: MyInterests }
  /** The server doesn't have the package (e.g. the shared DEV/live project). */
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

const NETWORK = 'Couldn’t save. Check your connection and try again. Nothing was changed.';
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? ''));

export function parseMyInterests(raw: unknown): MyInterests {
  const d = (raw ?? {}) as Record<string, unknown>;
  const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return {
    editable: d.editable === true,
    interests: arr<string>(d.interests),
    activities: arr<string>(d.activities),
    artists: arr(d.artists),
    books: arr(d.books),
    screen: arr(d.screen),
    take: (d.take as Take | null) ?? null,
  };
}

export async function loadMyInterests(): Promise<Loaded> {
  try {
    const { data, error } = await supabase.rpc('get_my_interests_v2');
    if (error) {
      if (missing(error)) return { kind: 'unsupported' };
      console.warn('[Interests] get_my_interests_v2 failed', error.message);
      return { kind: 'error', message: 'Couldn’t load your interests. Check your connection and try again.' };
    }
    return { kind: 'ok', value: parseMyInterests(data) };
  } catch (e) {
    console.warn('[Interests] get_my_interests_v2 threw', e);
    return { kind: 'error', message: 'Couldn’t load your interests. Check your connection and try again.' };
  }
}

export type SaveSelectionsResult =
  | { kind: 'ok'; value: MyInterests; takeRemoved: boolean }
  /** The take's subject would be removed — nothing was written; ask first. */
  | { kind: 'confirm'; take: Take }
  | { kind: 'error'; message: string };

export async function saveSelections(s: Selections, removeTake: boolean): Promise<SaveSelectionsResult> {
  try {
    const { data, error } = await supabase.rpc('save_interests_v2', {
      p_interests: s.interests,
      p_activities: s.activities,
      p_artists: s.artists,
      p_books: s.books,
      p_screen: s.screen,
      p_remove_take: removeTake,
    });
    if (error || !data) {
      if (error) console.warn('[Interests] save_interests_v2 failed', error.message);
      return { kind: 'error', message: /not_member/.test(error?.message ?? '') ? SERVER_ERROR_TEXT.not_member : NETWORK };
    }
    if (data.ok === true) return { kind: 'ok', value: parseMyInterests(data), takeRemoved: data.take_removed === true };
    if (data.error === 'take_subject_removed' && data.take) return { kind: 'confirm', take: data.take as Take };
    return { kind: 'error', message: SERVER_ERROR_TEXT[String(data.error)] ?? NETWORK };
  } catch (e) {
    console.warn('[Interests] save_interests_v2 threw', e);
    return { kind: 'error', message: NETWORK };
  }
}

export type TakeResult = { kind: 'ok'; take: Take | null } | { kind: 'error'; message: string };

export async function saveTake(kind: string, subjectId: string, questionId: string, answer: string): Promise<TakeResult> {
  try {
    const { data, error } = await supabase.rpc('save_take_v2', {
      p_subject_kind: kind,
      p_subject_id: subjectId,
      p_question_id: questionId,
      p_answer: answer.trim(),
    });
    if (error || !data) {
      if (error) console.warn('[Interests] save_take_v2 failed', error.message);
      return { kind: 'error', message: /not_member/.test(error?.message ?? '') ? SERVER_ERROR_TEXT.not_member : NETWORK };
    }
    if (data.ok === true) return { kind: 'ok', take: data.take as Take };
    return { kind: 'error', message: SERVER_ERROR_TEXT[String(data.error)] ?? NETWORK };
  } catch (e) {
    console.warn('[Interests] save_take_v2 threw', e);
    return { kind: 'error', message: NETWORK };
  }
}

export async function deleteTake(): Promise<TakeResult> {
  try {
    const { data, error } = await supabase.rpc('delete_take_v2');
    if (error || !data || data.ok !== true) {
      if (error) console.warn('[Interests] delete_take_v2 failed', error.message);
      return { kind: 'error', message: 'Couldn’t remove it. Check your connection and try again.' };
    }
    return { kind: 'ok', take: null };
  } catch (e) {
    console.warn('[Interests] delete_take_v2 threw', e);
    return { kind: 'error', message: 'Couldn’t remove it. Check your connection and try again.' };
  }
}
