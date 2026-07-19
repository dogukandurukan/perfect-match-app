import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabaseClient';

function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => {
      out[key] = value;
    });
  }

  try {
    const parsed = Linking.parse(url);
    const query = parsed.queryParams;
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (typeof value === 'string') out[key] = value;
        else if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0];
      }
    }
  } catch {
    // ignore parse errors
  }

  return out;
}

/** Apply Supabase session tokens (or PKCE code) from an auth redirect URL. */
export async function applySessionFromUrl(url: string): Promise<void> {
  if (!url) return;

  const params = paramsFromUrl(url);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;

  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
    return;
  }

  const code = params.code;
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
}

/** Subscribe to initial + subsequent auth deep links. Returns unsubscribe. */
export function subscribeAuthDeepLinks(onUrl: (url: string) => void): () => void {
  let cancelled = false;

  void Linking.getInitialURL().then((url) => {
    if (!cancelled && url) onUrl(url);
  });

  const subscription = Linking.addEventListener('url', ({ url }) => {
    onUrl(url);
  });

  return () => {
    cancelled = true;
    subscription.remove();
  };
}
