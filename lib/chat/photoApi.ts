// V2 chat photos — network: upload to the private bucket, send through
// send_photo_message_v2, and short-lived signed URLs to show them. A retry
// reuses the same request id (→ same path, same message): the upload's
// "already exists" counts as uploaded and the RPC returns the existing message.
import { supabase } from '@/lib/supabaseClient';

import { CHAT_PHOTO_BUCKET, chatPhotoPath, isAlreadyUploaded, photoSendError, type CheckedPhoto } from './photo';

export type PhotoMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  kind: 'photo';
  media_path: string;
  media_width: number;
  media_height: number;
};

export async function sendChatPhoto(
  matchId: string,
  senderId: string,
  photo: CheckedPhoto,
  requestId: string,
): Promise<{ ok: true; message: PhotoMessageRow } | { ok: false; message: string }> {
  const path = chatPhotoPath(matchId, senderId, requestId, photo.ext);
  try {
    const res = await fetch(photo.uri);
    if (!res.ok) return { ok: false, message: photoSendError(`read ${res.status}`) };
    const bytes = await res.arrayBuffer();
    const up = await supabase.storage.from(CHAT_PHOTO_BUCKET).upload(path, bytes, { contentType: photo.contentType, upsert: false });
    if (up.error && !isAlreadyUploaded(up.error.message)) {
      if (__DEV__) console.warn('[chat photo] upload failed', up.error.message);
      return { ok: false, message: photoSendError(up.error.message) };
    }
    const { data, error } = await supabase.rpc('send_photo_message_v2', {
      p_match: matchId,
      p_path: path,
      p_width: photo.width,
      p_height: photo.height,
      p_request_id: requestId,
    });
    if (error || !data) {
      if (__DEV__) console.warn('[chat photo] send failed', error?.message);
      return { ok: false, message: photoSendError(error?.message) };
    }
    const { already: _already, ...row } = data as PhotoMessageRow & { already?: boolean };
    return { ok: true, message: row as PhotoMessageRow };
  } catch (e) {
    if (__DEV__) console.warn('[chat photo] failed', e);
    return { ok: false, message: photoSendError((e as Error)?.message) };
  }
}

// Signed URLs (server checks the viewer is a participant of a readable chat).
const URL_TTL_S = 3600;
const cache = new Map<string, { url: string; until: number }>();

export async function chatPhotoUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(CHAT_PHOTO_BUCKET).createSignedUrl(path, URL_TTL_S);
  if (error || !data?.signedUrl) {
    if (__DEV__) console.warn('[chat photo] signed url failed', error?.message);
    return null;
  }
  cache.set(path, { url: data.signedUrl, until: Date.now() + (URL_TTL_S - 120) * 1000 });
  return data.signedUrl;
}

/** Drop cached URLs (chat ended: the server would refuse them anyway). */
export function forgetChatPhotoUrls(): void {
  cache.clear();
}
