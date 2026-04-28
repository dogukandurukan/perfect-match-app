import type { IntentKey } from '@/lib/onboardingIntent';

/**
 * Pool-based intent compatibility for matching (Profile Setup v5+).
 * @see matching table: not_sure_yet matches everyone; others match same intent + not_sure_yet.
 */
export function intentsCanMatch(a: IntentKey, b: IntentKey): boolean {
  if (a === 'sports_partner' || b === 'sports_partner') return a === 'sports_partner' && b === 'sports_partner';
  if (a === 'not_sure_yet' || b === 'not_sure_yet') return true;
  return a === b;
}

/**
 * Intent score table:
 * - same explicit intent: +20
 * - explicit + not_sure_yet: +10
 * - not_sure_yet + not_sure_yet: +15
 */
export function intentPairScore(a: IntentKey, b: IntentKey): number {
  if (a === 'sports_partner' || b === 'sports_partner') {
    return a === 'sports_partner' && b === 'sports_partner' ? 20 : 0;
  }
  if (a === 'not_sure_yet' && b === 'not_sure_yet') return 15;
  if (a === b) return 20;
  if (a === 'not_sure_yet' || b === 'not_sure_yet') return 10;
  return 0;
}
