// Screen: Profil foto storage yardımcıları | Status: stable | Last updated: Temmuz 2026
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';

/** Bucket for profile photos; paths stored in DB are relative to this bucket. */
export const USER_PHOTOS_BUCKET = 'user-photos' as const;

/** `{user_id}/photo_{n}.jpg` — required for Storage RLS (first segment must equal auth.uid()). */
export function profilePhotoObjectPath(userId: string, slotIndex: number) {
  return `${userId}/photo_${slotIndex}.jpg`;
}

/**
 * Private bucket for verification selfies — separate from `USER_PHOTOS_BUCKET`
 * on purpose (2026-09-20, Phase 0 security fix, see
 * docs/phase-0-security-report.md). The old shared-bucket setup put a
 * verification selfie at a predictable path inside a PUBLIC bucket, meaning
 * anyone who knew a user's uuid could download it with no authentication.
 * This bucket has `public=false` and no SELECT policy at all for anon/
 * authenticated — only a service-role Edge Function can ever read from it
 * (not built yet; MVP review is manual via Dashboard, per CLAUDE.md).
 */
export const VERIFICATION_SELFIE_BUCKET = 'verification-selfies' as const;

/**
 * Cryptographically-random hex token when the runtime actually provides
 * one, falling back to the project's existing non-crypto technique
 * (`micro-intro.tsx`'s `sessionTokenRef` uses the same
 * `Date.now()+Math.random()` shape) only if it doesn't (2026-09-21, Phase
 * 0.1). This project has no `expo-crypto`/`react-native-get-random-values`
 * dependency and adding one is a native module — it would need a dev-client
 * rebuild before it could ever run (CLAUDE.md §2), which is out of scope
 * for a security-only phase. Feature-detecting `globalThis.crypto` avoids
 * both a hard runtime crash if it's absent AND a false assumption that it
 * exists — Hermes/RN's WebCrypto support has changed across versions and
 * isn't something to guess at without a device test.
 */
function secureRandomToken(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID().replace(/-/g, '');
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/**
 * `{user_id}/{random_token}.jpg` — the folder segment is still required for
 * Storage RLS (first segment must equal auth.uid()), but the filename is
 * now a random token instead of the fixed, guessable `verification_selfie.jpg`
 * (2026-09-20) — defense in depth in case this bucket or a future signed
 * URL is ever misconfigured. A fresh token is generated on every call, so
 * retaking the selfie uploads to a NEW path rather than overwriting the old
 * one; the caller is responsible for deleting the previous object if one
 * exists (see onboardingStep1Context's submitAll).
 */
export function verificationSelfiePath(userId: string) {
  return `${userId}/${secureRandomToken()}.jpg`;
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
