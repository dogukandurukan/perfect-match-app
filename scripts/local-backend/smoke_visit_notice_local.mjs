// The profile-visits notice on the LOCAL Supabase (real Postgres + Auth +
// PostgREST, real JWTs): the server side of the "Got it" flow.
//   node scripts/local-backend/smoke_visit_notice_local.mjs
// FRESH synthetic people only (tempa-local-vnotice-<tag>-*); never the phone
// accounts, never .test-backend/*. The client flow: v2_profile_visits.check.js.
import { admin, ensureMember, LOOKS } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const rec = async (c, uid) => (await c.rpc('record_profile_visit_v2', { p_user: uid })).data;
const row = async (v, h) => (await admin.from('profile_visits_v2').select('*').eq('visitor_id', v).eq('visited_id', h).maybeSingle()).data;
const ackAt = async (uid) => (await admin.from('account_state_v2').select('visits_notice_ack_at').eq('user_id', uid).maybeSingle()).data?.visits_notice_ack_at ?? null;

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-vnotice-${tag}-${k}@tempa-test.example.com`;
  const base = { city: 'İstanbul', district: 'Kadıköy' };
  const H = await ensureMember({ ...base, email: mail('h'), first: 'Hande', gender: 'woman', interested: ['men'], dob: '1993-05-13', look: LOOKS[1] });
  const V = await ensureMember({ ...base, email: mail('v'), first: 'Volkan', gender: 'man', interested: ['women'], dob: '1992-02-02', look: LOOKS[5] });
  const X = await ensureMember({ ...base, email: mail('x'), first: 'Xander', gender: 'man', interested: ['women'], dob: '1991-03-03', look: LOOKS[4] });

  // 1st open: the full profile loads, the client asks to record → notice.
  check((await V.c.rpc('get_profile_v2', { p_user: H.uid })).data != null, 'setup: V can load H’s full profile');
  check((await rec(V.c, H.uid))?.reason === 'notice_required' && !(await row(V.uid, H.uid)) && !(await ackAt(V.uid)), 'open before "Got it" → notice_required; no visit, no acknowledgement');
  // Close / go back: the client calls nothing. Next eligible open → notice again.
  check((await rec(V.c, H.uid))?.reason === 'notice_required' && !(await row(V.uid, H.uid)) && !(await ackAt(V.uid)), 'after closing / going back, the next open asks again; still nothing stored');
  // "Got it": acknowledge first — that alone records no visit.
  check((await V.c.rpc('ack_profile_visits_notice_v2')).data?.ok === true && !!(await ackAt(V.uid)) && !(await row(V.uid, H.uid)), '"Got it": acknowledgement saved; the acknowledgement itself records no visit');
  const first = await ackAt(V.uid);
  check((await rec(V.c, H.uid))?.recorded === true && !!(await row(V.uid, H.uid)), 'then the visit is recorded');
  await V.c.rpc('ack_profile_visits_notice_v2');
  check((await ackAt(V.uid)) === first, 'acknowledging again keeps the first time (one-time notice)');
  // After acknowledging, only an eligible, visible profile is recorded.
  check((await rec(V.c, X.uid))?.reason === 'not_visible' && !(await row(V.uid, X.uid)), 'after "Got it", an ineligible profile is still not recorded');
  check((await rec(V.c, V.uid))?.reason === 'own' && !(await row(V.uid, V.uid)), 'own profile never recorded');

  console.log(`smoke_visit_notice_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
