// DEV profile pool — perfect-match-dev ONLY (TEMPA_TARGET=dev).
//
//   node scripts/dev-backend/seed-dev-pool.mjs           # create / complete missing people
//   node scripts/dev-backend/seed-dev-pool.mjs --list    # show the pool
//   node scripts/dev-backend/seed-dev-pool.mjs --verify  # read-only check via the normal viewer path
//
// 18 synthetic V2 members that fit the phone test account's current filters
// (women interested in men or everyone, İstanbul, ages 24–38; the phone
// account is a 30-year-old man looking for women). Every person goes through
// the NORMAL path — the same as the app:
//   real email-code sign-in (code issued locally by the admin API, verified by
//   the client) → save_onboarding_v2 per section → photo upload to the private
//   bucket + add_profile_photo_v2 → save_prompts_v2 → selfie upload +
//   set_verification_selfie_v2 → consent → submit_application_v2 → reviewer
//   accept via review_application_v2 (service role, like scripts/dev-backend/review.mjs).
// Nothing is embedded in the app; the app reads them through the normal
// discovery / profile RPCs.
//
// Idempotent: people are found by their fixed synthetic e-mail
// (tempa-pool-NN@tempa-test.example.com). An accepted person is skipped; a
// half-done one is completed. No likes, matches, messages or date suggestions
// are created, and nobody else's data is touched.
//
// Photos: generated flat-illustration adult portraits tagged
// "DEV · SYNTHETIC" (scripts/dev-backend/portraits.mjs) — no real people.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { renderPortraits } from './portraits.mjs';

process.env.TEMPA_TARGET = 'dev';
const { fail, loadTestEnv } = await import('../test-backend/_env.mjs');
const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const PHOTOS = 'profile-photos-private';
const SELFIES = 'verification-selfies';

const custom = (kind, title, subtitle) => ({ kind, source: 'custom', id: `custom:${kind}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title, ...(subtitle ? { subtitle } : {}) });

// look: skin / skinShade / hair / brow / hairStyle / top / bg / scene / accessory / item
const L = (skin, shade, hair, style, top, bg, scene, accessory, item) => ({ skin, skinShade: shade, hair, brow: hair, hairStyle: style, top, bg, scene, accessory, item });

const P = [
  { n: 1, first: 'Elif', dob: '1996-04-12', district: 'Kadıköy', h: 165, intent: 'long_term', values: ['trust', 'growth'],
    work: 'full_time', job: 'Product designer', school: 'Boğaziçi University', home: 'İzmir', interests: ['art', 'travel', 'food'],
    artists: ['Sezen Aksu'], books: ['Tutunamayanlar'], screen: ['Bir Zamanlar Anadolu’da'], dates: ['coffee', 'walk'], spot: 'Moda sahil', days: 'weekends', time: 'daytime',
    prompts: [['small_thing_i_love', 'Fresh simit and the first ferry of the day.'], ['together_we_could', 'Find the best kumpir on the Asian side.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat' }, look: L('#E2B593', '#C99A7A', '#3B2A20', 'wavy', '#1F3A2E', '#E6ECE3', 'sea', 'earrings', 'books') },
  { n: 2, first: 'Zeynep', dob: '1993-09-03', district: 'Beşiktaş', h: 170, intent: 'long_term', values: ['family', 'respect'],
    work: 'full_time', job: 'Architect', school: 'İTÜ', interests: ['culture', 'outdoors'],
    dates: ['dinner'], days: 'weekdays', time: 'evening',
    prompts: [['ask_me_about', 'Why every old building in Beyoğlu has a story.'], ['always_make_time_for', 'Sunday breakfast with my grandmother.'], ['teach_me_how_to', 'Make a proper menemen.']],
    life: { smoking: 'no', drinking: 'none', pets: 'like_no_pets', activity: 'very' }, look: L('#F0C9A8', '#D6AD8C', '#1E1611', 'bun', '#8C4B3C', '#EDE6D6', 'city', 'none', 'camera') },
  { n: 3, first: 'Deniz', dob: '1998-01-22', district: 'Üsküdar', h: 162, intent: 'figuring_out', values: ['fun', 'adventure'],
    work: 'student', interests: ['music', 'nightlife', 'gaming'],
    dates: ['drinks', 'activity'], days: 'either', time: 'evening',
    prompts: [['dont_judge_me', 'I still play the same video game from 2012.'], ['most_used_phrase', '“One more song and we go.”']],
    life: { smoking: 'sometimes', drinking: 'regularly', pets: 'neutral', activity: 'somewhat' }, look: L('#C68E68', '#AB7552', '#7A4B2A', 'pixie', '#C9A227', '#F1E4D3', 'cafe', 'none', 'music') },
  { n: 4, first: 'Selin', dob: '1991-06-30', district: 'Şişli', h: 168, intent: 'long_term', values: ['stability', 'trust'],
    work: 'self_employed', job: 'Ceramic artist', home: 'Eskişehir', interests: ['art', 'wellness'],
    artists: ['Nilüfer'], dates: ['coffee'], spot: 'A small café in Cihangir', days: 'weekends', time: 'either',
    prompts: [['oddly_good_at', 'Fixing chipped mugs so you can’t tell.'], ['sunday_starts_with', 'Clay, coffee, and a long playlist.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'dog', activity: 'not_very' }, look: L('#E8BE9B', '#CFA07D', '#A36A3E', 'long', '#5E7D6A', '#EDE6D6', 'park', 'earrings', 'plant') },
  { n: 5, first: 'Ayşe', dob: '1995-11-14', district: 'Ataşehir', h: 160, intent: 'casual', values: ['independence'],
    work: 'part_time', interests: ['sports'],
    dates: ['activity'], days: 'weekdays', time: 'daytime',
    prompts: [['always_say_yes_to', 'A spontaneous tennis match.'], ['take_too_seriously', 'Warm-up stretches.']],
    life: { smoking: 'no', drinking: 'none', pets: 'rather_not', activity: 'very' }, look: L('#B97A57', '#9E6545', '#2A1C14', 'bob', '#1F3A2E', '#E6ECE3', 'park', 'none', 'bike') },
  { n: 6, first: 'Melis', dob: '1990-02-08', district: 'Sarıyer', h: 174, intent: 'long_term', values: ['health', 'affection'],
    work: 'full_time', job: 'Physiotherapist', school: 'Hacettepe University', home: 'Ankara', interests: ['wellness', 'outdoors', 'animals'],
    books: ['Kürk Mantolu Madonna'], screen: ['The Bear'], dates: ['walk', 'outdoors'], spot: 'Belgrad Ormanı', days: 'weekends', time: 'daytime',
    prompts: [['after_a_long_day', 'A walk by the Bosphorus, no phone.'], ['first_date_needs', 'A good view and a slow pace.'], ['comfort_food', 'Mercimek çorbası, always.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'both', activity: 'very' }, look: L('#F3D2B5', '#DAB394', '#C6923C', 'long', '#C9A227', '#E6ECE3', 'sea', 'none', 'plant') },
  { n: 7, first: 'Ece', dob: '1997-07-19', district: 'Beyoğlu', h: 166, intent: 'figuring_out', values: ['growth', 'fun'],
    work: 'full_time', job: 'Copywriter', interests: ['books', 'movies', 'culture', 'food'],
    artists: ['Duman'], books: ['Saatleri Ayarlama Enstitüsü'], screen: ['Kış Uykusu'], dates: ['drinks'], days: 'either', time: 'evening',
    prompts: [['friends_know_me_for', 'Always having a book recommendation.'], ['well_laugh_about', 'My terrible sense of direction.']],
    life: { smoking: 'sometimes', drinking: 'sometimes', pets: 'neutral', activity: 'not_very' }, look: L('#D9A886', '#C08E6C', '#4A2F22', 'wavy', '#8C4B3C', '#F1E4D3', 'city', 'glasses', 'books') },
  { n: 8, first: 'Naz', dob: '1999-03-27', district: 'Bakırköy', h: 158, intent: 'casual', values: ['adventure'],
    work: 'student', interests: ['travel'],
    dates: ['coffee'], days: 'weekends', time: 'daytime',
    prompts: [['want_to_try', 'Paragliding in Ölüdeniz.'], ['funny_little_habit', 'Naming every plant I own.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'like_no_pets', activity: 'somewhat' }, look: L('#8D5A3E', '#774A33', '#1E1611', 'curly', '#C9A227', '#EDE6D6', 'sea', 'glasses', 'coffee') },
  { n: 9, first: 'Gizem', dob: '1988-12-05', district: 'Kadıköy', h: 171, intent: 'long_term', values: ['trust', 'family'],
    work: 'full_time', job: 'Pediatric nurse', school: 'İstanbul University', home: 'Trabzon', interests: ['food', 'animals'],
    dates: ['dinner', 'walk'], spot: 'Kadıköy çarşı', days: 'weekdays', time: 'evening',
    prompts: [['one_thing_to_know', 'I make friends with every street cat.'], ['always_make_time_for', 'Calling my mom on the way home.']],
    life: { smoking: 'no', drinking: 'none', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat' }, look: L('#E5BA97', '#CB9F7C', '#5A3A28', 'bun', '#1F3A2E', '#E6ECE3', 'cafe', 'earrings', 'coffee') },
  { n: 10, first: 'İrem', dob: '1994-08-16', district: 'Beşiktaş', h: 167, intent: 'long_term', values: ['respect', 'growth'],
    work: 'full_time', job: 'Data analyst', interests: ['tech', 'gaming', 'music'],
    artists: ['Mor ve Ötesi'], dates: ['drinks', 'activity'], days: 'either', time: 'either',
    prompts: [['oddly_good_at', 'Remembering everyone’s coffee order.'], ['you_pick_the_place', 'Somewhere with board games.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'neutral', activity: 'somewhat' }, look: L('#C68E68', '#AB7552', '#2A1C14', 'long', '#5E7D6A', '#EDE6D6', 'city', 'glasses', 'music') },
  { n: 11, first: 'Defne', dob: '1996-10-02', district: 'Maltepe', h: 163, intent: 'figuring_out', values: ['fun'],
    work: 'between_jobs', interests: ['fashion', 'nightlife'],
    dates: ['drinks'], days: 'weekends', time: 'evening',
    prompts: [['dont_judge_me', 'I have opinions about every playlist.'], ['always_say_yes_to', 'Karaoke.']],
    life: { smoking: 'yes', drinking: 'regularly', pets: 'rather_not', activity: 'not_very' }, look: L('#F0C9A8', '#D6AD8C', '#7A4B2A', 'bob', '#8C4B3C', '#F1E4D3', 'cafe', 'earrings', 'music') },
  { n: 12, first: 'Buse', dob: '1992-05-21', district: 'Ataşehir', h: 169, intent: 'long_term', values: ['stability', 'health'],
    work: 'full_time', job: 'Civil engineer', school: 'ODTÜ', home: 'Bursa', interests: ['outdoors', 'sports', 'travel'],
    screen: ['Ted Lasso'], dates: ['outdoors', 'walk'], spot: 'Polonezköy', days: 'weekends', time: 'daytime',
    prompts: [['sunday_starts_with', 'A long run and a bigger breakfast.'], ['together_we_could', 'Hike the Lycian Way, one stage at a time.'], ['ask_me_about', 'Bridges. Seriously.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'like_no_pets', activity: 'very' }, look: L('#E2B593', '#C99A7A', '#1E1611', 'pixie', '#1F3A2E', '#E6ECE3', 'park', 'none', 'bike') },
  { n: 13, first: 'Ceren', dob: '1997-02-11', district: 'Üsküdar', h: 161, intent: 'casual', values: ['independence', 'adventure'],
    work: 'self_employed', job: 'Photographer', interests: ['art', 'travel'],
    dates: ['coffee', 'walk'], days: 'either', time: 'daytime',
    prompts: [['friends_know_me_for', 'Taking the photo everyone ends up using.'], ['want_to_try', 'Shooting a film camera in Mardin.']],
    life: { smoking: 'sometimes', drinking: 'sometimes', pets: 'neutral', activity: 'somewhat' }, look: L('#B97A57', '#9E6545', '#3B2A20', 'wavy', '#C9A227', '#EDE6D6', 'sea', 'none', 'camera') },
  { n: 14, first: 'Pınar', dob: '1989-09-28', district: 'Kadıköy', h: 164, intent: 'long_term', values: ['affection', 'trust'],
    work: 'full_time', job: 'Teacher', school: 'Marmara University', interests: ['books', 'culture'],
    books: ['Aylak Adam'], dates: ['coffee', 'dinner'], spot: 'Yeldeğirmeni', days: 'weekdays', time: 'evening',
    prompts: [['small_thing_i_love', 'Handwritten notes in second-hand books.'], ['first_date_needs', 'Good conversation more than a fancy place.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'other', activity: 'not_very' }, look: L('#F3D2B5', '#DAB394', '#5A3A28', 'long', '#8C4B3C', '#F1E4D3', 'cafe', 'glasses', 'books') },
  { n: 15, first: 'Lara', dob: '2000-06-04', district: 'Beşiktaş', h: 172, intent: 'figuring_out', values: ['fun', 'growth'],
    work: 'student', interests: ['music', 'sports'],
    dates: ['activity'], days: 'either', time: 'either',
    prompts: [['most_used_phrase', '“Wait, let me check my calendar.”'], ['teach_me_how_to', 'Play the bağlama.']],
    life: { smoking: 'no', drinking: 'none', pets: 'neutral', activity: 'very' }, look: L('#8D5A3E', '#774A33', '#2A1C14', 'bun', '#5E7D6A', '#E6ECE3', 'park', 'earrings', 'music') },
  { n: 16, first: 'Sena', dob: '1994-01-17', district: 'Şişli', h: 166, intent: 'long_term', values: ['respect'],
    work: 'full_time', job: 'Lawyer', home: 'Antalya', interests: ['food', 'travel', 'culture'],
    dates: ['dinner'], days: 'weekends', time: 'evening',
    prompts: [['always_make_time_for', 'A proper dinner, even on busy weeks.'], ['take_too_seriously', 'Restaurant reviews.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'like_no_pets', activity: 'somewhat' }, look: L('#E8BE9B', '#CFA07D', '#1E1611', 'bob', '#1F3A2E', '#EDE6D6', 'city', 'none', 'coffee') },
  { n: 17, first: 'Yağmur', dob: '1991-08-09', district: 'Sarıyer', h: 159, intent: 'casual', values: ['adventure', 'health'],
    work: 'part_time', job: 'Yoga instructor', interests: ['wellness', 'outdoors'],
    dates: ['walk', 'outdoors'], days: 'weekdays', time: 'daytime',
    prompts: [['after_a_long_day', 'Sea, silence, and tea.'], ['funny_little_habit', 'Stretching in every queue.']],
    life: { smoking: 'no', drinking: 'none', pets: 'have_pets', pet_kind: 'dog', activity: 'very' }, look: L('#C68E68', '#AB7552', '#C6923C', 'curly', '#C9A227', '#E6ECE3', 'sea', 'none', 'plant') },
  { n: 18, first: 'Tuana', dob: '1986-03-02', district: 'Bakırköy', h: 168, intent: 'long_term', values: ['family', 'stability'],
    work: 'full_time', job: 'Pharmacist', school: 'Ege University', interests: ['animals', 'food'],
    dates: ['coffee'], days: 'either', time: 'daytime',
    prompts: [['one_thing_to_know', 'I bake when I’m happy and when I’m sad.'], ['comfort_food', 'My aunt’s börek.']],
    life: { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat' }, look: L('#E5BA97', '#CB9F7C', '#4A2F22', 'wavy', '#5E7D6A', '#F1E4D3', 'park', 'earrings', 'coffee') },
];
const SURNAME = 'Synthetic'; // private field, never shown on profiles
const WANTS = (n) => (n % 5 === 0 ? ['everyone'] : ['men']);
const slug = (s) => s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[^a-z]/g, '');

async function allUsers() {
  const out = [];
  for (let page = 1; page < 20; page += 1) {
    const r = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (r.error) fail(r.error.message);
    out.push(...r.data.users);
    if (r.data.users.length < 200) break;
  }
  return out;
}

async function signIn(email) {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) fail(`generateLink: ${link.error.message}`);
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) fail(`sign-in failed (${email.split('@')[0]}): ${v.error.message}`);
  return { c, uid: v.data.user.id };
}

const must = (r, what) => {
  if (r.error) fail(`${what}: ${r.error.message}`);
  return r.data;
};

async function seedOne(p, existing) {
  const email = `tempa-pool-${String(p.n).padStart(2, '0')}@tempa-test.example.com`;
  const user = existing.get(email);
  if (user) {
    const st = (await admin.from('account_state_v2').select('application_status').eq('user_id', user.id).maybeSingle()).data;
    if (st?.application_status === 'accepted') return { email, id: user.id, action: 'kept' };
  }
  const { c, uid } = await signIn(email);
  const b = must(await c.rpc('get_my_onboarding_v2'), 'load');
  if (b.state.application_status === 'draft' || b.state.application_status === 'changes_requested') {
    const save = async (section, data) => must(await c.rpc('save_onboarding_v2', { p_section: section, p_data: data }), `save ${section}`);
    await save('basics', { first_name: p.first, last_name: SURNAME, date_of_birth: p.dob, gender: 'woman', interested_in: WANTS(p.n),
      location_id: `tr-istanbul-${slug(p.district)}`, location_city: 'İstanbul', location_district: p.district,
      location_label: `${p.district}, İstanbul, Turkey`, height_cm: p.h });
    const social = ['low_key', 'mix', 'social'][p.n % 3];
    await save('compatibility', { intent: p.intent, social_energy: social, message_frequency: ['little_each_day', 'few_checkins', 'often'][p.n % 3],
      relationship_space: ['plenty_of_space', 'balance', 'lots_together'][(p.n + 1) % 3], emotional_expression: ['reserved', 'warm_when_comfortable', 'open'][(p.n + 2) % 3],
      meeting_pace: ['quickly', 'after_chatting', 'take_my_time'][p.n % 3], core_values: p.values });
    await save('yourLife', { pet_kind: null, ...p.life });
    await save('yourWorld', { work_status: p.work ?? null, job_title: p.job ?? null,
      school: p.school ? custom('school', p.school) : null, hometown: p.home ? custom('hometown', p.home) : null,
      interests: p.interests, artists: (p.artists ?? []).map((t) => custom('artist', t)), books: (p.books ?? []).map((t) => custom('book', t)),
      screen: (p.screen ?? []).map((t) => custom('screen', t)) });
    await save('yourDates', { date_types: p.dates, favorite_spot: p.spot ?? null, days_pref: p.days, time_pref: p.time });

    if ((b.photos ?? []).length < 3) {
      const imgs = renderPortraits(p.look);
      for (const img of imgs.slice((b.photos ?? []).length)) {
        const path = `${uid}/${crypto.randomBytes(12).toString('hex')}.png`;
        must(await c.storage.from(PHOTOS).upload(path, img, { contentType: 'image/png' }), 'upload photo');
        must(await c.rpc('add_profile_photo_v2', { p_path: path }), 'register photo');
      }
    }
    must(await c.rpc('save_prompts_v2', { p_prompts: p.prompts.map(([id, answer], i) => ({ slot: i + 1, prompt_id: id, answer })) }), 'prompts');
    if (!b.state.has_selfie) {
      const selfie = renderPortraits({ ...p.look, accessory: 'none' })[0];
      const sp = `${uid}/${crypto.randomBytes(16).toString('hex')}.png`;
      must(await c.storage.from(SELFIES).upload(sp, selfie, { contentType: 'image/png' }), 'upload selfie');
      must(await c.rpc('set_verification_selfie_v2', { p_path: sp }), 'register selfie');
    }
    must(await c.from('profiles').update({ privacy_consent_at: new Date().toISOString() }).eq('id', uid), 'consent');
    const sub = must(await c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() }), 'submit');
    if (sub.status !== 'submitted') fail(`${email.split('@')[0]} not submittable: ${JSON.stringify(sub.missing ?? sub)}`);
  }
  must(await admin.rpc('review_application_v2', { p_user: uid, p_decision: 'accept' }), 'accept');
  return { email, id: uid, action: user ? 'completed' : 'created' };
}

const users = await allUsers();
const existing = new Map(users.filter((u) => u.email?.startsWith('tempa-pool-')).map((u) => [u.email, u]));
if (process.argv.includes('--list')) {
  for (const p of P) {
    const u = existing.get(`tempa-pool-${String(p.n).padStart(2, '0')}@tempa-test.example.com`);
    const st = u ? (await admin.from('account_state_v2').select('application_status').eq('user_id', u.id).maybeSingle()).data?.application_status : '—';
    console.log(`${String(p.n).padStart(2, '0')} ${p.first.padEnd(8)} ${st ?? 'no state'} ${u?.id ?? ''}`);
  }
  process.exit(0);
}
if (process.argv.includes('--verify')) {
  // Read-only check through the NORMAL viewer path, as another synthetic member
  // (a 32-year-old İstanbul man looking for women — same filters as the phone).
  const VIEWER = 'cca06005-cf37-4928-ba40-81456d7831f1';
  const vu = (await admin.auth.admin.getUserById(VIEWER)).data.user;
  if (!vu?.email?.endsWith('@tempa-test.example.com')) fail('viewer is not synthetic');
  const { c } = await signIn(vu.email);
  const ids = new Map(users.filter((u) => u.email?.startsWith('tempa-pool-')).map((u) => [u.id, u.email]));
  const cand = (await c.rpc('get_discovery_candidates_v2', { p_limit: 100 })).data ?? [];
  const inPool = cand.filter((r) => ids.has(r.user_id));
  const ALLOWED = ['activity', 'age', 'artists', 'books', 'city', 'core_values', 'date_types', 'days_pref', 'drinking',
    'favorite_spot', 'first_name', 'height_cm', 'hometown', 'intent', 'interests', 'job_title', 'pet_kind', 'pets',
    'photo_paths', 'prompts', 'school', 'screen', 'smoking', 'time_pref', 'user_id', 'work_status', 'zodiac'];
  let ok = 0; let bad = 0; let sparse = 0;
  for (const r of inPool) {
    const prof = (await c.rpc('get_profile_v2', { p_user: r.user_id })).data;
    const keysOk = prof && JSON.stringify(Object.keys(prof).sort()) === JSON.stringify(ALLOWED);
    const signed = prof ? await c.storage.from(PHOTOS).createSignedUrl(prof.photo_paths[0], 900) : { error: true };
    const res = signed.error ? null : await fetch(signed.data.signedUrl);
    const bytes = res && res.ok ? (await res.arrayBuffer()).byteLength : 0;
    const good = keysOk && prof.photo_paths.length === 3 && prof.prompts.length >= 2 && bytes > 10000;
    if (!prof.job_title && !prof.school && !prof.hometown && prof.artists.length === 0) sparse += 1;
    good ? (ok += 1) : (bad += 1, console.log('FAIL', r.first_name, { keysOk, bytes }));
  }
  console.log(`[pool verify] ${env.ref}: ${inPool.length}/18 pool members in Discover for a matching viewer; ${ok} profiles OK, ${bad} bad; ${sparse} sparse (optional fields empty → hidden)`);
  process.exit(bad || inPool.length !== 18 ? 1 : 0);
}
const counts = { created: 0, completed: 0, kept: 0 };
for (const p of P) {
  const r = await seedOne(p, existing);
  counts[r.action] += 1;
  console.log(`[pool] ${String(p.n).padStart(2, '0')} ${p.first.padEnd(8)} ${r.action}`);
}
console.log(`[pool] ${env.ref}: ${counts.created} created, ${counts.completed} completed, ${counts.kept} already there`);
