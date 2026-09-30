// Seeds the SEPARATE test project with synthetic people only (no live data):
//   node scripts/test-backend/seed.mjs          (refuses if already seeded)
//   node scripts/test-backend/seed.mjs --reset  (deletes the seeded users first)
//
// Creates the two PHONE accounts (Tester A = Deniz, man; Tester B = Ada,
// woman) with random passwords written ONLY to .test-backend/accounts.local.json
// (git-ignored, mode 600), a set of synthetic Istanbul profiles covering the
// visibility cases, two İzmir "smoke" users for scripts/test-backend/smoke.mjs,
// plain-colour photos (no faces) in the private bucket, venues, and the
// relationships listed in CASES below. Runs with the TEST service key, which
// bypasses RLS/guards by design (setup only).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv, outDir } from './_env.mjs';
import { png } from './_png.mjs';

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const accountsFile = path.join(outDir, 'accounts.local.json');
const DOMAIN = 'tempa-test.example.com'; // reserved-style test domain; never delivers mail
const BUCKET = 'profile-photos-private';

// ---- people -----------------------------------------------------------------
const base = {
  city: 'Istanbul', country_code: 'TR', setup_completed: true, current_step: 5,
  hobbies: ['Music', 'Travel', 'Cooking'], availability_days: ['Saturday', 'Sunday'],
  availability_hours: ['Evening'], morning_night: 'Night owl', drinking: 'Socially', smoking: 'Never',
  languages: ['Turkish', 'English'], education: 'University', meeting_environment: ['A coffee date ☕'],
  bio: 'Synthetic test profile.', favorite_music: 'Jazz', favorite_movie: 'Amélie', favorite_book: 'Dune',
  first_date_expectation: 'Coffee and a walk', privacy_consent_at: new Date().toISOString(),
};
const woman = { gender: 'Woman', meeting_preferences: ['Men'] };
const man = { gender: 'Man', meeting_preferences: ['Women'] };
const PEOPLE = [
  { key: 'A', first_name: 'Deniz', phone: true, dob: '1994-03-10', district: 'Kadıköy', ...man, is_premium: true, color: [40, 90, 160] },
  { key: 'B', first_name: 'Ada', phone: true, dob: '1996-07-21', district: 'Beşiktaş', ...woman, color: [170, 70, 90] },
  { key: 'ECE', first_name: 'Ece', dob: '1995-01-02', district: 'Beşiktaş', ...woman, color: [220, 160, 60] },
  { key: 'SELIN', first_name: 'Selin', dob: '1993-05-05', district: 'Kadıköy', ...woman, color: [90, 160, 110] },
  { key: 'ZEYNEP', first_name: 'Zeynep', dob: '1995-09-09', district: 'Üsküdar', ...woman, is_hidden: true, color: [120, 80, 170] },
  { key: 'MELIS', first_name: 'Melis', dob: '1997-11-11', district: 'Şişli', ...woman, is_hidden: true, color: [200, 110, 150] },
  { key: 'BUSE', first_name: 'Buse', dob: '1992-12-12', district: 'Beyoğlu', ...woman, is_hidden: true, color: [110, 110, 110] },
  { key: 'LARA', first_name: 'Lara', dob: '1996-02-14', district: 'Sarıyer', ...woman, color: [60, 150, 170] },
  { key: 'NIL', first_name: 'Nil', dob: '1994-04-04', district: 'Maltepe', ...woman, color: [150, 150, 60] },
  { key: 'CEM', first_name: 'Cem', dob: '1993-08-08', district: 'Kadıköy', ...man, color: [80, 120, 60] },
  { key: 'KAAN', first_name: 'Kaan', dob: '1995-10-10', district: 'Beşiktaş', ...man, color: [170, 120, 60] },
  { key: 'S1', first_name: 'Smoke1', dob: '1994-06-06', district: 'Karşıyaka', city: 'Izmir', ...man, smoke: true, color: [30, 30, 30] },
  { key: 'S2', first_name: 'Smoke2', dob: '1995-06-06', district: 'Bornova', city: 'Izmir', ...woman, smoke: true, color: [200, 200, 200] },
];
// What each synthetic person means for the testers (also printed at the end).
const CASES = {
  ECE: 'visible — should appear in discovery for Deniz',
  SELIN: 'visible — should appear in discovery for Deniz',
  ZEYNEP: 'HIDDEN, but an accepted chat with Deniz already exists → Deniz still sees her in Chats',
  MELIS: 'HIDDEN, sent Deniz an invite (pending) → must NOT be visible to Deniz anywhere',
  BUSE: 'HIDDEN, liked Deniz → must NOT appear in Deniz\'s Liked-you, not even the count',
  LARA: 'visible, liked Deniz → appears in Deniz\'s Liked-you (Deniz is premium)',
  NIL: 'blocked Deniz → must NOT be visible to Deniz anywhere',
  CEM: 'visible — should appear in discovery for Ada',
  KAAN: 'visible — should appear in discovery for Ada',
};

// ---- helpers -------------------------------------------------------------------
const must = (res, what) => {
  if (res.error) fail(`${what}: ${res.error.message}`);
  return res.data;
};
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

async function reset() {
  if (!fs.existsSync(accountsFile)) return;
  const saved = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
  if (saved.projectRef !== env.ref) fail('accounts.local.json belongs to another project');
  const ids = Object.values(saved.ids);
  for (const id of ids) {
    const { data: objs } = await admin.storage.from(BUCKET).list(id);
    if (objs?.length) await admin.storage.from(BUCKET).remove(objs.map((o) => `${id}/${o.name}`));
  }
  must(await admin.from('profiles').delete().in('id', ids), 'delete profiles');
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  must(await admin.from('venues').delete().like('address', 'tempa-test%'), 'delete venues');
  fs.rmSync(accountsFile);
  console.log(`[seed] ${env.ref}: previous seed removed`);
}

async function main() {
  if (process.argv.includes('--reset')) await reset();
  if (fs.existsSync(accountsFile)) fail('already seeded — use --reset');
  const bucket = await admin.storage.getBucket(BUCKET);
  if (bucket.error || bucket.data?.public !== false) fail(`${BUCKET} missing or not private — run apply.mjs p0a first`);

  const run = crypto.randomBytes(3).toString('hex');
  const ids = {};
  const logins = {};
  for (const p of PEOPLE) {
    const email = `${p.key.toLowerCase()}-${run}@${DOMAIN}`;
    const password = crypto.randomBytes(12).toString('base64url');
    const u = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `create ${p.key}`);
    ids[p.key] = u.user.id;
    if (p.phone || p.smoke) logins[p.key] = { name: p.first_name, email, password };
  }
  for (const p of PEOPLE) {
    const id = ids[p.key];
    const photoPath = `${id}/${crypto.randomBytes(16).toString('hex')}.png`;
    must(await admin.storage.from(BUCKET).upload(photoPath, png(p.color), { contentType: 'image/png' }), `photo ${p.key}`);
    const { key, phone, smoke, color, dob, ...fields } = p;
    void key; void phone; void smoke; void color;
    must(await admin.from('profiles').upsert({ id, ...base, ...fields, date_of_birth: dob, last_name: 'Synthetic',
      phone_number: '+900000000000', photos: [photoPath] }), `profile ${p.key}`);
    must(await admin.from('onboarding_answers').upsert({ user_id: id, intent: 'open_to_relationship' }, { onConflict: 'user_id' }), `intent ${p.key}`);
  }
  must(await admin.from('venues').insert([
    { name: 'Moda Kahve', district: 'Kadıköy', emoji: '☕', address: 'tempa-test' },
    { name: 'Bebek Çay Bahçesi', district: 'Beşiktaş', emoji: '🍵', address: 'tempa-test' },
    { name: 'Cihangir Fırın', district: 'Beyoğlu', emoji: '🥐', address: 'tempa-test' },
  ]), 'venues');

  const [za, zb] = pair(ids.A, ids.ZEYNEP);
  const zm = must(await admin.from('matches').insert({ user_a_id: za, user_b_id: zb, match_score: 80, status: 'accepted',
    chat_opened: true, invited_by: ids.ZEYNEP, expires_at: new Date(Date.now() + 48 * 3600e3).toISOString() }).select('id').single(), 'Zeynep chat');
  must(await admin.from('messages').insert({ sender_id: ids.ZEYNEP, receiver_id: ids.A, content: 'Hi Deniz, this is a synthetic chat.' }), 'Zeynep msg');
  const [ma, mb] = pair(ids.A, ids.MELIS);
  must(await admin.from('matches').insert({ user_a_id: ma, user_b_id: mb, match_score: 70, status: 'pending', chat_opened: false,
    invited_by: ids.MELIS, expires_at: new Date(Date.now() + 24 * 3600e3).toISOString() }), 'Melis invite');
  must(await admin.from('likes').insert([
    { liker_id: ids.BUSE, likee_id: ids.A, target_type: 'profile', note: 'synthetic note from Buse' },
    { liker_id: ids.LARA, likee_id: ids.A, target_type: 'profile', note: 'synthetic note from Lara' },
  ]), 'likes');
  must(await admin.from('blocks').insert({ blocker_id: ids.NIL, blocked_id: ids.A }), 'Nil blocks Deniz');

  fs.writeFileSync(accountsFile, JSON.stringify({ projectRef: env.ref, run, ids, logins, zeynepMatchId: zm.id }, null, 1), { mode: 0o600 });
  console.log(`[seed] ${env.ref}: seeded ${PEOPLE.length} synthetic users (run ${run}).`);
  console.log(`[seed] Phone logins are in ${accountsFile} (not printed).`);
  for (const [k, v] of Object.entries(CASES)) console.log(`  ${PEOPLE.find((p) => p.key === k).first_name}: ${v}`);
}
await main();
