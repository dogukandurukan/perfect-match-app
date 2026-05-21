// Screen: Auth deep link oturumu | Status: stable | Last updated: Mayıs 2026
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabaseClient';

/** Parse access/refresh tokens from Supabase auth redirect URLs (hash or query). */
export function parseAuthTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  let part = '';
  if (hashIdx >= 0) part = url.slice(hashIdx + 1);
  else if (queryIdx >= 0) part = url.slice(queryIdx + 1);
  if (!part) return {};
  const params = new URLSearchParams(part);
  return {
    access_token: params.get('access_token') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
  };
}

/** Apply Supabase session from email confirmation / password recovery deep links. */
export async function applySessionFromUrl(url: string | null): Promise<void> {
  if (!url) return;
  const { access_token, refresh_token } = parseAuthTokensFromUrl(url);
  if (!access_token || !refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) console.warn('setSession from deep link failed', error.message);
}

export function subscribeAuthDeepLinks(onUrl: (url: string) => void) {
  Linking.getInitialURL().then((url) => {
    if (url) onUrl(url);
  });
  const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
  return () => sub.remove();
}
