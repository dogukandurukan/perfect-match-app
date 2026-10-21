// Bounded Realtime soak on the LOCAL Supabase, with the APP's own sync code
// (lib/chat/sync.ts + lib/chat/merge.ts):
//   node scripts/local-backend/soak_realtime_local.mjs
// Uses the synthetic probe pair (.test-backend/realtime-probe-pair.json,
// created by probe_realtime_local.mjs setup) — no new accounts, never the
// phone accounts. Limits: ≤ 30 min, ≤ 40 messages "rt-soak <run> #n".
//
// Receiver A behaves like app/chat.tsx: newest page → subscribe (no filter,
// RLS applies) → realtime rows merged → on every postgres_changes system
// message / error status / 10 s without readiness: catch-up via loadSince.
// Sender B: message #1 right at SUBSCRIBED (the gap before the stream runs),
// then one every 40 s. Stops after a real server re-establishment WHILE
// connected has been observed and 3 more messages were sent — or at a limit.
// Each message is recorded as: written (server created_at), Realtime arrival,
// catch-up arrival, copies in the final list.
//
//   --gap   targeted mode: wait (≤ 15 min, polling the server log) for the
//           server to shut the stream down WHILE connected, write message G1
//           at that moment (inside the re-establishment gap), then G2 after
//           the next readiness signal. 2 messages.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { repo, signIn } from './_local.mjs';

const require = createRequire(import.meta.url);
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(repo, req.slice(2)); return orig.call(this, req, ...a); };
require(path.join(repo, 'node_modules/sucrase/register/ts'));
const { mergeMessages, countNew } = require(path.join(repo, 'lib/chat/merge.ts'));
const { CatchUpRunner, loadLatest, loadSince, newestCreatedAt } = require(path.join(repo, 'lib/chat/sync.ts'));

const GAP = process.argv.includes('--gap');
const MAX_MS = (GAP ? 15 : 30) * 60 * 1000;
const MAX_MSGS = 40;
const EVERY_MS = 40 * 1000;
const PAIR = path.join(repo, '.test-backend', 'realtime-probe-pair.json');
if (!fs.existsSync(PAIR)) { console.error('no probe pair — run: node scripts/local-backend/probe_realtime_local.mjs setup'); process.exit(2); }
const s = JSON.parse(fs.readFileSync(PAIR, 'utf8'));

const t0 = Date.now();
const startIso = new Date(t0).toISOString();
const ts = (d = new Date()) => d.toISOString().slice(11, 23);
const log = (m) => console.log(`${ts()}  ${m}`);
const serverEvents = (sinceIso, untilIso) => {
  const args = ['logs', '--timestamps', '--since', sinceIso, ...(untilIso ? ['--until', untilIso] : []), 'supabase_realtime_tempa-local'];
  // Realtime logs to stdout and stderr: read both.
  const out = execFileSync('sh', ['-c', `docker ${args.map((x) => `'${x}'`).join(' ')} 2>&1`], { encoding: 'utf8' });
  return out.split('\n').filter((l) => /Rebalancing|has been terminated|is initializing|Create replication slot|Starting stream replication/.test(l))
    .map((l) => `${l.slice(11, 23)} ${l.replace(/^.*?\[(info|warning)\] /, '').slice(0, 90)}`);
};
// Tenant state before we connect: the last start vs the last shutdown.
const before = serverEvents(new Date(t0 - 15 * 60 * 1000).toISOString());
const lastStart = before.filter((l) => /initializing|Starting stream/.test(l)).pop();
const lastStop = before.filter((l) => /Rebalancing|terminated/.test(l)).pop();
log(`server before connect: last start [${lastStart ?? 'none in 15 min'}], last shutdown [${lastStop ?? 'none in 15 min'}]`);

const A = await signIn(s.a);
const B = await signIn(s.b);
A.c.realtime.setAuth(A.token);
const run = Date.now().toString(36);
const sent = new Map(); // n → { id, created_at }  (G1 / G2 in --gap mode)
const viaRealtime = new Map(); // id → arrival ms
const viaCatchUp = new Map(); // id → arrival ms
const sysEvents = [];
let list = [];

const first = await loadLatest(A.c, s.aUid, s.bUid);
if (!first.ok) { console.error('initial load failed', first.error); process.exit(1); }
list = mergeMessages(list, first.rows);
log(`initial load: ${first.rows.length} rows`);

const runner = new CatchUpRunner(() => ({ key: 'soak', run: async () => {
  const r = await loadSince(A.c, s.aUid, s.bUid, newestCreatedAt(list));
  if (!r.ok) return log(`catch-up FAILED (${r.error}) — list kept`);
  const before = new Set(list.map((m) => m.id));
  const next = mergeMessages(list, r.rows);
  for (const m of next) if (!before.has(m.id) && !viaRealtime.has(m.id) && !viaCatchUp.has(m.id)) viaCatchUp.set(m.id, Date.now());
  log(`catch-up: ${r.rows.length} rows read, +${countNew(list, next)} new${r.complete ? '' : ' (incomplete)'}`);
  list = next;
} }));

let subscribedOnce;
const subscribed = new Promise((r) => { subscribedOnce = r; });
let readyTimer = null;
A.c.channel(`soak-${run}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
    const m = p.new;
    if (!((m.sender_id === s.aUid && m.receiver_id === s.bUid) || (m.sender_id === s.bUid && m.receiver_id === s.aUid))) return;
    if (!list.some((x) => x.id === m.id) && !viaCatchUp.has(m.id)) viaRealtime.set(m.id, Date.now());
    list = mergeMessages(list, [m]);
  })
  .on('system', {}, (p) => {
    if (p?.extension !== 'postgres_changes') return;
    sysEvents.push({ at: Date.now(), status: p.status });
    log(`system: postgres_changes ${p.status} → catch-up`);
    if (readyTimer) clearTimeout(readyTimer);
    readyTimer = null;
    void runner.trigger();
  })
  .subscribe((st) => {
    log(`status: ${st}`);
    if (st === 'SUBSCRIBED') {
      subscribedOnce();
      if (readyTimer) clearTimeout(readyTimer);
      readyTimer = setTimeout(() => { readyTimer = null; log('no readiness signal within 10 s → catch-up'); void runner.trigger(); }, 10000);
    } else void runner.trigger();
  });

const send = async (n) => {
  const r = await B.c.from('messages').insert({ sender_id: s.bUid, receiver_id: s.aUid, content: `rt-soak ${run} ${GAP ? 'G' : '#'}${n}` }).select('id, created_at').single();
  if (r.error) { log(`send #${n} FAILED ${r.error.message}`); return; }
  sent.set(n, r.data);
  log(`sent #${n} (written ${r.data.created_at.slice(11, 23)})`);
};

await subscribed;
let reestablishedAt = null;
let afterCount = 0;
let n = 1;
let connectedAt = Date.now();
if (GAP) {
  // Wait for the system ok of the join first, then for a shutdown while connected.
  while (!sysEvents.length && Date.now() - t0 < MAX_MS) await new Promise((r) => setTimeout(r, 500));
  connectedAt = Date.now();
  log('connected and ready; waiting for a server shutdown while connected…');
  while (Date.now() - t0 < MAX_MS) {
    await new Promise((r) => setTimeout(r, 1000));
    const ev = serverEvents(new Date(connectedAt).toISOString());
    if (ev.some((l) => /Rebalancing|has been terminated/.test(l))) {
      reestablishedAt = Date.now();
      log(`server shutdown seen: ${ev.filter((l) => /Rebalancing|terminated/.test(l)).join(' | ')}`);
      break;
    }
  }
  if (reestablishedAt) {
    const sysBefore = sysEvents.length;
    await send(1); // G1 — inside the gap, before the re-join is ready
    const waitUntil = Date.now() + 60000;
    while (sysEvents.length === sysBefore && Date.now() < waitUntil) await new Promise((r) => setTimeout(r, 250));
    log(sysEvents.length > sysBefore ? 're-join ready' : 'no readiness signal within 60 s after the shutdown');
    await send(2); // G2 — after the re-join
  }
}
if (!GAP) await send(1); // inside the gap if the tenant was cold
if (!GAP) connectedAt = Date.now();
while (!GAP && Date.now() - t0 < MAX_MS && n < MAX_MSGS) {
  await new Promise((r) => setTimeout(r, EVERY_MS));
  const ev = serverEvents(new Date(connectedAt + 1000).toISOString());
  if (!reestablishedAt && ev.some((l) => /Rebalancing|has been terminated/.test(l))) {
    reestablishedAt = Date.now();
    log(`server re-establishment observed while connected: ${ev.filter((l) => /Rebalancing|terminated/.test(l)).join(' | ')}`);
  }
  n += 1;
  await send(n);
  if (reestablishedAt && sysEvents.some((e) => e.at > reestablishedAt - EVERY_MS)) afterCount += 1;
  if (afterCount >= 3) break;
}
await new Promise((r) => setTimeout(r, 12000)); // late deliveries
if (readyTimer) clearTimeout(readyTimer);

// ---- report ----
const rows = [...sent.entries()].map(([k, v]) => {
  const copies = list.filter((m) => m.id === v.id).length;
  const how = viaRealtime.has(v.id) ? 'realtime' : viaCatchUp.has(v.id) ? 'catch-up' : 'MISSING';
  return { k, id: v.id, written: v.created_at.slice(11, 23), how, copies };
});
for (const r of rows) console.log(`  #${String(r.k).padStart(2)} written ${r.written}  → ${r.how.padEnd(8)}  copies in list: ${r.copies}`);
const missing = rows.filter((r) => r.copies === 0).length;
const dupes = rows.filter((r) => r.copies > 1).length;
const sorted = list.every((m, i) => i === 0 || Date.parse(list[i - 1].created_at) <= Date.parse(m.created_at));
console.log('server events during the run:');
for (const l of serverEvents(startIso)) console.log(`  ${l}`);
// Cold first join = the server (re)created the stream within 5 s of our join.
const gapObserved = !GAP && serverEvents(startIso, new Date(connectedAt + 5000).toISOString()).some((l) => /initializing|Create replication slot/.test(l));
log(`summary: sent ${rows.length}, realtime ${rows.filter((r) => r.how === 'realtime').length}, catch-up ${rows.filter((r) => r.how === 'catch-up').length}, missing ${missing}, duplicates ${dupes}, list sorted ${sorted}`);
log(`conditions: ${GAP ? 'message written inside the re-establishment gap' : `cold first join ${gapObserved ? 'OBSERVED' : 'not observed'}`}; re-establishment while connected ${reestablishedAt ? 'OBSERVED' : 'NOT OBSERVED within the limits — this condition was not tested'}`);
process.exit(missing || dupes || !sorted ? 1 : 0);
