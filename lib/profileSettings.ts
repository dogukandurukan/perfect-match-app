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
  // Advanced filters (2026-09-10) — real, get_top_matches-backed toggles.
  discovery_verified_only: boolean;
  discovery_nonsmokers_only: boolean;
  // Height range — null = no filter. NOT scored, filter-only.
  discovery_height_min: number | null;
  discovery_height_max: number | null;
  // Multi-select — null/empty = no filter. NOT scored, filter-only.
  discovery_zodiac_signs: string[];
  discovery_pets: string[];
  discovery_education: string[];
  // "Recently Active" filter — deliberately NOT permissive on the
  // candidate's own null (never-tracked-active genuinely means inactive).
  discovery_active_today: boolean;
};

export const DISCOVERY_DISTANCE_OPTIONS: { value: DiscoveryDistance; label: string }[] = [
  { value: 'same_neighborhood', label: 'Same neighbourhood' },
  { value: 'same_district', label: 'Same district' },
  { value: 'whole_city', label: 'Whole city' },
];

export const MEETING_PREF_OPTIONS: MeetingPref[] = ['Women', 'Men', 'Non-binary', 'Everyone'];

export async function fetchProfileSettings(userId: string): Promise<ProfileSettingsRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'discovery_age_min, discovery_age_max, discovery_max_distance, meeting_preferences, notify_new_match, notify_messages, notify_meeting_invite, is_hidden, hide_location, discovery_verified_only, discovery_nonsmokers_only, discovery_height_min, discovery_height_max, discovery_zodiac_signs, discovery_pets, discovery_education, discovery_active_today',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    discovery_age_min: data.discovery_age_min ?? 18,
    discovery_age_max: data.discovery_age_max ?? 60,
    discovery_max_distance: (data.discovery_max_distance as DiscoveryDistance) ?? 'whole_city',
    discovery_verified_only: data.discovery_verified_only ?? false,
    discovery_nonsmokers_only: data.discovery_nonsmokers_only ?? false,
    discovery_height_min: data.discovery_height_min ?? null,
    discovery_height_max: data.discovery_height_max ?? null,
    discovery_zodiac_signs: data.discovery_zodiac_signs ?? [],
    discovery_pets: data.discovery_pets ?? [],
    discovery_education: data.discovery_education ?? [],
    discovery_active_today: data.discovery_active_today ?? false,
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

// Real deletion (2026-09-15) — was a soft-delete (deleted_at/is_hidden flags
// only, auth identity and data untouched) which doesn't satisfy Apple's
// "must actually delete, not just deactivate" requirement. Now calls the
// delete-account Edge Function (service-role — needed to remove the
// auth.users row and Storage objects, neither reachable from the client).
// The function identifies the caller from their own JWT; no id is passed.
export async function deleteAccountPermanently(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  // The account is already gone server-side; this just clears the local
  // session so the client doesn't hold a token for a deleted user.
  await supabase.auth.signOut();
  return { error: null };
}
