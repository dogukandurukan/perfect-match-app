// Screen: Profil foto storage yardımcıları | Status: stable | Last updated: Mayıs 2026
import { supabase } from '@/lib/supabaseClient';

/** Private bucket; RLS allows authenticated read. Paths stored in DB are relative to this bucket. */
export const USER_PHOTOS_BUCKET = 'user-photos' as const;

/** `{user_id}/photo_{n}.jpg` — required for Storage RLS (first segment must equal auth.uid()). */
export function profilePhotoObjectPath(userId: string, slotIndex: number) {
  return `${userId}/photo_${slotIndex}.jpg`;
}

/** Signed URL for private bucket objects (e.g. match UI). External https URLs pass through. */
export async function resolveProfilePhotoUrl(
  ref: string,
  expiresInSec = 3600,
): Promise<string | null> {
  if (ref.startsWith('https://') || ref.startsWith('http://')) {
    return ref;
  }
  const { data, error } = await supabase.storage
    .from(USER_PHOTOS_BUCKET)
    .createSignedUrl(ref, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
