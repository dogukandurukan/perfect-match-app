import { createClient } from '@supabase/supabase-js';
import { calculateMatchScore } from './lib/matchScoring';

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
  // intent may be absent in your schema; wrapper handles onboarding_answers.intent as source of truth.
  intent?: string | null;
  [k: string]: unknown;
};

/**
 * Setup-1: maxPossible 28 (district + age only; languages are hard-filter only).
 * Setup-2 maxPossible by pair: both just_friends → 70; both keeping_it_casual → 70;
 * both open_to_relationship → 85; if either not_sure_yet → 80.
 */
type OnboardingAnswersRow = {
  user_id: string;
  intent?: string | null;
  friendship_value?: string | null;
  hangout_frequency?: string | null;
  social_preference?: string | null;
  casualness_expectation?: string | null;
  exclusivity_view?: string | null;
  connection_style?: string | null;
  marriage_view?: string | null;
  children_view?: string | null;
  relationship_pace?: string | null;
  life_priority?: string | null;
  excitement_factor?: string | null;
  commitment_view?: string | null;
  connection_energy?: string | null;
  [k: string]: unknown;
};

function resolveIntent(user: { profiles: ProfileRow; onboarding_answers?: OnboardingAnswersRow | null }) {
  return (user.onboarding_answers?.intent ?? user.profiles.intent ?? 'not_sure_yet') as string;
}

function resolveName(user: { profiles: ProfileRow }) {
  const first = user.profiles.first_name ?? '';
  const last = user.profiles.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full || user.profiles.id;
}

function resolveCity(user: { profiles: ProfileRow }) {
  return user.profiles.city ?? '';
}

type MatchUser = {
  profiles: ProfileRow;
  onboarding_answers?: OnboardingAnswersRow | null;
};

type BestMatch = {
  userId: string;
  name: string;
  city: string;
  intent: string;
  matchPercentage: number;
  matchCategory: string;
  reasons: string[];
  breakdown: {
    setup1: { score: number; maxPossible: number; penalty: number };
    setup2: { score: number; maxPossible: number; penalty: number };
    setup3: { score: number; maxPossible: number; penalty: number; universitySameBonus: boolean };
    setup4: { score: number; maxPossible: number; penalty: number; isSkipped: boolean };
  };
};

async function main() {
  const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('*');
  if (profilesErr) throw profilesErr;

  const { data: onboardingAnswers, error: answersErr } = await supabase.from('onboarding_answers').select('*');
  if (answersErr) throw answersErr;

  const profilesList = (profiles ?? []) as ProfileRow[];
  const onboardingList = (onboardingAnswers ?? []) as OnboardingAnswersRow[];

  console.log(`Fetched profiles: ${profilesList.length}`);
  console.log(`Fetched onboarding_answers: ${onboardingList.length}`);

  const onboardingByUserId = new Map<string, OnboardingAnswersRow>();
  for (const a of onboardingList) onboardingByUserId.set(a.user_id, a);

  const users: MatchUser[] = profilesList.map((p) => ({
    profiles: p,
    onboarding_answers: onboardingByUserId.get(p.id) ?? null,
  }));

  const n = users.length;
  const totalPairs = (n * (n - 1)) / 2;
  console.log(`Testing pairs: ${totalPairs} (n=${n})`);

  let hardFilterPassPairs = 0;
  let hardFilterFailPairs = 0;
  let incompatibleLifestyleEliminatedPairs = 0;

  const focusCount = Math.min(5, n);
  const focusMatches: BestMatch[][] = Array.from({ length: focusCount }, () => []);

  const focusSet = new Set<number>(Array.from({ length: focusCount }, (_, idx) => idx));

  function upsertBest(focusIdx: number, other: MatchUser, result: ReturnType<typeof calculateMatchScore>) {
    if (!result.ok) return;
    const match: BestMatch = {
      userId: other.profiles.id,
      name: resolveName(other),
      city: resolveCity(other),
      intent: resolveIntent(other),
      matchPercentage: result.matchPercentage,
      matchCategory: result.matchCategory,
      reasons: result.reasons,
      breakdown: result.breakdown,
    };
    const list = focusMatches[focusIdx];

    const existingIdx = list.findIndex((x) => x.userId === match.userId);
    if (existingIdx >= 0) {
      if (list[existingIdx].matchPercentage < match.matchPercentage) list[existingIdx] = match;
      return;
    }

    list.push(match);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = calculateMatchScore(users[i] as any, users[j] as any);

      if (res.ok) {
        hardFilterPassPairs++;
      } else if (res.reason === 'different_city' || res.reason === 'gender_mismatch' || res.reason === 'no_common_language') {
        hardFilterFailPairs++;
      } else {
        // intent_mismatch / incompatible_lifestyle => hard filters passed
        hardFilterPassPairs++;
      }

      if (!res.ok && res.reason === 'incompatible_lifestyle') incompatibleLifestyleEliminatedPairs++;

      if (focusSet.has(i) && res.ok) upsertBest(i, users[j], res);
      if (focusSet.has(j) && res.ok) upsertBest(j, users[i], res);
    }
  }

  const describeField = (v: string | null | undefined) =>
    v == null || String(v).trim() === '' ? 'null/empty' : `filled (${JSON.stringify(v)})`;

  console.log('');
  console.log('--- Sample: first 5 users — a match where the other user has intent not_sure_yet (onboarding_answers) ---');
  let printedNotSureSample = false;
  for (let idx = 0; idx < focusCount && !printedNotSureSample; idx++) {
    const list = focusMatches[idx].slice().sort((a, b) => b.matchPercentage - a.matchPercentage);
    const hit = list.find((m) => m.intent === 'not_sure_yet');
    if (!hit) continue;
    const otherUser = users.find((u) => u.profiles.id === hit.userId);
    if (!otherUser) continue;

    const focusU = users[idx];
    const oa = focusU.onboarding_answers;
    const ob = otherUser.onboarding_answers;

    console.log(`Focus user #${idx + 1}: ${resolveName(focusU)} | user_id=${focusU.profiles.id}`);
    console.log(`  Other user (not_sure_yet): ${resolveName(otherUser)} | user_id=${otherUser.profiles.id}`);
    console.log(`  Focus user — excitement_factor: ${describeField(oa?.excitement_factor)}`);
    console.log(`  Focus user — commitment_view: ${describeField(oa?.commitment_view)}`);
    console.log(`  Focus user — connection_energy: ${describeField(oa?.connection_energy)}`);
    console.log(`  Other user — excitement_factor: ${describeField(ob?.excitement_factor)}`);
    console.log(`  Other user — commitment_view: ${describeField(ob?.commitment_view)}`);
    console.log(`  Other user — connection_energy: ${describeField(ob?.connection_energy)}`);
    printedNotSureSample = true;
  }
  if (!printedNotSureSample) {
    console.log('(No such match: among first 5 users, no top match with intent not_sure_yet.)');
  }

  console.log('');
  console.log(`Hard filters passed pairs: ${hardFilterPassPairs}`);
  console.log(`Hard filters failed pairs: ${hardFilterFailPairs}`);
  console.log(`Total pairs tested: ${totalPairs}`);
  console.log(`incompatible_lifestyle eliminated pairs: ${incompatibleLifestyleEliminatedPairs}`);

  console.log('');
  for (let idx = 0; idx < focusCount; idx++) {
    const u = users[idx];
    const name = resolveName(u);
    const city = resolveCity(u);
    const intent = resolveIntent(u);

    const list = focusMatches[idx]
      .slice()
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, 3);

    console.log(`First #${idx + 1} user: ${name} | city=${city} | intent=${intent}`);
    if (list.length === 0) {
      console.log('  Top matches: none (hard filters/intents constraints failed)');
      continue;
    }

    for (let k = 0; k < list.length; k++) {
      const m = list[k];

      console.log(`  Match #${k + 1}: ${m.name} | %${m.matchPercentage} | ${m.matchCategory}`);
      for (const r of m.reasons) {
        console.log(`    → ${r}`);
      }

      const fmtSetupLine = (label: 'setup1' | 'setup2' | 'setup3' | 'setup4') => {
        const b = m.breakdown[label];
        const pct = b.maxPossible > 0 ? Math.round((b.score / b.maxPossible) * 100) : 0;
        return `${label}: ${b.score} / ${b.maxPossible} puan (%${pct})`;
      };

      console.log(`    ${fmtSetupLine('setup1')}`);
      if (m.breakdown.setup1.penalty < 0) console.log(`    ceza: ${m.breakdown.setup1.penalty}`);

      console.log(`    ${fmtSetupLine('setup2')}`);

      const setup3Line =
        fmtSetupLine('setup3') + (m.breakdown.setup3.universitySameBonus ? ' [+10 aynı üniversite bonusu]' : '');
      console.log(`    ${setup3Line}`);
      if (m.breakdown.setup3.penalty < 0) console.log(`    ceza: ${m.breakdown.setup3.penalty}`);

      console.log(`    ${fmtSetupLine('setup4')}`);
      if (m.breakdown.setup4.penalty < 0) console.log(`    ceza: ${m.breakdown.setup4.penalty}`);
    }
  }
}

main().catch((e) => {
  console.error('testMatching failed:', e);
  process.exit(1);
});

