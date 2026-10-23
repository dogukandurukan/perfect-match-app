// Optional dating-preference answers on the LOCAL Supabase (real Postgres +
// Auth + PostgREST, real JWTs): save_connection_answers_v2 /
// get_my_connection_answers_v2, version 2 (D104 revision 2026-10-23) next to
// the kept version-1 answers.
//   node scripts/local-backend/smoke_connection_answers_local.mjs
// FRESH synthetic people only (tempa-local-connv2-<tag>-*); never the phone
// accounts and never .test-backend (the phone draft is chosen separately).
//   A  draft applicant (answers)      B  draft applicant (isolation)
//   M  approved member                S  applicant who answered, then submitted
//   C  applicant with no answers      I  incomplete draft (completeness unchanged)
import crypto from 'node:crypto';
import { admin, env, ensureMember, fillApplication, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const save = (c, answers, version = 2) => c.rpc('save_connection_answers_v2', { p_version: version, p_answers: answers });
const get = async (c, version = 2) => (await c.rpc('get_my_connection_answers_v2', { p_version: version })).data;
// jsonb reorders keys: compare independent of key order.
const sorted = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])) : o);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const base = { city: 'İstanbul', district: 'Kadıköy' };
const V1 = { meet_new: 'take_time', when_bothered: 'talk_now', time_together: 'both', show_care: 'words' };

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-connv2-${tag}-${k}@tempa-test.example.com`;
  const A = await signIn(mail('a'));
  await fillApplication(A.c, A.uid, { ...base, first: 'Ada', gender: 'woman', interested: ['men'], dob: '1994-01-01', look: LOOKS[1] });
  const B = await signIn(mail('b'));
  const M = await ensureMember({ ...base, email: mail('m'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1992-03-03', look: LOOKS[5] });

  const g0 = await get(A.c);
  check(g0?.version === null && same(g0.answers, {}) && g0.can_edit === true, 'nothing saved yet → empty, editable (draft)');

  // Old answers (version 1, e.g. from the first draft) stay separate.
  check(!(await save(A.c, V1, 1)).error, 'setup: version-1 answers saved');
  const p1 = await save(A.c, { plan_first_date: 'few_options' });
  check(!p1.error && same((await get(A.c)).answers, { plan_first_date: 'few_options' }), 'partial version-2 answer saved (1 of 2)');
  check(same((await get(A.c, 1)).answers, V1), 'version-1 answers kept unchanged next to version 2');
  const old = await A.c.rpc('get_my_connection_answers_v2');
  check(!old.error && old.data.version === 1 && same(old.data.answers, V1), 'a call without a version still reads version 1 (older app)');
  const v2NoV1 = await get(A.c);
  check(v2NoV1.version === 2 && !Object.keys(v2NoV1.answers).some((k) => k in V1), 'version 2 never contains version-1 ids');

  // Reload persistence, edit, clear.
  const fresh = await signIn(mail('a'));
  check(same((await get(fresh.c)).answers, { plan_first_date: 'few_options' }) && (await get(fresh.c)).version === 2, 'a fresh session (reload) reads the saved answer + version');
  await save(A.c, { plan_first_date: 'few_options', first_date_comfort: 'quiet_place' });
  await save(A.c, { plan_first_date: 'suggest_first', first_date_comfort: 'quiet_place' });
  check(same((await get(A.c)).answers, { plan_first_date: 'suggest_first', first_date_comfort: 'quiet_place' }), 'answer edited');
  await save(A.c, { first_date_comfort: 'quiet_place' });
  check(same((await get(A.c)).answers, { first_date_comfort: 'quiet_place' }), 'Clear answer removes only that answer');
  check(!(await save(A.c, {})).error && same((await get(A.c)).answers, {}) && (await get(A.c)).version === 2, 'all skipped / cleared: an empty set is valid');
  check(same((await get(A.c, 1)).answers, V1), 'version-1 answers still unchanged after edits');

  // Refused writes leave everything as it was (save error → nothing saved).
  await save(A.c, { plan_first_date: 'any' });
  for (const [name, ans, ver] of [['a version-1 id in version 2', { meet_new: 'take_time' }, 2], ['a version-2 id in version 1', { plan_first_date: 'any' }, 1], ['unknown option', { plan_first_date: 'call_first' }, 2], ['non-string value', { plan_first_date: 1 }, 2], ['not an object', ['plan_first_date'], 2], ['unknown version', { plan_first_date: 'any' }, 3]]) {
    const r = await save(A.c, ans, ver);
    check(/invalid_answers|unknown_version/.test(r.error?.message ?? ''), `${name} → refused`);
  }
  check(same((await get(A.c)).answers, { plan_first_date: 'any' }) && same((await get(A.c, 1)).answers, V1), 'after the refusals both versions are unchanged');

  // Isolation.
  const gb = await get(B.c);
  check(same(gb.answers, {}) && gb.version === null, 'another account reads only its own (empty) answers');
  const direct = await B.c.from('connection_answers_v2').select('*');
  check(!!direct.error || (direct.data ?? []).length === 0, 'the table is not readable directly');
  const forge = await B.c.from('connection_answers_v2').insert({ user_id: A.uid, version: 2, answers: {} });
  check(!!forge.error, 'nobody writes answers for someone else (direct insert refused)');
  const anon = await fetch(`${env.url}/rest/v1/rpc/get_my_connection_answers_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_version: 2 }) });
  check(anon.status >= 400, 'signed out → refused');

  // Optional: the normal submit works with or without answers; completeness unchanged.
  const S = await signIn(mail('s'));
  await fillApplication(S.c, S.uid, { ...base, first: 'Selin', gender: 'woman', interested: ['men'], dob: '1993-02-02', look: LOOKS[3] });
  await save(S.c, { first_date_comfort: 'small_activity' });
  const subS = (await S.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subS?.status === 'submitted', 'submit with partial answers → submitted');
  const sAfter = await get(S.c);
  check(sAfter.can_edit === false && sAfter.answers.first_date_comfort === 'small_activity', 'after submitting: answers kept, no longer editable');
  check(/application_locked/.test((await save(S.c, { first_date_comfort: 'quiet_place' })).error?.message ?? '') && (await get(S.c)).answers.first_date_comfort === 'small_activity', 'a submitted applicant cannot change answers (save error, data unchanged)');
  const C = await signIn(mail('c'));
  await fillApplication(C.c, C.uid, { ...base, first: 'Cem', gender: 'man', interested: ['women'], dob: '1991-04-04', look: LOOKS[0] });
  check((await C.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data?.status === 'submitted', 'no answers at all (section skipped / turned off) → normal submit works');
  const I = await signIn(mail('i'));
  await fillApplication(I.c, I.uid, { ...base, first: 'Can', gender: 'man', interested: ['women'], dob: '1991-05-05', look: LOOKS[2], prompts: [['small_thing_i_love', 'Tea.']] });
  await save(I.c, { plan_first_date: 'any', first_date_comfort: 'short_casual' });
  const subI = (await I.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subI?.status !== 'submitted' && JSON.stringify(subI?.missing ?? []).includes('prompt'), 'completeness unchanged: answering everything does not complete a missing prompt');

  // Members are never asked; answers are not part of what others see.
  check((await get(M.c)).can_edit === false && /application_locked/.test((await save(M.c, { plan_first_date: 'any' })).error?.message ?? ''), 'an approved member is not asked (cannot save)');
  const rv = await admin.rpc('review_application_v2', { p_user: S.uid, p_decision: 'accept' });
  if (rv.error) throw new Error(rv.error.message);
  const pub = JSON.stringify((await M.c.rpc('get_profile_v2', { p_user: S.uid })).data ?? {});
  check(pub.length > 2 && !/first_date_comfort|small_activity|plan_first_date|connection/.test(pub), 'the public profile does not contain the answers');

  console.log(`smoke_connection_answers_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
