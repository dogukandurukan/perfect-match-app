// Server calls for the "What you're looking for" section (D104b).
import { supabase } from '@/lib/supabaseClient';

import { INTERESTS } from './yourWorld';
import { cleanConnectionAnswers, CONNECTION_VERSION, type ConnectionAnswers } from './connection';

const INTEREST_KEYS = INTERESTS.map((i) => i.key);

export type ConnectionLoad =
  | { kind: 'ok'; answers: ConnectionAnswers; canEdit: boolean }
  | { kind: 'unsupported' } // server without the version-3 package: the section is not shown
  | { kind: 'error' };

/** The answers to THIS version only; older versions stay on the server, unread. */
export async function loadConnectionAnswers(): Promise<ConnectionLoad> {
  const { data, error } = await supabase.rpc('get_my_connection_answers_v2', { p_version: CONNECTION_VERSION });
  if (error) return (error as { code?: string }).code === 'PGRST202' ? { kind: 'unsupported' } : { kind: 'error' };
  const d = (data ?? {}) as { version?: number | null; answers?: unknown; can_edit?: boolean; supports?: number[] };
  // A server that doesn't know version 3 must not get the section.
  if (!Array.isArray(d.supports) || !d.supports.includes(CONNECTION_VERSION)) return { kind: 'unsupported' };
  const answers = d.version === CONNECTION_VERSION ? cleanConnectionAnswers(d.answers, INTEREST_KEYS) : {};
  return { kind: 'ok', answers, canEdit: d.can_edit === true };
}

export async function saveConnectionAnswers(answers: ConnectionAnswers): Promise<boolean> {
  const { error } = await supabase.rpc('save_connection_answers_v2', {
    p_version: CONNECTION_VERSION,
    p_answers: cleanConnectionAnswers(answers, INTEREST_KEYS),
  });
  if (error && __DEV__) console.warn('[Connection] save failed', error.message);
  return !error;
}
