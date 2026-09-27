// Tempa onboarding V2 — Your World search adapters (P05).
//
// ⚠️ DEVELOPMENT SAMPLE CATALOG — NOT LIVE SEARCH. No search provider is
// configured in this repo (no Spotify / TMDB / Google Books / Open Library /
// MusicBrainz credentials, Edge Functions or env keys). These adapters search
// small bundled lists of real, well-known entries so the typeahead UI can be
// reviewed. Real providers must be connected later behind the same async
// signatures (ideally via a server-side proxy so no key ships in the client).
// No images are bundled or fetched: the UI shows neutral placeholders.
// Metadata here is limited to facts the entries are known for (author, year,
// movie/series, school city); nothing is fabricated for display.
import { foldTr, searchCatalog } from '@/lib/onboardingV2/locationCatalog';
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

const ARTISTS: Entry[] = [
  'Sezen Aksu', 'Tarkan', 'Barış Manço', 'Sertab Erener', 'maNga', 'Duman', 'Mor ve Ötesi',
  'Teoman', 'Zeki Müren', 'Ajda Pekkan', 'Sıla', 'Mabel Matiz', 'Kenan Doğulu', 'Müslüm Gürses',
  'Daft Punk', 'Sade', 'Coldplay', 'Radiohead', 'Adele', 'Beyoncé', 'Taylor Swift', 'The Beatles',
  'Queen', 'Arctic Monkeys', 'Billie Eilish', 'Kendrick Lamar', 'Rosalía', 'Frank Ocean',
  'Norah Jones', 'Miles Davis',
].map((title) => ({ id: `sample:artist:${foldTr(title).replace(/[^a-z0-9]+/g, '-')}`, title }));

const BOOKS: Entry[] = [
  ['Kürk Mantolu Madonna', 'Sabahattin Ali'],
  ['İnce Memed', 'Yaşar Kemal'],
  ['Tutunamayanlar', 'Oğuz Atay'],
  ['Benim Adım Kırmızı', 'Orhan Pamuk'],
  ['Masumiyet Müzesi', 'Orhan Pamuk'],
  ['Saatleri Ayarlama Enstitüsü', 'Ahmet Hamdi Tanpınar'],
  ['Aylak Adam', 'Yusuf Atılgan'],
  ['1984', 'George Orwell'],
  ['Pride and Prejudice', 'Jane Austen'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez'],
  ['The Little Prince', 'Antoine de Saint-Exupéry'],
  ['Crime and Punishment', 'Fyodor Dostoevsky'],
  ['The Great Gatsby', 'F. Scott Fitzgerald'],
  ['Norwegian Wood', 'Haruki Murakami'],
  ['Sapiens', 'Yuval Noah Harari'],
  ['The Alchemist', 'Paulo Coelho'],
  ['To Kill a Mockingbird', 'Harper Lee'],
  ["Harry Potter and the Philosopher's Stone", 'J.K. Rowling'],
  ['The Hobbit', 'J.R.R. Tolkien'],
  ['Beloved', 'Toni Morrison'],
].map(([title, author]) => ({
  id: `sample:book:${foldTr(`${title} ${author}`).replace(/[^a-z0-9]+/g, '-')}`,
  title,
  subtitle: author,
  aliases: [author],
}));

const SCREEN: Entry[] = (
  [
    ['Babam ve Oğlum', 2005, 'Movie'],
    ['Eşkıya', 1996, 'Movie'],
    ['Kış Uykusu', 2014, 'Movie'],
    ["Bir Zamanlar Anadolu'da", 2011, 'Movie'],
    ['Ezel', 2009, 'Series'],
    ['Leyla ile Mecnun', 2011, 'Series'],
    ['Behzat Ç.', 2010, 'Series'],
    ['Amélie', 2001, 'Movie'],
    ['Inception', 2010, 'Movie'],
    ['Parasite', 2019, 'Movie'],
    ['The Godfather', 1972, 'Movie'],
    ['Spirited Away', 2001, 'Movie'],
    ['La La Land', 2016, 'Movie'],
    ['Before Sunrise', 1995, 'Movie'],
    ['Pulp Fiction', 1994, 'Movie'],
    ['Breaking Bad', 2008, 'Series'],
    ['Friends', 1994, 'Series'],
    ['The Office (US)', 2005, 'Series'],
    ['Game of Thrones', 2011, 'Series'],
    ['Fleabag', 2016, 'Series'],
    ['Succession', 2018, 'Series'],
    ['Stranger Things', 2016, 'Series'],
    ['The Crown', 2016, 'Series'],
  ] as [string, number, string][]
).map(([title, year, type]) => ({
  id: `sample:screen:${foldTr(`${title} ${year}`).replace(/[^a-z0-9]+/g, '-')}`,
  title,
  subtitle: `${year} · ${type}`,
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

export type SearchFn = (query: string) => Promise<TasteItem[]>;

// Async adapters — same shape a real provider proxy would have.
export const searchSchools: SearchFn = async (q) => searchList(SCHOOLS, 'school', q);
export const searchArtists: SearchFn = async (q) => searchList(ARTISTS, 'artist', q);
export const searchBooks: SearchFn = async (q) => searchList(BOOKS, 'book', q);
export const searchScreen: SearchFn = async (q) => searchList(SCREEN, 'screen', q);
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
  artist: `${ARTISTS.length} artists`,
  book: `${BOOKS.length} books`,
  screen: `${SCREEN.length} movies and series`,
};
