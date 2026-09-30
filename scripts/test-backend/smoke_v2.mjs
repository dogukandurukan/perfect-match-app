// V2 onboarding end-to-end on the SEPARATE test project — real Auth (email
// OTP verification), real PostgREST RPCs, real Storage uploads. Two synthetic
// accounts (A and B). Evidence is read back from the database with the
// service key and written to .test-backend/evidence-v2.json (git-ignored).
//
//   node scripts/test-backend/apply.mjs v2        # once, after base + p0a
//   node scripts/test-backend/smoke_v2.mjs        # creates 2 new synthetic accounts
//
// The email code is obtained with the Auth admin API (generateLink →
// email_otp) and then verified through the normal client verifyOtp call, so
// no email is sent and the real verification path is exercised. Prints
// pass/fail only; no keys, passwords, codes or URLs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv, outDir } from './_env.mjs';
import { png } from './_png.mjs';

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const run = crypto.randomBytes(3).toString('hex');
const PHOTOS = 'profile-photos-private';
const SELFIES = 'verification-selfies';

let passed = 0;
let failed = 0;
const results = [];
const check = (c, n) => {
  results.push({ name: n, ok: !!c });
  if (c) passed += 1;
  else {
    failed += 1;
    console.log('FAIL', n);
  }
};

// A client whose network can be cut on demand (simulated connection loss).
function makeClient() {
  const net = { down: false };
  const f = (input, init) => (net.down ? Promise.reject(new TypeError('Network request failed')) : fetch(input, init));
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: f } });
  return { c, net };
}

async function signInWithEmailCode(email) {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) fail(`generateLink: ${link.error.message}`);
  const otp = link.data?.properties?.email_otp;
  if (!otp) fail('no email_otp returned by generateLink');
  const { c, net } = makeClient();
  const v = await c.auth.verifyOtp({ email, token: otp, type: 'email' });
  check(!v.error && v.data.session, `auth: ${email.split('@')[0]} signs in with the email code`);
  return { c, net, userId: v.data.user.id };
}

const rpc = async (cl, fn, args = {}) => cl.rpc(fn, args);
const errIs = (r, text) => !!r.error && (r.error.message ?? '').includes(text);

async function main() {
  const emailA = `v2a-${run}@tempa-test.example.com`;
  const emailB = `v2b-${run}@tempa-test.example.com`;
  // Users are created by the first email-code sign-in (shouldCreateUser);
  // generateLink creates them on the admin side the same way.
  const A = await signInWithEmailCode(emailA);
  const B = await signInWithEmailCode(emailB);
  fs.writeFileSync(path.join(outDir, `v2-accounts-${run}.local.json`), JSON.stringify({ run, A: A.userId, B: B.userId, emailA, emailB }, null, 1), { mode: 0o600 });

  // ---- gate + draft creation ----------------------------------------------
  check((await rpc(A.c, 'get_my_access_v2')).data?.gate === 'onboarding', 'gate: new user → onboarding');
  const first = await rpc(A.c, 'get_my_onboarding_v2');
  check(!first.error && first.data.state.application_status === 'draft' && first.data.email.confirmed === true,
    'first load: draft created, email confirmed by the code sign-in');

  // ---- answers, resume, reconnect -------------------------------------------
  const save = (section, data, resumeSection, resumeStep) =>
    rpc(A.c, 'save_onboarding_v2', { p_section: section, p_data: data, p_resume_step: resumeStep, p_resume_section: resumeSection });
  check(!(await save('basics', { first_name: 'Test', last_name: 'Ada', date_of_birth: '1996-07-21', gender: 'woman',
    interested_in: ['men'], location_id: 'tr-istanbul-besiktas', location_city: 'İstanbul', location_district: 'Beşiktaş',
    location_label: 'Beşiktaş, İstanbul, Turkey', height_cm: 168 }, 'compatibility', 1)).error, 'save basics');
  A.net.down = true;
  const offline = await save('compatibility', { intent: 'long_term' }, 'compatibility', 2);
  A.net.down = false;
  check(!!offline.error, 'connection lost: the save reports an error (the app keeps the user on the step)');
  const afterOffline = (await admin.from('onboarding_v2').select('intent').eq('user_id', A.userId).single()).data;
  check(afterOffline?.intent === null, 'DB: nothing written while offline');
  check(!(await save('compatibility', { intent: 'long_term', social_energy: 'mix', message_frequency: 'few_checkins',
    relationship_space: 'balance', emotional_expression: 'open', meeting_pace: 'after_chatting', core_values: ['trust', 'respect'] },
    'yourLife', 1)).error, 'retry after reconnect saves');
  check(!(await save('yourLife', { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat' }, 'yourWorld', 1)).error, 'save your life');
  check(!(await save('yourWorld', { work_status: 'full_time', job_title: 'Designer', interests: ['travel', 'music'],
    school: null, hometown: null, artists: [], books: [], screen: [] }, 'yourDates', 1)).error, 'save your world');
  check(!(await save('yourDates', { date_types: ['coffee', 'walk'], favorite_spot: 'Bebek', days_pref: 'weekends', time_pref: 'evening' },
    'yourProfile', 1)).error, 'save your dates');
  check(!!(await save('basics', { gender: 'robot' }, null, null)).error, 'invalid value rejected by the server');

  // re-login (new session, new client) → same data + resume position
  const A2 = await signInWithEmailCode(emailA);
  const reload = (await rpc(A2.c, 'get_my_onboarding_v2')).data;
  check(reload?.draft?.first_name === 'Test' && reload?.draft?.intent === 'long_term' && reload?.draft?.favorite_spot === 'Bebek',
    're-login: answers intact');
  check(reload?.draft?.resume_section === 'yourProfile' && reload?.draft?.resume_step === 1, 're-login: resumes at Your Profile, step 1');

  // ---- photos: upload, failed upload, reorder, delete ------------------------
  const uploaded = [];
  for (let i = 0; i < 4; i += 1) {
    const p = `${A.userId}/${crypto.randomBytes(12).toString('hex')}.png`;
    const up = await A.c.storage.from(PHOTOS).upload(p, png([40 + i * 40, 90, 160]), { contentType: 'image/png' });
    check(!up.error, `photo ${i + 1} uploaded`);
    const reg = await rpc(A.c, 'add_profile_photo_v2', { p_path: p });
    check(!reg.error && reg.data.position === i + 1, `photo ${i + 1} registered at position ${i + 1}`);
    uploaded.push({ id: reg.data?.id, path: p });
  }
  A.net.down = true;
  const lost = await A.c.storage.from(PHOTOS).upload(`${A.userId}/lost.png`, png([1, 1, 1]), { contentType: 'image/png' });
  A.net.down = false;
  check(!!lost.error, 'failed upload (connection lost) reports an error');
  check(errIs(await rpc(A.c, 'add_profile_photo_v2', { p_path: `${A.userId}/lost.png` }), 'photo_not_uploaded'),
    'a failed upload can never be registered as a photo');
  check(!!(await A.c.storage.from(PHOTOS).upload(`${B.userId}/intrude.png`, png([9, 9, 9]), { contentType: 'image/png' })).error,
    'cannot upload into another user\'s folder');
  const order = [uploaded[3].id, uploaded[0].id, uploaded[1].id, uploaded[2].id];
  check(!(await rpc(A.c, 'reorder_profile_photos_v2', { p_ids: order })).error, 'reorder');
  const del = await rpc(A.c, 'delete_profile_photo_v2', { p_id: uploaded[1].id });
  check(!del.error && del.data.path === uploaded[1].path, 'delete returns the object path');
  check(!(await A.c.storage.from(PHOTOS).remove([uploaded[1].path])).error, 'owner removes the object');
  const dbPhotos = (await admin.from('profile_photos_v2').select('id, position, storage_path').eq('user_id', A.userId).order('position')).data ?? [];
  check(dbPhotos.map((p) => p.id).join() === [uploaded[3].id, uploaded[0].id, uploaded[2].id].join()
    && dbPhotos.map((p) => p.position).join() === '1,2,3', 'DB: 3 photos, new order, positions 1..3');
  const objs = (await admin.storage.from(PHOTOS).list(A.userId)).data ?? [];
  check(objs.length === 3 && !objs.some((o) => o.name === 'lost.png'), 'Storage: exactly the 3 registered objects remain');

  // ---- prompts, private selfie ---------------------------------------------
  check(!(await rpc(A.c, 'save_prompts_v2', { p_prompts: [
    { slot: 1, prompt_id: 'small_thing_i_love', answer: 'Morning coffee.' },
    { slot: 2, prompt_id: 'together_we_could', answer: 'Find the best tiramisu.' }] })).error, 'prompts saved');
  const selfiePath = `${A.userId}/${crypto.randomBytes(16).toString('hex')}.jpg`;
  check(!(await A.c.storage.from(SELFIES).upload(selfiePath, png([200, 180, 160]), { contentType: 'image/jpeg' })).error, 'selfie uploaded');
  check(!(await rpc(A.c, 'set_verification_selfie_v2', { p_path: selfiePath })).error, 'selfie recorded');
  const ownSelfie = await A.c.storage.from(SELFIES).createSignedUrl(selfiePath, 60);
  check(!!ownSelfie.error, 'the owner cannot read their selfie back');
  check(!!(await B.c.storage.from(SELFIES).createSignedUrl(selfiePath, 60)).error, 'another user cannot read it');

  // ---- other account --------------------------------------------------------
  await rpc(B.c, 'get_my_onboarding_v2');
  for (const t of ['onboarding_v2', 'profile_photos_v2', 'profile_prompts_v2', 'account_state_v2']) {
    const r = await B.c.from(t).select('*').eq('user_id', A.userId);
    check(!r.error && (r.data ?? []).length === 0, `B cannot read A's ${t}`);
  }
  check(!!(await B.c.storage.from(PHOTOS).createSignedUrl(dbPhotos[0].storage_path, 60)).error, 'B cannot sign A\'s photos (pending applicant)');
  check(((await B.c.from('profile_cards').select('id').eq('id', A.userId)).data ?? []).length === 0, 'B cannot see A\'s card');
  check(!!(await rpc(B.c, 'delete_profile_photo_v2', { p_id: uploaded[0].id })).error, 'B cannot delete A\'s photo');
  check(!!(await B.c.from('account_state_v2').update({ application_status: 'accepted' }).eq('user_id', B.userId)).error
    || ((await admin.from('account_state_v2').select('application_status').eq('user_id', B.userId).single()).data?.application_status === 'draft'),
    'B cannot change their own application status');

  // ---- submit: disconnect, rapid taps, gate --------------------------------
  check(!(await A.c.from('profiles').update({ privacy_consent_at: new Date().toISOString() }).eq('id', A.userId)).error,
    'KVKK consent recorded (as the V2 email screen does)');
  const req = crypto.randomUUID();
  A.net.down = true;
  const cut = await rpc(A.c, 'submit_application_v2', { p_request_id: req });
  A.net.down = false;
  check(!!cut.error, 'submit while offline reports an error (no "You\'re on the list")');
  const burst = await Promise.all([1, 2, 3, 4, 5].map(() => rpc(A.c, 'submit_application_v2', { p_request_id: req })));
  check(burst.every((r) => !r.error && r.data.status === 'submitted'), '5 rapid taps: all see "submitted"');
  check(burst.filter((r) => r.data?.already === false).length === 1, 'exactly one submission performed');
  const st = (await admin.from('account_state_v2').select('*').eq('user_id', A.userId)).data ?? [];
  check(st.length === 1 && st[0].application_status === 'submitted' && st[0].verification_status === 'pending'
    && st[0].membership_status === 'none' && !!st[0].selfie_path, 'DB: one application row — submitted / pending / not a member, selfie stored');
  check((await rpc(A.c, 'get_my_access_v2')).data?.gate === 'waiting', 'gate after submit: waiting (no Home)');
  const disc = await rpc(A.c, 'get_discovery_cards', { p_limit: 10 });
  check(!disc.error && (disc.data ?? []).length === 0, 'pending applicant gets no discovery');
  check(!!(await save('basics', { first_name: 'Changed' }, null, null)).error, 'answers locked after submission');
  const bSubmit = await rpc(B.c, 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(!bSubmit.error && bSubmit.data.status === 'draft' && (bSubmit.data.missing ?? []).length > 0, 'incomplete B cannot submit');

  // ---- evidence (stored data, no secrets) ------------------------------------
  const evidence = {
    run,
    account_state: st.map(({ selfie_path, ...rest }) => ({ ...rest, selfie_path: selfie_path ? '<stored, private>' : null })),
    onboarding: (await admin.from('onboarding_v2').select('*').eq('user_id', A.userId)).data,
    photos: dbPhotos,
    prompts: (await admin.from('profile_prompts_v2').select('*').eq('user_id', A.userId)).data,
    storage_objects: objs.map((o) => o.name),
    results,
  };
  fs.writeFileSync(path.join(outDir, `evidence-v2-${run}.json`), JSON.stringify(evidence, null, 1), { mode: 0o600 });
  console.log(`[smoke v2] ${env.ref}: ${passed} passed, ${failed} failed — evidence: .test-backend/evidence-v2-${run}.json`);
  process.exit(failed ? 1 : 0);
}
await main();
