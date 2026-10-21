// V2 chat photos — the send step with the Supabase client passed in (no app
// client import), so the local tests run the exact code the app runs.
// Upload (no upsert; "already exists" on a retry counts as uploaded) →
// send_photo_message_v2 (idempotent per request id). A lost response or a
// failed RPC is retried with the SAME request id → the same message.
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

type Client = {
  storage: { from: (bucket: string) => { upload: (path: string, body: ArrayBuffer, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }> } };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function sendChatPhotoWith(
  client: Client,
  matchId: string,
  senderId: string,
  photo: CheckedPhoto,
  requestId: string,
  warn: (m: string, e?: unknown) => void = () => {},
): Promise<{ ok: true; message: PhotoMessageRow } | { ok: false; message: string }> {
  const path = chatPhotoPath(matchId, senderId, requestId, photo.ext);
  try {
    const res = await fetch(photo.uri);
    if (!res.ok) return { ok: false, message: photoSendError(`read ${res.status}`) };
    const bytes = await res.arrayBuffer();
    const up = await client.storage.from(CHAT_PHOTO_BUCKET).upload(path, bytes, { contentType: photo.contentType, upsert: false });
    if (up.error && !isAlreadyUploaded(up.error.message)) {
      warn('[chat photo] upload failed', up.error.message);
      return { ok: false, message: photoSendError(up.error.message) };
    }
    const { data, error } = await client.rpc('send_photo_message_v2', {
      p_match: matchId,
      p_path: path,
      p_width: photo.width,
      p_height: photo.height,
      p_request_id: requestId,
    });
    if (error || !data) {
      warn('[chat photo] send failed', error?.message);
      return { ok: false, message: photoSendError(error?.message) };
    }
    const { already: _already, ...row } = data as PhotoMessageRow & { already?: boolean };
    return { ok: true, message: row as PhotoMessageRow };
  } catch (e) {
    warn('[chat photo] failed', e);
    return { ok: false, message: photoSendError((e as Error)?.message) };
  }
}
