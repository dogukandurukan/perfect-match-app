// V2 chat — Realtime catch-up (2026-10-20). Pure merge + static wiring. The
// timing evidence is in docs/tempa/work-packages/V2_REALTIME_RESULT.md.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/chat/merge.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

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
ok(M.mergeMessages([m('x', 'T1', { read_at: null })], [m('x', 'T1', { read_at: 'T2' })])[0].read_at === 'T2', 'a known row is updated in place (e.g. read_at)');
const tie = M.mergeMessages([m('z', 'T')], [m('y', 'T')]);
ok(eq(tie.map((x) => x.id), ['y', 'z']), 'same timestamp → stable order by id');

const chat = code('app/chat.tsx');
ok(/\.on\('system', \{\}, \(payload[^)]*\) => \{\s*if \(payload\?\.extension === 'postgres_changes' && payload\?\.status === 'ok'\) void catchUpMessages\(\);/.test(chat), 'every "postgres_changes ok" (first join and re-joins) triggers a catch-up');
ok(/AppState\.addEventListener\('change', \(st\) => \{\s*if \(st === 'active'\) void catchUpMessages\(\);/.test(chat) && /appSub\.remove\(\);/.test(chat), 'back to the foreground → catch-up (listener removed on unmount)');
ok(/if \(st\.running\) \{\s*st\.again = true;\s*return;\s*\}/.test(chat), 'catch-ups never overlap (one more run if triggered meanwhile)');
ok(/setMessages\(\(prev\) => mergeMessages\(prev, rows\)\)/.test(chat) && !/setMessages\(data as Message\[\]\)/.test(chat), 'fetch merges, never replaces');
ok(/if \(mode === 'initial' \|\| added > 0\) setTimeout\(\(\) => scrollToEndIfFollowing\(mode === 'catchup'\), 100\)/.test(chat), 'catch-up scrolls only for new rows and only if the reader is at the end');
ok(/if \(mode === 'initial'\) setMessagesError\(true\);/.test(chat), 'a failed catch-up keeps the visible chat (no error screen)');
ok(/if \(prev\.some\(\(m\) => m\.id === msg\.id\)\) return prev;/.test(chat), 'realtime handler still de-duplicates by id');
for (const f of ['scripts/local-backend/smoke_activity_local.mjs', 'scripts/local-backend/smoke_matches_local.mjs']) {
  const s = read(f);
  ok(/ch\.on\('system', \{\}, \(p\) => \{ if \(p\?\.extension === 'postgres_changes' && p\?\.status === 'ok'\) subscribed\(true\); \}\);/.test(s) && !/if \(s === 'SUBSCRIBED'\) subscribed\(true\)/.test(s), `${path.basename(f)}: waits for the real readiness signal, not SUBSCRIBED`);
}

module.exports = done('v2_chat_realtime');
