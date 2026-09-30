import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { allowedDevTestEmail, resolveBackend, type BackendExtra } from './backendConfig';

// Explicitly selected backend — see lib/backendConfig.ts. No fallback to live.
const extra = Constants.expoConfig?.extra as { backend?: BackendExtra } | undefined;
const resolved = resolveBackend(extra?.backend);
if (!resolved.ok) {
  throw new Error(`[backend] ${resolved.reason}`);
}

export const backend = { env: resolved.env, projectRef: resolved.projectRef } as const;

/** V2 live onboarding + V2 Home are enabled only on the explicitly chosen
 * development backends (dev = perfect-match-dev per the 2026-09-30 decision,
 * or a separate test project) — never with TEMPA_BACKEND=live. */
export const v2Enabled = resolved.env === 'dev' || resolved.env === 'test';

/** DEV-only test sign-in target (set by scripts/dev-backend/start-app.sh):
 * only in development builds, only on a dev/test backend, only a
 * @tempa-test.example.com address. Sign-in still needs a real one-time code. */
export const devTestEmail: string | null =
  __DEV__ && v2Enabled ? allowedDevTestEmail(extra?.backend) : null;

export const supabase = createClient(resolved.url, resolved.anonKey, {
  auth: {
    storage: AsyncStorage,
    // Session per environment + project: never reuse a live session on the
    // test project (or the other way round). Live/dev keep supabase-js's default
    // key so existing sessions are not signed out. The key must be OMITTED, not
    // set to undefined: an explicit `storageKey: undefined` overrides the
    // default, and AsyncStorage then reads/writes the session under an
    // undefined key — on the phone the sign-in/sign-up hung right after the
    // server returned 200 (2026-09-30).
    ...(resolved.env === 'test' ? { storageKey: `tempa-test-${resolved.projectRef}-auth` } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
