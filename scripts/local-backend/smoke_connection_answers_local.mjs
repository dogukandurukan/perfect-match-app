// "What you're looking for" answers on the LOCAL Supabase (real Postgres +
// Auth + PostgREST, real JWTs): save_connection_answers_v2 /
// get_my_connection_answers_v2 version 3 (D104b, 2026-10-25), next to kept
// version-1/2 answers, plus completeness (old intent OR new main intention).
//   node scripts/local-backend/smoke_connection_answers_local.mjs
// FRESH synthetic people only (tempa-local-connv3-<tag>-*); never the phone
// accounts and never .test-backend.
//   A  draft with old intent (answers)   N  draft WITHOUT old intent (new flow)
//   B  draft (isolation)                 O  draft with old intent, no new answers
//   M  approved member
import crypto from 'node:crypto';
import { admin, env, ensureMember, fillApplication, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const save = (c, answers, version = 3) => c.rpc('save_connection_answers_v2', { p_version: version, p_answers: answers });
const get = async (c, version = 3) => (await c.rpc('get_my_connection_answers_v2', { p_version: version })).data;
// jsonb reorders keys: compare independent of key order (deep).
const norm = (v) => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])])) : v);
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const base = { city: 'İstanbul', district: 'Kadıköy' };
const missing = async (uid) => (await admin.rpc('v2_missing_for', { p_uid: uid })).data;

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-connv3-${tag}-${k}@tempa-test.example.com`;
  const A = await signIn(mail('a'));
  await fillApplication(A.c, A.uid, { ...base, first: 'Ada', gender: 'woman', interested: ['men'], dob: '1994-01-01', look: LOOKS[1] });
  const B = await signIn(mail('b'));
  const M = await ensureMember({ ...base, email: mail('m'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1992-03-03', look: LOOKS[5] });

  const g0 = await get(A.c);
  check(g0?.version === null && same(g0.answers, {}) && g0.can_edit === true && same(g0.supports, [1, 2, 3]), 'nothing saved yet → empty, editable; server supports version 3');

  // Older versions stay separate and untouched.
  const V1 = { meet_new: 'take_time' };
  const V2 = { plan_first_date: 'decide_together' };
  await save(A.c, V1, 1);
  await save(A.c, V2, 2);

  // Partial, persistence, edit, clear.
  check(!(await save(A.c, { intent: 'long_term', intent_also: ['see_where'] })).error, 'intention + "Also open to" saved (partial)');
  const fresh = await signIn(mail('a'));
  check(same((await get(fresh.c)).answers, { intent: 'long_term', intent_also: ['see_where'] }), 'a fresh session (reopen) reads it back');
  const full = { intent: 'long_term', intent_also: ['see_where', 'marriage'],
    priorities: { active: { exercises: 'preference', active_together: 'must_have' }, interests: { travel: 'must_have', music: 'preference' }, children: { wants: 'must_have' } },
    connection: ['gradual', 'open_talk'] };
  check(!(await save(A.c, full)).error && same((await get(A.c)).answers, full), 'all three answered: per-detail Preference / Must-have kept');
  const edited = { ...full, intent: 'marriage', intent_also: ['see_where'] };
  check(!(await save(A.c, edited)).error && same((await get(A.c)).answers, edited), 'edit: new main intention, its duplicate extra removed');
  const noPrefs = { intent: 'marriage', intent_also: ['see_where'], priorities_none: true, connection: ['not_sure'] };
  check(!(await save(A.c, noPrefs)).error && same((await get(A.c)).answers, noPrefs), '"No specific preferences" and "I’m not sure yet" alone are valid');
  check(!(await save(A.c, { intent: 'marriage' })).error && same((await get(A.c)).answers, { intent: 'marriage' }), 'cleared parts are removed');
  check(!(await save(A.c, {})).error && same((await get(A.c)).answers, {}), 'everything skipped: empty set valid');
  check(same((await get(A.c, 1)).answers, V1) && same((await get(A.c, 2)).answers, V2), 'version-1 and version-2 answers unchanged');

  // Refusals leave the saved answers unchanged.
  await save(A.c, { intent: 'casual' });
  const refused = [
    ['main intention repeated in extras', { intent: 'casual', intent_also: ['casual'] }],
    ['"Still figuring it out" as an extra', { intent: 'casual', intent_also: ['figuring_out'] }],
    ['extras without a main intention', { intent_also: ['casual'] }],
    ['unknown intention', { intent: 'friends' }],
    ['4 priority topics', { priorities: { active: { exercises: 'preference' }, education: { degree: 'preference' }, career: { steady_job: 'preference' }, money: { independent: 'preference' } } }],
    ['a topic without a detail', { priorities: { active: {} } }],
    ['two children choices', { priorities: { children: { wants: 'preference', deciding: 'preference' } } }],
    ['an interest the user doesn’t have', { priorities: { interests: { gaming: 'preference' } } }],
    ['"Other" as a shared interest', { priorities: { interests: { other: 'preference' } } }],
    ['4 shared interests', { priorities: { interests: { travel: 'preference', music: 'preference', food: 'preference', books: 'preference' } } }],
    ['unknown importance', { priorities: { active: { exercises: 'essential' } } }],
    ['priorities with "No specific preferences"', { priorities_none: true, priorities: { active: { exercises: 'preference' } } }],
    ['3 connection choices', { connection: ['gradual', 'open_talk', 'own_space'] }],
    ['"I’m not sure yet" with another choice', { connection: ['not_sure', 'gradual'] }],
    ['an old-version id in version 3', { plan_first_date: 'any' }],
  ];
  for (const [name, ans] of refused) check(/invalid_answers/.test((await save(A.c, ans)).error?.message ?? ''), `${name} → refused`);
  check(same((await get(A.c)).answers, { intent: 'casual' }), 'after the refusals the saved answers are unchanged');

  // Isolation.
  check(same((await get(B.c)).answers, {}), 'another account reads only its own answers');
  const direct = await B.c.from('connection_answers_v2').select('*');
  check(!!direct.error || (direct.data ?? []).length === 0, 'the table is not readable directly');
  check(!!(await B.c.rpc('v2_connection_check_v3', { p_uid: A.uid, a: {} })).error && !!(await B.c.rpc('v2_connection_has_intent', { p_uid: A.uid })).error, 'helper functions are not callable by apps');
  const anon = await fetch(`${env.url}/rest/v1/rpc/get_my_connection_answers_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_version: 3 }) });
  check(anon.status >= 400, 'signed out → refused');

  // Completeness: the intention is still required — old field OR new main intention, never mapped.
  const N = await signIn(mail('n'));
  await fillApplication(N.c, N.uid, { ...base, first: 'Nil', gender: 'woman', interested: ['men'], dob: '1996-02-02', look: LOOKS[3] });
  const cl = await N.c.rpc('save_onboarding_v2', { p_section: 'compatibility', p_data: { intent: null } });
  check(!cl.error, 'setup: a draft that never answered the old intent question');
  check((await missing(N.uid))?.includes('compatibility.answers'), 'no old intent and no new intention → incomplete');
  const sub0 = (await N.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(sub0?.status !== 'submitted', 'submit refused without any intention (required info can’t be skipped)');
  await save(N.c, { priorities_none: true, connection: ['gradual'] });
  check((await missing(N.uid))?.includes('compatibility.answers'), 'optional answers alone don’t complete it');
  await save(N.c, { intent: 'see_where', priorities_none: true, connection: ['gradual'] });
  check(((await missing(N.uid)) ?? []).length === 0, 'new main intention completes the application');
  const oldIntentN = (await admin.from('onboarding_v2').select('intent').eq('user_id', N.uid).single()).data?.intent;
  check(oldIntentN === null, 'the new intention is NOT copied into the old intent field');
  const subN = (await N.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subN?.status === 'submitted', 'submit with the new intention → submitted');
  check((await get(N.c)).can_edit === false && /application_locked/.test((await save(N.c, { intent: 'casual' })).error?.message ?? '') && (await get(N.c)).answers.intent === 'see_where', 'after submitting: answers kept and locked (save error, data unchanged)');

  // Section off / old flow: old intent, no new answers → normal submit.
  const O = await signIn(mail('o'));
  await fillApplication(O.c, O.uid, { ...base, first: 'Oya', gender: 'woman', interested: ['men'], dob: '1993-03-03', look: LOOKS[2] });
  check((await O.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data?.status === 'submitted', 'old intent only (section off) → normal submit works');

  // Visibility: the new answers never reach other people.
  const rv = await admin.rpc('review_application_v2', { p_user: N.uid, p_decision: 'accept' });
  if (rv.error) throw new Error(rv.error.message);
  const pub = (await M.c.rpc('get_profile_v2', { p_user: N.uid })).data ?? {};
  const pubText = JSON.stringify(pub);
  check(pubText.length > 2 && pub.intent == null && !/see_where|priorities|gradual|connection/.test(pubText), 'public profile: no new intention, priorities or connection style');
  check(/application_locked/.test((await save(M.c, { intent: 'casual' })).error?.message ?? ''), 'an approved member is not asked (cannot save)');

  console.log(`smoke_connection_answers_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
