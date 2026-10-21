// Older chat history on the LOCAL Supabase (real Postgres + Auth + PostgREST,
// real JWTs and RLS), with the APP's own code (lib/chat/sync.ts + merge.ts):
//   node scripts/local-backend/smoke_chat_history_local.mjs
// Creates a FRESH synthetic pair (tempa-local-hist-<tag>-a/b); never the phone
// accounts. The pair is kept for the phone check and written to
// .test-backend/history-pair.json (git-ignored).
//
// 1250 history messages (both senders, explicit past timestamps; 12 of them
// share one timestamp across an older-page boundary) → first page (500) →
// older pages of 100 until the start, with: a new message + catch-up during a
// page load, one failed page + retry, a chat switch while a page is in flight,
// and no query after the end. Finally the loaded ids are compared with the
// server's, in order.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { admin, ensureMember, LOOKS, repo } from './_local.mjs';

const require = createRequire(import.meta.url);
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(repo, req.slice(2)); return orig.call(this, req, ...a); };
require(path.join(repo, 'node_modules/sucrase/register/ts'));
const { mergeMessages } = require(path.join(repo, 'lib/chat/merge.ts'));
const { loadBefore, loadLatest, loadSince, newestCreatedAt, oldestCursor, OlderPager } = require(path.join(repo, 'lib/chat/sync.ts'));

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const HISTORY = 1250;
const TIE_AT = HISTORY - 600; // newest-index ≈ 600 = first page (500) + one older page (100)

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-hist-${tag}-${k}@tempa-test.example.com`;
  const A = await ensureMember({ email: mail('a'), first: 'Hista', gender: 'woman', interested: ['men'], dob: '1993-05-13', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[1] });
  const B = await ensureMember({ email: mail('b'), first: 'Histb', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const prof = (await A.c.rpc('get_profile_v2', { p_user: B.uid })).data;
  await A.c.rpc('send_like_v2', { p_likee: B.uid, p_target_type: 'photo', p_target_id: prof.photos[0].id, p_note: 'Synthetic history test', p_request_id: crypto.randomUUID() });
  const likeId = (await admin.from('likes').select('id').eq('liker_id', A.uid).eq('likee_id', B.uid).single()).data.id;
  const acc = (await B.c.rpc('accept_like_v2', { p_like: likeId })).data;
  check(acc?.ok && !!acc.match_id, 'setup: synthetic pair matched through the normal path');
  fs.mkdirSync(path.join(repo, '.test-backend'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(repo, '.test-backend', 'history-pair.json'), JSON.stringify({ a: mail('a'), b: mail('b'), aUid: A.uid, bUid: B.uid, match: acc.match_id }), { mode: 0o600 });

  // Count A's message queries (to prove "no query after the end").
  let queries = 0;
  const counted = { from: (t) => { if (t === 'messages') queries += 1; return A.c.from(t); } };

  // Short / empty chat: the first page is complete → nothing older to load.
  const empty = await loadLatest(counted, A.uid, B.uid);
  const shortPager = new OlderPager();
  shortPager.reset('short', !empty.complete);
  const q0 = queries;
  await shortPager.load('short', () => loadBefore(counted, A.uid, B.uid, { created_at: new Date().toISOString(), id: crypto.randomUUID() }), () => {});
  check(empty.ok && empty.complete && queries === q0, 'empty / short chat: first page complete, no older query');

  // History: 1250 messages in the past, 1 s apart; 12 share one timestamp.
  const t0 = Date.parse('2026-09-01T08:00:00Z');
  const rowsA = [];
  const rowsB = [];
  for (let i = 0; i < HISTORY; i++) {
    const inTie = i >= TIE_AT - 6 && i < TIE_AT + 6;
    const at = new Date(inTie ? t0 + (TIE_AT - 6) * 1000 + 500 : t0 + i * 1000).toISOString();
    const fromA = i % 3 === 0;
    (fromA ? rowsA : rowsB).push({ sender_id: fromA ? A.uid : B.uid, receiver_id: fromA ? B.uid : A.uid, content: `hist ${tag} #${i}${inTie ? ' (tie)' : ''}`, created_at: at });
  }
  // Clients may write only content / sender / receiver (created_at is not
  // client-writable — a P0 rule, kept). Past timestamps for the history are
  // therefore written with the service role, test setup only. Reads below
  // use A's own session (RLS applies); the new messages use B's session.
  const direct = await B.c.from('messages').insert({ ...rowsB[0], created_at: rowsB[0].created_at });
  check(!!direct.error, 'a client cannot choose created_at (column privilege kept)');
  for (const rows of [rowsA, rowsB]) {
    for (let i = 0; i < rows.length; i += 250) {
      const r = await admin.from('messages').insert(rows.slice(i, i + 250));
      if (r.error) throw new Error(`insert: ${r.error.message}`);
    }
  }
  check(true, `inserted ${HISTORY} history messages (test setup, service role; 12 share one timestamp)`);

  // App: first page.
  let list = [];
  const first = await loadLatest(counted, A.uid, B.uid);
  list = mergeMessages(list, first.rows);
  const pager = new OlderPager();
  pager.reset('hist', !first.complete);
  check(first.ok && first.rows.length === 500 && pager.state.hasMore, 'first page = newest 500; more history exists');
  const fetchOlder = () => loadBefore(counted, A.uid, B.uid, oldestCursor(list));
  const apply = (rows) => { list = mergeMessages(list, rows); };

  // Page 1 + simultaneously: B sends 3 new messages, A catches up.
  let live = [];
  await Promise.all([
    pager.load('hist', fetchOlder, apply),
    (async () => {
      for (let k = 0; k < 3; k++) {
        const r = await B.c.from('messages').insert({ sender_id: B.uid, receiver_id: A.uid, content: `live ${tag} #${k}` }).select('id').single();
        live.push(r.data.id);
      }
      const cu = await loadSince(counted, A.uid, B.uid, newestCreatedAt(list));
      if (cu.ok) list = mergeMessages(list, cu.rows);
    })(),
  ]);
  check(list.length === 603 && live.every((id) => list.some((m) => m.id === id)), 'older page + new messages + catch-up at the same time: all merged (600 + 3)');

  // A failed page keeps the list; retry works.
  const lenBefore = list.length;
  await pager.load('hist', async () => ({ ok: false, error: 'injected network error' }), apply);
  check(pager.state.error && pager.state.hasMore && list.length === lenBefore, 'failed page: error state, history kept, retry possible');
  await pager.load('hist', fetchOlder, apply);
  check(!pager.state.error && list.length === lenBefore + 100, 'retry loads the next page');

  // Chat switch while a page is in flight: its rows are dropped.
  const switchPager = new OlderPager();
  switchPager.reset('hist', true);
  let appliedOld = false;
  const inFlight = switchPager.load('hist', fetchOlder, () => { appliedOld = true; });
  switchPager.reset('another-chat', true);
  await inFlight;
  check(!appliedOld, 'chat switched while a page was loading → its rows never reach the new chat');

  // To the start; then no more queries.
  let pages = 2;
  while (pager.state.hasMore) {
    await pager.load('hist', fetchOlder, apply);
    pages += 1;
    if (pages > 30) break;
  }
  const qEnd = queries;
  await pager.load('hist', fetchOlder, apply);
  check(!pager.state.hasMore && queries === qEnd, `start of the conversation reached after ${pages} older pages; no further query`);

  // Compare with the server, in order.
  const server = [];
  for (let from = 0; ; from += 1000) {
    const r = await admin.from('messages').select('id').or(`and(sender_id.eq.${A.uid},receiver_id.eq.${B.uid}),and(sender_id.eq.${B.uid},receiver_id.eq.${A.uid})`).order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
    server.push(...(r.data ?? []).map((x) => x.id));
    if ((r.data ?? []).length < 1000) break;
  }
  const ids = list.map((m) => m.id);
  const missing = server.filter((id) => !ids.includes(id));
  const dupes = ids.length - new Set(ids).size;
  check(server.length === HISTORY + 3 && missing.length === 0 && dupes === 0, `loaded ${ids.length} / server ${server.length}: missing ${missing.length}, duplicates ${dupes}`);
  check(ids.join() === server.join(), 'same order as the server (created_at, id) — incl. the 12-message timestamp tie');

  console.log(`smoke_chat_history_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  console.log(`phone pair: ${mail('a')} (A, receiver) ↔ ${mail('b')}; ${server.length} messages`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
