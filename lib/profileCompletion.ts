import { supabase } from '@/lib/supabaseClient';

export type ProfileSetupState = 'setup1' | 'setup2' | 'setup3' | 'setup4' | 'complete';

/**
 * Derives which profile-setup step the user should be on from `profiles.current_step`
 * and `profiles.setup_completed` (written by steps 1–4).
 */
export async function getProfileSetupState(userId: string): Promise<ProfileSetupState> {
  const { data, error } = await supabase
    .from('profiles')
    .select('current_step, setup_completed, first_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return 'setup1';
  }

  if (data.setup_completed) {
    return 'complete';
  }

  if (!data.first_name) {
    return 'setup1';
  }

  const step = typeof data.current_step === 'number' ? data.current_step : 1;

  if (step <= 1) return 'setup1';
  if (step === 2) return 'setup2';
  if (step === 3) return 'setup3';
  return 'setup4';
}
