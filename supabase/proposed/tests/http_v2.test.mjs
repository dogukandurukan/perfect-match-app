// V2 onboarding persistence + application + access gate — over real
// PostgREST HTTP on the live-schema replica (P0-A + P1 + V2 applied).
// Synthetic users only. Evidence is the DATA read back from the database,
// not UI state. Storage objects are created as the caller's role (the same
// storage.objects policies the Storage API enforces).
//
// Run: PGLITE_DIR=<dir>/node_modules POSTGREST=<postgrest 13> node supabase/proposed/tests/http_v2.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReplicaSql } from './replica.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const proposed = path.resolve(here, '..');
const pgliteDir = process.env.PGLITE_DIR;
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, '@electric-sql/pglite/dist/index.js')).href);
const { PGLiteSocketServer } = await import(
  pathToFileURL(path.join(pgliteDir, '@electric-sql/pglite-socket/dist/index.js')).href
);
const PG_PORT = 54349;
const API_PORT = 54350;
const SECRET = 'local-test-secret-local-test-secret-0123456789';

const id = (n) => `00000000-0000-4000-8000-0000000002${n}`;
const U = {
  U1: id('01'), // V2 applicant (tested end to end)
  U2: id('02'), // second V2 applicant (the "other account")
  L: id('03'), // legacy V1 member (must keep working)
  M: id('04'), // accepted + verified + active V2 member
  W: id('05'), // legacy V1 member woman (discoverable)
};

let passed = 0;
let failed = 0;
const results = [];
let stage = '';
const check = (c, name) => {
  results.push({ stage, name, ok: !!c });
  if (c) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL [${stage}] ${name}`);
  }
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (uid) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const b = b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: 4102444800 });
  return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`;
};
async function api(actor, method, p, body, headers = {}) {
  const h = { 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers };
  if (actor !== 'anon') h.Authorization = `Bearer ${jwt(U[actor])}`;
  const res = await fetch(`http://127.0.0.1:${API_PORT}${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { ok: res.ok, status: res.status, json };
}
const rpc = (actor, fn, args = {}) => api(actor, 'POST', `/rpc/${fn}`, args);
const rows = (r) => (Array.isArray(r.json) ? r.json : []);
const errMsg = (r) => (r.json && typeof r.json === 'object' ? `${r.json.message ?? ''}` : '');

const db = new PGlite();
for (const m of ['exec', 'query']) {
  const raw = db[m].bind(db);
  db[m] = async (...a) => {
    for (let i = 0; ; i += 1) {
      try { return await raw(...a); } catch (e) {
        if (i < 40 && (e?.code === '25006' || e?.code === '25001')) { await new Promise((r) => setTimeout(r, 25)); continue; }
        throw e;
      }
    }
  };
}
async function asRole(role, uid, sql) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(uid ? { sub: uid, role } : { role })]);
  if (role !== 'postgres') await db.exec(`set role ${role}`);
  try { return { ok: true, rows: (await db.query(sql)).rows }; } catch (e) { return { ok: false, error: e.message }; }
  finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claims', '', false)`); }
}
// Plain INSERT like the Storage API (no RETURNING: the selfie bucket has no
// SELECT policy at all, by design).
const upload = (uid, bucket, name) => asRole('authenticated', uid, `insert into storage.objects(bucket_id,name) values ('${bucket}','${name}')`);

// RPC rejections are asserted in SQL as the same role + JWT subject (exactly
// what PostgREST executes). They are NOT sent through the local HTTP bridge:
// pglite-socket drops the connection on an error raised inside a function
// (generic 503) and, PGlite being a single session, that leaves a dangling
// transaction that makes later requests flaky. Successful calls stay HTTP.
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && uuidRe.test(x))) {
    return `array[${v.map((x) => `'${x}'`).join(',')}]::uuid[]`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
async function rpcSqlError(actor, fn, args = {}) {
  const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const r = await asRole(actor === 'anon' ? 'anon' : 'authenticated', actor === 'anon' ? null : U[actor],
    `select public.${fn}(${named})`);
  return r.ok ? null : r.error;
}
const rejects = async (actor, fn, args, expected, name) => {
  const err = await rpcSqlError(actor, fn, args);
  check(err && err.includes(expected), `${name} (${expected})`);
};



let pgrst;
async function startApi() {
  const conf = path.join(process.env.TMPDIR || '/tmp', `pgrst-v2-${process.pid}.conf`);
  fs.writeFileSync(conf, [
    `db-uri = "postgres://authenticator:x@127.0.0.1:${PG_PORT}/postgres?sslmode=disable"`, 'db-schemas = "public"',
    'db-anon-role = "anon"', 'db-pool = 1', `jwt-secret = "${SECRET}"`, `server-port = ${API_PORT}`,
    'server-host = "127.0.0.1"', 'db-prepared-statements = false', 'db-channel-enabled = false', 'log-level = "crit"'].join('\n'));
  pgrst = spawn(process.env.POSTGREST, [conf], { stdio: 'ignore' });
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${API_PORT}/`)).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('PostgREST did not start');
}

const BASICS = {
  first_name: 'Test', last_name: 'Applicant', date_of_birth: '1995-04-12', gender: 'man', interested_in: ['women'],
  location_id: 'tr-istanbul-kadikoy', location_city: 'İstanbul', location_district: 'Kadıköy',
  location_label: 'Kadıköy, İstanbul, Turkey', height_cm: 181,
};
const COMPAT = { intent: 'long_term', social_energy: 'mix', message_frequency: 'few_checkins', relationship_space: 'balance',
  emotional_expression: 'open', meeting_pace: 'after_chatting', core_values: ['trust', 'respect'] };
const LIFE = { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat' };
const WORLD = { work_status: 'full_time', job_title: 'Designer', interests: ['travel', 'music', 'books'],
  school: { kind: 'school', source: 'custom', id: 'custom:school:bogazici', title: 'Boğaziçi' },
  artists: [{ kind: 'artist', source: 'custom', id: 'custom:artist:sezen', title: 'Sezen Aksu' }], books: [], screen: [] };
const DATES = { date_types: ['coffee', 'walk'], favorite_spot: 'Moda sahil', days_pref: 'weekends', time_pref: 'evening' };

async function main() {
  await db.exec(buildReplicaSql());
  for (const f of ['20260928130000_p0a_privacy_additive.sql', '20260930090000_p1_private_photos.sql',
    '20260930120000_v2_onboarding_persistence.sql']) {
    await db.exec(fs.readFileSync(path.join(proposed, f), 'utf8'));
  }
  // seed: auth users; legacy V1 members L and W; V2 member M activated by a reviewer
  await db.exec(`insert into auth.users(id, email) values
    ('${U.U1}','u1@tempa-test.invalid'), ('${U.U2}','u2@tempa-test.invalid'), ('${U.L}','l@tempa-test.invalid'),
    ('${U.M}','m@tempa-test.invalid'), ('${U.W}','w@tempa-test.invalid');
    insert into public.profiles(id, first_name, gender, city, date_of_birth, meeting_preferences, setup_completed, photos) values
    ('${U.L}','Legacy','Man','Istanbul','1994-01-01','{Women}',true,'{${U.L}/p.jpg}'),
    ('${U.W}','Wendy','Woman','Istanbul','1995-01-01','{Men}',true,'{${U.W}/p.jpg}'),
    ('${U.M}','Member','Woman','Istanbul','1995-02-02','{Men}',true,'{${U.M}/p.jpg}');
    insert into public.account_state_v2(user_id, application_status, verification_status, membership_status)
      values ('${U.M}','accepted','verified','active');`);
  const server = new PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1', maxConnections: 4 });
  await server.start();
  await startApi();
  try {
    await run();
  } finally {
    pgrst.kill('SIGTERM');
    await server.stop();
  }
  if (process.env.RESULTS_JSON) fs.writeFileSync(process.env.RESULTS_JSON, JSON.stringify({ passed, failed, results }, null, 1));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

async function run() {
  stage = 'ACCESS';
  await rejects('anon', 'get_my_onboarding_v2', {}, 'permission denied', 'anon cannot load a draft');
  await rejects('anon', 'submit_application_v2', { p_request_id: crypto.randomUUID() }, 'permission denied', 'anon cannot submit');
  check((await rpc('U1', 'get_my_access_v2')).json?.gate === 'onboarding', 'new user → gate onboarding');
  check((await rpc('L', 'get_my_access_v2')).json?.gate === 'legacy_member', 'existing V1 member → legacy_member (kept)');
  check((await rpc('M', 'get_my_access_v2')).json?.gate === 'member', 'accepted+verified+active → member');
  await rejects('L', 'get_my_onboarding_v2', {}, 'legacy_account', 'V1 member is never turned into a V2 applicant');
  check((await db.query(`select 1 from account_state_v2 where user_id='${U.L}'`)).rows.length === 0, 'no V2 state row created for the V1 member');

  stage = 'SAVE+RESUME';
  const first = await rpc('U1', 'get_my_onboarding_v2');
  check(first.ok && first.json.state.application_status === 'draft', 'first load creates an empty draft');
  const s1 = await rpc('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: { first_name: 'Test', last_name: 'Applicant' }, p_resume_step: 2 });
  check(s1.ok, 'save basics step 1');
  const s2 = await rpc('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: { date_of_birth: '1995-04-12' }, p_resume_step: 3 });
  check(s2.ok, 'save basics step 2 (partial)');
  const reload = await rpc('U1', 'get_my_onboarding_v2'); // "app closed and reopened" / re-login: same JWT subject
  check(reload.json.draft.first_name === 'Test' && reload.json.draft.last_name === 'Applicant'
    && reload.json.draft.date_of_birth === '1995-04-12', 'reopen: earlier answers kept (partial saves merge)');
  check(reload.json.draft.resume_section === 'basics' && reload.json.draft.resume_step === 3, 'reopen: resume position = next unfinished step');
  const stored = (await db.query(`select first_name, last_name, date_of_birth::text dob, resume_step from onboarding_v2 where user_id='${U.U1}'`)).rows[0];
  check(stored.first_name === 'Test' && stored.dob === '1995-04-12' && stored.resume_step === 3, 'DB row holds the saved values');
  const retry = await rpc('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: { date_of_birth: '1995-04-12' }, p_resume_step: 3 });
  check(retry.ok, 'the same save re-sent after a dropped connection is harmless (idempotent)');
  for (const [name, section, data] of [
    ['bad enum', 'basics', { gender: 'robot' }],
    ['everyone mixed with others', 'basics', { interested_in: ['everyone', 'men'] }],
    ['under 18', 'basics', { date_of_birth: '2015-01-01' }],
    ['unknown field', 'basics', { is_premium: true }],
    ['field of another section', 'basics', { intent: 'casual' }],
    ['3 values', 'compatibility', { core_values: ['trust', 'fun', 'family'] }],
    ['pet kind without pets', 'yourLife', { pets: 'neutral', pet_kind: 'dog' }],
    ['11 interests', 'yourWorld', { interests: ['travel','food','sports','music','art','movies','books','outdoors','tech','gaming','fashion'] }],
    ['bad taste item', 'yourWorld', { artists: [{ kind: 'book', source: 'custom', id: 'x', title: 'y' }] }],
    ['4 taste items', 'yourWorld', { books: [1, 2, 3, 4].map((n) => ({ kind: 'book', source: 'custom', id: `b${n}`, title: `B${n}` })) }],
    ['3 date types', 'yourDates', { date_types: ['coffee', 'walk', 'dinner'] }],
    ['unknown section', 'admin', { x: 1 }],
  ]) {
    const err = await rpcSqlError('U1', 'save_onboarding_v2', { p_section: section, p_data: data });
    check(err && /check constraint|unknown_field|invalid_section|invalid_date_of_birth|violates/.test(err), `rejected: ${name}`);
  }
  for (const [section, data] of [['basics', BASICS], ['compatibility', COMPAT], ['yourLife', LIFE], ['yourWorld', WORLD], ['yourDates', DATES]]) {
    check((await rpc('U1', 'save_onboarding_v2', { p_section: section, p_data: data, p_resume_step: 1 })).ok, `save ${section}`);
  }
  const petSwitch = await rpc('U1', 'save_onboarding_v2', { p_section: 'yourLife', p_data: { pets: 'neutral' } });
  const afterSwitch = (await db.query(`select pets, pet_kind from onboarding_v2 where user_id='${U.U1}'`)).rows[0];
  check(petSwitch.ok && afterSwitch.pets === 'neutral' && afterSwitch.pet_kind === null, 'changing pets away from "have pets" clears the kind');
  await rpc('U1', 'save_onboarding_v2', { p_section: 'yourLife', p_data: LIFE });

  stage = 'DIRECT WRITES';
  check(!(await api('U1', 'PATCH', `/onboarding_v2?user_id=eq.${U.U1}`, { first_name: 'X' })).ok, 'no direct UPDATE of the draft');
  check(!(await api('U1', 'POST', '/onboarding_v2', { user_id: U.U2 })).ok, 'no direct INSERT');
  check(!(await api('U1', 'PATCH', `/account_state_v2?user_id=eq.${U.U1}`, { application_status: 'accepted' })).ok,
    'client cannot change application status');
  check(!(await api('U1', 'PATCH', `/account_state_v2?user_id=eq.${U.U1}`, { membership_status: 'active' })).ok,
    'client cannot activate membership');
  await rejects('U1', 'review_application_v2', { p_user: U.U1, p_decision: 'accept' }, 'permission denied', 'client cannot call the reviewer RPC');
  await db.exec(`update profiles set first_name='Test', gender='Man', city='Istanbul', date_of_birth='1995-04-12', meeting_preferences='{Women}' where id='${U.U1}'`);
  const selfSetup = await asRole('authenticated', U.U1, `update public.profiles set setup_completed = true where id = '${U.U1}'`);
  const stillFalse = (await db.query(`select setup_completed from profiles where id='${U.U1}'`)).rows[0].setup_completed;
  check(!selfSetup.ok && selfSetup.error.includes('membership_not_active') && stillFalse !== true,
    'pending applicant cannot self-unlock the V1 Home gate (DB unchanged)');

  stage = 'PHOTOS';
  const P = (n) => `${U.U1}/${n}.jpg`;
  await rejects('U1', 'add_profile_photo_v2', { p_path: P('never-uploaded') }, 'photo_not_uploaded', 'failed upload: nothing registered');
  check((await db.query(`select count(*)::int n from profile_photos_v2 where user_id='${U.U1}'`)).rows[0].n === 0, 'failed upload leaves 0 photos');
  const ids = [];
  for (let n = 1; n <= 6; n += 1) {
    check((await upload(U.U1, 'profile-photos-private', P(n))).ok, `upload ${n} into own folder`);
    const r = await rpc('U1', 'add_profile_photo_v2', { p_path: P(n) });
    check(r.ok && r.json.position === n, `register photo ${n} at position ${n}`);
    ids.push(r.json.id);
  }
  const dup = await rpc('U1', 'add_profile_photo_v2', { p_path: P(1) });
  check(dup.ok && dup.json.duplicate === true, 'registering the same upload twice (retry) does not duplicate');
  await upload(U.U1, 'profile-photos-private', P(7));
  await rejects('U1', 'add_profile_photo_v2', { p_path: P(7) }, 'too_many_photos', '7th photo refused');
  check(!(await upload(U.U1, 'profile-photos-private', `${U.U2}/x.jpg`)).ok, 'cannot upload into another user\'s folder');
  const order = [ids[5], ids[0], ids[1], ids[2], ids[3], ids[4]];
  check((await rpc('U1', 'reorder_profile_photos_v2', { p_ids: order })).ok, 'reorder (atomic, full list)');
  const got = (await db.query(`select id from profile_photos_v2 where user_id='${U.U1}' order by position`)).rows.map((r) => r.id);
  check(JSON.stringify(got) === JSON.stringify(order), 'DB order matches the new order');
  await rejects('U1', 'reorder_profile_photos_v2', { p_ids: order.slice(1) }, 'photo_set_mismatch', 'partial reorder list refused');
  const del = await rpc('U1', 'delete_profile_photo_v2', { p_id: ids[2] });
  check(del.ok && del.json.path === P(3), 'delete returns the object path for storage clean-up');
  const pos = (await db.query(`select position from profile_photos_v2 where user_id='${U.U1}' order by position`)).rows.map((r) => r.position);
  check(JSON.stringify(pos) === '[1,2,3,4,5]', 'positions compacted after delete');
  const delObj = await asRole('authenticated', U.U1, `delete from storage.objects where bucket_id='profile-photos-private' and name='${P(3)}' returning 1`);
  check(delObj.ok && delObj.rows.length === 1, 'owner deletes the storage object');

  stage = 'PROMPTS';
  await rejects('U1', 'save_prompts_v2', { p_prompts: [{ slot: 1, prompt_id: 'made_up', answer: 'x' }] }, 'foreign key', 'unknown prompt id refused');
  await rejects('U1', 'save_prompts_v2', { p_prompts: [{ slot: 1, prompt_id: 'ask_me_about', answer: 'a' }, { slot: 2, prompt_id: 'ask_me_about', answer: 'b' }] },
    'duplicate key', 'same prompt twice refused');
  await rejects('U1', 'save_prompts_v2', { p_prompts: [{ slot: 1, prompt_id: 'ask_me_about', answer: 'x'.repeat(201) }] }, 'check constraint', '201-char answer refused');
  const pr = await rpc('U1', 'save_prompts_v2', { p_prompts: [
    { slot: 1, prompt_id: 'small_thing_i_love', answer: 'Morning coffee.' },
    { slot: 2, prompt_id: 'together_we_could', answer: 'Find the best tiramisu.' },
    { slot: 3, prompt_id: 'comfort_food', answer: '   ' }] });
  check(pr.ok && pr.json.saved === 2, 'prompts saved; blank optional third ignored');

  stage = 'SELFIE';
  const sp = `${U.U1}/${crypto.randomBytes(8).toString('hex')}.jpg`;
  await rejects('U1', 'set_verification_selfie_v2', { p_path: sp }, 'selfie_not_uploaded', 'selfie not uploaded → refused');
  check((await upload(U.U1, 'verification-selfies', sp)).ok, 'selfie uploaded to the private bucket (own folder)');
  check((await rpc('U1', 'set_verification_selfie_v2', { p_path: sp })).ok, 'selfie path recorded server-side');
  const readSelfie = await asRole('authenticated', U.U1, `select name from storage.objects where bucket_id='verification-selfies'`);
  check(readSelfie.ok && readSelfie.rows.length === 0, 'even the owner cannot read the selfie back');
  const me = await rpc('U1', 'get_my_onboarding_v2');
  check(me.json.state.has_selfie === true && !JSON.stringify(me.json).includes(sp), 'client sees "has selfie", never the path');

  stage = 'OTHER ACCOUNT';
  await rpc('U2', 'get_my_onboarding_v2');
  for (const t of ['onboarding_v2', 'profile_photos_v2', 'profile_prompts_v2', 'account_state_v2']) {
    const r = await api('U2', 'GET', `/${t}?user_id=eq.${U.U1}&select=*`);
    check(r.ok && rows(r).length === 0, `U2 cannot read U1's ${t}`);
  }
  await rejects('U2', 'reorder_profile_photos_v2', { p_ids: order }, 'photo_set_mismatch', 'U2 cannot reorder U1\'s photos');
  await rejects('U2', 'delete_profile_photo_v2', { p_id: ids[0] }, 'photo_not_found', 'U2 cannot delete U1\'s photo');
  await rejects('U2', 'add_profile_photo_v2', { p_path: P(1) }, 'not_your_photo', 'U2 cannot register U1\'s upload');
  await rejects('U2', 'set_verification_selfie_v2', { p_path: sp }, 'not_your_selfie', 'U2 cannot claim U1\'s selfie');
  const u2Photo = await asRole('authenticated', U.U2, `select name from storage.objects where bucket_id='profile-photos-private' and name like '${U.U1}/%'`);
  check(u2Photo.ok && u2Photo.rows.length === 0, 'U2 cannot sign U1\'s photos (pending applicant is not visible)');
  const card = await api('U2', 'GET', `/profile_cards?id=eq.${U.U1}`);
  check(rows(card).length === 0, 'pending applicant has no public card');

  stage = 'SUBMIT';
  const early = await rpc('U1', 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(early.ok && early.json.status === 'draft' && early.json.missing?.includes('account.email'),
    'submit with unconfirmed email → not submitted, "missing" returned');
  check((await db.query(`select application_status from account_state_v2 where user_id='${U.U1}'`)).rows[0].application_status === 'draft',
    'DB: still draft after refused submit');
  await db.exec(`update auth.users set email_confirmed_at = now() where id='${U.U1}'`); // email OTP sign-in confirms it
  const req = crypto.randomUUID();
  const burst = await Promise.all([1, 2, 3, 4, 5].map(() => rpc('U1', 'submit_application_v2', { p_request_id: req })));
  check(burst.every((r) => r.ok && r.json.status === 'submitted'), '5 rapid taps all report submitted');
  check(burst.filter((r) => r.json.already === false).length === 1, 'exactly one of them performed the submission');
  const st = (await db.query(`select application_status, verification_status, membership_status, submitted_at from account_state_v2 where user_id='${U.U1}'`)).rows;
  check(st.length === 1 && st[0].application_status === 'submitted' && st[0].verification_status === 'pending'
    && st[0].membership_status === 'none', 'DB: one row, submitted / pending / not a member');
  const again = await rpc('U1', 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(again.ok && again.json.already === true && again.json.submitted_at === burst[0].json.submitted_at, 'retry after reconnect returns the same submission');
  await rejects('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: { first_name: 'Changed' } }, 'application_locked', 'answers locked after submission');
  await rejects('U1', 'add_profile_photo_v2', { p_path: P(7) }, 'application_locked', 'photos locked after submission');
  check((await rpc('U1', 'get_my_access_v2')).json?.gate === 'waiting', 'gate after submit: waiting (no Home)');
  const disc = await rpc('U1', 'get_discovery_cards', { p_limit: 10 });
  check(disc.ok && rows(disc).length === 0, 'pending applicant gets no discovery');
  const u2 = await rpc('U2', 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(u2.ok && u2.json.status === 'draft' && (u2.json.missing ?? []).length > 5, 'incomplete applicant cannot submit');

  stage = 'REVIEW';
  await db.exec(`select public.review_application_v2('${U.U1}', 'accept', 'synthetic test')`); // service role / Studio
  check((await rpc('U1', 'get_my_access_v2')).json?.gate === 'member', 'after reviewer acceptance: member');
  const md = await rpc('L', 'get_discovery_cards', { p_limit: 10 });
  check(md.ok && rows(md).some((r) => r.user_id === U.W), 'V1 member discovery still works');
  const mm = await rpc('M', 'get_discovery_cards', { p_limit: 10 });
  check(mm.ok, 'active V2 member can call discovery');

  stage = 'SCHEMA';
  const noSecrets = fs.readFileSync(path.join(proposed, '20260930120000_v2_onboarding_persistence.sql'), 'utf8');
  check(!/eyJ[A-Za-z0-9_-]{20,}|fyqwjduzpnjuxqsloxih/.test(noSecrets), 'no key or live ref in the migration');
}

await main();
