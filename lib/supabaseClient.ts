// Screen: Supabase istemci | Status: stable | Last updated: Mayıs 2026
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

type ExtraConfig = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

const extra: ExtraConfig =
  (Constants.expoConfig?.extra as ExtraConfig | undefined) ??
  ((Constants as any).manifestExtra as ExtraConfig | undefined) ??
  {};

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set or empty.', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
