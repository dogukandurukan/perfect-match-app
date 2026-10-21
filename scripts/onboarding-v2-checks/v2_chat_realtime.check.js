// V2 chat — message sync / Realtime catch-up. Pure merge + sync logic with an
// in-memory query client, and static wiring. Timing evidence and real-service
// runs: docs/tempa/work-packages/V2_REALTIME_RESULT.md.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/chat/merge.ts'));
const S = require(path.join(ROOT, 'lib/chat/sync.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

module.exports = (async () => {
  // ---- merge ----
  const m = (id, at, extra = {}) => ({ id, created_at: at, content: id, ...extra });
  const a = m('a', '2026-10-20T10:00:00.000Z');
  const b = m('b', '2026-10-20T10:01:00.000Z');
  const c = m('c', '2026-10-20T10:02:00.000Z');
  const prev = [a, c];
  ok(M.mergeMessages(prev, []) === prev && M.mergeMessages(prev, null) === prev, 'nothing incoming → same array (no re-render)');
  ok(M.mergeMessages(prev, [a, c]) === prev, 'only known rows → same array (no re-render, no scroll)');
  const merged = M.mergeMessages(prev, [b, c]);
  ok(eq(merged.map((x) => x.id), ['a', 'b', 'c']), 'missed message inserted in time order');
  ok(eq(M.mergeMessages(merged, [b]).map((x) => x.id), ['a', 'b', 'c']), 'no duplicate when realtime and catch-up both bring it');
  ok(M.countNew(prev, merged) === 1 && M.countNew(prev, prev) === 0, 'countNew: only genuinely new rows');
  ok(M.mergeMessages([m('x', 'T1', { read_at: null })], [m('x', 'T1', { read_at: 'T2' })])[0].read_at === 'T2', 'a known row gains a later value (read_at)');
  const keep = [m('x', 'T1', { read_at: 'T2' })];
  ok(M.mergeMessages(keep, [m('x', 'T1', { read_at: null })]) === keep, 'a stale response never blanks a newer value');
  const mixed = M.mergeMessages([m('late', '2026-10-20T13:08:31.100000+00:00')], [m('early', '2026-10-20T13:08:30.925509')]);
  ok(eq(mixed.map((x) => x.id), ['early', 'late']), 'Realtime vs REST timestamp formats sort by time');
  ok(eq(M.mergeMessages([m('z', '2026-10-20T10:00:00.000001Z')], [m('y', '2026-10-20T10:00:00.000001Z')]).map((x) => x.id), ['y', 'z']), 'same timestamp → stable order by id');
  ok(eq(M.mergeMessages([], [m('p', '2026-10-20T10:00:00Z', { kind: 'photo', media_path: 'x/y/z.jpg' }), m('t', '2026-10-20T09:00:00Z', { kind: 'text' })]).map((x) => x.id), ['t', 'p']), 'text and photo rows share the same merge');

  // ---- sync with an in-memory PostgREST-like client (max_rows cap) ----
  const ME = 'me', OT = 'ot';
  const MAX_ROWS = 1000;
  const rowsDb = [];
  const base = Date.parse('2026-10-20T10:00:00Z');
  for (let i = 0; i < 1300; i++) rowsDb.push({ id: `m${String(i).padStart(4, '0')}`, created_at: new Date(base + i * 1000).toISOString(), sender_id: i % 2 ? ME : OT, receiver_id: i % 2 ? OT : ME });
  rowsDb.push({ id: 'other-chat', created_at: new Date(base + 5e6).toISOString(), sender_id: 'x', receiver_id: ME });
  const calls = [];
  const client = {
    from: () => {
      const q = { orders: [], gte: null, lim: null, pair: false };
      const api = {
        select: () => api, or: () => { q.pair = true; return api; },
        order: (col, o) => { q.orders.push([col, o.ascending]); return api; },
        gte: (col, v) => { q.gte = v; return api; },
        limit: (n) => { q.lim = n; return api; },
        then: (res, rej) => {
          calls.push({ ...q });
          let r = rowsDb.filter((x) => (x.sender_id === ME && x.receiver_id === OT) || (x.sender_id === OT && x.receiver_id === ME));
          if (q.gte) r = r.filter((x) => Date.parse(x.created_at) >= Date.parse(q.gte));
          const [col, asc] = q.orders[0];
          r = r.slice().sort((x, y) => (asc ? 1 : -1) * (Date.parse(x[col]) - Date.parse(y[col])));
          r = r.slice(0, Math.min(q.lim ?? Infinity, MAX_ROWS));
          return Promise.resolve({ data: r, error: null }).then(res, rej);
        },
      };
      return api;
    },
  };
  const latest = await S.loadLatest(client, ME, OT, 500);
  ok(latest.ok && latest.rows.length === 500 && latest.rows[499].id === 'm1299' && latest.rows[0].id === 'm0800' && !latest.complete, 'initial load = the NEWEST 500, oldest-first for display');
  const oldWay = rowsDb.filter((x) => x.id !== 'other-chat').slice(0, MAX_ROWS);
  ok(oldWay[oldWay.length - 1].id === 'm0999', '(old behaviour: all-oldest-first is capped at max_rows and misses m1000…m1299)');
  calls.length = 0;
  const since = await S.loadSince(client, ME, OT, rowsDb[1199].created_at, 50, 10);
  ok(since.ok && since.complete && since.rows.some((x) => x.id === 'm1299') && since.rows[0].id === 'm1079', 'catch-up from the newest known message (2 min overlap, inclusive), paged until the end');
  ok(calls.length === 5 && calls.every((c) => c.lim === 50 && c.gte), 'catch-up pages are bounded (limit per page, gte cursor; each page re-reads its first row, merge drops it)');
  const capped = await S.loadSince(client, ME, OT, rowsDb[0].created_at, 50, 3);
  ok(capped.ok && !capped.complete && capped.rows.length === 150, 'too much missed → stops after maxPages and reports incomplete (no endless loop)');
  ok((await S.loadSince(client, ME, OT, null)).rows.length === 500, 'nothing on screen yet → newest page');
  ok(!(await S.loadSince(client, ME, OT, rowsDb[1250].created_at)).rows.some((x) => x.id === 'other-chat'), 'only this pair’s messages');
  const same = { from: () => { const api = { select: () => api, or: () => api, order: () => api, gte: () => api, limit: () => api, then: (r) => Promise.resolve({ data: [1, 2].map((i) => ({ id: `s${i}`, created_at: '2026-10-20T10:00:00Z' })), error: null }).then(r) }; return api; } };
  const st = await S.loadSince(same, ME, OT, '2026-10-20T10:02:00Z', 2, 10);
  ok(st.ok && !st.complete && st.rows.length === 2, 'a full page with one timestamp cannot advance → stops (no loop)');
  const bad = { from: () => { const api = { select: () => api, or: () => api, order: () => api, gte: () => api, limit: () => api, then: (r) => Promise.resolve({ data: null, error: { message: 'boom' } }).then(r) }; return api; } };
  ok((await S.loadSince(bad, ME, OT, '2026-10-20T10:02:00Z')).ok === false, 'a failed request is reported (caller keeps the list)');
  ok(S.newestCreatedAt([{ created_at: '2026-10-20T10:00:00Z' }, { created_at: '2026-10-20T11:00:00.5+00:00' }]) === '2026-10-20T11:00:00.5+00:00' && S.newestCreatedAt([]) === null, 'newest by time, any format');

  // ---- CatchUpRunner ----
  let key = 'chatA';
  const runs = [];
  let release;
  const runner = new S.CatchUpRunner(() => ({ key, run: async (k) => { runs.push(k); if (runs.length === 1) await new Promise((r) => { release = r; }); } }));
  const p1 = runner.trigger();
  runner.trigger(); runner.trigger();
  key = 'chatB';
  release();
  await p1;
  ok(eq(runs, ['chatA', 'chatB']), 'overlapping triggers → exactly one more run, for the CURRENT chat');
  await runner.trigger();
  ok(runs.length === 3, 'runner usable again after finishing');
  const errRunner = new S.CatchUpRunner(() => ({ key: 'k', run: async () => { throw new Error('x'); } }));
  await errRunner.trigger().catch(() => {});
  let ran = false;
  await new S.CatchUpRunner(() => ({ key: 'k', run: async () => { ran = true; } })).trigger();
  ok(ran && (await errRunner.trigger().then(() => 'ok', () => 'rejected')) === 'rejected', 'a failing run releases the lock (next trigger runs again)');

  // ---- wiring ----
  const chat = code('app/chat.tsx');
  ok(/\.on\('system', \{\}, \(payload[^)]*\) => \{\s*if \(!live \|\| payload\?\.extension !== 'postgres_changes'\) return;[\s\S]{0,200}void catchUpMessages\(\);/.test(chat), 'every postgres_changes system message (ok or error, first join and re-joins) → catch-up');
  ok(/readyTimer = setTimeout\(\(\) => \{\s*readyTimer = null;\s*if \(live\) void catchUpMessages\(\);\s*\}, 10000\);/.test(chat), 'readiness signal missing → one catch-up after 10 s (no polling)');
  ok(/if \(__DEV__\) console\.warn\('\[Chat\] realtime status', status\);\s*void catchUpMessages\(\);/.test(chat), 'CHANNEL_ERROR / TIMED_OUT / CLOSED → one catch-up');
  ok(/return \(\) => \{\s*live = false;\s*if \(readyTimer\) clearTimeout\(readyTimer\);\s*appSub\.remove\(\);\s*void supabase\.removeChannel\(channel\);/.test(chat), 'cleanup: events ignored, timer cleared, AppState listener and channel removed');
  ok(/if \(live && st === 'active'\) void catchUpMessages\(\);/.test(chat), 'back to the foreground → catch-up');
  ok(/if \(chatKeyRef\.current !== key\) return; \/\/ chat changed/.test(read('app/chat.tsx')) && /setMessages\(\[\]\);\s*userScrolledRef\.current = false;\s*pinToEndRef\.current = true;\s*nearEndRef\.current = true;[\s\S]{0,200}olderPagerRef\.current\?\.reset\([^;]*\);\s*\}, \[currentUserId, otherUserId\]\);/.test(chat), 'a late response never lands in another chat; the list resets on a chat change');
  ok(/mode === 'catchup'\s*\? await loadSince<Message>/.test(chat) && /: await loadLatest<Message>/.test(chat) && !/\.order\('created_at', \{ ascending: true \}\);/.test(chat), 'initial = newest page, catch-up = since newest (no unlimited oldest-first read)');
  ok(/setMessages\(\(prev\) => mergeMessages\(prev, \[msg\]\)\)/.test(chat) && /setMessages\(\(prev\) => mergeMessages\(prev, rows\)\)/.test(chat), 'realtime rows and fetched rows go through the same merge');
  ok(/if \(mode === 'catchup' && added > 0\) setTimeout\(\(\) => scrollToEndIfFollowing\(!pinToEndRef\.current\), 100\)/.test(chat), 'catch-up scrolls only for new rows and only if the reader is at the end');
  ok(/if \(mode === 'initial'\) \{\s*setMessagesError\(true\);/.test(chat), 'a failed catch-up keeps the visible chat (no error screen)');
  for (const f of ['scripts/local-backend/smoke_activity_local.mjs', 'scripts/local-backend/smoke_matches_local.mjs']) {
    const s = read(f);
    ok(/ch\.on\('system', \{\}, \(p\) => \{ if \(p\?\.extension === 'postgres_changes' && p\?\.status === 'ok'\) subscribed\(true\); \}\);/.test(s), `${path.basename(f)}: waits for the real readiness signal, not SUBSCRIBED`);
  }
  return done('v2_chat_realtime');
})();
