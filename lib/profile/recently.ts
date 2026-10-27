// Server calls for "Recently" (D106). Nothing looks saved until the server
// said so; the row version this screen loaded is sent back, so a change made
// elsewhere is reported (Reload) instead of overwritten.
import { supabase } from '@/lib/supabaseClient';

import { recentlyFromServer, type RecentlyDraft } from './recentlyCore';

export type RecentlyLoad = { ok: true; draft: RecentlyDraft; version: string | null } | { ok: false; text: string };

export async function loadMyRecently(): Promise<RecentlyLoad> {
  try {
    const { data, error } = await supabase.rpc('get_my_recently_v2');
    if (error) return { ok: false, text: 'Couldn’t load this. Check your connection and try again.' };
    return { ok: true, ...recentlyFromServer(data) };
  } catch {
    return { ok: false, text: 'Couldn’t load this. Check your connection and try again.' };
  }
}

export type RecentlySave =
  | { ok: true; draft: RecentlyDraft; version: string | null }
  | { ok: false; text: string; changed: boolean };

export async function saveMyRecently(d: RecentlyDraft, version: string | null): Promise<RecentlySave> {
  try {
    const { data, error } = await supabase.rpc('save_my_recently_v2', {
      p_book_title: d.bookTitle.trim() || null,
      p_book_author: d.bookAuthor.trim() || null,
      p_song_title: d.songTitle.trim() || null,
      p_song_artist: d.songArtist.trim() || null,
      p_song_url: d.songUrl.trim() || null,
      p_expected_updated_at: version,
    });
    if (error) {
      if (__DEV__) console.warn('[Recently] save failed', error.message);
      return /not_member/.test(error.message ?? '')
        ? { ok: false, text: 'Only approved members can add this.', changed: false }
        : { ok: false, text: 'Couldn’t save. Check your connection and try again.', changed: false };
    }
    if (!data?.ok) {
      return data?.error === 'profile_changed'
        ? { ok: false, text: 'This changed on another screen or device. Reload to see the latest.', changed: true }
        : { ok: false, text: 'That can’t be saved. Check the fields and try again.', changed: false };
    }
    return { ok: true, ...recentlyFromServer(data.recently) };
  } catch {
    return { ok: false, text: 'Couldn’t save. Check your connection and try again.', changed: false };
  }
}
