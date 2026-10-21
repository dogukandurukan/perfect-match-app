// V2 chat — older history (keyset pages before the oldest message on screen).
// Pure logic with an in-memory PostgREST-like client + static wiring. Real
// local services: scripts/local-backend/smoke_chat_history_local.mjs. The
// on-screen scroll behaviour needs the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const S = require(path.join(ROOT, 'lib/chat/sync.ts'));
const M = require(path.join(ROOT, 'lib/chat/merge.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

module.exports = (async () => {
  const ME = 'me', OT = 'ot';
  const db = [];
  const base = Date.parse('2026-10-01T10:00:00Z');
  const iso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');
  for (let i = 0; i < 330; i++) db.push({ id: `m${String(i).padStart(4, '0')}`, created_at: iso(base + i * 1000), sender_id: i % 2 ? ME : OT, receiver_id: i % 2 ? OT : ME });
  // 12 rows sharing ONE timestamp around the first page boundary (newest 100 → index 230).
  const tie = iso(base + 225 * 1000 + 500);
  for (let j = 0; j < 12; j++) db.push({ id: `t${String(j).padStart(2, '0')}`, created_at: tie, sender_id: ME, receiver_id: OT });
  const key = (r) => [Date.parse(r.created_at), r.id];
  const cmp = (a, b) => { const [x, y] = key(a); const [u, v] = key(b); return x !== u ? x - u : y < v ? -1 : y > v ? 1 : 0; };
  const ordered = db.slice().sort(cmp);
  let calls = 0;
  let failNext = false;
  const client = {
    from: () => {
      const q = { cur: null, desc: true, lim: null };
      const api = {
        select: () => api,
        or: (f) => { const m = /^created_at\.lt\."(.+?)",and\(created_at\.eq\."(.+?)",id\.lt\.(.+)\)$/.exec(f); if (m) q.cur = { created_at: m[1], id: m[3] }; return api; },
        order: (c, o) => { if (c === 'created_at') q.desc = !o.ascending; return api; },
        gte: () => api,
        limit: (n) => { q.lim = n; return api; },
        then: (res, rej) => {
          calls += 1;
          if (failNext) { failNext = false; return Promise.resolve({ data: null, error: { message: 'network' } }).then(res, rej); }
          let r = ordered.slice();
          if (q.cur) r = r.filter((x) => cmp(x, q.cur) < 0);
          if (q.desc) r.reverse();
          return Promise.resolve({ data: r.slice(0, Math.min(q.lim ?? 1000, 1000)), error: null }).then(res, rej);
        },
      };
      return api;
    },
  };

  const first = await S.loadLatest(client, ME, OT, 100);
  let list = M.mergeMessages([], first.rows);
  ok(first.ok && list.length === 100 && !first.complete, 'first page = newest 100, history continues');
  const states = [];
  const pager = new S.OlderPager((s) => states.push({ ...s }));
  pager.reset('chat1', !first.complete);
  const fetchOlder = () => S.loadBefore(client, ME, OT, S.oldestCursor(list), 100);
  const apply = (rows) => { list = M.mergeMessages(list, rows); };

  // Two triggers at once → one request.
  const before = calls;
  await Promise.all([pager.load('chat1', fetchOlder, apply), pager.load('chat1', fetchOlder, apply)]);
  ok(calls - before === 1 && list.length === 200, 'parallel triggers → one request; one page added');
  ok(new Set(list.map((m) => m.id)).size === list.length && list.filter((m) => m.created_at === tie).length >= 1, 'no duplicate ids across the boundary');

  // Failure keeps the list; retry works.
  failNext = true;
  const lenBefore = list.length;
  await pager.load('chat1', fetchOlder, apply);
  ok(pager.state.error === 'network' && pager.state.hasMore && list.length === lenBefore, 'failed page: error shown, history kept, still more to load');
  await pager.load('chat1', fetchOlder, apply);
  ok(pager.state.error === null && list.length === lenBefore + 100, 'retry loads the page');

  // Load to the end, then no more requests.
  while (pager.state.hasMore) await pager.load('chat1', fetchOlder, apply);
  const after = calls;
  await pager.load('chat1', fetchOlder, apply);
  ok(calls === after, 'history complete → no further query');
  ok(eq(list.map((m) => m.id), ordered.map((m) => m.id)), `all ${ordered.length} messages, server order, none missing or repeated (12-row timestamp tie split by id)`);
  ok(states.some((s) => s.loading) && states.every((s, i) => i === 0 || !(s.loading && states[i - 1].loading)), 'loading state toggles per request');

  // Chat change while a page is in flight → result dropped.
  const p2 = new S.OlderPager();
  p2.reset('A', true);
  let release; let applied = false;
  const slow = () => new Promise((r) => { release = () => r({ ok: true, rows: [{ id: 'x', created_at: tie }], complete: false }); });
  const run = p2.load('A', slow, () => { applied = true; });
  p2.reset('B', true);
  release();
  await run;
  ok(!applied && p2.state.loading === false && p2.state.hasMore === true, 'chat changed while loading → old page dropped, new chat can load');
  ok((await (async () => { const p3 = new S.OlderPager(); p3.reset('k', false); let n = 0; await p3.load('k', async () => { n += 1; return { ok: true, rows: [], complete: true }; }, () => {}); return n; })()) === 0, 'short chat (no more history) → never queries');

  ok(eq(S.oldestCursor([{ id: 'b', created_at: tie }, { id: 'a', created_at: tie }, { id: 'z', created_at: iso(base + 999e3) }]), { created_at: tie, id: 'a' }) && S.oldestCursor([]) === null, 'cursor = oldest (created_at, id)');

  const chat = code('app/chat.tsx');
  ok(/maintainVisibleContentPosition=\{\{ minIndexForVisible: 1 \}\}/.test(chat), 'rows added above keep the visible message in place');
  ok(/if \(userScrolledRef\.current && e\.nativeEvent\.contentOffset\.y < 400\) loadOlderMessages\(\);/.test(chat) && /onScrollBeginDrag=\{\(\) => \{\s*userScrolledRef\.current = true;/.test(chat), 'older pages only after the reader scrolls near the top (no chain on open)');
  ok(/if \(mode === 'initial'\) olderPagerRef\.current\?\.reset\(key, !r\.complete\);/.test(chat), 'older history exists only when the first page was full');
  ok(/\(rows\) => setMessages\(\(prev\) => mergeMessages\(prev, rows\)\)/.test(chat), 'older pages use the same merge (with realtime / catch-up)');
  ok(/older\.hasMore \|\| older\.loading \|\| older\.error \? \(\s*<OlderHistoryHeader state=\{older\} onLoad=\{loadOlderMessages\} \/>\s*\) : v2Enabled \? \(\s*<HowItStartedCard/.test(chat), 'How it started once, at the real start (after the last page); never per page');
  ok(/olderPagerRef\.current\?\.reset\(currentUserId && otherUserId \? `\$\{currentUserId\}:\$\{otherUserId\}` : '', false\);/.test(chat), 'chat change resets paging (late pages dropped)');
  // Opening position (2026-10-21): pin to the newest until the reader acts.
  ok(/onContentSizeChange=\{\(\) => \{\s*if \(pinToEndRef\.current\) \{\s*nearEndRef\.current = true;\s*flatListRef\.current\?\.scrollToEnd\(\{ animated: false \}\);\s*return;\s*\}\s*scrollToEndIfFollowing\(\);/.test(chat), 'opening: every content-size change goes to the newest message while pinned (no timer)');
  ok(/if \(!pinToEndRef\.current\) nearEndRef\.current = isNearEnd\(e\.nativeEvent\);/.test(chat), 'opening: layout / position-keeping scroll events cannot unpin');
  ok(/userScrolledRef\.current = true;\s*pinToEndRef\.current = false;/.test(chat) && /function loadOlderMessages\(\) \{\s*if \(!currentUserId \|\| !otherUserId\) return;\s*pinToEndRef\.current = false;/.test(chat), 'first drag or "Earlier messages" ends pinning (late layout never pulls a reader down)');
  ok(/pinToEndRef\.current = true;\s*nearEndRef\.current = true;\s*olderPagerRef\.current\?\.reset/.test(chat), 'pinning restarts for each chat');
  ok(!/mode === 'initial' \|\| added > 0/.test(chat), 'no timed scroll after the first load');
  const sync = code('lib/chat/sync.ts');
  ok(/\.or\(`created_at\.lt\."\$\{c\}",and\(created_at\.eq\."\$\{c\}",id\.lt\.\$\{cursor\.id\}\)`\)/.test(sync) && !/\.range\(|offset/.test(sync.split('// ---- Older history')[1]), 'keyset (created_at, id), no offset');
  return done('v2_chat_history');
})();
