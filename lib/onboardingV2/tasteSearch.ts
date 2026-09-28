// Tempa onboarding V2 — Your World search adapters (P05).
//
// Artists, books and movies/series use LIVE read-only catalogs (P05 R1, see
// liveCatalog.ts). Schools and hometown still use a clearly labelled
// DEVELOPMENT SAMPLE (below) — not live search. Metadata is limited to
// verified facts (school city); nothing is fabricated for display.
import { foldTr, searchCatalog } from '@/lib/onboardingV2/locationCatalog';
import { searchArtistsLive, searchBooksLive, searchScreenLive } from '@/lib/onboardingV2/liveCatalog';
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export const MIN_QUERY = 2;

type Entry = { id: string; title: string; subtitle?: string; aliases?: string[] };

const SCHOOLS: Entry[] = [
  ['bogazici', 'Boğaziçi Üniversitesi', 'İstanbul, Turkey', ['Bogazici University']],
  ['itu', 'İstanbul Teknik Üniversitesi', 'İstanbul, Turkey', ['ITU', 'Istanbul Technical University']],
  ['odtu', 'Orta Doğu Teknik Üniversitesi', 'Ankara, Turkey', ['ODTÜ', 'METU', 'Middle East Technical University']],
  ['bilkent', 'Bilkent Üniversitesi', 'Ankara, Turkey'],
  ['hacettepe', 'Hacettepe Üniversitesi', 'Ankara, Turkey'],
  ['koc', 'Koç Üniversitesi', 'İstanbul, Turkey', ['Koc University']],
  ['sabanci', 'Sabancı Üniversitesi', 'İstanbul, Turkey', ['Sabanci University']],
  ['istanbul', 'İstanbul Üniversitesi', 'İstanbul, Turkey'],
  ['ankara', 'Ankara Üniversitesi', 'Ankara, Turkey'],
  ['ege', 'Ege Üniversitesi', 'İzmir, Turkey'],
  ['deu', 'Dokuz Eylül Üniversitesi', 'İzmir, Turkey'],
  ['ytu', 'Yıldız Teknik Üniversitesi', 'İstanbul, Turkey', ['YTU']],
  ['gsu', 'Galatasaray Üniversitesi', 'İstanbul, Turkey'],
  ['marmara', 'Marmara Üniversitesi', 'İstanbul, Turkey'],
  ['bilgi', 'İstanbul Bilgi Üniversitesi', 'İstanbul, Turkey'],
  ['ozyegin', 'Özyeğin Üniversitesi', 'İstanbul, Turkey'],
  ['bau', 'Bahçeşehir Üniversitesi', 'İstanbul, Turkey'],
  ['uludag', 'Bursa Uludağ Üniversitesi', 'Bursa, Turkey'],
  ['akdeniz', 'Akdeniz Üniversitesi', 'Antalya, Turkey'],
  ['gazi', 'Gazi Üniversitesi', 'Ankara, Turkey'],
].map(([id, title, subtitle, aliases]) => ({
  id: `sample:school:${id}`,
  title: title as string,
  subtitle: subtitle as string,
  aliases: aliases as string[] | undefined,
}));

function matches(e: Entry, q: string): boolean {
  const words = q.split(' ');
  const hay = [e.title, ...(e.aliases ?? [])].map((s) => foldTr(s).split(/[\s.,'’()-]+/)).flat();
  return words.every((w) => hay.some((h) => h.startsWith(w)));
}

function searchList(list: Entry[], kind: TasteItem['kind'], query: string, limit = 6): TasteItem[] {
  const q = foldTr(query);
  if (q.length < MIN_QUERY) return [];
  return list
    .filter((e) => matches(e, q))
    .slice(0, limit)
    .map((e) => ({ kind, source: 'sample', id: e.id, title: e.title, subtitle: e.subtitle }));
}

export type SearchFn = (query: string, signal?: AbortSignal) => Promise<TasteItem[]>;

// Async adapters — same shape a real provider proxy would have.
export const searchSchools: SearchFn = async (q) => searchList(SCHOOLS, 'school', q);
// Live providers (no silent fallback to sample data on failure).
export const searchArtists: SearchFn = async (q, signal) => (foldTr(q).length < MIN_QUERY ? [] : searchArtistsLive(q, signal));
export const searchBooks: SearchFn = async (q, signal) => (foldTr(q).length < MIN_QUERY ? [] : searchBooksLive(q, signal));
export const searchScreen: SearchFn = async (q, signal) => (foldTr(q).length < MIN_QUERY ? [] : searchScreenLive(q, signal));
/** Hometown reuses the bundled location catalog (5 Turkish cities + districts). */
export const searchHometowns: SearchFn = async (q) => {
  if (foldTr(q).length < MIN_QUERY) return [];
  return searchCatalog(q, 6).map((r) => ({
    kind: 'hometown' as const,
    source: 'sample' as const,
    id: `sample:place:${r.id}`,
    title: r.district ?? r.city,
    subtitle: r.district ? `${r.city}, ${r.country}` : r.country,
  }));
};

export const SAMPLE_COVERAGE = {
  school: `${SCHOOLS.length} Turkish universities`,
  hometown: 'İstanbul, Ankara, İzmir, Bursa, Antalya and their districts',
};
