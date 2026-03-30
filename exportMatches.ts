import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
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
  intent?: string | null;
  [k: string]: unknown;
};

type OnboardingAnswersRow = {
  user_id: string;
  intent?: string | null;
  [k: string]: unknown;
};

type MatchUser = {
  profiles: ProfileRow;
  onboarding_answers?: (OnboardingAnswersRow & { intent?: string | null }) | null;
};

function resolveName(u: MatchUser): string {
  const first = u.profiles.first_name ?? '';
  const last = u.profiles.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full || u.profiles.id;
}

function resolveCity(u: MatchUser): string {
  return u.profiles.city ?? '';
}

function resolveIntent(u: MatchUser): string {
  return (u.onboarding_answers?.intent ?? u.profiles.intent ?? 'not_sure_yet') as string;
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const [{ data: profiles, error: profilesErr }, { data: onboardingAnswers, error: answersErr }] =
    await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('onboarding_answers').select('*'),
    ]);

  if (profilesErr) throw profilesErr;
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

  const outPath = join(process.cwd(), 'match_results.csv');
  const stream = createWriteStream(outPath, { encoding: 'utf8' });

  stream.write(
    [
      'user_a_name',
      'user_a_city',
      'user_a_intent',
      'user_b_name',
      'user_b_city',
      'user_b_intent',
      'matchPercentage',
      'totalScore',
      'breakdown_setup1',
      'breakdown_setup2',
      'breakdown_setup3',
      'breakdown_setup4',
    ].join(',') + '\n',
  );

  const n = users.length;
  let written = 0;
  const totalPairs = (n * (n - 1)) / 2;

  console.log(`Calculating pairs: ${totalPairs} (n=${n})`);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = calculateMatchScore(users[i] as any, users[j] as any);
      if (!res.ok) continue;

      const a = users[i];
      const b = users[j];

      const row = [
        csvEscape(resolveName(a)),
        csvEscape(resolveCity(a)),
        csvEscape(resolveIntent(a)),
        csvEscape(resolveName(b)),
        csvEscape(resolveCity(b)),
        csvEscape(resolveIntent(b)),
        csvEscape(res.matchPercentage),
        csvEscape(res.clampedScore),
        csvEscape(res.breakdown.setup1.score),
        csvEscape(res.breakdown.setup2.score),
        csvEscape(res.breakdown.setup3.score),
        csvEscape(res.breakdown.setup4.score),
      ].join(',');

      stream.write(row + '\n');
      written++;
    }

    // Simple progress log to know it's alive.
    if (i % 5 === 0) {
      console.log(`Progress: i=${i + 1}/${n} | written(ok=true)=${written}`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });

  console.log(`Done. Written ${written} ok=true matches to ${outPath}`);
}

main().catch((e) => {
  console.error('exportMatches failed:', e);
  process.exit(1);
});

