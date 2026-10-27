// "Recently" (D106, owner 2026-10-27): one book (title — author) and one
// song (title — artist, optional music link) under the name on a profile.
// Both optional; they stay until the member changes or removes them. Typed by
// hand — no external API, nothing fetched automatically. Pure (no React
// Native), so it is testable in Node. Mirrors the server rules in
// save_my_recently_v2 / v2_is_music_url.

export const RECENTLY_LIMITS = { bookTitle: 120, bookAuthor: 80, songTitle: 120, songArtist: 80, songUrl: 500 } as const;

/** The editable form (as typed). */
export type RecentlyDraft = { bookTitle: string; bookAuthor: string; songTitle: string; songArtist: string; songUrl: string };
export const EMPTY_RECENTLY: RecentlyDraft = { bookTitle: '', bookAuthor: '', songTitle: '', songArtist: '', songUrl: '' };

/** What a profile shows (from get_profile_v2 'recently', or the own row). */
export type PublicRecently = {
  book: { title: string; author: string | null } | null;
  song: { title: string; artist: string | null; url: string | null } | null;
};

// Music services whose links may be opened (and their subdomains).
const MUSIC_HOSTS = ['spotify.com', 'apple.com', 'youtube.com', 'youtu.be', 'soundcloud.com', 'deezer.com', 'tidal.com', 'music.amazon.com', 'bandcamp.com', 'fizy.com'];

/** https only, no user:password@, no spaces / control characters, host on the allow-list. */
export function isSafeMusicUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false;
  const url = raw.trim();
  if (url.length < 12 || url.length > RECENTLY_LIMITS.songUrl) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(url)) return false;
  const m = /^https:\/\/([a-z0-9.-]+)(:443)?(\/[^@]*)?$/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  if (host.startsWith('.') || host.includes('..')) return false;
  return MUSIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

const clean = (s: string) => s.trim();
// eslint-disable-next-line no-control-regex
const hasControl = (s: string) => /[\u0000-\u001f\u007f]/.test(s);

/** Why Save is disabled (null = valid). */
export function recentlyProblem(d: RecentlyDraft): string | null {
  const bt = clean(d.bookTitle), ba = clean(d.bookAuthor), st = clean(d.songTitle), sa = clean(d.songArtist), su = clean(d.songUrl);
  if ([bt, ba, st, sa, su].some(hasControl)) return 'Use a single line for each field.';
  if (bt.length > RECENTLY_LIMITS.bookTitle) return `Book title: up to ${RECENTLY_LIMITS.bookTitle} characters.`;
  if (ba.length > RECENTLY_LIMITS.bookAuthor) return `Author: up to ${RECENTLY_LIMITS.bookAuthor} characters.`;
  if (st.length > RECENTLY_LIMITS.songTitle) return `Song title: up to ${RECENTLY_LIMITS.songTitle} characters.`;
  if (sa.length > RECENTLY_LIMITS.songArtist) return `Artist: up to ${RECENTLY_LIMITS.songArtist} characters.`;
  if (ba && !bt) return 'Add the book title, or clear the author.';
  if ((sa || su) && !st) return 'Add the song title, or clear the artist and link.';
  if (su && !isSafeMusicUrl(su)) return 'Use an https link from a music service (Spotify, Apple Music, YouTube, SoundCloud, Deezer, Tidal…).';
  return null;
}

export const sameRecently = (a: RecentlyDraft, b: RecentlyDraft): boolean =>
  (Object.keys(EMPTY_RECENTLY) as (keyof RecentlyDraft)[]).every((k) => clean(a[k]) === clean(b[k]));

/** The own row (get_my_recently_v2 / save result) → form + its version. */
export function recentlyFromServer(r: Record<string, unknown> | null | undefined): { draft: RecentlyDraft; version: string | null } {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const x = r ?? {};
  return {
    draft: { bookTitle: s(x.book_title), bookAuthor: s(x.book_author), songTitle: s(x.song_title), songArtist: s(x.song_artist), songUrl: s(x.song_url) },
    version: typeof x.updated_at === 'string' ? x.updated_at : null,
  };
}

/** Form → what profiles show (null when both are empty). */
export function recentlyForDisplay(d: RecentlyDraft): PublicRecently | null {
  const bt = clean(d.bookTitle), st = clean(d.songTitle);
  if (!bt && !st) return null;
  return {
    book: bt ? { title: bt, author: clean(d.bookAuthor) || null } : null,
    song: st ? { title: st, artist: clean(d.songArtist) || null, url: clean(d.songUrl) || null } : null,
  };
}

/** One line: "Title — Author"; the dash only when there is a second part. */
export const recentlyLine = (title: string, by: string | null): string => (by ? `${title} — ${by}` : title);

/** A song link is opened only when it passes the same check again. */
export const openableSongUrl = (song: PublicRecently['song']): string | null => (song?.url && isSafeMusicUrl(song.url) ? song.url.trim() : null);
