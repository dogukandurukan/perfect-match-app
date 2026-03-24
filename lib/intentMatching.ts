import type { IntentKey } from '@/lib/onboardingIntent';

/**
 * Pool-based intent compatibility for matching (Profile Setup v5+).
 * @see matching table: not_sure_yet matches everyone; others match same intent + not_sure_yet.
 */
export function intentsCanMatch(a: IntentKey, b: IntentKey): boolean {
  if (a === 'not_sure_yet' || b === 'not_sure_yet') return true;
  return a === b;
}
