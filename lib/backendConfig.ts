// Explicit backend selection (P0 test environment, 2026-09-30).
//
// The app talks to exactly one Supabase project, chosen explicitly:
//   TEMPA_BACKEND=dev   → perfect-match-dev as the V2 DEVELOPMENT target (owner
//                         decision 2026-09-30: not released, no real users; no
//                         separate test project). Enables the V2 entry + V2 Home.
//   TEMPA_BACKEND=live  → the same project with production behaviour (V1 flows)
//   TEMPA_BACKEND=test  → TEMPA_TEST_SUPABASE_URL + TEMPA_TEST_SUPABASE_ANON_KEY
// read by app.config.js into `extra.backend`. There is NO default and NO
// fallback: a missing, unknown or incomplete test configuration is an error
// (the app refuses to start) — it never silently connects to live.
// EAS production builds pin `live` in app.config.js.
//
// Pure module (no React Native imports) so it is testable in Node:
// scripts/p0-checks/backend_config.check.mjs.

export const LIVE_PROJECT_REF = 'fyqwjduzpnjuxqsloxih';
// Another project in the same Supabase account that is NOT Tempa's (AI HQ).
const NOT_TEMPA_REFS = ['eiytdoquxlpjvquxmgsp'];
export const LIVE_SUPABASE_URL = `https://${LIVE_PROJECT_REF}.supabase.co`;
// Public (anon/publishable) key — ships in every app bundle by design.
export const LIVE_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cXdqZHV6cG5qdXhxc2xveGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjQ2NjgsImV4cCI6MjA4ODc0MDY2OH0.Ko1MMTYTFnI4HW7ZMLqJnVKTg7-GjQOhfSx4kSQBm8k';

export type BackendExtra = {
  env?: string | null;
  testUrl?: string | null;
  testAnonKey?: string | null;
};

export type BackendConfig =
  | { ok: true; env: 'live' | 'dev' | 'test'; url: string; anonKey: string; projectRef: string }
  | { ok: false; reason: string };

const URL_RE = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;

function jwtClaim(key: string, claim: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } }).Buffer?.from(
            padded,
            'base64',
          ).toString('utf8') ?? '';
    const v = (JSON.parse(json) as Record<string, unknown>)[claim];
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function resolveBackend(extra: BackendExtra | null | undefined): BackendConfig {
  const env = extra?.env?.trim();
  if (!env) {
    return { ok: false, reason: 'TEMPA_BACKEND is not set. Start Metro with TEMPA_BACKEND=live or TEMPA_BACKEND=test.' };
  }
  if (env === 'live' || env === 'dev') {
    return { ok: true, env, url: LIVE_SUPABASE_URL, anonKey: LIVE_SUPABASE_ANON_KEY, projectRef: LIVE_PROJECT_REF };
  }
  if (env !== 'test') {
    return { ok: false, reason: `TEMPA_BACKEND="${env}" is not "dev", "test" or "live".` };
  }
  const url = extra?.testUrl?.trim() ?? '';
  const key = extra?.testAnonKey?.trim() ?? '';
  const m = URL_RE.exec(url);
  if (!m) return { ok: false, reason: 'TEMPA_TEST_SUPABASE_URL is missing or not https://<ref>.supabase.co.' };
  const ref = m[1];
  if (ref === LIVE_PROJECT_REF) {
    return { ok: false, reason: 'TEMPA_TEST_SUPABASE_URL points at the LIVE project. Use the separate test project.' };
  }
  if (NOT_TEMPA_REFS.includes(ref)) {
    return { ok: false, reason: 'TEMPA_TEST_SUPABASE_URL points at a project that is not Tempa (AI HQ).' };
  }
  if (!key) return { ok: false, reason: 'TEMPA_TEST_SUPABASE_ANON_KEY is missing.' };
  if (key.startsWith('sb_secret_')) {
    return { ok: false, reason: 'TEMPA_TEST_SUPABASE_ANON_KEY is a SECRET key. Use the anon / publishable key.' };
  }
  if (!key.startsWith('sb_publishable_')) {
    const role = jwtClaim(key, 'role');
    const keyRef = jwtClaim(key, 'ref');
    if (role !== 'anon') return { ok: false, reason: 'TEMPA_TEST_SUPABASE_ANON_KEY is not an anon key.' };
    if (keyRef !== ref) return { ok: false, reason: 'TEMPA_TEST_SUPABASE_ANON_KEY belongs to a different project than the URL.' };
  }
  if (key === LIVE_SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'TEMPA_TEST_SUPABASE_ANON_KEY is the LIVE key.' };
  }
  return { ok: true, env: 'test', url: `https://${ref}.supabase.co`, anonKey: key, projectRef: ref };
}
