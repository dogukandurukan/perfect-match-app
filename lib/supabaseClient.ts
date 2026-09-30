import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { resolveBackend, type BackendExtra } from './backendConfig';

// Explicitly selected backend — see lib/backendConfig.ts. No fallback to live.
const extra = Constants.expoConfig?.extra as { backend?: BackendExtra } | undefined;
const resolved = resolveBackend(extra?.backend);
if (!resolved.ok) {
  throw new Error(`[backend] ${resolved.reason}`);
}

export const backend = { env: resolved.env, projectRef: resolved.projectRef } as const;

export const supabase = createClient(resolved.url, resolved.anonKey, {
  auth: {
    storage: AsyncStorage,
    // Session per environment + project: never reuse a live session on the
    // test project (or the other way round). Live keeps supabase-js's default
    // key so existing live sessions are not signed out.
    storageKey: resolved.env === 'live' ? undefined : `tempa-test-${resolved.projectRef}-auth`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
