// Screen: Profil foto storage yardımcıları | Status: stable | Last updated: Temmuz 2026
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';

/** Bucket for profile photos; paths stored in DB are relative to this bucket. */
export const USER_PHOTOS_BUCKET = 'user-photos' as const;

/** `{user_id}/photo_{n}.jpg` — required for Storage RLS (first segment must equal auth.uid()). */
export function profilePhotoObjectPath(userId: string, slotIndex: number) {
  return `${userId}/photo_${slotIndex}.jpg`;
}

/** Public URL for bucket objects (or pass-through for https seed URLs). */
export async function resolveProfilePhotoUrl(
  ref: string,
  _expiresInSec = 3600,
): Promise<string | null> {
  void _expiresInSec;
  if (!ref.trim()) return null;
  return getProfilePhotoPublicUrl(ref);
}
