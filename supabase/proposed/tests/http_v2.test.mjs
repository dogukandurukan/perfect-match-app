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
db.__rawQuery = db.query.bind(db);
db.__rawExec = db.exec.bind(db);
for (const m of ['exec', 'query']) {
  const raw = db[m].bind(db);
  db[m] = async (...a) => {
    // Wait until no other connection's transaction is open in the shared
    // session (now() is the transaction start; equal to the statement time
    // only when this statement runs in its own transaction).
    for (let w = 0; w < 200; w += 1) {
      try {
        const probe = await db.__rawQuery('select now() = statement_timestamp() as fresh');
        if (probe.rows[0]?.fresh) break;
      } catch (e) {
        if (e?.code === '25P02') { await db.__rawExec('rollback'); break; }
        break;
      }
      await new Promise((r) => setTimeout(r, 15));
    }
    for (let i = 0; ; i += 1) {
      try { return await raw(...a); } catch (e) {
        // 25P02: a transaction left aborted by a dropped bridge connection
        // (single PGlite session) — it belongs to a dead connection; end it.
        if (i < 40 && e?.code === '25P02') { await raw('rollback'); continue; }
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
    '20260930120000_v2_onboarding_persistence.sql', '20260930140000_v2_review_discovery_media.sql',
    '20261001090000_v2_public_profile.sql']) {
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
  const cross = await rpc('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: {}, p_resume_step: 1, p_resume_section: 'compatibility' });
  const crossRow = (await db.query(`select resume_section, resume_step from onboarding_v2 where user_id='${U.U1}'`)).rows[0];
  check(cross.ok && crossRow.resume_section === 'compatibility' && crossRow.resume_step === 1, 'resume position can cross into the next section');
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
  const noConsent = await rpc('U1', 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(noConsent.ok && noConsent.json.status === 'draft' && noConsent.json.missing?.includes('account.consent'),
    'no KVKK consent → not submitted');
  const consent = await api('U1', 'PATCH', `/profiles?id=eq.${U.U1}`, { privacy_consent_at: new Date().toISOString() });
  check(consent.ok, 'consent recorded by the user (allowed column)');
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

  stage = 'REVIEW LOOP';
  await rejects('U1', 'review_application_v2', { p_user: U.U1, p_decision: 'accept' }, 'permission denied', 'client cannot review');
  const noNote = await asRole('postgres', null, `select public.review_application_v2('${U.U1}', 'request_changes')`);
  check(!noNote.ok && noNote.error.includes('changes_need_note_or_items'), 'request changes needs a note or items');
  const oldSelfie = (await db.query(`select selfie_path from account_state_v2 where user_id='${U.U1}'`)).rows[0].selfie_path;
  await db.exec(`select public.review_application_v2('${U.U1}', 'request_changes', 'Please add a clearer main photo and retake your selfie.',
    array['yourProfile.photos','yourProfile.selfie'])`);
  const cr = (await db.query(`select application_status, verification_status, membership_status, selfie_path, review_items from account_state_v2 where user_id='${U.U1}'`)).rows[0];
  check(cr.application_status === 'changes_requested' && cr.membership_status === 'none' && cr.selfie_path === null
    && cr.review_items.join() === 'yourProfile.photos,yourProfile.selfie', 'DB: changes requested, selfie dropped, items stored');
  const g1 = (await rpc('U1', 'get_my_access_v2')).json;
  check(g1?.gate === 'onboarding' && g1?.application_status === 'changes_requested', 'gate: back to the V2 flow (no Home)');
  const mine = (await rpc('U1', 'get_my_onboarding_v2')).json;
  check(mine.state.review_note?.includes('clearer main photo') && mine.state.review_items?.length === 2 && mine.state.has_selfie === false,
    'the user sees the reviewer note and what to change');
  const u2see = await api('U2', 'GET', `/account_state_v2?user_id=eq.${U.U1}&select=review_note`);
  check(rows(u2see).length === 0, 'another user cannot see the review note');
  check((await rpc('U1', 'save_onboarding_v2', { p_section: 'basics', p_data: { height_cm: 182 } })).ok, 'editing is allowed again');
  check((await upload(U.U1, 'profile-photos-private', P(8))).ok, 'new photo uploaded');
  const p8 = await rpc('U1', 'add_profile_photo_v2', { p_path: P(8) });
  const cur = (await db.query(`select id from profile_photos_v2 where user_id='${U.U1}' order by position`)).rows.map((r) => r.id);
  check(p8.ok && (await rpc('U1', 'reorder_profile_photos_v2', { p_ids: [p8.json.id, ...cur.filter((x) => x !== p8.json.id)] })).ok,
    'new photo made the main photo');
  const early2 = await rpc('U1', 'submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(early2.ok && early2.json.status === 'changes_requested' && early2.json.missing?.includes('yourProfile.selfie'),
    'resubmit without the new selfie → not submitted');
  const sp2 = `${U.U1}/${crypto.randomBytes(8).toString('hex')}.jpg`;
  check((await upload(U.U1, 'verification-selfies', sp2)).ok && (await rpc('U1', 'set_verification_selfie_v2', { p_path: sp2 })).ok,
    'new selfie stored');
  const re = await Promise.all([1, 2, 3].map(() => rpc('U1', 'submit_application_v2', { p_request_id: crypto.randomUUID() })));
  check(re.every((r) => r.ok && r.json.status === 'submitted') && re.filter((r) => r.json.already === false).length === 1,
    'resubmission: exactly one, even with rapid taps');
  const afterRe = (await db.query(`select application_status, review_items from account_state_v2 where user_id='${U.U1}'`)).rows[0];
  check(afterRe.application_status === 'submitted' && afterRe.review_items === null, 'DB: submitted again, request cleared');
  await db.exec(`select public.review_application_v2('${U.U1}', 'accept', 'looks good')`); // service role / Studio
  check((await rpc('U1', 'get_my_access_v2')).json?.gate === 'member', 'after acceptance: member');
  const ev = (await db.query(`select event from application_events_v2 where user_id='${U.U1}' order by id`)).rows.map((r) => r.event);
  check(ev.join() === 'submitted,changes_requested,submitted,accepted', `audit trail: ${ev.join(' → ')}`);
  const proj = (await db.query(`select setup_completed, first_name, photos from profiles where id='${U.U1}'`)).rows[0];
  const order2 = (await db.query(`select storage_path from profile_photos_v2 where user_id='${U.U1}' order by position`)).rows.map((r) => r.storage_path);
  check(proj.setup_completed === true && proj.first_name === 'Test' && JSON.stringify(proj.photos) === JSON.stringify(order2),
    'acceptance projects the public card basics (server-side) in photo order');
  const md = await rpc('L', 'get_discovery_cards', { p_limit: 10 });
  check(md.ok && rows(md).some((r) => r.user_id === U.W), 'V1 member discovery still works');

  stage = 'V2 DISCOVERY (eligibility only)';
  // Synthetic active V2 members, one per rule. U1: man, interested in women, born 1995, İstanbul, range 18–60.
  const F = (n) => `00000000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`;
  const member = async (n, { gender = 'woman', wants = ['men'], dob = '1996-01-01', city = 'İstanbul', state = 'active',
    hidden = false, amin = 18, amax = 60 } = {}) => {
    const id = F(n);
    await db.exec(`insert into auth.users(id, email) values ('${id}', 'f${n}@tempa-test.invalid');
      insert into profiles(id, first_name, is_hidden, discovery_age_min, discovery_age_max, setup_completed)
        values ('${id}', 'F${n}', ${hidden}, ${amin}, ${amax}, ${state === 'active'});
      insert into onboarding_v2(user_id, first_name, gender, interested_in, date_of_birth, location_city)
        values ('${id}', 'F${n}', '${gender}', array[${wants.map((w) => `'${w}'`).join(',')}], '${dob}', '${city}');
      insert into account_state_v2(user_id, application_status, verification_status, membership_status) values ('${id}',
        ${state === 'active' ? "'accepted','verified','active'" : "'submitted','pending','none'"});`);
    return id;
  };
  const ok1 = await member(1); // eligible
  await db.exec(`insert into storage.objects(bucket_id, name) values ('profile-photos-private', '${ok1}/f1.jpg');
    insert into profile_photos_v2(user_id, storage_path, position) values ('${ok1}', '${ok1}/f1.jpg', 1);
    update profiles set photos = array['${ok1}/f1.jpg'] where id = '${ok1}';`);
  const u1SignsF1 = await asRole('authenticated', U.U1,
    `select name from storage.objects where bucket_id='profile-photos-private' and name like '${ok1}/%'`);
  check(u1SignsF1.ok && u1SignsF1.rows.length === 1, 'U1 can sign an eligible member\'s photos');
  await member(2, { wants: ['women'] }); // doesn't want men
  await member(3, { city: 'Ankara' }); // other city
  await member(4, { dob: '1955-01-01' }); // outside U1's 18–60
  await member(5, { amax: 25 }); // U1 (31) outside her range
  await member(6, { hidden: true }); // hidden
  const blocker = await member(7); // blocks U1
  await db.exec(`insert into blocks(blocker_id, blocked_id) values ('${blocker}', '${U.U1}')`);
  await member(8, { state: 'pending' }); // not accepted yet
  const ok9 = await member(9, { wants: ['everyone'] }); // everyone
  const cand = await rpc('U1', 'get_discovery_candidates_v2', { p_limit: 20 });
  const candIds = rows(cand).map((r) => r.user_id);
  check(cand.ok && JSON.stringify(candIds) === JSON.stringify([ok1, ok9].sort()), `U1 sees exactly the eligible members, fixed order (${candIds.length})`);
  check(rows(cand).every((r) => Object.keys(r).sort().join() === 'age,city,first_name,photo_paths,user_id'),
    'no score or ranking field is produced');
  const f1sees = await asRole('authenticated', ok1, 'select user_id from public.get_discovery_candidates_v2(20)');
  check(f1sees.ok && f1sees.rows.some((r) => r.user_id === U.U1), 'the other eligible member sees U1 too (mutual)');
  const again2 = await rpc('U1', 'get_discovery_candidates_v2', { p_limit: 20 });
  check(JSON.stringify(rows(again2).map((r) => r.user_id)) === JSON.stringify(candIds), 'order is stable between calls');
  const pendingSees = await asRole('authenticated', F(8), 'select user_id from public.get_discovery_candidates_v2(20)');
  check(pendingSees.ok && pendingSees.rows.length === 0, 'a pending applicant gets no candidates');
  const legacySees = await rpc('L', 'get_discovery_candidates_v2', {});
  check(legacySees.ok && rows(legacySees).length === 0, 'a V1 account is not part of V2 discovery');
  check((await rpcSqlError('anon', 'get_discovery_candidates_v2', {}))?.includes('permission denied'), 'anon cannot call it');
  const f1photo = await asRole('authenticated', ok1,
    `select name from storage.objects where bucket_id='profile-photos-private' and name like '${U.U1}/%'`);
  check(f1photo.ok && f1photo.rows.length >= 1, 'an eligible member can sign the accepted member\'s photos');
  stage = 'V2 PUBLIC PROFILE';
  const prof = async (viewer, target) => {
    const r = await asRole('authenticated', viewer, `select public.get_profile_v2('${target}') as p`);
    return r.ok ? r.rows[0].p : { __error: r.error };
  };
  const ALLOWED = ['activity', 'age', 'artists', 'books', 'city', 'core_values', 'date_types', 'days_pref', 'drinking',
    'favorite_spot', 'first_name', 'height_cm', 'hometown', 'intent', 'interests', 'job_title', 'pet_kind', 'pets',
    'photo_paths', 'prompts', 'school', 'screen', 'smoking', 'time_pref', 'user_id', 'work_status', 'zodiac'];
  const u1p = await prof(ok1, U.U1);
  check(u1p && JSON.stringify(Object.keys(u1p).sort()) === JSON.stringify(ALLOWED), 'profile returns exactly the allowed fields');
  check(u1p?.first_name === 'Test' && u1p.age >= 30 && u1p.zodiac === 'Aries' && u1p.city === 'İstanbul'
    && u1p.height_cm === (await db.query(`select height_cm from onboarding_v2 where user_id='${U.U1}'`)).rows[0].height_cm,
    `name, age, zodiac (server-computed), city and height (${JSON.stringify([u1p?.first_name, u1p?.age, u1p?.zodiac, u1p?.city, u1p?.height_cm])})`);
  check(u1p?.intent === 'long_term' && JSON.stringify(u1p.core_values) === '["trust","respect"]' && u1p.job_title === 'Designer'
    && u1p.school?.title === 'Boğaziçi' && u1p.artists?.[0]?.title === 'Sezen Aksu' && u1p.favorite_spot === 'Moda sahil'
    && u1p.days_pref === 'weekends' && u1p.smoking === 'no' && u1p.pet_kind === 'cat', 'looking for, values, work, school, taste, dates, lifestyle');
  check(Array.isArray(u1p?.prompts) && u1p.prompts.length >= 2 && u1p.prompts.every((q, i, a) => i === 0 || a[i - 1].slot < q.slot),
    'prompts in slot order');
  const u1photos = (await db.query(`select storage_path from profile_photos_v2 where user_id='${U.U1}' order by position`)).rows
    .map((r) => r.storage_path);
  check(JSON.stringify(u1p?.photo_paths) === JSON.stringify(u1photos), 'photos in the owner\'s order');
  const raw = JSON.stringify(u1p);
  check(!/Applicant|1995-04-12|Kadıköy|tr-istanbul|tempa-test|selfie|few_checkins|after_chatting|"gender"|"mix"/.test(raw),
    'no surname, DOB, district, location id, email, selfie, gender or compatibility answers');
  check(!!(await prof(U.U1, ok9)), 'a mutually eligible member\'s profile opens');
  for (const [n, why] of [[2, 'does not want this gender'], [3, 'other city'], [4, 'outside the age range'],
    [5, 'viewer outside their range'], [6, 'hidden'], [7, 'blocked the viewer'], [8, 'pending applicant']]) {
    check((await prof(U.U1, F(n))) === null, `no profile when the target ${why}`);
  }
  check((await prof(F(8), U.U1)) === null, 'a pending applicant cannot open member profiles');
  check((await prof(U.L, U.U1)) === null, 'a V1 account cannot open V2 profiles');
  check((await prof(U.U2, U.U1)) === null, 'a draft applicant cannot open member profiles');
  check(!!(await prof(U.U1, U.U1)), 'the owner can open their own profile');
  check((await rpcSqlError('anon', 'get_profile_v2', { p_user: U.U1 }))?.includes('permission denied'), 'anon cannot call it');
  const raw2 = await asRole('authenticated', ok1, `select first_name from public.onboarding_v2 where user_id = '${U.U1}'`);
  check(raw2.ok && raw2.rows.length === 0, 'the raw onboarding draft stays owner-only');
  // eligibility used by the profile = discovery's eligibility
  let same = true;
  for (let n = 1; n <= 9; n += 1) {
    const e = (await db.query(`select public.v2_pair_eligible('${U.U1}', '${F(n)}') as e`)).rows[0].e;
    if (e !== candIds.includes(F(n))) same = false;
  }
  check(same, 'pair eligibility equals the discovery candidate list');
  // an existing match row keeps the profile reachable even when not eligible
  const [ma, mb] = [U.U1, F(2)].sort();
  await db.exec(`insert into matches(user_a_id, user_b_id, status, match_score) values ('${ma}', '${mb}', 'pending', 50)`);
  check(!!(await prof(U.U1, F(2))), 'a matched (not eligible) member\'s profile opens');
  await db.exec(`insert into blocks(blocker_id, blocked_id) values ('${F(2)}', '${U.U1}')`);
  check((await prof(U.U1, F(2))) === null, 'a block closes it again, even with a match');
  const gone = await member(10);
  check(!!(await prof(U.U1, gone)), 'member 10 visible before deletion');
  await db.exec(`update profiles set deleted_at = now() where id = '${gone}'`);
  check((await prof(U.U1, gone)) === null, 'a deleted member\'s profile is gone');
  await db.exec(`update profiles set deleted_at = null, is_hidden = true where id = '${gone}'`);
  check((await prof(U.U1, gone)) === null, 'a member who hid their profile is gone');

  await db.exec(`insert into blocks(blocker_id, blocked_id) values ('${U.U1}', '${ok1}')`);
  const afterBlock = await rpc('U1', 'get_discovery_candidates_v2', { p_limit: 20 });
  check(!rows(afterBlock).some((r) => r.user_id === ok1), 'blocking removes the candidate at once');
  const u1PhotoForF1 = await asRole('authenticated', ok1,
    `select name from storage.objects where bucket_id='profile-photos-private' and name like '${U.U1}/%'`);
  const f1PhotoForU1 = await asRole('authenticated', U.U1,
    `select name from storage.objects where bucket_id='profile-photos-private' and name like '${ok1}/%'`);
  check(u1PhotoForF1.ok && u1PhotoForF1.rows.length === 0 && f1PhotoForU1.ok && f1PhotoForU1.rows.length === 0,
    'after the block neither side can sign the other\'s photos');
  const cardAfter = await asRole('authenticated', ok1, `select id from public.profile_cards where id = '${U.U1}'`);
  check(cardAfter.ok && cardAfter.rows.length === 0, 'after the block the blocked member loses the card');
  const likeAfter = await asRole('authenticated', ok1,
    `insert into public.likes(liker_id, likee_id, target_type, status) values ('${ok1}', '${U.U1}', 'profile', 'sent')`);
  check(!likeAfter.ok && likeAfter.error.includes('target_not_visible'), 'after the block no like can be sent');
  const f1After = await asRole('authenticated', ok1, 'select user_id from public.get_discovery_candidates_v2(20)');
  check(f1After.ok && !f1After.rows.some((r) => r.user_id === U.U1), 'after the block the other side no longer sees U1 either');
  check((await asRole('authenticated', ok1, `select public.get_profile_v2('${U.U1}') as p`)).rows?.[0]?.p === null
    && (await asRole('authenticated', U.U1, `select public.get_profile_v2('${ok1}') as p`)).rows?.[0]?.p === null,
    'after the block neither side can open the other\'s profile');

  stage = 'ORPHAN MEDIA';
  await db.exec(`update storage.objects set created_at = now() - interval '2 days' where name like '${U.U1}/%'`);
  const orphans = await asRole('postgres', null, `select bucket_id, name from public.list_orphan_media_v2(interval '1 hour')`);
  const onames = (orphans.rows ?? []).map((r) => `${r.bucket_id}:${r.name}`);
  check(onames.includes(`profile-photos-private:${P(7)}`), 'uploaded-but-never-registered photo is listed');
  check(onames.includes(`verification-selfies:${oldSelfie}`), 'the replaced selfie is listed');
  const registered = (await db.query(`select storage_path from profile_photos_v2 where user_id='${U.U1}'`)).rows.map((r) => r.storage_path);
  check(!registered.some((pth) => onames.includes(`profile-photos-private:${pth}`)) && !onames.includes(`verification-selfies:${sp2}`),
    'registered photos and the current selfie are never listed');
  const fresh = await asRole('postgres', null, `select count(*)::int n from public.list_orphan_media_v2(interval '0')`);
  check(fresh.ok, 'grace period cannot be set below 1 hour (in-flight uploads protected)');
  check((await rpcSqlError('U1', 'list_orphan_media_v2', {}))?.includes('permission denied'), 'clients cannot list orphans');

  stage = 'AFTER P0-B';
  await db.exec(fs.readFileSync(path.join(proposed, '20260928130100_p0b_privacy_restrict.sql'), 'utf8'));
  pgrst.kill('SIGTERM');
  await new Promise((r) => pgrst.once('exit', r));
  await startApi();
  check((await rpc('U1', 'get_my_onboarding_v2')).ok, 'P0-B applied: own V2 bundle still loads');
  check((await rpc('U1', 'get_my_access_v2')).json?.gate === 'member', 'P0-B applied: gate still member');
  const cand2 = await rpc('U1', 'get_discovery_candidates_v2', { p_limit: 20 });
  check(cand2.ok && rows(cand2).some((r) => r.user_id === ok9), 'P0-B applied: V2 discovery still works');
  const other = await api('U1', 'GET', `/profiles?id=eq.${ok9}&select=first_name`);
  check(rows(other).length === 0, 'P0-B applied: other people\'s profiles rows are private');
  const card9 = await api('U1', 'GET', `/profile_cards?id=eq.${ok9}&select=first_name`);
  check(rows(card9).length === 1, 'P0-B applied: an eligible V2 member\'s public card is readable');
  const u2b = await rpc('U2', 'get_my_onboarding_v2');
  check(u2b.ok && u2b.json.state.application_status === 'draft', 'P0-B applied: a draft applicant still loads and saves');

  stage = 'SCHEMA';
  const noSecrets = ['20260930120000_v2_onboarding_persistence.sql', '20260930140000_v2_review_discovery_media.sql',
    '20261001090000_v2_public_profile.sql']
    .map((f) => fs.readFileSync(path.join(proposed, f), 'utf8')).join('\n');
  check(!/eyJ[A-Za-z0-9_-]{20,}|fyqwjduzpnjuxqsloxih/.test(noSecrets), 'no key or live ref in the migration');
}

await main();
