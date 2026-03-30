import { createClient } from '@supabase/supabase-js';
import { calculateMatchScore, type MatchProfile, type MatchResult } from './lib/matchScoring';
import type { IntentKey } from './lib/onboardingIntent';
import {
  mergeSetup2Sources,
  setup2PairScore,
  intentScore,
  setup2MaxPossible,
  type Setup2AnswersFields,
} from './lib/setup2Matching';
import { districtBonusScore, ageDifferenceScore } from './lib/profileMatching';
import {
  morningNightScore,
  rechargeStyleScore,
  hobbiesScore,
  hobbiesOverlapCount,
  educationScore,
  religionScore,
} from './lib/setup3Matching';
import {
  availabilityDaysScore,
  availabilityHoursScore,
  meetingEnvironmentScore,
  firstDateExpectationScore,
  preferredLocationsScore,
  bioPairBonusScore,
} from './lib/setup4Matching';
import { SETUP1_MAX_POSSIBLE } from './lib/setup1Matching';
import { calculateAge } from './lib/zodiac';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
  district?: string | null;
  date_of_birth?: string | null;
  intent?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  [k: string]: unknown;
};

type OnboardingAnswersRow = Setup2AnswersFields & {
  user_id: string;
  intent?: string | null;
  [k: string]: unknown;
};

type MatchUser = {
  profiles: ProfileRow;
  onboarding_answers?: OnboardingAnswersRow | null;
};

function deriveDrinkingSmoking(profiles: Record<string, unknown>): string | null | undefined {
  const direct = profiles['drinking_smoking'];
  if (typeof direct === 'string') return direct;

  const drinking = profiles['drinking'];
  const smoking = profiles['smoking'];
  if (typeof drinking !== 'string' || typeof smoking !== 'string') return null;

  if (drinking === 'Socially' || smoking === 'Socially') return 'When socializing';
  if (drinking === 'Yes' && smoking === 'Yes') return 'Both';
  if (drinking === 'Yes' && smoking === 'No') return 'Only drinking';
  if (drinking === 'No' && smoking === 'Yes') return 'Only smoking';
  if (drinking === 'No' && smoking === 'No') return 'Neither';
  return null;
}

function mapUserToProfile(user: MatchUser): MatchProfile {
  const profiles = user.profiles as Record<string, unknown>;
  const onboarding = user.onboarding_answers as (Setup2AnswersFields & { intent?: IntentKey | null }) | null | undefined;

  const intentResolved = (onboarding?.intent ?? profiles['intent'] ?? 'not_sure_yet') as IntentKey;

  const { intent: _ignoredIntent, ...onboardingRest } = (onboarding ?? {}) as {
    intent?: IntentKey | null;
  } & Setup2AnswersFields &
    Record<string, unknown>;

  const setup2Answers = mergeSetup2Sources(onboardingRest, undefined);

  return {
    city: profiles['city'] as MatchProfile['city'],
    district: profiles['district'] as MatchProfile['district'],
    date_of_birth: profiles['date_of_birth'] as MatchProfile['date_of_birth'],
    gender: profiles['gender'] as MatchProfile['gender'],
    meeting_preferences: profiles['meeting_preferences'] as MatchProfile['meeting_preferences'],
    languages: profiles['languages'] as MatchProfile['languages'],
    morning_night: profiles['morning_night'] as MatchProfile['morning_night'],
    recharge_style: profiles['recharge_style'] as MatchProfile['recharge_style'],
    hobbies: profiles['hobbies'] as MatchProfile['hobbies'],
    drinking_smoking: deriveDrinkingSmoking(profiles) as MatchProfile['drinking_smoking'],
    education: profiles['education'] as MatchProfile['education'],
    education_detail: profiles['education_detail'] as MatchProfile['education_detail'],
    religion: profiles['religion'] as MatchProfile['religion'],
    availability_days: profiles['availability_days'] as MatchProfile['availability_days'],
    availability_hours: profiles['availability_hours'] as MatchProfile['availability_hours'],
    meeting_environment: profiles['meeting_environment'] as MatchProfile['meeting_environment'],
    preferred_locations: profiles['preferred_locations'] as MatchProfile['preferred_locations'],
    first_date_expectation: profiles['first_date_expectation'] as MatchProfile['first_date_expectation'],
    bio: profiles['bio'] as MatchProfile['bio'],
    intent: intentResolved,
    setup2_answers: setup2Answers,
  };
}

function parseDob(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageDiffYears(dobA: string | null | undefined, dobB: string | null | undefined, ref: Date): number | null {
  const da = parseDob(dobA);
  const db = parseDob(dobB);
  if (!da || !db) return null;
  return Math.abs(calculateAge(da, ref) - calculateAge(db, ref));
}

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

function setup4OverlapCount(
  a: string | string[] | null | undefined,
  b: string | string[] | null | undefined,
): number {
  const toStringArray = (v: string | string[] | null | undefined): string[] => {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    return [v];
  };
  const normalizeList = (values: string | string[] | null | undefined): string[] =>
    [
      ...new Set(
        toStringArray(values)
          .map((v) =>
            v
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, ''),
          )
          .filter(Boolean),
      ),
    ];
  const aa = normalizeList(a);
  const bb = new Set(normalizeList(b));
  return aa.filter((x) => bb.has(x)).length;
}

function pairTag(pts: number): string {
  if (pts === 12) return 'aynı ✓';
  if (pts === 6) return 'yakın (Mix/All) ~';
  return 'farklı ✗';
}

function setup3DrinkSmokeLogTag(pts: number): string {
  return pts === 10 ? 'aynı ✓' : 'farklı ✗';
}

const FLEX_MIX = ['Mix of everything', 'Both', 'All of the above', 'A bit of everything'] as const;

function printSetup2Block(pa: MatchProfile, pb: MatchProfile) {
  const ia = pa.intent;
  const ib = pb.intent;
  const aa = pa.setup2_answers ?? {};
  const bb = pb.setup2_answers ?? {};
  console.log(`Intent uyumu: ${ia} ↔ ${ib} → ${intentScore(ia, ib)}`);

  const row = (label: string, va: unknown, vb: unknown, flex: readonly string[] = []) => {
    const pts = setup2PairScore(va as string | null | undefined, vb as string | null | undefined, flex);
    console.log(`${label}: "${fmt(va)}" | "${fmt(vb)}" → ${pairTag(pts)} (${pts})`);
  };

  if (ia === 'just_friends' && ib === 'just_friends') {
    row('friendship_value', aa.friendship_value, bb.friendship_value, FLEX_MIX);
    row('hangout_frequency', aa.hangout_frequency, bb.hangout_frequency, ['Whenever it happens']);
    row('social_preference', aa.social_preference, bb.social_preference, ['Mix of everything']);
  } else if (ia === 'keeping_it_casual' && ib === 'keeping_it_casual') {
    row('casualness_expectation', aa.casualness_expectation, bb.casualness_expectation, ['All of the above']);
    row('exclusivity_view', aa.exclusivity_view, bb.exclusivity_view, FLEX_MIX);
    row('connection_style', aa.connection_style, bb.connection_style, ['A bit of everything']);
  } else if (ia === 'open_to_relationship' && ib === 'open_to_relationship') {
    row('marriage_view', aa.marriage_view, bb.marriage_view, []);
    row('children_view', aa.children_view, bb.children_view, []);
    row('relationship_pace', aa.relationship_pace, bb.relationship_pace, ['Not sure yet']);
    row('life_priority', aa.life_priority, bb.life_priority, ['Balance of everything']);
  } else if (ia === 'not_sure_yet' && ib === 'not_sure_yet') {
    row('excitement_factor', aa.excitement_factor, bb.excitement_factor, ['Just seeing what happens']);
    row('commitment_view', aa.commitment_view, bb.commitment_view, [
      'Open to whatever feels right',
      'Not thinking about it yet',
    ]);
    row('connection_energy', aa.connection_energy, bb.connection_energy, ['Still figuring it out']);
  }
}

type OkResult = Extract<MatchResult, { ok: true }>;

function printTopPair(
  rank: number,
  userA: MatchUser,
  userB: MatchUser,
  res: OkResult,
  ref: Date,
) {
  const pa = mapUserToProfile(userA);
  const pb = mapUserToProfile(userB);
  const prA = userA.profiles as Record<string, unknown>;
  const prB = userB.profiles as Record<string, unknown>;

  const nameA = `${prA['first_name'] ?? ''} ${prA['last_name'] ?? ''}`.trim() || String(prA['id']);
  const nameB = `${prB['first_name'] ?? ''} ${prB['last_name'] ?? ''}`.trim() || String(prB['id']);
  const cityA = fmt(prA['city']);
  const cityB = fmt(prB['city']);
  const ageA = parseDob(prA['date_of_birth'] as string | undefined) ? calculateAge(parseDob(prA['date_of_birth'] as string)!, ref) : '—';
  const ageB = parseDob(prB['date_of_birth'] as string | undefined) ? calculateAge(parseDob(prB['date_of_birth'] as string)!, ref) : '—';

  const line = '═══════════════════════════════════════';
  console.log('');
  console.log(line);
  console.log(`#${rank} EŞLEŞMESİ — %${res.matchPercentage} | ${res.matchCategory}`);
  console.log(line);
  console.log('');
  console.log(`KULLANICI A: ${nameA} | ${cityA} | ${ageA} | intent: ${pa.intent}`);
  console.log(`KULLANICI B: ${nameB} | ${cityB} | ${ageB} | intent: ${pb.intent}`);
  console.log('');
  console.log('── SETUP-1 ──');
  const diff = ageDiffYears(
    prA['date_of_birth'] as string | undefined,
    prB['date_of_birth'] as string | undefined,
    ref,
  );
  const agePts = ageDifferenceScore(prA['date_of_birth'] as string | undefined, prB['date_of_birth'] as string | undefined, ref);
  console.log(`Yaş farkı: ${diff != null ? `${diff} yıl` : '—'} → ${agePts}`);
  const distPts = districtBonusScore(prA['district'] as string | undefined, prB['district'] as string | undefined);
  const sameDist = distPts > 0 ? 'Evet' : 'Hayır';
  console.log(`Aynı ilçe: ${sameDist} → ${distPts}`);
  console.log('');
  console.log('── SETUP-2 ──');
  printSetup2Block(pa, pb);
  console.log('');
  console.log('── SETUP-3 ──');
  console.log(
    `Morning/night: "${fmt(pa.morning_night)}" | "${fmt(pb.morning_night)}" → ${morningNightScore(pa.morning_night, pb.morning_night)}`,
  );
  console.log(
    `Recharge: "${fmt(pa.recharge_style)}" | "${fmt(pb.recharge_style)}" → ${rechargeStyleScore(pa.recharge_style, pb.recharge_style)}`,
  );
  const hobO = hobbiesOverlapCount(pa.hobbies ?? null, pb.hobbies ?? null);
  console.log(
    `Hobiler: ${fmt(pa.hobbies)} | ${fmt(pb.hobbies)} → ${hobO} ortak → ${hobbiesScore(pa.hobbies ?? null, pb.hobbies ?? null)}`,
  );
  const drinkPts =
    typeof prA['drinking'] === 'string' &&
    typeof prB['drinking'] === 'string' &&
    prA['drinking'] === prB['drinking']
      ? 10
      : 0;
  const smokePts =
    typeof prA['smoking'] === 'string' &&
    typeof prB['smoking'] === 'string' &&
    prA['smoking'] === prB['smoking']
      ? 10
      : 0;
  console.log(
    `Drinking: "${fmt(prA['drinking'])}" | "${fmt(prB['drinking'])}" → ${setup3DrinkSmokeLogTag(drinkPts)} (${drinkPts})`,
  );
  console.log(
    `Smoking: "${fmt(prA['smoking'])}" | "${fmt(prB['smoking'])}" → ${setup3DrinkSmokeLogTag(smokePts)} (${smokePts})`,
  );
  console.log(
    `Eğitim: "${fmt(pa.education)}${pa.education_detail ? ` (${fmt(pa.education_detail)})` : ''}" | "${fmt(pb.education)}${pb.education_detail ? ` (${fmt(pb.education_detail)})` : ''}" → ${educationScore(pa.education, pb.education, pa.education_detail, pb.education_detail)}`,
  );
  console.log(`Din: "${fmt(pa.religion)}" | "${fmt(pb.religion)}" → ${religionScore(pa.religion, pb.religion)}`);
  console.log('');
  console.log('── SETUP-4 ──');
  const dO = setup4OverlapCount(pa.availability_days, pb.availability_days);
  console.log(
    `Müsait günler: ${fmt(pa.availability_days)} | ${fmt(pb.availability_days)} → ${dO} ortak → ${availabilityDaysScore(pa.availability_days, pb.availability_days)}`,
  );
  const hO = setup4OverlapCount(pa.availability_hours, pb.availability_hours);
  console.log(
    `Müsait saatler: ${fmt(pa.availability_hours)} | ${fmt(pb.availability_hours)} → ${hO} ortak → ${availabilityHoursScore(pa.availability_hours, pb.availability_hours)}`,
  );
  const eO = setup4OverlapCount(pa.meeting_environment, pb.meeting_environment);
  console.log(
    `Buluşma ortamı: ${fmt(pa.meeting_environment)} | ${fmt(pb.meeting_environment)} → ${eO} ortak → ${meetingEnvironmentScore(pa.meeting_environment, pb.meeting_environment)}`,
  );
  console.log(
    `İlk buluşma: "${fmt(pa.first_date_expectation)}" | "${fmt(pb.first_date_expectation)}" → ${firstDateExpectationScore(pa.first_date_expectation, pb.first_date_expectation)}`,
  );
  const pO = setup4OverlapCount(pa.preferred_locations, pb.preferred_locations);
  console.log(
    `Tercih mahalleleri: ${fmt(pa.preferred_locations)} | ${fmt(pb.preferred_locations)} → ${pO} ortak → ${preferredLocationsScore(pa.preferred_locations, pb.preferred_locations)}`,
  );
  console.log(`Bio (çift): → ${bioPairBonusScore(pa.bio, pb.bio)}`);
  console.log('');
  console.log('── SKORLAR ──');
  const s2max = setup2MaxPossible(pa.intent, pb.intent);
  console.log(
    `setup1: ${res.breakdown.setup1.score}/${SETUP1_MAX_POSSIBLE} | setup2: ${res.breakdown.setup2.score}/${s2max} | setup3: ${res.breakdown.setup3.score}/95 | setup4: ${res.breakdown.setup4.score}/115`,
  );
  console.log(`rawScore: ${res.rawScore} | matchPercentage: %${res.matchPercentage}`);
  console.log(`reasons: ${res.reasons.length ? res.reasons.join(' | ') : '(yok)'}`);
}

async function main() {
  const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('*');
  if (profilesErr) throw profilesErr;

  const { data: onboardingAnswers, error: answersErr } = await supabase.from('onboarding_answers').select('*');
  if (answersErr) throw answersErr;

  const profilesList = (profiles ?? []) as ProfileRow[];
  const onboardingList = (onboardingAnswers ?? []) as OnboardingAnswersRow[];

  const onboardingByUserId = new Map<string, OnboardingAnswersRow>();
  for (const a of onboardingList) onboardingByUserId.set(a.user_id, a);

  const users: MatchUser[] = profilesList.map((p) => ({
    profiles: p,
    onboarding_answers: onboardingByUserId.get(p.id) ?? null,
  }));

  const n = users.length;
  const ref = new Date();

  type PairOk = { i: number; j: number; result: OkResult };
  const okPairs: PairOk[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = calculateMatchScore(users[i] as any, users[j] as any, ref);
      if (res.ok) okPairs.push({ i, j, result: res });
    }
  }

  okPairs.sort((a, b) => b.result.matchPercentage - a.result.matchPercentage);
  const top3 = okPairs.slice(0, 3);

  console.log(`Toplam profil: ${n}, ok: true çift: ${okPairs.length}, gösterilen: ${top3.length}`);
  if (top3.length === 0) {
    console.log('Gösterilecek eşleşme yok.');
    return;
  }

  let rank = 1;
  for (const { i, j, result } of top3) {
    printTopPair(rank++, users[i], users[j], result, ref);
  }
}

main().catch((e) => {
  console.error('topMatches failed:', e);
  process.exit(1);
});
