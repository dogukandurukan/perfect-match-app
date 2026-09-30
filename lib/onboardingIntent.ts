// Screen: Intent tipleri ve normalize | Status: stable | Last updated: Mayıs 2026
import AsyncStorage from '@react-native-async-storage/async-storage';

import { backend } from './supabaseClient';

export const ONBOARDING_INTENT_STORAGE_KEY = 'onboarding_intent_v1';

export type IntentKey =
  | 'just_friends'
  | 'keeping_it_casual'
  | 'open_to_relationship'
  | 'not_sure_yet';

/** Maps UI labels to persisted intent keys */
export function mapOnboardingLabelToIntent(label: string): IntentKey {
  const map: Record<string, IntentKey> = {
    'Just friends': 'just_friends',
    'Something casual': 'keeping_it_casual',
    'Open to something real': 'open_to_relationship',
    'Figuring it out': 'not_sure_yet',
    // legacy labels
    'Keeping it casual': 'keeping_it_casual',
    'Open to a relationship': 'open_to_relationship',
    'Not sure yet': 'not_sure_yet',
  };
  return map[label] ?? 'not_sure_yet';
}

/** Migrate legacy DB / storage values to current intent keys */
export function normalizeIntentKey(v: string): IntentKey | null {
  if (v === 'something_serious' || v === 'life_partner') return 'open_to_relationship';
  if (
    v === 'just_friends' ||
    v === 'keeping_it_casual' ||
    v === 'open_to_relationship' ||
    v === 'not_sure_yet'
  ) {
    return v;
  }
  return null;
}

// Local drafts are kept per backend so a test-project session never reads a
// live draft (or the other way round). Live keeps the original key.
function intentStorageKey(): string {
  return backend.env === 'live' ? ONBOARDING_INTENT_STORAGE_KEY : `${ONBOARDING_INTENT_STORAGE_KEY}:test:${backend.projectRef}`;
}

export async function savePendingIntent(intent: IntentKey): Promise<void> {
  await AsyncStorage.setItem(intentStorageKey(), intent);
}

export async function getPendingIntent(): Promise<IntentKey | null> {
  const v = await AsyncStorage.getItem(intentStorageKey());
  if (!v) return null;
  return normalizeIntentKey(v);
}
