/**
 * Place search for the "Plan a date" Place step (2026-09-19).
 *
 * Investigated BEFORE writing any UI (grepped the whole repo for
 * GOOGLE_PLACES/PLACES_API/MAPS_API_KEY, checked app.json/eas.json, checked
 * for a `.env*` file, checked package.json for a Places SDK, checked
 * `supabase/functions/` for a places proxy): there is NO Google Places/Maps
 * API key anywhere in this project, no Places SDK dependency (only
 * `react-native-maps`, used by the unrelated Map tab), no Edge Function for
 * it, and no billing configured. Wiring a full Places Autocomplete call
 * chain (session tokens, debounce, TR/Istanbul bias, Place Details fetch,
 * `Powered by Google` attribution) against a service that cannot actually
 * be reached here would not be testable and would risk shipping something
 * that LOOKS integrated but silently does nothing — so this file only ships
 * the real, working LOCAL fallback below, plus the exact contract a real
 * Google-backed provider would need to satisfy to slot in as
 * `googlePlacesSearch` without touching any UI code.
 *
 * The local fallback is genuinely two different kinds of result — it says
 * so, it doesn't pretend to be live business data:
 * - `venue` — a real row from the app's own `venues` table (10 real cafés
 *   today, matched by name or district).
 * - `area` — a district-level match from `lib/turkishGeo.ts`'s static list
 *   (Istanbul only, e.g. "Kadıköy"). There is no neighbourhood-level data
 *   anywhere in this project (`profiles.neighborhoods` exists as a column
 *   but is never written to — see CLAUDE.md) — so a query like "Moda" will
 *   NOT resolve to an area result here; only real `venues` rows happen to
 *   mention it as a district value. This is a real data gap, not a bug.
 *
 * To wire a real Google Places provider later:
 * 1. `EXPO_PUBLIC_GOOGLE_PLACES_ENABLED` (or simply the presence of a
 *    working proxy below) is what `GOOGLE_PLACES_CONFIGURED` should key
 *    off — never ship a raw Places API key in the client bundle.
 * 2. Add a Supabase Edge Function (e.g. `search-places`) that holds the
 *    real key as a Supabase secret (`supabase secrets set
 *    GOOGLE_PLACES_API_KEY=...`) and proxies Autocomplete + Place Details
 *    calls server-side — mirrors this project's existing pattern for
 *    anything requiring a private key (`send-push-notification`,
 *    `delete-account`).
 * 3. Call it with a per-search-session token (new session token on Place
 *    step mount, reused across keystrokes, discarded after a Place Details
 *    call), ~300ms debounce, `minLength=2`, `components=country:tr`, and a
 *    `locationBias` centered on Istanbul (and, if both people's districts
 *    are known, biased toward whichever is shared).
 * 4. Implement `googlePlacesSearch(query, sessionToken)` below with that
 *    shape and flip `GOOGLE_PLACES_CONFIGURED` to check for real
 *    availability (e.g. a successful ping, or an env flag set after the
 *    secret exists) — the Place step already renders the `Powered by
 *    Google` attribution row whenever ANY result in the list has
 *    `source: 'google'`, so no UI change would be needed.
 */
import { supabase } from '@/lib/supabaseClient';
import { DISTRICTS_BY_CITY, normalizeTr } from '@/lib/turkishGeo';

export type PlaceSearchResult = {
  id: string;
  source: 'venue' | 'area' | 'google';
  name: string;
  district: string | null;
  city: string | null;
  /** Venue category glyph (from `venues.emoji`) — null for area/google results. */
  emoji: string | null;
};

/** No real Google integration exists yet (see file docstring) — always
 * false in this build. Kept as an exported flag (not a hardcoded `false`
 * inline) so the Place step's "Powered by Google" row and any future
 * provider swap have exactly one place to read from. */
export const GOOGLE_PLACES_CONFIGURED = false;

/** Real search over the `venues` table (name or district) + the static
 * Istanbul district list. Real data only — no fabricated business results. */
export async function searchPlacesLocal(query: string): Promise<PlaceSearchResult[]> {
  const q = normalizeTr(query);
  if (q.length < 2) return [];

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, district, city, emoji')
    .eq('is_active', true);

  const venueResults: PlaceSearchResult[] = (venues ?? [])
    .filter(
      (v) =>
        normalizeTr(v.name ?? '').includes(q) || (v.district ? normalizeTr(v.district).includes(q) : false),
    )
    .map((v) => ({
      id: `venue-${v.id}`,
      source: 'venue' as const,
      name: v.name,
      district: v.district ?? null,
      city: v.city ?? null,
      emoji: v.emoji ?? null,
    }));

  const areaResults: PlaceSearchResult[] = DISTRICTS_BY_CITY.Istanbul.filter((d) => normalizeTr(d).includes(q))
    .slice(0, 5)
    .map((d) => ({
      id: `area-${d}`,
      source: 'area' as const,
      name: d,
      district: d,
      city: 'Istanbul',
      emoji: null,
    }));

  // Venues (concrete, bookable places) before areas (a district is a
  // starting point, not a place to actually meet at).
  return [...venueResults, ...areaResults].slice(0, 8);
}

/** See the "To wire a real Google Places provider later" steps above —
 * not implemented, `GOOGLE_PLACES_CONFIGURED` is `false` so this is never
 * called; kept as a documented stub so a future session has the exact
 * shape to fill in instead of inventing a new contract from scratch. */
export async function searchPlacesGoogle(
  _query: string,
  _sessionToken: string,
): Promise<PlaceSearchResult[]> {
  return [];
}

export async function searchPlaces(query: string, sessionToken: string): Promise<PlaceSearchResult[]> {
  if (GOOGLE_PLACES_CONFIGURED) return searchPlacesGoogle(query, sessionToken);
  return searchPlacesLocal(query);
}
