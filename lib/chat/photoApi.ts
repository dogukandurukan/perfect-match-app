// V2 chat photos — app wrappers: the send step (lib/chat/photoSend.ts) with
// the app's Supabase client, and short-lived signed URLs to show photos. The
// server checks the viewer is a participant; a URL is cached until shortly
// before it expires, and a URL that failed to load is fetched anew (force).
import { supabase } from '@/lib/supabaseClient';

import { CHAT_PHOTO_BUCKET, PhotoUrlCache, type CheckedPhoto } from './photo';
import { sendChatPhotoWith, type PhotoMessageRow } from './photoSend';

export type { PhotoMessageRow };

export function sendChatPhoto(matchId: string, senderId: string, photo: CheckedPhoto, requestId: string) {
  return sendChatPhotoWith(supabase as never, matchId, senderId, photo, requestId, (m, e) => {
    if (__DEV__) console.warn(m, e);
  });
}

const URL_TTL_S = 3600;
const cache = new PhotoUrlCache(URL_TTL_S);

export async function chatPhotoUrl(path: string, opts: { force?: boolean } = {}): Promise<string | null> {
  const hit = cache.get(path, Date.now(), opts.force);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from(CHAT_PHOTO_BUCKET).createSignedUrl(path, URL_TTL_S);
  if (error || !data?.signedUrl) {
    if (__DEV__) console.warn('[chat photo] signed url failed', error?.message);
    return null;
  }
  cache.set(path, data.signedUrl, Date.now());
  return data.signedUrl;
}

/** Drop cached URLs (chat ended: the server would refuse them anyway). */
export function forgetChatPhotoUrls(): void {
  cache.forget();
}
