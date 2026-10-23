// Profile visits (2026-10-22, D103). Pure copy / parsing + static wiring + SQL
// shape. Real local services: scripts/local-backend/smoke_profile_visits_local.mjs.
// The screens and the notice need the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const V = require(path.join(ROOT, 'lib/visits/visitsCore.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

ok(V.visitLabel({ again: false }) === 'Viewed your profile' && V.visitLabel({ again: true }) === 'Visited again', 'labels: first visit / a later separate visit — no number');
ok(V.visitsEntrySub(0) === 'No visits yet' && V.visitsEntrySub(1) === '1 person' && V.visitsEntrySub(4) === '4 people', 'Activity entry counts people, not visits');
ok(V.visitsCountLine(1) === '1 person visited your profile' && V.visitsCountLine(3) === '3 people visited your profile', 'non-premium count line');
ok(V.VISITS_NOTICE.body === 'People whose profiles you visit can see you in their profile visitors.' && V.VISITS_NOTICE.cta === 'Got it' && !('title' in V.VISITS_NOTICE) && /visible both ways/.test(V.VISITS_INFO), 'notice: one plain line + "Got it"; info line says visits are visible');
const pv = V.parseVisits({ member: true, premium: false, count: 2, visits: [], notice_ack: true });
ok(pv.count === 2 && pv.visits.length === 0 && !pv.premium && pv.noticeAck, 'parse: non-premium = count only');
ok(eq(V.parseVisits(null), { member: false, premium: false, count: 0, visits: [], noticeAck: false }), 'parse: empty / unknown payload');

const hook = code('hooks/useProfileVisit.ts');
ok(/createVisitFlow\(\{ record: recordProfileVisit, ack: ackVisitsNotice \}/.test(hook) && !/Alert/.test(hook), 'hook: uses the pure flow; no system alert');
const nc = code('components/visits/VisitsNotice.tsx');
ok(/VISITS_NOTICE\.cta/.test(nc) && /onPress=\{state\.gotIt\}/.test(nc) && /onPress=\{state\.dismiss\}/.test(nc) && (nc.match(/styles\.cta\b/g) || []).length === 1, 'notice area: one primary "Got it" + a close icon');
for (const f of ['app/v2/profile.tsx', 'app/v2/activity-profile.tsx', 'app/v2/match-profile.tsx'])
  ok(/<VisitsNotice state=\{visitNotice\} \/>/.test(code(f)), `${f}: shows the notice area`);
const ppv = code('components/onboarding-v2/PublicProfileView.tsx');
ok(/if \(state\.kind === 'ready'\) onLoadedRef\.current\?\.\(userId\)/.test(ppv), 'full profile reports only a successful load');
ok(/onLoaded=\{isOwn \? undefined : recordVisit\}/.test(code('app/v2/profile.tsx')), 'chat → profile records (never the own profile)');
ok(/setLoad\('ready'\);\s*recordVisit\(userId\)/.test(code('app/v2/activity-profile.tsx')), 'Activity → profile records after the load');
ok(/setLoad\('ready'\);\s*recordVisit\(id\)/.test(code('app/v2/match-profile.tsx')), 'Matches → profile records after the load');
const home = code('app/(tabs)/index.tsx');
ok(!/recordVisit|useProfileVisit|record_profile_visit/.test(home), 'Discover cards / previews do not record visits');
const devSrc = ['app/dev', 'components/dev', 'lib/dev'].filter((d) => fs.existsSync(path.join(ROOT, d)))
  .flatMap((d) => fs.readdirSync(path.join(ROOT, d), { recursive: true }).map((f) => path.join(d, String(f))))
  .filter((f) => fs.statSync(path.join(ROOT, f)).isFile()).map(read).join('\n');
ok(devSrc.length > 0 && !/recordVisit|useProfileVisit|record_profile_visit/.test(devSrc), 'design previews (app/dev, components/dev, lib/dev) do not record visits');
const act = code('components/activity/V2ActivityScreen.tsx');
ok(/router\.push\('\/v2\/profile-visits'/.test(act) && /visitsEntrySub\(visitCount\)/.test(act), 'Activity: small Profile visits entry');
ok(!/visit/i.test(code('lib/activity/feed.ts') + code('lib/activity/badge.ts') + code('lib/activity/badgeStore.ts')), 'badge / like feed know nothing about visits');
const scr = code('app/v2/profile-visits.tsx');
ok(/!d\.premium/.test(scr) && /visitsCountLine\(d\.count\)/.test(scr) && /\/premium/.test(scr), 'non-premium: count + premium CTA');
ok(/visitLabel\(v\)/.test(scr) && /VISITS_INFO/.test(scr) && /No visits yet/.test(scr), 'premium list with labels; info line; empty state');

const sql = read('supabase/proposed/20261022090000_v2_profile_visits.sql').replace(/^--.*$/gm, '');
ok(/primary key \(visitor_id, visited_id\)/.test(sql) && /visitor_id <> visited_id/.test(sql), 'one row per pair; never oneself');
ok(/enable row level security/.test(sql) && !/create policy/.test(sql) && /revoke all on public\.profile_visits_v2 from anon, authenticated/.test(sql), 'table: RPCs only');
ok(/select interval '24 hours'/.test(sql) && /where v\.last_visit_at <= now\(\) - public\.v2_profile_visit_window\(\)/.test(sql), '24 h window is one named constant');
ok(/values \(v_me, p_user\)/.test(sql) && /'notice_required'/.test(sql) && /v2_can_view_public_profile\(v_me, p_user\)/.test(sql), 'record: visitor is always auth.uid(); notice first; visible pairs only');
ok(/pv\.visited_id = v_me/.test(sql) && /filter \(where v_premium\)/.test(sql) && !/'visits', vi\.visits/.test(sql), 'read: only my visitors; identities premium-only; no exact count');
ok(/20261022090000_v2_profile_visits\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/profile_visits/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
// The client flow with stubbed server calls (the server side: smoke_visit_notice_local.mjs).
module.exports = (async () => {
  const mk = () => {
    const st = { acked: false, rows: new Set(), calls: [], shown: [] };
    const deps = {
      record: async (id) => { st.calls.push(['record', id]); if (!st.acked) return 'notice'; st.rows.add(id); return 'recorded'; },
      ack: async () => { st.calls.push(['ack']); st.acked = true; return true; },
    };
    return { st, flow: V.createVisitFlow(deps, (id) => st.shown.push(id)) };
  };
  let t = mk();
  ok((await t.flow.loaded('h')) === 'notice' && t.st.rows.size === 0 && !t.st.acked && eq(t.st.shown, ['h']), 'flow: first open → notice shown, nothing recorded, nothing acknowledged');
  t.flow.dismiss();
  ok(t.st.rows.size === 0 && !t.st.acked && eq(t.st.shown, ['h', null]) && !t.st.calls.some((c) => c[0] === 'ack'), 'flow: close without "Got it" → no visit, no acknowledgement');
  ok((await t.flow.gotIt()) === false && !t.st.acked, 'flow: "Got it" after closing does nothing');
  t = mk(); // leaving the screen = the flow is dropped; the next open is a new flow
  await t.flow.loaded('h');
  const t2 = { st: t.st, flow: V.createVisitFlow({ record: async (id) => { t.st.calls.push(['record', id]); return t.st.acked ? (t.st.rows.add(id), 'recorded') : 'notice'; }, ack: async () => true }, (id) => t.st.shown.push(id)) };
  ok((await t2.flow.loaded('h')) === 'notice' && t.st.rows.size === 0, 'flow: back out, open again → the notice shows again');
  t = mk();
  await t.flow.loaded('h');
  ok((await t.flow.gotIt()) === true && t.st.acked && t.st.rows.has('h'), 'flow: "Got it" acknowledges, then records');
  const order = t.st.calls.map((c) => c[0]).join(',');
  ok(order === 'record,ack,record', 'flow: the visit is recorded only after the acknowledgement');
  ok((await t.flow.loaded('h')) === null && t.st.calls.length === 3, 'flow: once per person per screen');
  t = mk();
  t.st.acked = true;
  ok((await t.flow.loaded('x')) === 'recorded' && eq(t.st.shown, []), 'flow: already acknowledged → no notice, recorded directly');
  // failed acknowledgement: notice stays, nothing recorded
  const st3 = { rows: 0, shown: [] };
  const f3 = V.createVisitFlow({ record: async () => 'notice', ack: async () => false }, (id) => st3.shown.push(id));
  await f3.loaded('h');
  ok((await f3.gotIt()) === false && eq(st3.shown, ['h']), 'flow: failed acknowledgement → notice stays, nothing recorded');
  // double tap
  let acks = 0;
  const f4 = V.createVisitFlow({ record: async () => (acks ? 'recorded' : 'notice'), ack: async () => { acks += 1; await new Promise((r) => setTimeout(r, 5)); return true; } }, () => {});
  await f4.loaded('h');
  await Promise.all([f4.gotIt(), f4.gotIt()]);
  ok(acks === 1, 'flow: a double tap on "Got it" acknowledges once');
  return done('v2_profile_visits');
})();
