// Server calls for Profile → Edit profile (Package 1). Loads the member's
// own draft (get_my_onboarding_v2) and saves through the narrow
// update_member_profile_v2 — nothing is shown as saved until the server said so.
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import type { ServerBundle } from '@/lib/onboardingV2/serverMapping';
import { supabase } from '@/lib/supabaseClient';

import { fieldsFromServer, saveError, type MemberFields, type SaveFailure } from './memberProfileCore';

export type MemberProfileLoad =
  | { ok: true; fields: MemberFields; jobTitle: string; bundle: ServerBundle }
  | { ok: false; text: string };

export async function loadMemberProfile(): Promise<MemberProfileLoad> {
  const r = await loadMyOnboarding();
  if (!r.ok) return { ok: false, text: r.message };
  const draft = (r.value.draft ?? {}) as Record<string, unknown>;
  return { ok: true, fields: fieldsFromServer(draft), jobTitle: typeof draft.job_title === 'string' ? draft.job_title.trim() : '', bundle: r.value };
}

export async function saveMemberProfile(
  changes: Record<string, unknown>,
  expected: Record<string, unknown>,
): Promise<{ ok: true; fields: MemberFields } | ({ ok: false } & SaveFailure)> {
  try {
    const { data, error } = await supabase.rpc('update_member_profile_v2', { p_changes: changes, p_expected: expected });
    if (error) {
      if (__DEV__) console.warn('[EditProfile] save failed', error.message);
      return { ok: false, ...saveError(/not_member/.test(error.message ?? '') ? 'not_member' : null) };
    }
    if (!data?.ok) return { ok: false, ...saveError(data?.error) };
    return { ok: true, fields: fieldsFromServer(data.profile) };
  } catch (e) {
    if (__DEV__) console.warn('[EditProfile] save threw', e);
    return { ok: false, ...saveError(null) };
  }
}
