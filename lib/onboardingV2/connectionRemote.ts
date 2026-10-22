// Server calls for the optional connection questions (D104).
import { supabase } from '@/lib/supabaseClient';

import { cleanConnectionAnswers, CONNECTION_VERSION, type ConnectionAnswers } from './connection';

export type ConnectionLoad =
  | { kind: 'ok'; answers: ConnectionAnswers; canEdit: boolean }
  | { kind: 'unsupported' } // server without the package: the invite is not shown
  | { kind: 'error' };

export async function loadConnectionAnswers(): Promise<ConnectionLoad> {
  const { data, error } = await supabase.rpc('get_my_connection_answers_v2');
  if (error) return (error as { code?: string }).code === 'PGRST202' ? { kind: 'unsupported' } : { kind: 'error' };
  const d = (data ?? {}) as { version?: number | null; answers?: unknown; can_edit?: boolean };
  // Answers to another question version are not carried into this one.
  const answers = d.version == null || d.version === CONNECTION_VERSION ? cleanConnectionAnswers(d.answers) : {};
  return { kind: 'ok', answers, canEdit: d.can_edit === true };
}

export async function saveConnectionAnswers(answers: ConnectionAnswers): Promise<boolean> {
  const { error } = await supabase.rpc('save_connection_answers_v2', {
    p_version: CONNECTION_VERSION,
    p_answers: cleanConnectionAnswers(answers),
  });
  if (error && __DEV__) console.warn('[Connection] save failed', error.message);
  return !error;
}
