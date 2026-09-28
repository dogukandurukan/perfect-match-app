// Tempa onboarding V2 — LIVE read-only catalog adapters (P05 R1).
//
// Providers need no account, key or payment:
//  - Artists:        MusicBrainz Web Service (musicbrainz.org/ws/2) — artist entity only.
//  - Books:          Open Library Search API (openlibrary.org/search.json) + Covers API.
//  - Movies/series:  Wikidata API (wbsearchentities + wbgetentities); type from P31,
//                    year from P577 (publication date) / P580 (start time).
// All require an identifying User-Agent and ask for ~1 request/second per
// client (MusicBrainz: per IP; Open Library: unidentified clients), so each
// provider is throttled here. Queries are sent to these third parties from the
// device; nothing is logged. There is NO silent fallback to sample data: a
// failure surfaces as an error and the user can add the entry as typed.
// Production note: route through a server-side proxy with caching before real
// launch (rate limits are per IP; Open Library is not meant as a high-traffic
// commercial backend) — not built/deployed here.
import { foldTr } from '@/lib/onboardingV2/locationCatalog';
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export const USER_AGENT = 'TempaPreview/0.1 ( https://github.com/dogukandurukan/perfect-match-app )';
const TIMEOUT_MS = 10000;
const MIN_INTERVAL_MS = 1100;
const LIMIT = 6;

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

let fetchImpl: FetchLike = (url, init) => fetch(url, init);
/** Test seam only. */
export function __setFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((url, init) => fetch(url, init));
}

// Per-host throttle: each provider gets ≥ MIN_INTERVAL_MS between requests.
const lastCall: Record<string, number> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let throttleEnabled = true;
export function __setThrottle(on: boolean) {
  throttleEnabled = on;
}

function aborted(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

async function getJson(host: string, url: string, signal?: AbortSignal): Promise<any> {
  if (throttleEnabled) {
    const wait = (lastCall[host] ?? 0) + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
  }
  // A superseded query is dropped before it ever reaches the provider.
  if (signal?.aborted) throw aborted();
  lastCall[host] = Date.now();
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
    signal?.removeEventListener('abort', onAbort);
  }
}

function queryWords(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ''))
    .filter(Boolean);
}

/** MusicBrainz: "sezen ak" → `artist:(sezen*) AND artist:(ak*)` — prefix match
 * per word on the artist-name field only (Lucene specials stripped). */
export function prefixQuery(q: string): string {
  return queryWords(q)
    .map((w) => `artist:(${w}*)`)
    .join(' AND ');
}

/** Open Library: prefix only words of ≥ 3 characters; a 1–2 letter trailing
 * fragment ("norwegian w") would otherwise match almost everything. */
export function bookQuery(q: string): string {
  const words = queryWords(q);
  const kept = words.filter((w, i) => w.length >= 3 || i < words.length - 1);
  return kept.map((w) => (w.length >= 3 ? `${w}*` : w)).join(' ');
}

/** Stable local re-rank: results whose title contains every query word as a
 * word prefix first, then titles starting with the query, provider order kept
 * otherwise. Nothing is dropped or merged. */
export function rerankByTitle(items: TasteItem[], q: string): TasteItem[] {
  const words = foldTr(q).split(' ').filter(Boolean);
  const score = (t: string) => {
    const f = foldTr(t);
    const tokens = f.split(/[\s.,:;'’()\-]+/);
    const all = words.every((w) => tokens.some((tk) => tk.startsWith(w)));
    return (all ? 0 : 2) + (f.startsWith(words.join(' ')) ? 0 : 1);
  };
  return items
    .map((it, i) => ({ it, i, s: score(it.title) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.it);
}

// ---------- Artists: MusicBrainz ----------
export function parseMusicBrainz(json: any): TasteItem[] {
  const artists: any[] = Array.isArray(json?.artists) ? json.artists : [];
  return artists
    .filter((a) => a?.id && a?.name && a.name !== '[unknown]' && a.name !== 'Various Artists')
    .slice(0, LIMIT)
    .map((a) => ({
      kind: 'artist' as const,
      source: 'musicbrainz' as const,
      id: `mb:artist:${a.id}`,
      title: String(a.name),
      // MusicBrainz's own disambiguation comment when present (verified text).
      subtitle: a.disambiguation ? String(a.disambiguation) : undefined,
    }));
}

export async function searchArtistsLive(q: string, signal?: AbortSignal): Promise<TasteItem[]> {
  const pq = prefixQuery(q);
  if (!pq) return [];
  const url = `https://musicbrainz.org/ws/2/artist?fmt=json&limit=${LIMIT + 2}&query=${encodeURIComponent(pq)}`;
  return rerankByTitle(parseMusicBrainz(await getJson('musicbrainz', url, signal)), q);
}

// ---------- Books: Open Library ----------
export function parseOpenLibrary(json: any): TasteItem[] {
  const docs: any[] = Array.isArray(json?.docs) ? json.docs : [];
  const seen = new Set<string>();
  const out: TasteItem[] = [];
  for (const d of docs) {
    if (!d?.key || !d?.title) continue;
    const author = Array.isArray(d.author_name) && d.author_name[0] ? String(d.author_name[0]) : undefined;
    // Open Library often returns several works for one book; show one per
    // exact normalized title + author (no fuzzy merging beyond that).
    const dedupe = `${foldTr(String(d.title))}|${foldTr(author ?? '')}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      kind: 'book',
      source: 'openlibrary',
      id: `ol:${String(d.key).replace(/^\/works\//, 'work:')}`,
      title: String(d.title),
      subtitle: author,
      imageUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg` : undefined,
    });
    if (out.length >= LIMIT) break;
  }
  return out;
}

export async function searchBooksLive(q: string, signal?: AbortSignal): Promise<TasteItem[]> {
  const query = bookQuery(q);
  if (!query) return [];
  const url = `https://openlibrary.org/search.json?limit=20&fields=key,title,author_name,cover_i&q=${encodeURIComponent(query)}`;
  return rerankByTitle(parseOpenLibrary(await getJson('openlibrary', url, signal)), q);
}

// ---------- Movies & series: Wikidata ----------
// P31 (instance of) values accepted as a film or a TV series. Episodes,
// seasons and franchises are deliberately excluded.
const FILM = new Set(['Q11424', 'Q24869', 'Q202866', 'Q506240', 'Q24862']);
const SERIES = new Set(['Q5398426', 'Q526877', 'Q1259759', 'Q63952888', 'Q117467246']);

function claimIds(e: any, p: string): string[] {
  return (e?.claims?.[p] ?? []).map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
}
function claimYear(e: any, ps: string[]): string | undefined {
  const years = ps
    .flatMap((p) => e?.claims?.[p] ?? [])
    .map((c: any) => c?.mainsnak?.datavalue?.value?.time as string | undefined)
    .filter((t): t is string => !!t && /^[+-]\d{4}/.test(t))
    .map((t) => t.slice(1, 5));
  return years.length ? years.sort()[0] : undefined;
}

export function parseWikidata(search: any, entities: any): TasteItem[] {
  const hits: any[] = Array.isArray(search?.search) ? search.search : [];
  const ents = entities?.entities ?? {};
  const out: TasteItem[] = [];
  for (const h of hits) {
    const e = ents[h.id];
    if (!e) continue;
    const p31 = claimIds(e, 'P31');
    const type = p31.some((x) => FILM.has(x)) ? 'Movie' : p31.some((x) => SERIES.has(x)) ? 'Series' : null;
    if (!type) continue;
    const year = claimYear(e, type === 'Movie' ? ['P577'] : ['P580', 'P577']);
    // Show the label the user matched (e.g. "Inception" or "Babam ve Oğlum").
    const title = h?.match?.type === 'label' || h?.match?.type === 'alias' ? h.match.text : h.label;
    out.push({
      kind: 'screen',
      source: 'wikidata',
      id: `wd:${h.id}`,
      title: String(title ?? h.label),
      subtitle: year ? `${year} · ${type}` : type,
    });
    if (out.length >= LIMIT) break;
  }
  return out;
}

export async function searchScreenLive(q: string, signal?: AbortSignal): Promise<TasteItem[]> {
  const s = q.trim();
  if (!s) return [];
  const base = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
  const search = await getJson(
    'wikidata',
    `${base}&action=wbsearchentities&type=item&limit=15&language=tr&uselang=en&search=${encodeURIComponent(s)}`,
    signal,
  );
  const ids = (Array.isArray(search?.search) ? search.search : []).map((h: any) => h.id).filter(Boolean);
  if (ids.length === 0) return [];
  const entities = await getJson(
    'wikidata-entities',
    `${base}&action=wbgetentities&props=claims&ids=${ids.join('|')}`,
    signal,
  );
  return parseWikidata(search, entities);
}

export const LIVE_ATTRIBUTION = {
  artist: 'Suggestions from MusicBrainz',
  book: 'Suggestions from Open Library',
  screen: 'Suggestions from Wikidata',
} as const;
