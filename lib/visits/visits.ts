// Profile visits — server calls (record_profile_visit_v2,
// ack_profile_visits_notice_v2, get_my_profile_visits_v2).
import { supabase } from '@/lib/supabaseClient';

import { parseVisits, type RecordResult, type VisitsData } from './visitsCore';

export * from './visitsCore';

export async function recordProfileVisit(userId: string): Promise<RecordResult> {
  try {
    const { data, error } = await supabase.rpc('record_profile_visit_v2', { p_user: userId });
    if (error) {
      if (__DEV__) console.warn('[Visits] record failed', error.message);
      return 'error';
    }
    if (data?.recorded === true) return 'recorded';
    return data?.reason === 'notice_required' ? 'notice' : 'skipped';
  } catch (e) {
    if (__DEV__) console.warn('[Visits] record threw', e);
    return 'error';
  }
}

export async function ackVisitsNotice(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('ack_profile_visits_notice_v2');
    return !error && data?.ok === true;
  } catch {
    return false;
  }
}

export async function loadMyVisits(): Promise<{ ok: true; value: VisitsData } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('get_my_profile_visits_v2');
  if (error) return { ok: false, message: 'Couldn’t load your profile visits. Check your connection and try again.' };
  return { ok: true, value: parseVisits(data) };
}
