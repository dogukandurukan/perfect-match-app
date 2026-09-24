// Tempa onboarding V2 — current-location lookup for the P02 dev preview (D49).
//
// PREVIEW COVERAGE ONLY: a bundled catalog of real Turkish locations — the
// cities İstanbul, Ankara, İzmir, Bursa, Antalya and their official districts
// (ilçe), reusing the district lists in lib/turkishGeo.ts. This is NOT
// worldwide production autocomplete: no network geocoder, no API key, no
// paid provider. Replace `searchLocations` with a provider-backed
// implementation later; callers only depend on the LocationResult shape and
// the async signature.
import { DISTRICTS_BY_CITY, type CityOption } from '@/lib/turkishGeo';

export type LocationResult = {
  /** Stable local ID, e.g. "tr-istanbul" or "tr-istanbul-kadikoy". */
  id: string;
  kind: 'city' | 'district';
  city: string;
  district: string | null;
  country: 'Turkey';
  /** Display label: "İstanbul, Turkey" / "Kadıköy, İstanbul, Turkey". */
  label: string;
};

// Proper Turkish display names for turkishGeo's ASCII city keys.
const CITY_DISPLAY: Record<CityOption, string> = {
  Istanbul: 'İstanbul',
  Ankara: 'Ankara',
  Izmir: 'İzmir',
  Bursa: 'Bursa',
  Antalya: 'Antalya',
};

export const PREVIEW_COVERAGE_CITIES = Object.values(CITY_DISPLAY);

const FOLD: Record<string, string> = {
  ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ü: 'u', Ü: 'u', ç: 'c', Ç: 'c',
};

/** Case- and Turkish-diacritic-insensitive fold. Replaces Turkish letters
 * BEFORE lowercasing (JS lowercases "İ" to "i" + U+0307) and strips any
 * remaining combining marks. */
export function foldTr(raw: string): string {
  return raw
    .replace(/[şŞğĞıIİöÖüÜçÇ]/g, (ch) => FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(s: string): string {
  return foldTr(s).replace(/[^a-z0-9]+/g, '-');
}

type Entry = LocationResult & { tokens: string[]; name: string };

const CATALOG: Entry[] = (Object.keys(DISTRICTS_BY_CITY) as CityOption[]).flatMap((key) => {
  const city = CITY_DISPLAY[key];
  const cityEntry: Entry = {
    id: `tr-${slug(city)}`,
    kind: 'city',
    city,
    district: null,
    country: 'Turkey',
    label: `${city}, Turkey`,
    name: foldTr(city),
    tokens: foldTr(`${city} Turkey`).split(' '),
  };
  const districts: Entry[] = DISTRICTS_BY_CITY[key].map((district) => ({
    id: `tr-${slug(city)}-${slug(district)}`,
    kind: 'district',
    city,
    district,
    country: 'Turkey',
    label: `${district}, ${city}, Turkey`,
    name: foldTr(district),
    tokens: foldTr(`${district} ${city} Turkey`).split(' '),
  }));
  return [cityEntry, ...districts];
});

function strip({ tokens: _t, name: _n, ...r }: Entry): LocationResult {
  return r;
}

/** Synchronous catalog search (exported for tests). Every query word must be
 * a prefix of some word in the location's label; cities rank first, then
 * results whose own name starts with the query. Empty query → []. */
export function searchCatalog(query: string, limit = 8): LocationResult[] {
  const q = foldTr(query);
  if (!q) return [];
  const words = q.split(' ');
  const hits = CATALOG.filter((e) => words.every((w) => e.tokens.some((t) => t.startsWith(w))));
  hits.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'city' ? -1 : 1;
    const ap = a.name.startsWith(q) ? 0 : 1;
    const bp = b.name.startsWith(q) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.label.localeCompare(b.label, 'tr');
  });
  return hits.slice(0, limit).map(strip);
}

/** Provider seam: the UI calls this. Async so a network provider can drop in. */
export async function searchLocations(query: string): Promise<LocationResult[]> {
  return searchCatalog(query);
}
