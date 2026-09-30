// Profile photos live in the PRIVATE `profile-photos-private` bucket
// (P0 photos). Clients only ever get 15-minute signed URLs; the storage
// SELECT policy signs a photo only if you may see its owner
// (can_view_profile_as_me), so hidden / blocked / deleted users' photos can
// no longer be signed. Already-issued URLs and images already on the device
// cannot be revoked instantly — they end when the URL expires / the cache
// evicts them.
import { createPhotoUrlCache } from './photoUrlCache';
import { supabase } from './supabaseClient';

export const PROFILE_PHOTOS_BUCKET = 'profile-photos-private' as const;
export const SIGNED_URL_TTL_SEC = 15 * 60;
const REFRESH_MARGIN_SEC = 60;

const cache = createPhotoUrlCache({
  ttlSec: SIGNED_URL_TTL_SEC,
  refreshMarginSec: REFRESH_MARGIN_SEC,
  sign: async (paths, ttlSec) => {
    const { data, error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).createSignedUrls(paths, ttlSec);
    if (error || !data) return paths.map((path) => ({ path, signedUrl: null }));
    return data.map((row) => ({ path: row.path ?? '', signedUrl: row.error ? null : row.signedUrl }));
  },
});

/** Storage path (or seed https URL) → short-lived signed URL, or null if not visible to you. */
export async function resolveProfilePhotoUrl(path: string | null | undefined): Promise<string | null> {
  return cache.resolve(path);
}

/** Batch-sign before building UI rows; then read with `cachedProfilePhotoUrl`. */
export async function preloadProfilePhotoUrls(paths: (string | null | undefined)[]): Promise<void> {
  await cache.resolveMany(paths);
}

/** Render-time read of an already-preloaded URL (null if not signed / expired). */
export function cachedProfilePhotoUrl(path: string | null | undefined): string | null {
  return cache.peek(path);
}

/** Forget signed URLs for one person (call after blocking them). */
export function forgetProfilePhotoUrls(ownerId: string) {
  cache.invalidateOwner(ownerId);
}
