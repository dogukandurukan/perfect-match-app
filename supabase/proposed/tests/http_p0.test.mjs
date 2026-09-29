// P0 privacy — end-to-end verification over real PostgREST HTTP.
//
// Database: PGlite (Postgres in WASM) loaded with a data-free replica of the
// LIVE schema (replica.mjs: real function bodies incl. get_top_matches, real
// policies, grants, triggers) + synthetic users only.
// API: PostgREST 13.0.8 connected through pglite-socket, JWTs signed locally.
//
// Stages:  LIVE (baseline: proves the replica reproduces today's exposure)
//        → P0-A (old client still works, write holes closed, new read paths)
//        → P0-B (only own profile row readable; R-P0 client shapes still work)
// Actors: anon, the owner (A), other signed-in users.
// Storage: Supabase Storage enforces storage.objects RLS by running queries
// as the caller's role; that part is checked in SQL as each role (the
// Storage HTTP server itself is not part of this replica).
//
// Run:
//   npm i --no-save --prefix <dir> @electric-sql/pglite @electric-sql/pglite-socket
//   PGLITE_DIR=<dir>/node_modules POSTGREST=<path to postgrest 13> \
//     node supabase/proposed/tests/http_p0.test.mjs
// Prints pass/fail per check; never prints private values (all synthetic).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReplicaSql } from './replica.mjs';
import { clientShapes } from './client_shapes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const proposed = path.resolve(here, '..');
const pgliteDir = process.env.PGLITE_DIR;
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, '@electric-sql/pglite/dist/index.js')).href);
const { PGLiteSocketServer } = await import(
  pathToFileURL(path.join(pgliteDir, '@electric-sql/pglite-socket/dist/index.js')).href
);

const PG_PORT = 54339;
const API_PORT = 54340;
const SECRET = 'local-test-secret-local-test-secret-0123456789';

// ---------------------------------------------------------------------------
// actors (synthetic)
// ---------------------------------------------------------------------------
const id = (n) => `00000000-0000-4000-8000-0000000000${n}`;
export const U = {
  A: id('0a'), // owner / viewer — Man, Kadıköy
  B: id('0b'), // visible Woman, Beşiktaş
  C: id('0c'), // hidden, accepted chat with A
  D: id('0d'), // hidden, no relation
  D2: id('d2'), // hidden, only a bare pending candidate row with A
  E: id('0e'), // deleted (deleted_at), had accepted chat with A
  F: id('0f'), // blocked BY A
  G: id('10'), // blocked A
  I: id('11'), // incomplete onboarding (setup_completed=false)
  J: id('12'), // invited A (incoming pending invite)
  K: id('13'), // hidden, has a live like on A
  L: id('14'), // expired old invite with A
  M: id('15'), // visible Woman, Kadıköy (same district as A)
  N: id('16'), // signed up, no profile row yet
  P: id('17'), // visible Woman, never interacted (stays a discovery candidate)
  Q: id('18'), // visible Woman, never interacted
  HX: id('19'), // hidden, old expired invite with A
  HI: id('1a'), // hidden, invited A (pending invite)
};
const SECRET_MARK = 'SYNTH-PRIVATE';
const PRIVATE_COLS = [
  'last_name', 'date_of_birth', 'phone_number', 'full_address', 'lat', 'lng', 'district',
  'instagram_handle', 'expo_push_token', 'verification_selfie_path', 'meeting_preferences',
  'discovery_age_min', 'is_premium', 'deleted_at', 'is_hidden', 'hide_location',
  'daily_views_count', 'waitlist_number', 'privacy_consent_at', 'last_active_at',
];

function seedSql() {
  const prof = (k, o) => {
    const v = {
      first_name: k, last_name: `${SECRET_MARK}-${k}`, gender: 'Woman', city: 'Istanbul',
      district: 'Beşiktaş', date_of_birth: '1995-05-05', meeting_preferences: '{Men}',
      phone_number: `${SECRET_MARK}-phone-${k}`, full_address: `${SECRET_MARK}-addr`,
      lat: 41.1, lng: 29.1, instagram_handle: `${SECRET_MARK}-ig`, expo_push_token: `${SECRET_MARK}-push`,
      verification_selfie_path: `${U[k]}/selfie-${SECRET_MARK}.jpg`, photos: `{${U[k]}/p1.jpg}`,
      hobbies: '{Music,Travel}', setup_completed: true, is_hidden: false, deleted_at: null,
      morning_night: 'Night owl', availability_days: '{Saturday,Sunday}', zodiac_sign: 'Leo',
      ...o,
    };
    const cols = Object.keys(v);
    const vals = cols.map((c) => (v[c] === null ? 'null' : typeof v[c] === 'number' ? v[c] : `'${String(v[c]).replace(/'/g, "''")}'`));
    return `insert into auth.users(id) values ('${U[k]}');
insert into public.profiles (id, ${cols.join(', ')}) values ('${U[k]}', ${vals.join(', ')});`;
  };
  const pair = (x, y) => (U[x] < U[y] ? [U[x], U[y]] : [U[y], U[x]]);
  const match = (x, y, o = {}) => {
    const [a, b] = pair(x, y);
    const v = { status: 'pending', match_score: 70, ...o };
    const cols = Object.keys(v);
    const vals = cols.map((c) => (v[c] === null ? 'null' : typeof v[c] === 'number' || typeof v[c] === 'boolean' ? v[c] : `'${v[c]}'`));
    return `insert into public.matches (user_a_id, user_b_id, ${cols.join(', ')}) values ('${a}', '${b}', ${vals.join(', ')});`;
  };
  return [
    prof('A', { gender: 'Man', meeting_preferences: '{Women}', district: 'Kadıköy', date_of_birth: '1994-01-01' }),
    prof('B'),
    prof('C', { is_hidden: true }),
    prof('D', { is_hidden: true }),
    prof('D2', { is_hidden: true }),
    prof('E', { deleted_at: '2026-09-01' }),
    prof('F'),
    prof('G'),
    prof('I', { setup_completed: false }),
    prof('J'),
    prof('K', { is_hidden: true }),
    prof('L'),
    prof('M', { district: 'Kadikoy' }),
    prof('P', { hobbies: '{Music}' }),
    prof('Q', { district: 'Kadıköy' }),
    prof('HX', { is_hidden: true }),
    prof('HI', { is_hidden: true }),
    `insert into auth.users(id) values ('${U.N}');`,
    `insert into public.onboarding_answers(user_id, intent) select id, 'open_to_relationship' from public.profiles;`,
    match('A', 'C', { status: 'accepted', chat_opened: true, invited_by: U.A }),
    match('A', 'D2', {}),
    match('A', 'E', { status: 'accepted', chat_opened: true, invited_by: U.E }),
    match('A', 'J', { invited_by: U.J }),
    match('A', 'L', { status: 'expired', invited_by: U.L, chat_opened: false }),
    match('A', 'HX', { status: 'expired', invited_by: U.HX, chat_opened: false }),
    match('A', 'HI', { invited_by: U.HI }),
    `insert into public.blocks(blocker_id, blocked_id) values ('${U.A}', '${U.F}'), ('${U.G}', '${U.A}');`,
    `insert into public.likes(liker_id, likee_id, target_type, note) values
       ('${U.K}', '${U.A}', 'profile', 'note from K'), ('${U.G}', '${U.A}', 'profile', 'note from G'),
       ('${U.E}', '${U.A}', 'profile', 'note from E'), ('${U.Q}', '${U.A}', 'photo', 'note from Q');`,
    `insert into public.messages(sender_id, receiver_id, content) values ('${U.C}', '${U.A}', 'hi A');`,
    `insert into public.venues(name, district, emoji, created_at) values
       ('Moda Cafe', 'Kadıköy', '☕', '2026-01-01'), ('Bebek Cafe', 'Beşiktaş', '☕', '2026-01-02'),
       ('Cihangir Cafe', 'Beyoğlu', '☕', '2026-01-03');`,
    `insert into storage.objects(bucket_id, name) values
       ('user-photos', '${U.A}/p1.jpg'), ('user-photos', '${U.B}/p1.jpg'),
       ('verification-selfies', '${U.B}/selfie.jpg');`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const results = [];
let stage = '';
function check(cond, name) {
  results.push({ stage, name, ok: !!cond });
  if (cond) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL [${stage}] ${name}`);
  }
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(uid) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: 4102444800 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function api(actor, method, urlPath, body, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', Prefer: 'return=representation', ...extraHeaders };
  if (actor && actor !== 'anon') headers.Authorization = `Bearer ${jwt(U[actor] ?? actor)}`;
  const res = await fetch(`http://127.0.0.1:${API_PORT}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.status >= 200 && res.status < 300, json };
}
const rows = (r) => (Array.isArray(r.json) ? r.json : []);
const hasPrivate = (r) => rows(r).some((row) => PRIVATE_COLS.some((c) => c in row) || JSON.stringify(row).includes(SECRET_MARK));

const db = new PGlite();
async function asRole(role, uid, sql) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(uid ? { sub: uid, role } : { role })]);
  if (role !== 'postgres') await db.exec(`set role ${role}`);
  try {
    return { ok: true, rows: (await db.query(sql)).rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

let pgrst;
async function startApi() {
  const conf = path.join(process.env.TMPDIR || '/tmp', `pgrst-p0-${process.pid}.conf`);
  fs.writeFileSync(
    conf,
    [
      `db-uri = "postgres://authenticator:x@127.0.0.1:${PG_PORT}/postgres?sslmode=disable"`,
      'db-schemas = "public"',
      'db-anon-role = "anon"',
      'db-pool = 1',
      `jwt-secret = "${SECRET}"`,
      `server-port = ${API_PORT}`,
      'server-host = "127.0.0.1"',
      'db-prepared-statements = false',
      'db-channel-enabled = false',
      'log-level = "crit"',
    ].join('\n'),
  );
  pgrst = spawn(process.env.POSTGREST, [conf], { stdio: 'ignore', env: process.env });
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${API_PORT}/`);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('PostgREST did not start');
}
async function reloadApi() {
  pgrst.kill('SIGTERM');
  await new Promise((r) => pgrst.once('exit', r));
  await startApi();
}
// MUTATE=skip runs every stage WITHOUT applying the proposed files — a
// mutation check that the suite detects the fixes instead of passing vacuously.
const applyFile = async (f) => {
  if (process.env.MUTATE === 'skip') return;
  await db.exec(fs.readFileSync(path.join(proposed, f), 'utf8'));
};

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------
async function baselineLive() {
  stage = 'LIVE';
  const other = await api('A', 'GET', `/profiles?id=eq.${U.B}&select=phone_number,date_of_birth,district`);
  check(other.ok && hasPrivate(other), 'replica reproduces: signed-in user reads another user\'s phone/DOB/district');
  const d2 = await api('A', 'GET', `/profiles?id=eq.${U.D2}&select=id`);
  check(rows(d2).length === 1, 'replica reproduces: hidden profile readable via a bare candidate row');
  const ins = await api('N', 'POST', '/profiles', { id: U.N, first_name: 'N', is_premium: true, photo_verified: true });
  check(ins.ok, 'replica reproduces: INSERT sets is_premium/photo_verified');
  await db.exec(`delete from public.profiles where id='${U.N}'`);
  const [a, b] = U.A < U.B ? [U.A, U.B] : [U.B, U.A];
  await db.exec(`insert into public.matches(user_a_id,user_b_id,match_score) values ('${a}','${b}',50)`);
  const forge = await api('A', 'PATCH', `/matches?user_a_id=eq.${a}&user_b_id=eq.${b}`, { status: 'accepted', chat_opened: true });
  const msg = await api('A', 'POST', '/messages', { sender_id: U.A, receiver_id: U.B, content: 'unsolicited' });
  check(forge.ok && rows(forge).length === 1 && msg.ok, 'replica reproduces: self-accept a candidate and message them without consent');
  await db.exec(`delete from public.messages where content='unsolicited'; delete from public.matches where user_a_id='${a}' and user_b_id='${b}'`);
  const rewrite = await api('A', 'PATCH', `/messages?sender_id=eq.${U.C}`, { content: 'rewritten' });
  check(rewrite.ok && rows(rewrite).length === 1, 'replica reproduces: receiver rewrites a received message');
  await db.exec(`update public.messages set content='hi A' where sender_id='${U.C}'`);
  const lst = await asRole('anon', null, `select name from storage.objects where bucket_id='user-photos'`);
  check(lst.ok && lst.rows.length === 2, 'replica reproduces: anon lists user-photos objects');
  const likers = await api('A', 'POST', '/rpc/get_my_likers', {});
  check(likers.ok, 'replica: get_my_likers callable');
  await db.exec(`update public.profiles set is_premium=true where id='${U.A}'`);
  const likersP = await api('A', 'POST', '/rpc/get_my_likers', {});
  check(rows(likersP).some((r) => r.liker_id === U.G) && rows(likersP).some((r) => r.date_of_birth),
    'replica reproduces: premium likers list includes a user who blocked me, with full DOB');
  await db.exec(`update public.profiles set is_premium=false where id='${U.A}'`);
}

async function oldClientStillWorks() {
  // Shapes used by the CURRENT (pre R-P0) app — must keep working after P0-A.
  const r1 = await api('A', 'GET', `/profiles?id=in.(${U.B},${U.C},${U.J})&select=id,first_name,date_of_birth,photos`);
  check(r1.ok && rows(r1).length === 3, 'old client: batch profile read of others still works');
  const r2 = await api('A', 'POST', '/rpc/get_top_matches', { p_user_id: U.A, p_limit: 10 });
  check(r2.ok && rows(r2).length > 0, 'old client: get_top_matches still works');
  const r3 = await api('A', 'GET',
    `/matches?select=id,profiles!matches_user_b_id_fkey(first_name)&status=eq.accepted&or=(user_a_id.eq.${U.A},user_b_id.eq.${U.A})`);
  check(r3.ok && rows(r3).length >= 1, 'old client: embedded profile join on matches still works');
}

async function p0aChecks() {
  stage = 'P0-A';
  await oldClientStillWorks();

  // anon
  for (const t of ['profiles', 'matches', 'messages', 'likes', 'notifications', 'onboarding_answers', 'profile_cards']) {
    const r = await api('anon', 'GET', `/${t}?select=*`);
    check(!r.ok || rows(r).length === 0, `anon cannot read ${t}`);
  }
  const anonIns = await api('anon', 'POST', '/profiles', { id: U.N, first_name: 'x' });
  check(!anonIns.ok, 'anon cannot insert profiles');
  const anonRpc = await api('anon', 'POST', '/rpc/get_discovery_cards', { p_limit: 5 });
  check(!anonRpc.ok, 'anon cannot call get_discovery_cards');
  const oracle = await api('A', 'POST', '/rpc/can_view_profile', { p_viewer: U.B, p_target: U.D });
  check(!oracle.ok, 'two-party visibility rule is not callable by clients (no oracle)');
  const anonUpsert = await api('anon', 'POST', '/rpc/upsert_match', { p_user_a: U.A, p_user_b: U.B });
  check(!anonUpsert.ok, 'anon cannot call upsert_match');

  // profiles: server-owned fields
  const ins = await api('N', 'POST', '/profiles', { id: U.N, first_name: 'N', is_premium: true });
  check(!ins.ok, 'INSERT with is_premium rejected');
  const ins2 = await api('N', 'POST', '/profiles', { id: U.N, first_name: 'N', photo_verified: true });
  check(!ins2.ok, 'INSERT with photo_verified rejected');
  const ins3 = await api('N', 'POST', '/profiles', { id: U.N, first_name: 'N', setup_completed: true });
  check(!ins3.ok, 'INSERT with setup_completed but missing fields rejected');
  const ins4 = await api('N', 'POST', '/profiles', { id: U.N, privacy_consent_at: new Date().toISOString() });
  check(ins4.ok, 'register.tsx consent upsert (allowed columns) still works');
  const selfie = await api('N', 'PATCH', `/profiles?id=eq.${U.N}`, { verification_selfie_path: `${U.B}/x.jpg` });
  check(!selfie.ok, 'selfie path in another user\'s folder rejected');
  const selfieOk = await api('N', 'PATCH', `/profiles?id=eq.${U.N}`, { verification_selfie_path: `${U.N}/x.jpg` });
  check(selfieOk.ok, 'selfie path in own folder allowed');
  for (const f of [{ is_premium: true }, { photo_verified: true }, { deleted_at: null }, { daily_views_count: 0 }, { waitlist_boost: 99 }]) {
    const r = await api('A', 'PATCH', `/profiles?id=eq.${U.A}`, f);
    check(!r.ok, `owner cannot update ${Object.keys(f)[0]}`);
  }
  const incomplete = await api('N', 'PATCH', `/profiles?id=eq.${U.N}`, { setup_completed: true });
  check(!incomplete.ok, 'setup_completed=true without core fields rejected');

  // matches: forged state
  const [a, b] = U.A < U.B ? [U.A, U.B] : [U.B, U.A];
  const up = await api('A', 'POST', '/rpc/upsert_match', { p_user_a: a, p_user_b: b, p_match_score: 80 });
  check(up.ok, 'upsert_match candidate towards a discoverable user works');
  const mB = `/matches?user_a_id=eq.${a}&user_b_id=eq.${b}`;
  const f1 = await api('A', 'PATCH', mB, { status: 'accepted' });
  check(!f1.ok, 'cannot self-accept a candidate');
  const f2 = await api('A', 'PATCH', mB, { chat_opened: true });
  check(!f2.ok, 'cannot open chat on a candidate');
  const f3 = await api('A', 'PATCH', mB, { invited_by: U.B });
  check(!f3.ok, 'cannot set invited_by to the other person');
  const f4 = await api('A', 'PATCH', mB, { user_a_accepted: true, user_b_accepted: true });
  check(!f4.ok, 'cannot set legacy accepted flags');
  const f5 = await api('A', 'PATCH', mB, { source: 'mutual_like' });
  check(!f5.ok, 'cannot change source');
  const f6 = await api('A', 'PATCH', mB, { expires_at: '2030-01-01T00:00:00Z' });
  check(!f6.ok, 'cannot push expires_at far out');
  const ttl = await api('A', 'PATCH', `${mB}&invited_by=is.null`,
    { expires_at: new Date(Date.now() + 24 * 3600e3).toISOString(), status: 'pending', algo_version: 'v1' });
  check(ttl.ok && rows(ttl).length === 1, 'matches.tsx candidate TTL refresh still works');
  const [ad, dd] = U.A < U.D ? [U.A, U.D] : [U.D, U.A];
  const hid = await api('A', 'POST', '/matches', { user_a_id: ad, user_b_id: dd, match_score: 10 });
  check(!hid.ok, 'cannot create a matches row with a hidden user');
  const upHid = await api('A', 'POST', '/rpc/upsert_match', { p_user_a: ad, p_user_b: dd, p_match_score: 10 });
  check(!upHid.ok, 'upsert_match towards a hidden user rejected');
  const [ag, gg] = U.A < U.G ? [U.A, U.G] : [U.G, U.A];
  const blk = await api('A', 'POST', '/rpc/upsert_match', { p_user_a: ag, p_user_b: gg, p_match_score: 10 });
  check(!blk.ok, 'upsert_match with someone who blocked me rejected');
  const del = await api('A', 'DELETE', mB);
  check(!del.ok || rows(del).length === 0, 'cannot delete match history');

  // legitimate invite → accept → meetup → message → check-in
  const manOpens = await api('A', 'PATCH', mB, { invited_by: U.A, chat_opened: true, status: 'pending' });
  check(!manOpens.ok, 'man inviting a woman cannot open the chat immediately');
  const invite = await api('A', 'PATCH', mB, { invited_by: U.A, chat_opened: false, status: 'pending',
    [a === U.A ? 'user_a_intro_answers' : 'user_b_intro_answers']: { place: 'Moda Cafe' } });
  check(invite.ok && rows(invite).length === 1, 'invite (sendMatchInvite patch) works');
  const otherIntro = await api('A', 'PATCH', mB, { [a === U.A ? 'user_b_intro_answers' : 'user_a_intro_answers']: { x: 1 } });
  check(!otherIntro.ok, 'cannot write the other side\'s intro answers');
  const selfAccept = await api('A', 'PATCH', mB, { status: 'accepted', chat_opened: true });
  check(!selfAccept.ok, 'inviter cannot accept own invite');
  const msgEarly = await api('A', 'POST', '/messages', { sender_id: U.A, receiver_id: U.B, content: 'too early' });
  check(!msgEarly.ok, 'cannot message before the invite is accepted');
  const accept = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`, { chat_opened: true, status: 'accepted' });
  check(accept.ok && rows(accept).length === 1, 'invitee accept (acceptMatchInvite) works');
  const custom = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`,
    { meeting_at: '2026-10-10T17:00:00Z', confirmed_place: 'Moda Cafe — Kadıköy', meetup_proposed_by: U.B, meetup_confirmed: null });
  check(custom.ok, 'accept with a custom time (pending proposal) works');
  const ownConfirm = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`, { meetup_confirmed: true });
  check(!ownConfirm.ok, 'proposer cannot confirm own proposal');
  const confirm = await api('A', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`, { meetup_confirmed: true });
  check(confirm.ok, 'other side confirms the proposal');
  const pick = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`,
    { meeting_at: '2026-10-11T17:00:00Z', meetup_proposed_by: U.A, meetup_confirmed: true });
  check(pick.ok, 'invitee picking one of the inviter\'s offered times works');
  const msg = await api('A', 'POST', '/messages', { sender_id: U.A, receiver_id: U.B, content: 'hello' });
  check(msg.ok, 'message after acceptance works');
  const forgedMsg = await api('A', 'POST', '/messages', { sender_id: U.A, receiver_id: U.B, content: 'x', created_at: '2020-01-01' });
  check(!forgedMsg.ok, 'cannot backdate a message (created_at not insertable)');
  const readOwn = await api('A', 'PATCH', `/messages?sender_id=eq.${U.A}`, { read_at: new Date().toISOString() });
  check(rows(readOwn).length === 0, 'sender cannot mark own messages read');
  const readRecv = await api('B', 'PATCH', `/messages?sender_id=eq.${U.A}&receiver_id=eq.${U.B}&read_at=is.null`, { read_at: new Date().toISOString() });
  check(readRecv.ok && rows(readRecv).length >= 1, 'receiver read receipt (chat.tsx) works');
  const rewrite = await api('B', 'PATCH', `/messages?sender_id=eq.${U.A}`, { content: 'rewritten' });
  check(!rewrite.ok, 'receiver cannot rewrite message content');
  const delMsg = await api('B', 'DELETE', `/messages?sender_id=eq.${U.A}`);
  check(!delMsg.ok || rows(delMsg).length === 0, 'cannot delete messages');
  const ci = await api('A', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`,
    a === U.A ? { checkin_a: true, date_rating_a: 8 } : { checkin_b: true, date_rating_b: 8 });
  check(ci.ok, 'own check-in + rating works');
  const ciOther = await api('A', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`,
    a === U.A ? { checkin_b: true } : { checkin_a: true });
  check(!ciOther.ok, 'cannot check in for the other side');
  const early = await api('A', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`, { checkin_confirmed: true });
  check(!early.ok, 'checkin_confirmed needs both check-ins');
  const ciB = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`,
    a === U.B ? { checkin_a: true, date_rating_a: 9 } : { checkin_b: true, date_rating_b: 9 });
  const both = await api('B', 'PATCH', `/matches?id=eq.${rows(invite)[0].id}`, { checkin_confirmed: true });
  check(ciB.ok && both.ok, 'checkin_confirmed after both check-ins works');

  // woman inviting a man opens the chat (shouldOpenChatOnInvite)
  const [am, mm] = U.A < U.M ? [U.A, U.M] : [U.M, U.A];
  await api('M', 'POST', '/rpc/upsert_match', { p_user_a: am, p_user_b: mm, p_match_score: 70 });
  const wInv = await api('M', 'PATCH', `/matches?user_a_id=eq.${am}&user_b_id=eq.${mm}`,
    { invited_by: U.M, chat_opened: true, status: 'pending' });
  check(wInv.ok && rows(wInv).length === 1, 'woman inviting a man may open the chat at invite time');

  // revive of an expired old invite normalises it
  const [al, ll] = U.A < U.L ? [U.A, U.L] : [U.L, U.A];
  const rev = await api('A', 'POST', '/rpc/upsert_match', { p_user_a: al, p_user_b: ll, p_match_score: 60 });
  const revRow = await db.query(`select status, invited_by from public.matches where user_a_id='${al}' and user_b_id='${ll}'`);
  check(rev.ok && revRow.rows[0].status === 'pending' && revRow.rows[0].invited_by === null,
    'reviving an expired invite yields a clean candidate (no stale invite)');

  // likes
  const likeHidden = await api('A', 'POST', '/likes', { liker_id: U.A, likee_id: U.D, target_type: 'profile', status: 'sent' });
  check(!likeHidden.ok, 'cannot like a hidden, unrelated user');
  const likeStatus = await api('A', 'POST', '/likes', { liker_id: U.A, likee_id: U.J, target_type: 'profile', status: 'matched' });
  check(!likeStatus.ok, 'cannot insert a like as matched');
  const likeUp = await api('A', 'POST', '/likes?on_conflict=liker_id,likee_id',
    { liker_id: U.A, likee_id: U.J, target_type: 'photo', target_key: 'p1', note: 'hey', status: 'sent' },
    { Prefer: 'resolution=merge-duplicates,return=representation' });
  check(likeUp.ok, 'recordLike upsert works');
  const likeUp2 = await api('A', 'POST', '/likes?on_conflict=liker_id,likee_id',
    { liker_id: U.A, likee_id: U.J, target_type: 'profile', target_key: null, note: null, status: 'sent' },
    { Prefer: 'resolution=merge-duplicates,return=representation' });
  check(likeUp2.ok, 'recordLike upsert on an existing like works');
  const likeRetarget = await api('A', 'PATCH', `/likes?likee_id=eq.${U.J}`, { likee_id: U.B });
  check(!likeRetarget.ok, 'cannot re-point an existing like');
  const kCard = await api('A', 'GET', `/profile_cards?select=id&id=eq.${U.K}`);
  check(rows(kCard).length === 1, 'hidden user with a live like on me is visible (Liked you)');
  await db.exec(`update public.profiles set is_premium=true where id='${U.A}'`);
  const kLikers = await api('A', 'POST', '/rpc/get_my_liker_cards', { p_limit: 50 });
  check(rows(kLikers).some((r) => r.liker_id === U.K), 'hidden liker listed for premium');
  await db.exec(`update public.profiles set is_premium=false where id='${U.A}'`);
  const likeBackK = await api('A', 'POST', '/likes?on_conflict=liker_id,likee_id',
    { liker_id: U.A, likee_id: U.K, target_type: 'profile', status: 'sent' },
    { Prefer: 'resolution=merge-duplicates,return=representation' });
  const kMatch = await db.query(`select status, chat_opened, source from public.matches
    where least(user_a_id::text,user_b_id::text)=least('${U.A}','${U.K}') and greatest(user_a_id::text,user_b_id::text)=greatest('${U.A}','${U.K}')`);
  check(likeBackK.ok && kMatch.rows[0]?.status === 'accepted' && kMatch.rows[0]?.source === 'mutual_like',
    'liking back someone who liked me (Liked-you) opens the mutual chat');

  // notifications / reports / blocks
  await db.exec(`insert into public.notifications(user_id, type, text) values ('${U.A}', 'x', 'server text')`);
  const nText = await api('A', 'PATCH', `/notifications?user_id=eq.${U.A}`, { text: 'forged' });
  check(!nText.ok, 'cannot rewrite notification text');
  const nRead = await api('A', 'PATCH', `/notifications?user_id=eq.${U.A}`, { is_read: true });
  check(nRead.ok && rows(nRead).length >= 1, 'mark notification read works');
  const nIns = await api('A', 'POST', '/notifications', { user_id: U.B, type: 'x', text: 'spoof' });
  check(!nIns.ok, 'cannot insert notifications');
  const rep = await api('A', 'POST', '/reports', { reporter_id: U.A, reported_id: U.J, reason: 'spam' });
  check(rep.ok, 'report works');
  const repEdit = await api('A', 'PATCH', `/reports?reporter_id=eq.${U.A}`, { reported_id: U.B });
  check(!repEdit.ok, 'cannot edit a report');
  const blkIns = await api('A', 'POST', '/blocks', { blocker_id: U.A, blocked_id: U.I });
  const blkDel = await api('A', 'DELETE', `/blocks?blocker_id=eq.${U.A}&blocked_id=eq.${U.I}`);
  check(blkIns.ok && blkDel.ok, 'block + unblock work');
  const ev = await api('A', 'POST', '/events', { user_id: U.A, name: 'x', properties: {} }, { Prefer: 'return=minimal' });
  check(ev.ok, 'analytics event insert works');

  await readPaths('P0-A');
  await storageChecks();
}

async function readPaths(label) {
  // profile_cards: rows and columns
  const cards = await api('A', 'GET', '/profile_cards?select=*');
  if (!cards.ok && process.env.DEBUG) console.log(cards.status, cards.json);
  check(cards.ok, `${label}: profile_cards readable when signed in`);
  const ids = new Set(rows(cards).map((r) => r.id));
  const expectVisible = { A: true, B: true, C: true, J: true, K: true, M: true, F: true, L: true, P: true, Q: true, HI: true };
  const expectHidden = { D: true, D2: true, E: true, G: true, I: true, HX: true };
  for (const k of Object.keys(expectVisible)) check(ids.has(U[k]), `${label}: profile_cards shows ${k}`);
  for (const k of Object.keys(expectHidden)) check(!ids.has(U[k]), `${label}: profile_cards hides ${k}`);
  check(!hasPrivate(cards), `${label}: profile_cards returns no private columns (incl. district, DOB)`);
  check(rows(cards).every((r) => typeof r.age === 'number'), `${label}: profile_cards returns age`);
  const fromG = await api('G', 'GET', `/profile_cards?id=eq.${U.A}`);
  check(rows(fromG).length === 1, `${label}: blocker sees the person they blocked (unblock list)`);
  const fromF = await api('F', 'GET', `/profile_cards?id=eq.${U.A}`);
  check(rows(fromF).length === 0, `${label}: blocked person cannot see the blocker`);

  // discovery
  const disc = await api('A', 'POST', '/rpc/get_discovery_cards', { p_limit: 20 });
  if (!disc.ok && process.env.DEBUG) console.log(disc.status, disc.json);
  check(disc.ok && rows(disc).length > 0, `${label}: get_discovery_cards works`);
  check(!hasPrivate(disc), `${label}: get_discovery_cards returns no DOB / district`);
  const dIds = rows(disc).map((r) => r.user_id);
  check(dIds.includes(U.P) && dIds.includes(U.Q), `${label}: discovery returns untouched discoverable users`);
  for (const k of ['C', 'D', 'D2', 'E', 'F', 'G', 'I']) check(!dIds.includes(U[k]), `${label}: discovery excludes ${k}`);
  if (label === 'P0-A') {
    const top = await api('A', 'POST', '/rpc/get_top_matches', { p_user_id: U.A, p_limit: 20 });
    check(JSON.stringify(rows(top).map((r) => r.user_id)) === JSON.stringify(dIds),
      'P0-A: get_discovery_cards order == get_top_matches order (scoring unchanged)');
  }
  const discOther = await api('B', 'POST', '/rpc/get_discovery_cards', { p_limit: 20 });
  check(!rows(discOther).some((r) => r.user_id === U.B), `${label}: discovery never returns the caller`);

  // likers
  const lk = await api('A', 'POST', '/rpc/get_my_liker_cards', { p_limit: 50 });
  check(lk.ok && rows(lk).every((r) => r.liker_id === null && r.note === null), `${label}: non-premium likers are anonymous`);
  const visibleLikers = rows(lk)[0]?.total_count;
  await db.exec(`update public.profiles set is_premium=true where id='${U.A}'`);
  const lkP = await api('A', 'POST', '/rpc/get_my_liker_cards', { p_limit: 50 });
  const lIds = rows(lkP).map((r) => r.liker_id);
  check(!lIds.includes(U.G), `${label}: premium likers exclude someone who blocked me`);
  check(!lIds.includes(U.E), `${label}: premium likers exclude deleted users`);
  check(!hasPrivate(lkP) && rows(lkP).every((r) => r.age === null || typeof r.age === 'number'),
    `${label}: premium likers return age, no DOB`);
  check(rows(lkP).length === Number(visibleLikers ?? 0), `${label}: liker count matches visible likers`);
  await db.exec(`update public.profiles set is_premium=false where id='${U.A}'`);

  // venues: the other person's district is never exposed or used as a label
  const vB = await api('A', 'POST', '/rpc/get_date_venue_suggestions', { p_other: U.B });
  check(vB.ok && rows(vB).length === 3, `${label}: venue suggestions work`);
  check(rows(vB).every((r) => r.reason !== 'both') && rows(vB)[0]?.reason === 'you',
    `${label}: venues: other district not revealed (no "both" across districts, own first)`);
  const vM = await api('A', 'POST', '/rpc/get_date_venue_suggestions', { p_other: U.M });
  check(rows(vM)[0]?.reason === 'both', `${label}: venues: same district (diacritics-insensitive) → "both"`);
  const vD = await api('A', 'POST', '/rpc/get_date_venue_suggestions', { p_other: U.D });
  check(rows(vD).every((r) => r.reason !== 'both'), `${label}: venues: invisible user contributes nothing`);

  // client shapes used by the R-P0 app (must all succeed with data)
  for (const shape of clientShapes(U)) {
    const r = await api(shape.actor, shape.method ?? 'GET', shape.path, shape.body);
    const ok = r.ok && (shape.expect ? shape.expect(r.json) : true);
    check(ok, `${label}: R-P0 client shape — ${shape.name}`);
    if (shape.noPrivate) check(!hasPrivate(r), `${label}: R-P0 client shape has no private data — ${shape.name}`);
  }
}

async function storageChecks() {
  const tag = stage.replace(/[^A-Za-z0-9]/g, '');
  const anonList = await asRole('anon', null, `select name from storage.objects where bucket_id='user-photos'`);
  check(anonList.ok && anonList.rows.length === 0, 'storage: anon cannot list user-photos');
  const own = await asRole('authenticated', U.A, `select name from storage.objects where bucket_id='user-photos'`);
  check(own.ok && own.rows.length >= 1 && own.rows.every((r) => r.name.startsWith(`${U.A}/`)), 'storage: owner lists only own folder');
  const up = await asRole('authenticated', U.A, `insert into storage.objects(bucket_id,name) values ('user-photos','${U.A}/new-${tag}.jpg')`);
  check(up.ok, 'storage: upload to own folder works');
  const upOther = await asRole('authenticated', U.A, `insert into storage.objects(bucket_id,name) values ('user-photos','${U.B}/x.jpg')`);
  check(!upOther.ok, 'storage: upload to another folder rejected');
  const selfie = await asRole('authenticated', U.B, `select name from storage.objects where bucket_id='verification-selfies'`);
  check(selfie.ok && selfie.rows.length === 0, 'storage: nobody (not even owner) reads verification selfies');
}

async function p0bChecks() {
  stage = 'P0-B';
  const own = await api('A', 'GET', `/profiles?id=eq.${U.A}&select=*`);
  check(rows(own).length === 1 && 'phone_number' in rows(own)[0], 'owner still reads own full row');
  for (const k of ['B', 'C', 'J', 'K']) {
    const r = await api('A', 'GET', `/profiles?id=eq.${U[k]}&select=*`);
    check(rows(r).length === 0, `other user's profiles row not readable (${k})`);
  }
  const all = await api('A', 'GET', '/profiles?select=id');
  check(rows(all).length === 1, 'profiles table returns only own row');
  const emb = await api('A', 'GET',
    `/matches?select=id,profiles!matches_user_b_id_fkey(first_name,date_of_birth)&status=eq.accepted&or=(user_a_id.eq.${U.A},user_b_id.eq.${U.A})`);
  check(rows(emb).every((m) => m.profiles === null || m.profiles?.first_name === 'A'), 'embedded join no longer exposes other profiles');
  const top = await api('A', 'POST', '/rpc/get_top_matches', { p_user_id: U.A, p_limit: 5 });
  check(!top.ok, 'get_top_matches (DOB + district) no longer callable');
  const lk = await api('A', 'POST', '/rpc/get_my_likers', {});
  check(!lk.ok, 'get_my_likers (DOB) no longer callable');
  await readPaths('P0-B');
  await storageChecks();
}

// P0-A revert file must restore the exact live access state (policies,
// table/column grants, function set) — checked on a separate fresh replica.
async function revertCheck() {
  stage = 'REVERT';
  const fingerprint = async (d) => {
    const q = async (sql) => JSON.stringify((await d.query(sql)).rows);
    return {
      policies: await q(`select schemaname, tablename, policyname, cmd, roles::text, qual, with_check
        from pg_policies order by 1,2,3`),
      tableGrants: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants
        where table_schema='public' and grantee in ('anon','authenticated') order by 1,2,3`),
      columnGrants: await q(`select table_name, column_name, grantee, privilege_type from information_schema.column_privileges
        where table_schema='public' and grantee in ('anon','authenticated') order by 1,2,3,4`),
      // ACL entry order is not meaningful; compare the sorted set.
      functions: await q(`select proname,
          coalesce((select string_agg(x, ',' order by x) from unnest(proacl::text[]) x), '') as acl
        from pg_proc where pronamespace='public'::regnamespace order by 1`),
      views: await q(`select viewname from pg_views where schemaname='public' order by 1`),
      triggers: await q(`select tgname from pg_trigger where not tgisinternal order by 1`),
    };
  };
  const d = new PGlite();
  await d.exec(buildReplicaSql());
  const before = await fingerprint(d);
  await d.exec(fs.readFileSync(path.join(proposed, '20260928130000_p0a_privacy_additive.sql'), 'utf8'));
  const during = await fingerprint(d);
  check(JSON.stringify(during) !== JSON.stringify(before), 'P0-A changes the access state');
  await d.exec(fs.readFileSync(path.join(proposed, '20260928130000_p0a_privacy_additive.rollback.sql'), 'utf8'));
  const after = await fingerprint(d);
  for (const k of Object.keys(before)) {
    const same = before[k] === after[k];
    if (!same && process.env.DEBUG) console.log('REVERT DIFF', k);
    check(same, `P0-A revert restores live ${k} exactly`);
  }
  await d.close();
}

// ---------------------------------------------------------------------------
async function main() {
  await db.exec(buildReplicaSql());
  await db.exec(seedSql());
  const server = new PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1', maxConnections: 4 });
  await server.start();
  await startApi();
  try {
    await baselineLive();
    await applyFile('20260928130000_p0a_privacy_additive.sql');
    await reloadApi();
    await p0aChecks();
    await applyFile('20260928130100_p0b_privacy_restrict.sql');
    await reloadApi();
    await p0bChecks();
  } finally {
    pgrst.kill('SIGTERM');
    await server.stop();
  }
  await revertCheck();
  const out = process.env.RESULTS_JSON;
  if (out) fs.writeFileSync(out, JSON.stringify({ passed, failed, results }, null, 1));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
await main();
