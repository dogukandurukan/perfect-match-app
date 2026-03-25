import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntentKey } from '@/lib/onboardingIntent';
import { intentsCanMatch } from '@/lib/intentMatching';
import { setup1HardFiltersPass, setup1ScoreTotal, type Setup1MatchFields } from '@/lib/profileMatching';
import { setup2AnswersScore, type Setup2AnswersFields } from '@/lib/setup2Matching';
import { setup3ScoreTotal, type Setup3Fields } from '@/lib/setup3Matching';
import { setup4ScoreTotal, type Setup4Fields } from '@/lib/setup4Matching';

/** Max possible total match score (sub-scores may sum higher; we cap here). */
export const MATCH_SCORE_MAX = 360;

export type MatchProfile = Setup1MatchFields &
  Setup3Fields &
  Setup4Fields & {
    intent: IntentKey;
    setup2_answers?: Setup2AnswersFields | null;
  };

export type MatchResult =
  | { ok: false; reason: 'hard_filter_failed' | 'intent_incompatible'; totalScore: null }
  | {
      ok: true;
      /** Sum of setup scores before cap. */
      rawTotalScore: number;
      /** min(rawTotalScore, MATCH_SCORE_MAX). */
      totalScore: number;
      /** Math.round((totalScore / MATCH_SCORE_MAX) * 100), 0–100. */
      matchPercentage: number;
      breakdown: {
        setup1: number;
        setup2: number;
        setup3: number;
        setup4: number;
      };
    };

/** Master flow: hard filters -> intent filter -> score sum. */
export function calculateMatchScore(a: MatchProfile, b: MatchProfile, ref: Date = new Date()): MatchResult {
  if (!setup1HardFiltersPass(a, b)) return { ok: false, reason: 'hard_filter_failed', totalScore: null };
  if (!intentsCanMatch(a.intent, b.intent)) return { ok: false, reason: 'intent_incompatible', totalScore: null };

  const setup1 = setup1ScoreTotal(a, b, ref);
  const setup2 = setup2AnswersScore(a.intent, a.setup2_answers ?? {}, b.intent, b.setup2_answers ?? {});
  const setup3 = setup3ScoreTotal(a, b);
  const setup4 = setup4ScoreTotal(a, b);
  const rawTotalScore = setup1 + setup2 + setup3 + setup4;
  const totalScore = Math.min(rawTotalScore, MATCH_SCORE_MAX);
  const matchPercentage = Math.round((totalScore / MATCH_SCORE_MAX) * 100);
  return {
    ok: true,
    rawTotalScore,
    totalScore,
    matchPercentage,
    breakdown: { setup1, setup2, setup3, setup4 },
  };
}

type OkMatch = Extract<MatchResult, { ok: true }>;

/**
 * Computes the pair score and upserts `match_pair_scores` (canonical order: smaller id first).
 * Call when you want the cached score + percentage in the DB (e.g. after a swipe/match flow).
 */
export async function persistMatchPairScore(
  supabase: SupabaseClient,
  userAId: string,
  userBId: string,
  a: MatchProfile,
  b: MatchProfile,
  ref: Date = new Date()
): Promise<{ ok: false; result: MatchResult } | { ok: true; result: OkMatch }> {
  const result = calculateMatchScore(a, b, ref);
  if (!result.ok) return { ok: false, result };

  const [user_a_id, user_b_id] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  const { error } = await supabase.from('match_pair_scores').upsert(
    {
      user_a_id,
      user_b_id,
      total_score: result.totalScore,
      raw_total_score: result.rawTotalScore,
      match_percentage: result.matchPercentage,
      breakdown: result.breakdown,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_a_id,user_b_id' }
  );
  if (error) throw error;
  return { ok: true, result };
}
