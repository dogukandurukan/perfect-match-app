// V2 chat photos — pure rules (no React / network): which picked files can be
// sent, the private Storage path, the bubble size, and user-facing errors.
// Server rules live in supabase/proposed/20261020090000_v2_chat_photos.sql.

export const CHAT_PHOTO_BUCKET = 'chat-photos';
/** Same limit as the bucket (file_size_limit). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** JPEG re-encode quality for the picker (shrinks large photos, HEIC → JPEG). */
export const PICK_QUALITY = 0.7;

const TYPES: Record<string, { ct: string; ext: string }> = {
  'image/jpeg': { ct: 'image/jpeg', ext: 'jpg' },
  'image/jpg': { ct: 'image/jpeg', ext: 'jpg' },
  'image/png': { ct: 'image/png', ext: 'png' },
  'image/heic': { ct: 'image/heic', ext: 'heic' },
  'image/heif': { ct: 'image/heic', ext: 'heic' },
  'image/webp': { ct: 'image/webp', ext: 'webp' },
};
const EXT_TYPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heic', webp: 'image/webp' };

export type PickedPhoto = { uri: string; width: number; height: number; mimeType?: string | null; fileName?: string | null; fileSize?: number | null };
export type CheckedPhoto = { uri: string; width: number; height: number; contentType: string; ext: string };

export const UNSUPPORTED_MESSAGE = 'This file type isn’t supported. Choose a JPG, PNG, HEIC or WebP photo.';
export const TOO_LARGE_MESSAGE = 'This photo is too large (over 10 MB). Choose a smaller one.';
export const UNREADABLE_MESSAGE = 'This photo couldn’t be read. Choose another one.';

/** Can this picked file be sent? Type from the picker's MIME type, else the file extension. */
export function checkPickedPhoto(p: PickedPhoto): { ok: true; photo: CheckedPhoto } | { ok: false; message: string } {
  if (!p?.uri || !(p.width > 0) || !(p.height > 0)) return { ok: false, message: UNREADABLE_MESSAGE };
  const mime = (p.mimeType ?? '').toLowerCase();
  const ext = ((p.fileName ?? p.uri).split('?')[0].split('.').pop() ?? '').toLowerCase();
  const t = TYPES[mime] ?? (mime ? undefined : TYPES[EXT_TYPE[ext] ?? '']);
  if (!t) return { ok: false, message: UNSUPPORTED_MESSAGE };
  if (typeof p.fileSize === 'number' && p.fileSize > MAX_PHOTO_BYTES) return { ok: false, message: TOO_LARGE_MESSAGE };
  return { ok: true, photo: { uri: p.uri, width: Math.round(p.width), height: Math.round(p.height), contentType: t.ct, ext: t.ext } };
}

/** `<match>/<sender>/<request id>.<ext>` — the server checks exactly this shape. */
export function chatPhotoPath(matchId: string, senderId: string, requestId: string, ext: string): string {
  return `${matchId.toLowerCase()}/${senderId.toLowerCase()}/${requestId.toLowerCase()}.${ext}`;
}

/** Bubble size keeping the photo's aspect ratio inside maxW × maxH (very thin photos get a minimum side). */
export function photoBubbleSize(w: number | null | undefined, h: number | null | undefined, maxW = 220, maxH = 280, minSide = 96): { width: number; height: number } {
  if (!w || !h || w <= 0 || h <= 0) return { width: maxW, height: Math.round(maxW * 0.75) };
  const s = Math.min(maxW / w, maxH / h);
  return { width: Math.max(minSide, Math.round(w * s)), height: Math.max(minSide, Math.round(h * s)) };
}

/** Server / Storage error → short text for the send sheet. */
export function photoSendError(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('chat_not_active')) return 'This chat is no longer active.';
  if (m.includes('mime') || m.includes('invalid_mime') || m.includes('not supported')) return UNSUPPORTED_MESSAGE;
  if (m.includes('too large') || m.includes('payload') || m.includes('exceeded') || m.includes('maximum allowed size')) return TOO_LARGE_MESSAGE;
  if (m.includes('bucket not found') || m.includes('could not find the function') || m.includes('send_photo_message_v2')) return 'Photos aren’t available on this server yet.';
  return 'The photo couldn’t be sent. Check your connection and try again.';
}

/** Storage says the object is already there (a retry after the upload succeeded). */
export const isAlreadyUploaded = (message: string | undefined | null) => /already exists|duplicate|resource already/i.test(message ?? '');

/**
 * Signed-URL cache (pure; the clock is passed in). An entry is used only until
 * `margin` before the URL itself expires; `force` skips it (a URL that failed
 * to load is replaced instead of being handed out again).
 */
export class PhotoUrlCache {
  private readonly map = new Map<string, { url: string; until: number }>();
  constructor(private readonly ttlS: number, private readonly marginS = 120) {}
  get(path: string, now: number, force = false): string | null {
    if (force) return null;
    const hit = this.map.get(path);
    return hit && hit.until > now ? hit.url : null;
  }
  set(path: string, url: string, now: number): void {
    this.map.set(path, { url, until: now + Math.max(0, this.ttlS - this.marginS) * 1000 });
  }
  forget(path?: string): void {
    if (path) this.map.delete(path);
    else this.map.clear();
  }
}
