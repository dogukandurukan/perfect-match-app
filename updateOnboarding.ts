import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type IntentKey = 'just_friends' | 'keeping_it_casual' | 'open_to_relationship' | 'not_sure_yet';

type OnboardingRow = {
  user_id: string;
  intent: string | null;
  friendship_value: string | null;
  hangout_frequency: string | null;
  connection_style: string | null;
  relationship_pace: string | null;
  excitement_factor: string | null;
  connection_energy: string | null;
  social_preference: string | null;
  life_priority: string | null;
  commitment_view: string | null;
};

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeIntent(raw: string | null): IntentKey | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (k === 'just_friends' || k === 'keeping_it_casual' || k === 'open_to_relationship' || k === 'not_sure_yet') {
    return k;
  }
  return null;
}

/** Intent’e göre yeni setup2 alanları — her çalıştırmada rastgele seçilir (force overwrite). */
function buildPatch(intent: IntentKey): Record<string, string> {
  if (intent === 'just_friends') {
    return {
      friendship_value: pickOne(['Loyalty & trust', 'Shared adventures', 'Deep conversations', 'Just having fun']),
      hangout_frequency: pickOne(['A few times a week', 'Once a week', 'A few times a month', 'Whenever it happens']),
      social_preference: pickOne(['One-on-one', 'Small groups', 'Big groups', 'Mix of everything']),
    };
  }

  if (intent === 'keeping_it_casual') {
    return {
      connection_style: pickOne([
        'Physical chemistry first',
        'Good conversations',
        'Shared experiences',
        'A bit of everything',
      ]),
    };
  }

  if (intent === 'open_to_relationship') {
    return {
      relationship_pace: pickOne(['Taking it slow', 'Going with the flow', 'Ready to commit', 'Not sure yet']),
      life_priority: pickOne([
        'Career & ambition',
        'Family & relationships',
        'Personal growth',
        'Balance of everything',
      ]),
    };
  }

  if (intent === 'not_sure_yet') {
    return {
      excitement_factor: pickOne([
        'A great friendship',
        'A romantic spark',
        'An adventure buddy',
        'Just seeing what happens',
      ]),
      commitment_view: pickOne(['Taking it slow', 'Open to whatever feels right', 'Not thinking about it yet']),
      connection_energy: pickOne([
        'Laid back & easy going',
        'Curious & open minded',
        'Fun & spontaneous',
        'Still figuring it out',
      ]),
    };
  }

  return {};
}

async function main() {
  const { data: rows, error } = await supabase.from('onboarding_answers').select('*');
  if (error) throw error;

  const list = (rows ?? []) as OnboardingRow[];
  let updatedCount = 0;

  for (const row of list) {
    const intent = normalizeIntent(row.intent);
    if (!intent) continue;

    const patch = buildPatch(intent);
    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await supabase.from('onboarding_answers').update(patch).eq('user_id', row.user_id);
    if (upErr) {
      console.error(`Update failed for user_id=${row.user_id}:`, upErr.message);
      continue;
    }

    updatedCount += 1;
    console.log(`Updated user_id=${row.user_id}`);
  }

  console.log(`\nDone. Total updated rows: ${updatedCount}`);
}

main().catch((e) => {
  console.error('updateOnboarding failed:', e);
  process.exit(1);
});
