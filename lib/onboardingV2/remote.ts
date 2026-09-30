// Onboarding V2 — live persistence against the server RPCs of
// supabase/proposed/20260930120000_v2_onboarding_persistence.sql.
// Every write is a validating SECURITY DEFINER RPC keyed on the signed-in
// user; nothing here can change application / verification / membership
// state except the (idempotent) submit.
import { resolveProfilePhotoUrl, preloadProfilePhotoUrls, PROFILE_PHOTOS_BUCKET } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';
import { verificationSelfiePath, VERIFICATION_SELFIE_BUCKET } from '@/lib/userPhotosStorage';

import type { FlowPos, SectionId } from './previewFlow';
import type { LocalPhoto, LocalSelfie, PromptAnswer } from './yourProfile';
import { photosFromServer, promptsToServer, type ServerBundle } from './serverMapping';

export type Result<T = void> = { ok: true; value: T } | { ok: false; message: string };

const friendly = (e: { message?: string } | null | undefined, fallback: string) => {
  const m = e?.message ?? '';
  if (/Network request failed|fetch failed|timeout/i.test(m)) return 'No connection. Check your internet and try again.';
  if (m.includes('application_locked')) return 'Your application was already sent, so answers can no longer be changed.';
  if (m.includes('too_many_photos')) return 'You can add up to 6 photos.';
  return fallback;
};

export async function loadMyOnboarding(): Promise<Result<ServerBundle>> {
  const { data, error } = await supabase.rpc('get_my_onboarding_v2');
  if (error || !data) return { ok: false, message: friendly(error, 'Could not load your answers. Try again.') };
  return { ok: true, value: data as ServerBundle };
}

/** Signs the saved photos and returns LocalPhoto entries (with server ids). */
export async function photosForBundle(bundle: ServerBundle): Promise<LocalPhoto[]> {
  await preloadProfilePhotoUrls(bundle.photos.map((p) => p.path));
  const signed = new Map<string, string | null>();
  for (const p of bundle.photos) signed.set(p.path, await resolveProfilePhotoUrl(p.path));
  return photosFromServer(bundle.photos, signed);
}

export async function saveSection(
  section: SectionId,
  data: Record<string, unknown>,
  resume: FlowPos | null,
): Promise<Result> {
  const { error } = await supabase.rpc('save_onboarding_v2', {
    p_section: section,
    p_data: data,
    p_resume_step: resume?.step ?? null,
    p_resume_section: resume?.section ?? null,
  });
  return error ? { ok: false, message: friendly(error, 'Could not save. Try again.') } : { ok: true, value: undefined };
}

export async function savePrompts(list: PromptAnswer[]): Promise<Result> {
  const { error } = await supabase.rpc('save_prompts_v2', { p_prompts: promptsToServer(list) });
  return error ? { ok: false, message: friendly(error, 'Could not save your answers. Try again.') } : { ok: true, value: undefined };
}

function contentTypeFor(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
const extFor = (ct: string) => (ct === 'image/png' ? 'png' : ct === 'image/heic' ? 'heic' : ct === 'image/webp' ? 'webp' : 'jpg');

async function readBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`read ${res.status}`);
  return res.arrayBuffer();
}

function randomToken(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/**
 * Brings the server in line with the photo list on screen:
 * 1. uploads + registers every photo without a server id (each success is
 *    reported through `onRegistered`, so a retry never re-uploads it);
 * 2. deletes server photos that are no longer in the list;
 * 3. applies the on-screen order.
 * Stops at the first failure; nothing half-registered is counted by the server.
 */
export async function syncPhotos(
  userId: string,
  photos: LocalPhoto[],
  serverIds: string[],
  onRegistered: (localId: string, serverId: string, path: string) => void,
): Promise<Result<{ serverIds: string[] }>> {
  const usable = photos.filter((p) => !p.broken || p.serverId);
  const known = new Map<string, string>(); // localId → serverId
  for (const p of usable) if (p.serverId) known.set(p.id, p.serverId);

  for (const p of usable) {
    if (p.serverId) continue;
    try {
      const ct = contentTypeFor(p.uri);
      const path = `${userId}/${randomToken()}.${extFor(ct)}`;
      const bytes = await readBytes(p.uri);
      const up = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, bytes, { contentType: ct, upsert: false });
      if (up.error) return { ok: false, message: friendly(up.error, 'A photo could not be uploaded. Try again.') };
      const reg = await supabase.rpc('add_profile_photo_v2', { p_path: path });
      if (reg.error || !reg.data?.id) {
        // registration failed: remove the orphan object (best effort)
        await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]);
        return { ok: false, message: friendly(reg.error, 'A photo could not be saved. Try again.') };
      }
      known.set(p.id, reg.data.id as string);
      onRegistered(p.id, reg.data.id as string, path);
    } catch (e) {
      return { ok: false, message: friendly(e as Error, 'A photo could not be uploaded. Try again.') };
    }
  }

  const wanted = new Set(known.values());
  for (const sid of serverIds) {
    if (wanted.has(sid)) continue;
    const del = await supabase.rpc('delete_profile_photo_v2', { p_id: sid });
    if (del.error) return { ok: false, message: friendly(del.error, 'A photo could not be removed. Try again.') };
    const path = (del.data as { path?: string } | null)?.path;
    if (path) await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]); // best effort
  }

  const order = usable.map((p) => known.get(p.id)).filter((x): x is string => !!x);
  if (order.length) {
    const re = await supabase.rpc('reorder_profile_photos_v2', { p_ids: order });
    if (re.error) return { ok: false, message: friendly(re.error, 'Could not save the photo order. Try again.') };
  }
  return { ok: true, value: { serverIds: order } };
}

/** Uploads the private selfie (never readable by any client) and records it. */
export async function uploadSelfie(userId: string, selfie: LocalSelfie): Promise<Result> {
  if (selfie.uploaded) return { ok: true, value: undefined };
  try {
    const path = verificationSelfiePath(userId);
    const bytes = await readBytes(selfie.uri);
    const up = await supabase.storage.from(VERIFICATION_SELFIE_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (up.error) return { ok: false, message: friendly(up.error, 'Your selfie could not be uploaded. Try again.') };
    const reg = await supabase.rpc('set_verification_selfie_v2', { p_path: path });
    if (reg.error) return { ok: false, message: friendly(reg.error, 'Your selfie could not be saved. Try again.') };
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, message: friendly(e as Error, 'Your selfie could not be uploaded. Try again.') };
  }
}

export type SubmitOutcome =
  | { kind: 'submitted'; submittedAt: string }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'error'; message: string };

/** Idempotent: the same requestId (and any retry) never creates a second application. */
export async function submitApplication(requestId: string): Promise<SubmitOutcome> {
  const { data, error } = await supabase.rpc('submit_application_v2', { p_request_id: requestId });
  if (error || !data) return { kind: 'error', message: friendly(error, 'Could not send your application. Try again.') };
  const d = data as { status: string; submitted_at?: string; missing?: string[] };
  if (d.status === 'submitted' || d.status === 'accepted' || d.status === 'rejected') {
    return { kind: 'submitted', submittedAt: d.submitted_at ?? '' };
  }
  return { kind: 'missing', missing: d.missing ?? [] };
}

export type AccessGate =
  | { gate: 'signed_out' | 'legacy_member' | 'member' }
  | { gate: 'onboarding'; applicationStatus?: string }
  | { gate: 'waiting'; applicationStatus?: string; verificationStatus?: string }
  | { gate: 'unavailable' } // server not migrated yet → keep the V1 behaviour
  | { gate: 'error'; message: string };

export async function getAccessGate(): Promise<AccessGate> {
  const { data, error } = await supabase.rpc('get_my_access_v2');
  if (error) {
    // PGRST202 = function not found (backend without the V2 migration).
    if ((error as { code?: string }).code === 'PGRST202') return { gate: 'unavailable' };
    return { gate: 'error', message: friendly(error, 'Could not check your account. Try again.') };
  }
  const d = data as { gate: string; application_status?: string; verification_status?: string };
  if (d.gate === 'onboarding') return { gate: 'onboarding', applicationStatus: d.application_status };
  if (d.gate === 'waiting') return { gate: 'waiting', applicationStatus: d.application_status, verificationStatus: d.verification_status };
  if (d.gate === 'member' || d.gate === 'legacy_member' || d.gate === 'signed_out') return { gate: d.gate };
  return { gate: 'error', message: 'Unexpected account state.' };
}
