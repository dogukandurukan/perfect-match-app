import { supabase } from '@/lib/supabaseClient';

export type DiscoveryDistance = 'same_neighborhood' | 'same_district' | 'whole_city';

export type MeetingPref = 'Men' | 'Women' | 'Non-binary' | 'Everyone';

export type ProfileSettingsRow = {
  discovery_age_min: number;
  discovery_age_max: number;
  discovery_max_distance: DiscoveryDistance;
  meeting_preferences: string[] | null;
  notify_new_match: boolean;
  notify_messages: boolean;
  notify_meeting_invite: boolean;
  is_hidden: boolean;
  hide_location: boolean;
};

export const DISCOVERY_DISTANCE_OPTIONS: { value: DiscoveryDistance; label: string }[] = [
  { value: 'same_neighborhood', label: 'Aynı semt' },
  { value: 'same_district', label: 'Aynı ilçe' },
  { value: 'whole_city', label: 'Tüm şehir' },
];

export const MEETING_PREF_OPTIONS: MeetingPref[] = ['Women', 'Men', 'Non-binary', 'Everyone'];

export async function fetchProfileSettings(userId: string): Promise<ProfileSettingsRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'discovery_age_min, discovery_age_max, discovery_max_distance, meeting_preferences, notify_new_match, notify_messages, notify_meeting_invite, is_hidden, hide_location',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    discovery_age_min: data.discovery_age_min ?? 18,
    discovery_age_max: data.discovery_age_max ?? 60,
    discovery_max_distance: (data.discovery_max_distance as DiscoveryDistance) ?? 'whole_city',
    meeting_preferences: data.meeting_preferences ?? [],
    notify_new_match: data.notify_new_match ?? true,
    notify_messages: data.notify_messages ?? true,
    notify_meeting_invite: data.notify_meeting_invite ?? true,
    is_hidden: data.is_hidden ?? false,
    hide_location: data.hide_location ?? false,
  };
}

export async function updateProfileSettings(
  userId: string,
  patch: Partial<ProfileSettingsRow>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function softDeleteAccount(userId: string): Promise<{ error: string | null }> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString(), is_hidden: true })
    .eq('id', userId);

  if (profileError) return { error: profileError.message };

  const { error: signOutError } = await supabase.auth.signOut();
  return { error: signOutError?.message ?? null };
}
