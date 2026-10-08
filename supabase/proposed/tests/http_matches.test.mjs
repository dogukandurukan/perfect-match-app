// V2 Matches (daily picks, featured mutual, like source, no automatic
// messages, hidden / suspended) — over real PostgREST HTTP on the LOCAL
// live-schema replica with every applied package + the proposed
// 20261009090000_v2_matches_daily_picks.sql. Synthetic users only; nothing
// touches the shared remote project (DEV = live).
//
// Run: PGLITE_DIR=<dir>/node_modules POSTGREST=<postgrest 13 or a wrapper> \
//      node supabase/proposed/tests/http_matches.test.mjs
// (PostgREST 13.0.8 from the official Docker image works through a small
// wrapper that maps the harness config to PGRST_* variables.)
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
const PG_PORT = 54359;
const API_PORT = 54360;
const SECRET = 'local-test-secret-local-test-secret-0123456789';

const id = (n) => `00000000-0000-4000-8000-0000000009${n}`;
// A = the viewer (man → women). B–E: eligible women. F: woman in another
// city (never eligible). H, S, M1, M2: women already matched with A.
// V, W: second viewer pair for tab-order checks. L1/L2: V1 legacy accounts.
const U = {
  A: id('01'), B: id('02'), C: id('03'), D: id('04'), E: id('05'), F: id('06'),
  H: id('07'), S: id('08'), M1: id('09'), M2: id('10'), V: id('11'), W: id('12'),
  L1: id('13'), L2: id('14'), R: id('15'),
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
  const conf = path.join(process.env.TMPDIR || '/tmp', `pgrst-matches-${process.pid}.conf`);
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
// ─── seed (synthetic only) ────────────────────────────────────────────────
const WOMEN_IST = ['B', 'C', 'D', 'E', 'H', 'S', 'M1', 'M2', 'W', 'R'];
function seedSql() {
  const out = [];
  const person = (k, gender, interested, city, dob) => {
    const u = U[k];
    out.push(`insert into auth.users(id, email) values ('${u}','${k.toLowerCase()}@tempa-test.invalid');`);
    out.push(`insert into public.profiles(id, first_name, setup_completed, photos) values ('${u}','${k}',true,'{}');`);
    out.push(`insert into public.onboarding_v2(user_id, first_name, last_name, date_of_birth, gender, interested_in, location_city, location_district)
              values ('${u}','${k}','Synthetic','${dob}','${gender}',array['${interested}'],'${city}','Kadıköy');`);
    out.push(`insert into public.account_state_v2(user_id, application_status, verification_status, membership_status)
              values ('${u}','accepted','verified','active');`);
    out.push(`insert into public.profile_photos_v2(user_id, storage_path, position) values ('${u}','${u}/1.jpg',1), ('${u}','${u}/2.jpg',2);`);
    out.push(`insert into public.profile_prompts_v2(user_id, slot, prompt_id, answer) values ('${u}',1,'small_thing_i_love','Answer of ${k}');`);
  };
  person('A', 'man', 'women', 'İstanbul', '1994-01-01');
  person('V', 'man', 'women', 'İstanbul', '1993-01-01');
  for (const k of WOMEN_IST) person(k, 'woman', 'men', 'İstanbul', '1996-05-05');
  person('F', 'woman', 'men', 'Ankara', '1996-05-05');
  // R: general "not active" (membership none) — NOT suspended.
  out.push(`update public.account_state_v2 set membership_status = 'none' where user_id = '${U.R}';`);
  // A's existing mutual matches (no messages): M1 oldest … R newest.
  [['M1', 5], ['M2', 4], ['H', 3], ['S', 2], ['R', 1]].forEach(([k, d]) => {
    out.push(`insert into public.matches(user_a_id, user_b_id, status, chat_opened, source, match_score, created_at)
              values (least('${U.A}','${U[k]}')::uuid, greatest('${U.A}','${U[k]}')::uuid, 'accepted', true, 'mutual_like', 100, now() - interval '${d} days');`);
  });
  // V1 legacy pair (no account_state_v2 rows).
  for (const k of ['L1', 'L2']) {
    out.push(`insert into auth.users(id, email) values ('${U[k]}','${k.toLowerCase()}@tempa-test.invalid');`);
  }
  out.push(`insert into public.profiles(id, first_name, gender, city, date_of_birth, meeting_preferences, setup_completed, photos) values
    ('${U.L1}','LegacyOne','Man','Istanbul','1994-01-01','{Women}',true,'{${U.L1}/p.jpg}'),
    ('${U.L2}','LegacyTwo','Woman','Istanbul','1995-01-01','{Men}',true,'{${U.L2}/p.jpg}');`);
  return out.join('\n');
}

// ─── helpers ──────────────────────────────────────────────────────────────
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => (await q(s))[0];
const picks = async (actor) => (await rpc(actor, 'get_daily_picks_v2')).json;
const picksAt = async (k, at) => (await one(`select public.v2_daily_picks_json('${U[k]}', '${at}') as j`)).j;
const dayFromNow = (d) => new Date(Date.now() + d * 86400e3).toISOString();
const photoOf = async (k) => (await one(`select id from profile_photos_v2 where user_id='${U[k]}' order by position limit 1`)).id;
const photoPath = async (k) => (await one(`select storage_path from profile_photos_v2 where user_id='${U[k]}' order by position limit 1`)).storage_path;
const promptOf = async (k) => (await one(`select id from profile_prompts_v2 where user_id='${U[k]}' limit 1`)).id;
const used = async (k) => Number((await one(`select coalesce(daily_views_count,0) n from profiles where id='${U[k]}'`)).n);
const likeRows = (a, b) => q(`select * from likes where liker_id='${U[a]}' and likee_id='${U[b]}'`);
const msgCount = async (a, b) => Number((await one(`select count(*) n from messages where (sender_id='${U[a]}' and receiver_id='${U[b]}') or (sender_id='${U[b]}' and receiver_id='${U[a]}')`)).n);
const keyOf = (uid) => Object.keys(U).find((k) => U[k] === uid);
const send = async (actor, likeeKey, type, targetId, note, req, source) => {
  const args = { p_likee: U[likeeKey], p_target_type: type, p_target_id: targetId, p_note: note, p_request_id: req ?? crypto.randomUUID() };
  if (source !== undefined) args.p_source = source;
  return (await rpc(actor, 'send_like_v2', args)).json;
};
const message = (from, to, content) => api(from, 'POST', '/messages', { sender_id: U[from], receiver_id: U[to], content });
const matchId = async (a, b) => (await one(`select id from matches where least(user_a_id::text,user_b_id::text)=least('${U[a]}','${U[b]}') and greatest(user_a_id::text,user_b_id::text)=greatest('${U[a]}','${U[b]}')`))?.id;
const discovery = async (actor) => rows(await rpc(actor, 'get_discovery_candidates_v2', { p_limit: 50 })).map((r) => r.user_id);

async function main() {
  await db.exec(buildReplicaSql());
  for (const f of ['20260928130000_p0a_privacy_additive.sql', '20260930090000_p1_private_photos.sql',
    '20260930120000_v2_onboarding_persistence.sql', '20260930140000_v2_review_discovery_media.sql',
    '20261001090000_v2_public_profile.sql', '20261001120000_v2_match_chat_date.sql', '20261001140000_v2_discovery_skip_liked.sql',
    '20260928130100_p0b_privacy_restrict.sql', '20261008090000_v2_discover_targeted_likes.sql',
    '20261009090000_v2_matches_daily_picks.sql']) {
    await db.exec(fs.readFileSync(path.join(proposed, f), 'utf8'));
  }
  await db.exec(seedSql());
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
  // ── period ───────────────────────────────────────────────────────────────
  stage = 'PERIOD';
  check((await one(`select public.v2_pick_period('2026-10-09T08:59:59Z')::text p`)).p === '2026-10-08', '11:59:59 Istanbul → previous period');
  check((await one(`select public.v2_pick_period('2026-10-09T09:00:00Z')::text p`)).p === '2026-10-09', '12:00:00 Istanbul → new period');
  check(new Date((await one(`select public.v2_pick_refresh_at('2026-10-08') t`)).t).toISOString() === '2026-10-09T09:00:00.000Z', 'refresh_at = next 12:00 Istanbul (09:00 UTC)');
  const vBefore = await picksAt('V', '2026-10-09T08:59:00Z');
  const vBefore2 = await picksAt('V', '2026-10-09T08:59:59Z');
  const vAfter = await picksAt('V', '2026-10-09T09:00:30Z');
  check(vBefore.pick?.user_id && vBefore.pick.user_id === vBefore2.pick?.user_id && vBefore.period === vBefore2.period, 'same period (11:59 / 11:59:59) → same pick');
  check(vAfter.period !== vBefore.period && vAfter.pick?.user_id && vAfter.pick.user_id !== vBefore.pick.user_id, 'after 12:00 → new period, a different pick');

  // ── daily picks over HTTP (A) ─────────────────────────────────────────────
  stage = 'DAILY';
  const p1 = await picks('A');
  const P = keyOf(p1?.pick?.user_id);
  check(p1?.member === true && ['B', 'C', 'D', 'E', 'W'].includes(P) && p1.pick.state === 'new', 'pick = an eligible, unmatched person (state new)');
  check(keyOf(p1?.mutual?.user_id) === 'M1' && p1.mutual.state === 'matched', 'featured mutual = oldest never-featured match without messages');
  check(p1.pick.user_id !== p1.mutual.user_id, 'never the same person in both sections');
  check(!JSON.stringify([p1.pick, p1.mutual]).match(/score|percent|reason|compat/i) && !('district' in p1.pick), 'no score / percentage / district in the card');
  const again = [];
  for (let i = 0; i < 3; i += 1) again.push(await picks('A'));
  const burst = await Promise.all([1, 2, 3, 4, 5].map(() => picks('A')));
  check([...again, ...burst].every((x) => x.pick.user_id === p1.pick.user_id && x.mutual.user_id === p1.mutual.user_id), 'reopen ×3 + 5 concurrent requests → same pick and mutual');
  check(Number((await one(`select count(*) n from daily_picks_v2 where user_id='${U.A}'`)).n) === 1, 'exactly one stored row for the period');
  await rejects('anon', 'get_daily_picks_v2', {}, 'permission denied', 'signed-out caller refused');
  check(!(await asRole('authenticated', U.A, 'select * from public.daily_picks_v2')).ok, 'clients cannot read daily_picks_v2');
  check(!(await asRole('authenticated', U.A, `select public.v2_daily_picks_json('${U.A}', now())`)).ok, 'clients cannot call the internal period function');

  // ── Discover consistency ─────────────────────────────────────────────────
  stage = 'DISCOVER';
  const dA = await discovery('A');
  check(!dA.includes(U[P]) && dA.length > 0 && !dA.includes(U.F), 'A: today’s pick is not in Discover (opened after Matches)');
  const dW = await discovery('W'); // W opens Discover FIRST in this period
  const pW = await picks('W');
  check(pW.pick?.user_id && !dW.includes(pW.pick.user_id), 'W: Discover first, then Matches → pick still not in Discover (tab order irrelevant)');

  // ── like source / stale / quota ──────────────────────────────────────────
  stage = 'SOURCE';
  const others = ['B', 'C', 'D', 'E'].filter((k) => k !== P);
  const X = others[0];
  const q0 = await used('A');
  let r = await send('A', X, 'photo', await photoOf(X), null, null, 'daily_pick');
  check(r?.ok === false && r.error === 'stale_pick' && (await likeRows('A', X)).length === 0 && (await used('A')) === q0, 'daily_pick for someone who is not today’s pick → refused, nothing spent');
  r = await send('A', P, 'photo', await photoOf(P), 'hi', null, 'discover');
  check(r?.ok === false && r.error === 'stale_pick' && (await likeRows('A', P)).length === 0 && (await used('A')) === q0, 'Discover-source like on today’s pick → refused (refresh), nothing spent');
  r = await send('A', P, 'photo', await photoOf(P), null, null, 'bogus');
  check(r?.ok === false && r.error === 'invalid_source', 'unknown source refused');
  const yesterday = await picksAt('A', dayFromNow(-1));
  const Y = keyOf(yesterday.pick?.user_id);
  check(Y && Y !== P, 'yesterday’s period has its own (different) pick');
  r = await send('A', Y, 'photo', await photoOf(Y), null, null, 'daily_pick');
  check(r?.ok === false && r.error === 'stale_pick' && (await used('A')) === q0, 'pick from an earlier day → stale_pick, no like / quota');
  const r1 = crypto.randomUUID();
  r = await send('A', P, 'photo', await photoOf(P), '  Which ferry?  ', r1, 'daily_pick');
  const lp = await likeRows('A', P);
  check(r?.ok === true && lp.length === 1 && lp[0].source === 'daily_pick' && lp[0].pick_period && lp[0].target_key === (await photoOf(P)) && lp[0].note === 'Which ferry?', 'today’s pick: like saved with source daily_pick + period + exact photo');
  check((await used('A')) === q0 + 1, 'one like unit spent');
  const rep = await send('A', P, 'photo', await photoOf(P), 'Which ferry?', r1, 'daily_pick');
  check(rep?.ok === true && rep.replayed === true && (await used('A')) === q0 + 1 && (await likeRows('A', P)).length === 1, 'retry with the same request → original result, no second unit');
  check((await picks('A')).pick.state === 'like_sent' && (await picks('A')).pick.like?.note === 'Which ferry?', 'card shows Like sent with the note');
  // D74: an earlier day's pick (not liked) is a normal Discover person today —
  // liking from Discover is fine; only daily_pick is refused for it.
  check((await discovery('A')).includes(U[Y]), 'yesterday’s pick (not liked) appears in today’s Discover');
  const qy = await used('A');
  r = await send('A', Y, 'prompt', await promptOf(Y), null, null, 'discover');
  const ly = await likeRows('A', Y);
  check(r?.ok === true && ly.length === 1 && ly[0].source === 'discover' && ly[0].pick_period === null && (await used('A')) === qy + 1,
    'yesterday’s pick liked from Discover → accepted as source discover (one unit)');
  r = await send('A', X, 'prompt', await promptOf(X), null, null, 'discover');
  check(r?.ok === true && (await likeRows('A', X))[0].source === 'discover' && (await likeRows('A', X))[0].pick_period === null, 'Discover like stored with source discover');
  const Z = others[1];
  r = (await rpc('A', 'send_like_v2', { p_likee: U[Z], p_target_type: 'photo', p_target_id: await photoOf(Z), p_note: null, p_request_id: crypto.randomUUID() })).json;
  check(r?.ok === true && (await likeRows('A', Z))[0].source === 'discover', 'installed builds (5-argument call) = Discover source');

  // ── mutual like: immediate match, no automatic message ────────────────────
  stage = 'MUTUAL';
  const pOfP = await picks(P);
  const srcBack = pOfP.pick?.user_id === U.A ? 'daily_pick' : 'discover';
  r = await send(P, 'A', 'prompt', await promptOf('A'), 'Kadıköy line, obviously.', null, srcBack);
  check(r?.ok === true && r.matched === true, 'pick likes A back → matched immediately (no 12:00 wait)');
  const mAP = await matchId('A', P);
  check(mAP && (await one(`select status, chat_opened from matches where id='${mAP}'`)).chat_opened === true, 'one accepted match, chat open');
  check((await msgCount('A', P)) === 0, 'V2: no automatic message from either comment');
  const p2 = await picks('A');
  check(p2.pick.user_id === U[P] && p2.pick.state === 'matched' && p2.pick.match_id === mAP, 'same pick card → matched (Say hello), with the match id');
  check(p2.mutual.user_id === U.M1 && p2.pick.user_id !== p2.mutual.user_id, 'mutual section unchanged; no copy');
  const chat = (await rpc('A', 'get_chat_v2', { p_match: mAP })).json;
  const mine = chat?.likes?.find((l) => l.from_me);
  const theirs = chat?.likes?.find((l) => !l.from_me);
  check(chat?.state === 'active' && chat.likes.length === 2, 'chat: active, both likes as context');
  check(mine?.target_type === 'photo' && mine.photo_path === (await photoPath(P)) && mine.note === 'Which ferry?', 'context: A’s like on P’s photo (which photo + note)');
  check(theirs?.target_type === 'prompt' && theirs.prompt_id === 'small_thing_i_love' && theirs.answer === 'Answer of A' && theirs.note === 'Kadıköy line, obviously.', 'context: P’s like on A’s prompt (which answer + note)');
  check((await message('A', P, 'Hi!')).ok && (await picks('A')).pick.state === 'conversation_started', 'first real message → Conversation started on the pick card');
  check((await message('A', 'M1', 'Hello M1')).ok && (await picks('A')).mutual.state === 'conversation_started', 'first message to the featured mutual → Conversation started (kept this period)');
  check((await picks('A')).mutual.user_id === U.M1, 'the period keeps the same featured mutual after the first message');

  // ── rotation across periods ───────────────────────────────────────────────
  stage = 'ROTATION';
  const day = [];
  for (let d = 1; d <= 5; d += 1) day[d] = await picksAt('A', dayFromNow(d));
  // Featured so far: today M1 (now talking), the simulated yesterday M2.
  check(keyOf(yesterday.mutual?.user_id) === 'M2', 'yesterday’s period featured M2 (M1 was today’s)');
  check(![1, 2, 3, 4, 5].some((d) => day[d].mutual?.user_id === U.M1), 'M1 (conversation started) is never featured again');
  check(keyOf(day[1].mutual?.user_id) === 'H' && keyOf(day[2].mutual?.user_id) === 'S', 'never-featured matches first, oldest match first (H, then S)');
  check(![day[1], day[2], day[3]].some((x) => keyOf(x.mutual?.user_id) === 'R'), 'not-active (membership none) match is not featured');
  check(keyOf(day[3].mutual?.user_id) === 'M2' && keyOf(day[4].mutual?.user_id) === 'H', 'all featured → least recently featured first (M2, then H)');
  check(![1, 2, 3, 4, 5].some((d) => day[d].mutual?.user_id === U[P]), 'P (talking) never featured as mutual');
  const allPicks = [p1.pick.user_id, yesterday.pick?.user_id, vBefore.pick?.user_id, ...[1, 2, 3, 4, 5].map((d) => day[d].pick?.user_id)].filter(Boolean);
  const aPicks = [p1.pick.user_id, yesterday.pick?.user_id, ...[1, 2, 3, 4, 5].map((d) => day[d].pick?.user_id)].filter(Boolean);
  check(new Set(aPicks).size === aPicks.length, 'a person is never offered as a pick twice');
  check([1, 2, 3, 4, 5].some((d) => day[d].pick === null && day[d].pick_reason === 'none'), 'no candidate left → pick null, reason none (empty state)');
  check([1, 2, 3, 4, 5].every((d) => !day[d].pick || ![U[X], U[Z], U[P]].includes(day[d].pick.user_id)), 'liked / matched people are never picks');
  void allPicks;
  // Single unmessaged match repeats (V ↔ W).
  await db.exec(`insert into matches(user_a_id, user_b_id, status, chat_opened, source, match_score) values (least('${U.V}','${U.W}')::uuid, greatest('${U.V}','${U.W}')::uuid, 'accepted', true, 'mutual_like', 100)`);
  const v6 = await picksAt('V', dayFromNow(6));
  const v7 = await picksAt('V', dayFromNow(7));
  check(keyOf(v6.mutual?.user_id) === 'W' && keyOf(v7.mutual?.user_id) === 'W', 'only one eligible match → featured again the next day');

  // ── hidden ───────────────────────────────────────────────────────────────
  stage = 'HIDDEN';
  await db.exec(`update profiles set is_hidden = true where id = '${U.H}'`);
  const mAH = await matchId('A', 'H');
  check((await rpc('A', 'get_chat_v2', { p_match: mAH })).json?.state === 'active' && (await message('A', 'H', 'still here')).ok, 'hidden: existing chat continues (A can message H)');
  check((await rpc('A', 'get_profile_v2', { p_user: U.H })).json !== null, 'hidden: the match can still open the profile');
  check((await rpc('V', 'get_profile_v2', { p_user: U.H })).json === null && !(await discovery('V')).includes(U.H), 'hidden: not visible / not in Discover for others');
  const v8 = await picksAt('V', dayFromNow(8));
  check(v8.pick?.user_id !== U.H && (await picksAt('A', dayFromNow(9))).mutual?.user_id !== U.H, 'hidden: never a pick, never a featured mutual');

  // ── suspended ────────────────────────────────────────────────────────────
  stage = 'SUSPENDED';
  const mAS = await matchId('A', 'S');
  check((await message('A', 'S', 'before suspension')).ok, 'history exists before suspension');
  await db.exec(`update account_state_v2 set membership_status = 'suspended' where user_id = '${U.S}'`);
  const cS = (await rpc('A', 'get_chat_v2', { p_match: mAS })).json;
  check(cS?.state === 'unavailable' && cS.active === false, 'suspended: chat state unavailable (read-only)');
  check((await asRole('authenticated', U.A, `select content from messages where receiver_id='${U.S}'`)).rows?.length === 1, 'suspended: the other participant can still read the history');
  check(!(await asRole('authenticated', U.A, `insert into messages(sender_id, receiver_id, content) values ('${U.A}','${U.S}','x')`)).ok, 'suspended: A cannot message S');
  check(!(await asRole('authenticated', U.S, `insert into messages(sender_id, receiver_id, content) values ('${U.S}','${U.A}','x')`)).ok, 'suspended: S cannot message');
  const listA = rows(await rpc('A', 'get_my_matches_v2'));
  const rowS = listA.find((x) => x.other_id === U.S);
  check(rowS && rowS.unavailable === true && rowS.photo_path === null, 'Chats: S listed as Account unavailable (no photo)');
  r = await send('S', 'V', 'photo', await photoOf('V'), null, null, 'discover');
  check(r?.ok === false && (r.error === 'not_member' || r.error === 'not_available'), 'suspended: no new likes');
  check(!(await discovery('V')).includes(U.S) && (await picksAt('A', dayFromNow(10))).mutual?.user_id !== U.S, 'suspended: not in Discover, not featured');
  const mAR = await matchId('A', 'R');
  check((await rpc('A', 'get_chat_v2', { p_match: mAR })).json?.state !== 'unavailable', 'membership none (not active) is NOT treated as suspended');

  // ── block / delete / unmatch (current period cards) ──────────────────────
  stage = 'REMOVED';
  const qW = (await picks('W')).pick?.user_id;
  check(!!qW, 'W has a pick');
  await db.exec(`insert into blocks(blocker_id, blocked_id) values ('${qW}','${U.W}')`);
  const wAfter = await picks('W');
  check(wAfter.pick === null && wAfter.pick_reason === 'unavailable', 'blocked pick → card hidden (unavailable)');
  check((await one(`select pick_user_id from daily_picks_v2 where user_id='${U.W}' and period = public.v2_pick_period(now())`)).pick_user_id === qW, 'not replaced inside the period');
  await db.exec(`insert into blocks(blocker_id, blocked_id) values ('${U.M1}','${U.A}')`);
  const aB = await picks('A');
  check(aB.mutual === null && aB.mutual_reason === 'unavailable', 'blocked featured mutual → card hidden');
  check((await rpc('A', 'get_chat_v2', { p_match: await matchId('A', 'M1') })).json?.state === 'ended', 'block → chat ended');
  await db.exec(`update profiles set deleted_at = now() where id = '${U.M2}'`);
  check((await rpc('A', 'get_chat_v2', { p_match: await matchId('A', 'M2') })).json?.state === 'ended' && !rows(await rpc('A', 'get_my_matches_v2')).some((x) => x.other_id === U.M2), 'deleted account → chat ended, not in Chats');
  check((await rpc('A', 'unmatch_v2', { p_match: mAH })).ok && (await rpc('A', 'get_chat_v2', { p_match: mAH })).json?.state === 'ended', 'unmatch → chat ended');
  const later = [await picksAt('A', dayFromNow(11)), await picksAt('A', dayFromNow(12))];
  check(later.every((x) => ![U.M1, U.M2, U.H, U.S].includes(x.mutual?.user_id)), 'blocked / deleted / unmatched / suspended never featured again');

  // ── V1 unchanged ─────────────────────────────────────────────────────────
  stage = 'V1';
  check((await asRole('authenticated', U.L1, `insert into likes(liker_id, likee_id, target_type, note, status) values ('${U.L1}','${U.L2}','profile','v1 note one','sent')`)).ok, 'V1 direct like still works');
  check((await asRole('authenticated', U.L2, `insert into likes(liker_id, likee_id, target_type, note, status) values ('${U.L2}','${U.L1}','profile','v1 note two','sent')`)).ok, 'V1 like back');
  check((await msgCount('L1', 'L2')) === 2, 'V1: notes still become the opening messages (unchanged)');
  check((await likeRows('L1', 'L2'))[0].source === null, 'V1 / old likes keep source NULL (unknown)');
  check(!(await asRole('authenticated', U.A, `insert into likes(liker_id, likee_id, target_type, status) values ('${U.A}','${U.C}','profile','sent')`)).ok, 'V2 member direct write still refused');
}

await main();
