import { supabase } from '@/lib/supabaseClient';

export type ProfileSetupState = 'setup1' | 'setup2' | 'setup3' | 'setup4' | 'complete';

export async function getProfileSetupState(userId: string): Promise<ProfileSetupState> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('setup_completed, current_step')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) return 'setup1';

    if (profile.setup_completed === true) return 'complete';

    const step = typeof profile.current_step === 'number' ? profile.current_step : 1;
    if (step <= 1) return 'setup1';
    if (step === 2) return 'setup2';
    if (step === 3) return 'setup3';
    return 'setup4';
  } catch {
    return 'setup1';
  }
}
