// Screen: Intent tipleri ve normalize | Status: stable | Last updated: Mayıs 2026
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_INTENT_STORAGE_KEY = 'onboarding_intent_v1';

export type IntentKey =
  | 'just_friends'
  | 'keeping_it_casual'
  | 'open_to_relationship'
  | 'not_sure_yet'
  | 'sports_partner';

/** Maps UI labels to persisted intent keys */
export function mapOnboardingLabelToIntent(label: string): IntentKey {
  const map: Record<string, IntentKey> = {
    'Just friends': 'just_friends',
    'Keeping it casual': 'keeping_it_casual',
    'Open to a relationship': 'open_to_relationship',
    'Not sure yet': 'not_sure_yet',
    'Spor partneri': 'sports_partner',
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
    v === 'not_sure_yet' ||
    v === 'sports_partner'
  ) {
    return v;
  }
  return null;
}

export async function savePendingIntent(intent: IntentKey): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_INTENT_STORAGE_KEY, intent);
}

export async function getPendingIntent(): Promise<IntentKey | null> {
  const v = await AsyncStorage.getItem(ONBOARDING_INTENT_STORAGE_KEY);
  if (!v) return null;
  return normalizeIntentKey(v);
}
