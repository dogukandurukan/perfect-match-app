// V2 Activity tab badge: unseen pending likes. Pure count rule + badge store
// (account / stale-response rules) + wiring. Real local services:
// scripts/local-backend/smoke_activity_badge_local.mjs.
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const F = require(path.join(ROOT, 'lib/activity/feed.ts'));
const B = require(path.join(ROOT, 'lib/activity/badgeStore.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

module.exports = (async () => {
  const p = (user_id, seen) => ({ like_id: `l-${user_id}`, user_id, seen });
  ok(F.unseenLikeCount({ premium: true, pending: [p('a', false), p('b', true), p('c', false)], matches: [] }) === 2, 'counts pending likes not yet opened');
  ok(F.unseenLikeCount({ premium: true, pending: [p('a', false)], matches: [{ other_id: 'a' }] }) === 0, 'a matched person is not pending');
  ok(F.unseenLikeCount({ premium: false, pending: [], matches: [] }) === 0, 'without premium identities are hidden (none can be opened) → 0');
  ok(F.unseenLikeCount({ premium: true, pending: [], matches: [] }) === 0, 'nothing pending → 0 (no badge)');

  // Store rules.
  let uid = 'u1';
  const queue = [];
  const store = new B.ActivityBadgeStore({ currentUserId: async () => uid, loadCount: () => new Promise((r) => queue.push(r)) });
  const seen = [];
  store.subscribe((n) => seen.push(n));
  const r1 = store.refresh();
  await new Promise((r) => setImmediate(r));
  queue.shift()({ ok: true, count: 3 });
  await r1;
  ok(store.value === 3, 'refresh → server count');
  const older = store.refresh();
  await new Promise((r) => setImmediate(r));
  const newer = store.refresh();
  await new Promise((r) => setImmediate(r));
  queue.pop()({ ok: true, count: 1 }); // newer answers first
  await newer;
  queue.pop()({ ok: true, count: 5 }); // older answers late
  await older;
  ok(store.value === 1, 'an older response finishing late never overwrites a newer one');
  const fail = store.refresh();
  await new Promise((r) => setImmediate(r));
  queue.pop()({ ok: false });
  await fail;
  ok(store.value === 1, 'a failed refresh keeps the same account’s last count');
  const mid = store.refresh();
  await new Promise((r) => setImmediate(r));
  uid = 'u2';
  store.accountChanged('u2');
  ok(store.value === 0, 'account change clears the previous account’s count at once');
  queue.pop()({ ok: true, count: 9 });
  await mid;
  ok(store.value === 0, 'a response for the previous account is dropped');
  uid = null;
  await store.refresh();
  ok(store.value === 0, 'signed out → 0');
  uid = 'u3';
  await store.publish(2);
  ok(store.value === 2 && seen.filter((n, i) => i > 0 && n === seen[i - 1]).length === 0, 'publish from a loaded snapshot; listeners only on change');

  // Wiring.
  const icon = code('components/ui/TabBarBadgedIcon.tsx');
  ok(/\{v2Enabled \? <MessageCountBadge count=\{unseenLikes\} \/> : <NotificationDot visible=\{showNotificationDot\} \/>\}/.test(icon) && /if \(count <= 0\) return null;/.test(icon), 'V2: number badge, hidden at 0; V1: its old dot');
  const screen = code('components/activity/V2ActivityScreen.tsx');
  ok(/if \(r\.kind === 'ok'\) publishActivityBadge\(r\.value\);/.test(screen) && !/markLikeSeen/.test(screen), 'opening the Activity list publishes the count and marks nothing seen');
  const prof = code('app/v2/activity-profile.tsx');
  ok(/void markLikeSeen\(i\.like_id\)\.then\(\(ok\) => \{\s*if \(ok\) void activityBadge\.refresh\(\);/.test(prof), 'profile opened → seen on the server → badge refreshed');
  ok(/if \(r\.kind === 'ok'\) \{\s*void activityBadge\.refresh\(\);/.test(prof), 'Match & chat → badge refreshed (no longer pending)');
  const hook = code('hooks/useActivityBadge.ts');
  ok(/if \(st === 'active'\) void activityBadge\.refresh\(\);/.test(hook) && /activityBadge\.accountChanged\(session\?\.user\?\.id \?\? null\);/.test(hook) && /auth\.subscription\.unsubscribe\(\);/.test(hook), 'foreground → refresh; auth change → previous count cleared, then refresh; listeners removed');
  const layout = code('app/(tabs)/_layout.tsx');
  ok(/screenListeners=\{\(\{ route \}\) => \(\{\s*focus: \(\) => \{\s*if \(v2Enabled && route\.name !== 'notifications'\) void activityBadge\.refresh\(\);/.test(layout), 'tab focus refreshes (Activity publishes itself)');
  ok(!/setInterval/.test(hook + read('lib/activity/badge.ts') + read('lib/activity/badgeStore.ts')), 'no polling');
  return done('v2_activity_badge');
})();
