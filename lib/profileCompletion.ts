import { supabase } from '@/lib/supabaseClient';

export type ProfileSetupState = 'setup1' | 'setup2' | 'setup3' | 'setup4' | 'complete';

function hasValue(v: unknown) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

export async function getProfileSetupState(userId: string): Promise<ProfileSetupState> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, city, gender, date_of_birth, meeting_preferences')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) return 'setup1';
    const meetingOk = Array.isArray(profile.meeting_preferences)
      ? profile.meeting_preferences.length > 0
      : false;
    if (
      !hasValue(profile.first_name) ||
      !hasValue(profile.last_name) ||
      !hasValue(profile.city) ||
      !hasValue(profile.gender) ||
      !hasValue(profile.date_of_birth) ||
      !meetingOk
    ) {
      return 'setup1';
    }
  } catch {
    return 'setup1';
  }

  try {
    const { data: pref, error: prefError } = await supabase
      .from('preferences')
      .select('setup2_completed, setup3_completed, setup4_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefError || !pref) return 'setup2';
    if (!pref.setup2_completed) return 'setup2';
    if (!pref.setup3_completed) return 'setup3';
    if (!pref.setup4_completed) return 'setup4';
    return 'complete';
  } catch {
    return 'setup2';
  }
}
