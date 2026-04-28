import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

type IntentKey = 'just_friends' | 'keeping_it_casual' | 'open_to_relationship' | 'not_sure_yet';
type Gender = 'Man' | 'Woman' | 'Non-binary';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MALE_NAMES = ['Ahmet', 'Mehmet', 'Can', 'Emre', 'Mert', 'Burak', 'Kerem', 'Eren', 'Umut', 'Deniz', 'Oguz', 'Yusuf', 'Kaan', 'Berk', 'Arda', 'Onur', 'Serkan', 'Tolga', 'Furkan', 'Baris'];
const FEMALE_NAMES = ['Elif', 'Zeynep', 'Merve', 'Derya', 'Selin', 'Ece', 'Ceren', 'Irem', 'Seda', 'Buse', 'Melis', 'Naz', 'Asli', 'Gizem', 'Aylin', 'Yasemin', 'Tugce', 'Pelin', 'Lara', 'Sinem'];
const NEUTRAL_NAMES = ['Deniz', 'Duru', 'Aren', 'Ekin', 'Ege', 'Ilke', 'Miran', 'Arya'];
const LAST_NAMES = ['Yilmaz', 'Kaya', 'Demir', 'Sahin', 'Celik', 'Yildiz', 'Arslan', 'Dogan', 'Kilic', 'Aslan', 'Koc', 'Aydin', 'Ozdemir', 'Tekin', 'Erdogan', 'Ozturk', 'Aksoy', 'Kurt', 'Polat', 'Karaca'];

const DISTRICTS: Record<string, Array<{ district: string; lat: number; lng: number }>> = {
  Istanbul: [
    { district: 'Kadikoy', lat: 40.9917, lng: 29.0277 },
    { district: 'Besiktas', lat: 41.043, lng: 29.0094 },
    { district: 'Sisli', lat: 41.0605, lng: 28.9872 },
    { district: 'Uskudar', lat: 41.022, lng: 29.0137 },
    { district: 'Maltepe', lat: 40.9351, lng: 29.1307 },
    { district: 'Beyoglu', lat: 41.0369, lng: 28.985 },
    { district: 'Atasehir', lat: 40.983, lng: 29.1274 },
  ],
  Ankara: [
    { district: 'Cankaya', lat: 39.9179, lng: 32.8627 },
    { district: 'Kecioren', lat: 39.9857, lng: 32.8663 },
    { district: 'Yenimahalle', lat: 39.9672, lng: 32.7616 },
  ],
  Izmir: [
    { district: 'Karsiyaka', lat: 38.4556, lng: 27.1091 },
    { district: 'Bornova', lat: 38.4622, lng: 27.2177 },
    { district: 'Konak', lat: 38.4192, lng: 27.1287 },
  ],
};

const HOURS = ['Morning (9-12)', 'Afternoon (12-18)', 'Evening (18-21)'] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MEETING_ENV = ['Coffee', 'Walk in the park', 'Dinner', 'Drinks', 'Something active'] as const;
const RECHARGE = ['Alone time', 'With people', 'With my pet', 'Mix of everything'] as const;

function pickOne<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickSome<T>(arr: readonly T[], min: number, max: number): T[] {
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  const copy = [...arr]; const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) { const idx = Math.floor(Math.random() * copy.length); out.push(copy[idx]); copy.splice(idx, 1); }
  return out;
}
function chance(p: number): boolean { return Math.random() < p; }
function weightedCity(): 'Istanbul' | 'Ankara' | 'Izmir' { const r = Math.random(); if (r < 0.72) return 'Istanbul'; if (r < 0.87) return 'Ankara'; return 'Izmir'; }
function weightedIntent(): IntentKey { const r = Math.random(); if (r < 0.28) return 'just_friends'; if (r < 0.48) return 'keeping_it_casual'; if (r < 0.83) return 'open_to_relationship'; return 'not_sure_yet'; }
function weightedGender(): Gender { const r = Math.random(); if (r < 0.46) return 'Man'; if (r < 0.92) return 'Woman'; return 'Non-binary'; }
function meetingPrefsFor(gender: Gender): string[] { const r = Math.random(); if (r < 0.22) return ['Everyone']; if (gender === 'Man') return chance(0.65) ? ['Women'] : ['Women', 'Non-binary']; if (gender === 'Woman') return chance(0.65) ? ['Men'] : ['Men', 'Non-binary']; return chance(0.5) ? ['Women'] : ['Men']; }
function randomDob(ageMin = 20, ageMax = 42): string { const now = new Date(); const age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin; const year = now.getFullYear() - age; const month = Math.floor(Math.random() * 12); const day = Math.floor(Math.random() * 28) + 1; return new Date(year, month, day).toISOString().slice(0, 10); }
function zodiacSign(month: number, day: number): string { const md = month * 100 + day; if (md >= 1222 || md <= 119) return 'Capricorn'; if (md <= 218) return 'Aquarius'; if (md <= 320) return 'Pisces'; if (md <= 419) return 'Aries'; if (md <= 520) return 'Taurus'; if (md <= 620) return 'Gemini'; if (md <= 722) return 'Cancer'; if (md <= 822) return 'Leo'; if (md <= 922) return 'Virgo'; if (md <= 1022) return 'Libra'; if (md <= 1121) return 'Scorpio'; return 'Sagittarius'; }

function setup2Answers(intent: IntentKey) {
  if (intent === 'just_friends')
    return {
      friendship_value: pickOne(['Loyalty & trust', 'Shared adventures', 'Deep conversations', 'Just having fun']),
      hangout_frequency: pickOne(['A few times a week', 'Once a week', 'A few times a month', 'Whenever it happens']),
      social_preference: pickOne(['One-on-one', 'Small groups', 'Big groups', 'Mix of everything']),
    };
  if (intent === 'keeping_it_casual')
    return {
      casualness_expectation: pickOne(['Fun & good vibes', 'New experiences', 'See where it goes', 'All of the above']),
      exclusivity_view: pickOne(['Not important right now', 'Open to it eventually', 'Prefer to keep it open']),
      connection_style: pickOne(['Physical chemistry first', 'Good conversations', 'Shared experiences', 'A bit of everything']),
    };
  if (intent === 'open_to_relationship')
    return {
      marriage_view: pickOne(['Yes, definitely', 'Open to it', 'Not sure', 'No']),
      children_view: pickOne(['Yes', 'Maybe someday', 'No', 'Already have kids']),
      relationship_pace: pickOne(['Taking it slow', 'Going with the flow', 'Ready to commit', 'Not sure yet']),
      life_priority: pickOne(['Career & ambition', 'Family & relationships', 'Personal growth', 'Balance of everything']),
    };
  return {
    excitement_factor: pickOne(['A great friendship', 'A romantic spark', 'An adventure buddy', 'Just seeing what happens']),
    commitment_view: pickOne(['Taking it slow', 'Open to whatever feels right', 'Not thinking about it yet']),
    connection_energy: pickOne(['Laid back & easy going', 'Curious & open minded', 'Fun & spontaneous', 'Still figuring it out']),
  };
}

async function main() {
  let inserted = 0;
  for (let i = 0; i < 100; i++) {
    const gender = weightedGender();
    const first = gender === 'Man' ? pickOne(MALE_NAMES) : gender === 'Woman' ? pickOne(FEMALE_NAMES) : pickOne(NEUTRAL_NAMES);
    const last = pickOne(LAST_NAMES);
    const city = weightedCity();
    const districtInfo = pickOne(DISTRICTS[city]);
    const { district, lat, lng } = districtInfo;
    const iso = randomDob(20, 42);
    const d = new Date(`${iso}T12:00:00`);
    const z = zodiacSign(d.getMonth() + 1, d.getDate());
    const languages = ['Turkish'];
    if (chance(0.72)) languages.push('English');
    if (chance(0.28)) languages.push('German');
    const intent = weightedIntent();
    const setup3Filled = chance(0.8);
    const setup4Filled = chance(0.6);
    const email = `seed_${Date.now()}_${i}_${randomUUID().slice(0, 8)}@example.com`;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({ email, password: 'DummyPass123!', email_confirm: true, user_metadata: { seeded: true } });
    if (createErr || !created.user) { console.error(`createUser failed for #${i}:`, createErr?.message); continue; }
    const userId = created.user.id;
    const profile: Record<string, unknown> = {
      id: userId, first_name: first, last_name: last, date_of_birth: iso, zodiac_sign: z,
      city, district, lat: lat + (Math.random() - 0.5) * 0.02, lng: lng + (Math.random() - 0.5) * 0.02,
      full_address: `${district}, ${city}`, gender, meeting_preferences: meetingPrefsFor(gender),
      languages,
      photos: [`https://i.pravatar.cc/300?u=${userId}`],
      current_step: 4,
      setup_completed: true,
      morning_night: setup3Filled ? pickOne(['Morning person', 'Night owl', 'Depends on the day']) : null,
      recharge_style: setup3Filled ? pickOne(RECHARGE) : null,
      hobbies: setup3Filled ? pickSome(['Travel', 'Music', 'Fitness', 'Reading', 'Gaming', 'Cooking'], 2, 5) : null,
      vibe: setup3Filled ? pickOne(['Introvert', 'Extrovert', 'Mixed']) : null,
      drinking: setup3Filled ? pickOne(['Yes', 'Socially', 'No']) : null,
      smoking: setup3Filled ? pickOne(['Yes', 'Socially', 'No']) : null,
      education: setup3Filled ? pickOne(['High school', 'University', "Master's", 'Other']) : null,
      education_detail: setup3Filled && chance(0.55) ? pickOne(['Bogazici', 'ODTU', 'ITU', 'Ege University']) : null,
      religion: setup3Filled ? pickOne(['Spiritual', 'Religious', 'Agnostic', 'Atheist', 'Prefer not to say']) : null,
      availability_days: setup4Filled ? pickSome(DAYS, 2, 7) : null,
      availability_hours: setup4Filled ? pickSome(HOURS, 1, 3) : null,
      meeting_environment: setup4Filled ? pickSome(MEETING_ENV, 1, 4) : null,
      favorite_spots: setup4Filled ? { coffee: pickOne(['Kadikoy', 'Besiktas', 'Alsancak']) } : null,
      first_date_expectation: setup4Filled ? pickOne(["See if there's a vibe", 'Have a real conversation', 'Have fun and laugh', 'All of the above']) : null,
      bio: setup4Filled && chance(0.7) ? pickOne(['Coffee lover', 'Runner and avid reader', 'Music and long walks', 'Foodie exploring Istanbul']) : null,
    };
    const { error: profileErr } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
    if (profileErr) { console.error(`profiles upsert failed for #${i}:`, profileErr.message); continue; }
    const { error: onboardingErr } = await supabase.from('onboarding_answers').upsert({ user_id: userId, intent, ...setup2Answers(intent) }, { onConflict: 'user_id' });
    if (onboardingErr) { console.error(`onboarding upsert failed for #${i}:`, onboardingErr.message); continue; }
    inserted++;
    if ((i + 1) % 10 === 0) console.log(`Progress: ${i + 1}/100 processed, ${inserted} inserted.`);
  }
  console.log(`\nDone. Inserted ${inserted}/100 realistic dummy profiles.`);
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); });