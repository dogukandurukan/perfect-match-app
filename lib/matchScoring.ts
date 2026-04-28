import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntentKey } from '@/lib/onboardingIntent';
import { intentsCanMatch } from '@/lib/intentMatching';
import {
  sameCityHardFilter,
  meetingPreferencesMutuallyCompatible,
  languagesHardCompatible,
  districtBonusScore,
  ageDifferenceScore,
  absAgeGapYears,
  type Setup1MatchFields,
} from '@/lib/profileMatching';
import {
  mergeSetup2Sources,
  setup2AnswersScore,
  setup2MaxPossible,
  intentScore,
  type Setup2AnswersFields,
} from '@/lib/setup2Matching';
import { setup3ScoreTotal, religionScore, hobbiesScore, hobbiesOverlapCount, type Setup3Fields } from '@/lib/setup3Matching';
import {
  setup4ScoreTotal,
  availabilityDaysScore,
  availabilityHoursScore,
  meetingEnvironmentScore,
  type Setup4Fields,
} from '@/lib/setup4Matching';
import { SETUP1_MAX_POSSIBLE } from '@/lib/setup1Matching';

/** Denominator used for matchPercentage. */
export const MATCH_SCORE_MAX = 360;

export type MatchProfile = Setup1MatchFields &
  Setup3Fields &
  Setup4Fields & {
    intent: IntentKey;
    setup2_answers?: Setup2AnswersFields | null;
  };

export type SupabaseMatchUser = {
  profiles: Setup1MatchFields &
    Setup3Fields &
    Setup4Fields & {
      // Some flows mirror intent either into `profiles.intent` or only in onboarding_answers.
      intent?: IntentKey | null;
      current_step?: number | null;
      setup_completed?: boolean | null;
    };
  onboarding_answers?: (Setup2AnswersFields & { intent?: IntentKey | null }) | null;
  /** İsteğe bağlı: `setup2_answers` JSON burada dolu, onboarding kolonları boşsa birleştirilir. */
  preferences?: { setup2_answers?: Setup2AnswersFields | null } | null;
};

export type MatchFailureReason =
  | 'incomplete_profile'
  | 'different_city'
  | 'age_gap_too_large'
  | 'gender_mismatch'
  | 'no_common_language'
  | 'intent_mismatch'
  | 'incompatible_lifestyle';

export type MatchResult =
  | {
      ok: false;
      reason: MatchFailureReason;
      rawScore: number | null;
      totalScore: null;
      matchPercentage: null;
    }
  | {
      ok: true;
      rawScore: number;
      clampedScore: number;
      matchPercentage: number;
      matchCategory: string;
      reasons: string[];
      breakdown: {
        setup1: { score: number; maxPossible: typeof SETUP1_MAX_POSSIBLE; penalty: number; normalized: number };
        setup2: { score: number; maxPossible: number; penalty: 0; normalized: number };
        setup3: { score: number; maxPossible: 95; penalty: number; universitySameBonus: boolean; normalized: number };
        setup4: { score: number; maxPossible: 115; penalty: number; isSkipped: boolean; normalized: number };
      };
    };

function normalizeTrText(v: string | null | undefined): string {
  return (v ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function eqNormalized(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeTrText(a);
  const nb = normalizeTrText(b);
  return na.length > 0 && na === nb;
}

function matchCategoryFromPercentage(p: number): string {
  if (p >= 95) return 'Mükemmel uyum';
  if (p >= 65) return 'Harika eşleşme';
  if (p >= 50) return 'İyi eşleşme';
  if (p >= 35) return 'Olası eşleşme';
  if (p >= 20) return 'Keşfet';
  return 'Zayıf eşleşme';
}

function buildMatchReasons(params: {
  setup1District: number;
  intentPts: number;
  setup3Score: number;
  hobbiesPts: number;
  hobbyOverlap: number;
  setup4Score: number;
}): string[] {
  const reasons: string[] = [];
  if (params.setup1District > 0) reasons.push('Aynı semtte yaşıyorsunuz');
  if (params.intentPts === 45) {
    reasons.push('Aynı hedefte buluşuyorsunuz');
  } else if (params.intentPts === 28 || params.intentPts === 20) {
    reasons.push('Benzer hedefleriniz var');
  }
  if (params.setup3Score > 40) reasons.push('Benzer yaşam tarzı');
  if (params.hobbiesPts > 10 && params.hobbyOverlap > 0) {
    reasons.push(`${params.hobbyOverlap} ortak ilgi alanı`);
  }
  if (params.setup4Score > 25) reasons.push('Müsait zamanlarınız örtüşüyor');
  return reasons;
}

function hasSetup4Data(u: Setup4Fields): boolean {
  const anyList =
    u.availability_days != null ||
    u.availability_hours != null ||
    u.meeting_environment != null ||
    u.preferred_locations != null;
  const anyText = !!(u.first_date_expectation && u.first_date_expectation.toString().trim().length > 0) || !!(u.bio && u.bio.toString().trim().length > 0);
  return anyList || anyText;
}

/** Master flow: hard filters -> intent filter -> score sum. */
export function calculateMatchScore(a: MatchProfile, b: MatchProfile, ref?: Date): MatchResult;
export function calculateMatchScore(a: SupabaseMatchUser, b: SupabaseMatchUser, ref?: Date): MatchResult;
export function calculateMatchScore(
  a: MatchProfile | SupabaseMatchUser,
  b: MatchProfile | SupabaseMatchUser,
  ref: Date = new Date()
): MatchResult {
  const isSupabaseUser = (x: MatchProfile | SupabaseMatchUser): x is SupabaseMatchUser =>
    !!x && typeof x === 'object' && 'profiles' in x;

  if (isSupabaseUser(a) && isSupabaseUser(b)) {
    if (!a.onboarding_answers || !b.onboarding_answers) {
      return {
        ok: false,
        reason: 'incomplete_profile',
        rawScore: null,
        totalScore: null,
        matchPercentage: null,
      };
    }
    const profA = a.profiles as Record<string, unknown>;
    const profB = b.profiles as Record<string, unknown>;
    if (profA['setup_completed'] === false || profB['setup_completed'] === false) {
      return {
        ok: false,
        reason: 'incomplete_profile',
        rawScore: null,
        totalScore: null,
        matchPercentage: null,
      };
    }
  }

  const deriveDrinkingSmoking = (profiles: Record<string, unknown>): string | null | undefined => {
    const direct = profiles['drinking_smoking'];
    if (typeof direct === 'string') return direct;

    const drinking = profiles['drinking'];
    const smoking = profiles['smoking'];
    if (typeof drinking !== 'string' || typeof smoking !== 'string') return null;

    // Heuristic bridge for older schema that used `drinking`/`smoking` values.
    if (drinking === 'Socially' || smoking === 'Socially') return 'When socializing';
    if (drinking === 'Yes' && smoking === 'Yes') return 'Both';
    if (drinking === 'Yes' && smoking === 'No') return 'Only drinking';
    if (drinking === 'No' && smoking === 'Yes') return 'Only smoking';
    if (drinking === 'No' && smoking === 'No') return 'Neither';
    return null;
  };

  const mapFromSupabaseUser = (user: SupabaseMatchUser): MatchProfile => {
    const profiles = user.profiles as Record<string, unknown>;
    const onboarding = user.onboarding_answers as (Setup2AnswersFields & { intent?: IntentKey | null }) | null | undefined;

    const intentResolved = (onboarding?.intent ?? profiles['intent'] ?? 'not_sure_yet') as IntentKey;

    const { intent: _ignoredIntent, ...onboardingRest } = (onboarding ?? {}) as {
      intent?: IntentKey | null;
    } & Setup2AnswersFields &
      Record<string, unknown>;

    const setup2Answers = mergeSetup2Sources(
      onboardingRest,
      user.preferences?.setup2_answers ?? undefined,
    );

    return {
      // Setup-1
      city: profiles['city'] as Setup1MatchFields['city'],
      district: profiles['district'] as Setup1MatchFields['district'],
      date_of_birth: profiles['date_of_birth'] as Setup1MatchFields['date_of_birth'],
      gender: profiles['gender'] as Setup1MatchFields['gender'],
      meeting_preferences: profiles['meeting_preferences'] as Setup1MatchFields['meeting_preferences'],
      languages: profiles['languages'] as Setup1MatchFields['languages'],

      // Setup-3
      morning_night: profiles['morning_night'] as Setup3Fields['morning_night'],
      recharge_style: profiles['recharge_style'] as Setup3Fields['recharge_style'],
      hobbies: profiles['hobbies'] as Setup3Fields['hobbies'],
      drinking_smoking: deriveDrinkingSmoking(profiles) as Setup3Fields['drinking_smoking'],
      education: profiles['education'] as Setup3Fields['education'],
      education_detail: profiles['education_detail'] as Setup3Fields['education_detail'],
      religion: profiles['religion'] as Setup3Fields['religion'],

      // Setup-4
      availability_days: profiles['availability_days'] as Setup4Fields['availability_days'],
      availability_hours: profiles['availability_hours'] as Setup4Fields['availability_hours'],
      meeting_environment: profiles['meeting_environment'] as Setup4Fields['meeting_environment'],
      preferred_locations: profiles['preferred_locations'] as Setup4Fields['preferred_locations'],
      first_date_expectation: profiles['first_date_expectation'] as Setup4Fields['first_date_expectation'],
      bio: profiles['bio'] as Setup4Fields['bio'],

      // Setup-2 + intent
      intent: intentResolved,
      setup2_answers: setup2Answers,
    };
  };

  const matchA = isSupabaseUser(a) ? mapFromSupabaseUser(a) : a;
  const matchB = isSupabaseUser(b) ? mapFromSupabaseUser(b) : b;

  // Sert filtreler: önce konum, yaş (10+), gender/meeting, dil.
  if (!sameCityHardFilter(matchA.city, matchB.city)) {
    return { ok: false, reason: 'different_city', rawScore: null, totalScore: null, matchPercentage: null };
  }

  const ageGapYears = absAgeGapYears(matchA.date_of_birth, matchB.date_of_birth, ref);
  if (ageGapYears != null && ageGapYears >= 10) {
    return { ok: false, reason: 'age_gap_too_large', rawScore: null, totalScore: null, matchPercentage: null };
  }

  if (!meetingPreferencesMutuallyCompatible(matchA.gender, matchA.meeting_preferences, matchB.gender, matchB.meeting_preferences)) {
    return { ok: false, reason: 'gender_mismatch', rawScore: null, totalScore: null, matchPercentage: null };
  }

  if (!languagesHardCompatible(matchA.languages, matchB.languages)) {
    return { ok: false, reason: 'no_common_language', rawScore: null, totalScore: null, matchPercentage: null };
  }

  // Intent filtresi.
  if (!intentsCanMatch(matchA.intent, matchB.intent)) {
    return { ok: false, reason: 'intent_mismatch', rawScore: null, totalScore: null, matchPercentage: null };
  }

  // Setup-1
  const setup1District = districtBonusScore(matchA.district, matchB.district);
  const setup1Age = ageDifferenceScore(matchA.date_of_birth, matchB.date_of_birth, ref);
  const setup1Score = setup1District + setup1Age;

  // Setup-2
  const setup2Score = setup2AnswersScore(
    matchA.intent,
    matchA.setup2_answers ?? {},
    matchB.intent,
    matchB.setup2_answers ?? {}
  );
  const intentPts = intentScore(matchA.intent, matchB.intent);

  // Setup-3
  const setup3Score = setup3ScoreTotal(matchA, matchB);
  const hobbiesPts = hobbiesScore(matchA.hobbies ?? null, matchB.hobbies ?? null);
  const hobbyOverlap = hobbiesOverlapCount(matchA.hobbies ?? null, matchB.hobbies ?? null);
  const universitySameBonus =
    !!matchA.education &&
    !!matchB.education &&
    matchA.education === matchB.education &&
    eqNormalized(matchA.education_detail, matchB.education_detail);
  const religionPenalty = religionScore(matchA.religion, matchB.religion);
  const setup3Penalty = setup3Score < 0 ? setup3Score : religionPenalty < 0 ? religionPenalty : 0;

  // Setup-4
  const setup4Score = setup4ScoreTotal(matchA, matchB);
  const isSkipped = !hasSetup4Data(matchA) && !hasSetup4Data(matchB);
  const daysScore = availabilityDaysScore(matchA.availability_days, matchB.availability_days);
  const hoursScore = availabilityHoursScore(matchA.availability_hours, matchB.availability_hours);
  const envScore = meetingEnvironmentScore(matchA.meeting_environment, matchB.meeting_environment);
  const rawPenaltySum =
    (daysScore < 0 ? daysScore : 0) + (hoursScore < 0 ? hoursScore : 0) + (envScore < 0 ? envScore : 0);

  const setup4Penalty = isSkipped ? 0 : setup4Score < 0 ? setup4Score : rawPenaltySum;

  const rawScore = setup1Score + setup2Score + setup3Score + setup4Score;

  // rawScore < 0 => incompatible lifestyle.
  if (rawScore < 0) {
    return {
      ok: false,
      reason: 'incompatible_lifestyle',
      rawScore,
      totalScore: null,
      matchPercentage: null,
    };
  }

  const clampedScore = Math.max(0, rawScore);

  const setup2Max = setup2MaxPossible(matchA.intent, matchB.intent);
  const s1 = Math.min(100, (Math.max(0, setup1Score) / SETUP1_MAX_POSSIBLE) * 100);
  const s2 = setup2Max > 0 ? Math.min(100, (Math.max(0, setup2Score) / setup2Max) * 100) : 0;
  const s3 = Math.min(100, (Math.max(0, setup3Score) / 95) * 100);
  const s4 = Math.min(100, (Math.max(0, setup4Score) / 115) * 100);

  let matchPercentage: number;
  if (isSkipped) {
    matchPercentage = Math.round(s1 * 0.15 + s2 * 0.45 + s3 * 0.4);
  } else {
    matchPercentage = Math.round(s1 * 0.1 + s2 * 0.35 + s3 * 0.3 + s4 * 0.25);
  }
  matchPercentage = Math.min(100, matchPercentage);

  if (matchPercentage >= 95) {
    const maxAltSub = setup2Max - intentPts;
    const subNorm =
      maxAltSub > 0 ? Math.min(100, (Math.max(0, setup2Score - intentPts) / maxAltSub) * 100) : 0;
    const cond1 = subNorm >= 50;
    const cond2 = s3 >= 45;
    const cond3 = setup1Score >= 0;
    const cond4 = isSkipped || s4 >= 30;
    if (!(cond1 && cond2 && cond3 && cond4)) {
      matchPercentage = 94;
    }
  }

  const matchCategory = matchCategoryFromPercentage(matchPercentage);
  const reasons = buildMatchReasons({
    setup1District,
    intentPts,
    setup3Score,
    hobbiesPts,
    hobbyOverlap,
    setup4Score,
  });

  return {
    ok: true,
    rawScore,
    clampedScore,
    matchPercentage,
    matchCategory,
    reasons,
    breakdown: {
      setup1: {
        score: setup1Score,
        maxPossible: SETUP1_MAX_POSSIBLE,
        penalty: setup1Age < 0 ? setup1Age : 0,
        normalized: s1,
      },
      setup2: {
        score: setup2Score,
        maxPossible: setup2Max,
        penalty: 0,
        normalized: s2,
      },
      setup3: {
        score: setup3Score,
        maxPossible: 95,
        penalty: setup3Penalty,
        universitySameBonus,
        normalized: s3,
      },
      setup4: {
        score: setup4Score,
        maxPossible: 115,
        penalty: setup4Penalty,
        isSkipped,
        normalized: s4,
      },
    },
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
      total_score: result.clampedScore,
      raw_total_score: result.rawScore,
      match_percentage: result.matchPercentage,
      breakdown: result.breakdown,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_a_id,user_b_id' }
  );
  if (error) throw error;
  return { ok: true, result };
}
