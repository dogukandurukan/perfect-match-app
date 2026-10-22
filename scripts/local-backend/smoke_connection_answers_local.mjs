// Optional "How do you connect?" answers on the LOCAL Supabase (real Postgres +
// Auth + PostgREST, real JWTs): save_connection_answers_v2 /
// get_my_connection_answers_v2.
//   node scripts/local-backend/smoke_connection_answers_local.mjs
// FRESH synthetic people only (tempa-local-connect-<tag>-*); never the phone
// accounts. A is left as a draft for the phone check (.test-backend/connection.json).
//   A  draft applicant (answers)      B  draft applicant (isolation)
//   M  approved member                S  applicant who answered, then submitted
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { admin, env, ensureMember, fillApplication, LOOKS, repo, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const save = (c, answers, version = 1) => c.rpc('save_connection_answers_v2', { p_version: version, p_answers: answers });
const get = async (c) => (await c.rpc('get_my_connection_answers_v2')).data;
const base = { city: 'İstanbul', district: 'Kadıköy' };

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-connect-${tag}-${k}@tempa-test.example.com`;
  const A = await signIn(mail('a'));
  await fillApplication(A.c, A.uid, { ...base, first: 'Ada', gender: 'woman', interested: ['men'], dob: '1994-01-01', look: LOOKS[1] });
  const B = await signIn(mail('b'));
  const S = await signIn(mail('s'));
  await fillApplication(S.c, S.uid, { ...base, first: 'Selin', gender: 'woman', interested: ['men'], dob: '1993-02-02', look: LOOKS[3] });
  const M = await ensureMember({ ...base, email: mail('m'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1992-03-03', look: LOOKS[5] });

  const g0 = await get(A.c);
  check(g0?.version === null && JSON.stringify(g0.answers) === '{}' && g0.can_edit === true, 'nothing saved yet → empty, editable (draft)');
  const p1 = await save(A.c, { meet_new: 'take_time' });
  check(!p1.error && (await get(A.c)).answers.meet_new === 'take_time', 'partial answer saved (1 of 4)');
  const p2 = await save(A.c, { meet_new: 'take_time', show_care: 'mix' });
  const fresh = await signIn(mail('a'));
  const g2 = await get(fresh.c);
  check(!p2.error && g2.version === 1 && g2.answers.meet_new === 'take_time' && g2.answers.show_care === 'mix' && !('when_bothered' in g2.answers), 'a fresh session reads the saved partial answers + version');
  check(!(await save(A.c, {})).error && JSON.stringify((await get(A.c)).answers) === '{}', 'an empty set is valid (all skipped)');
  await save(A.c, { meet_new: 'open_quickly', when_bothered: 'time_then_talk', time_together: 'both', show_care: 'quality_time' });
  check(Object.keys((await get(A.c)).answers).length === 4, 'all four answered');

  for (const [name, ans, ver] of [['unknown question', { favourite_colour: 'blue' }, 1], ['unknown option', { meet_new: 'shy' }, 1], ['non-string value', { meet_new: 1 }, 1], ['not an object', ['meet_new'], 1], ['unknown version', { meet_new: 'take_time' }, 2]]) {
    const r = await save(A.c, ans, ver);
    check(/invalid_answers|unknown_version/.test(r.error?.message ?? ''), `${name} → refused`);
  }
  check(Object.keys((await get(A.c)).answers).length === 4, 'after the refusals the saved answers are unchanged');

  // Isolation: another account never sees A's answers.
  const gb = await get(B.c);
  check(JSON.stringify(gb.answers) === '{}' && gb.version === null, 'another account reads only its own (empty) answers');
  const direct = await B.c.from('connection_answers_v2').select('*');
  check(!!direct.error || (direct.data ?? []).length === 0, 'the table is not readable directly');
  const forge = await B.c.from('connection_answers_v2').insert({ user_id: A.uid, version: 1, answers: {} });
  check(!!forge.error, 'nobody writes answers for someone else (direct insert refused)');
  const anon = await fetch(`${env.url}/rest/v1/rpc/get_my_connection_answers_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: '{}' });
  check(anon.status >= 400, 'signed out → refused');

  // Optional: submitting works with or without answers; completeness unchanged.
  await save(S.c, { meet_new: 'depends' });
  const subS = (await S.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subS?.status === 'submitted', 'submit with partial answers → submitted');
  const sAfter = await get(S.c);
  check(sAfter.can_edit === false && sAfter.answers.meet_new === 'depends', 'after submitting: answers kept, no longer editable');
  check(/application_locked/.test((await save(S.c, { meet_new: 'take_time' })).error?.message ?? ''), 'a submitted applicant cannot change answers');
  const C = await signIn(mail('c'));
  await fillApplication(C.c, C.uid, { ...base, first: 'Cem', gender: 'man', interested: ['women'], dob: '1991-04-04', look: LOOKS[0] });
  const subC = (await C.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subC?.status === 'submitted', 'submit with no answers at all → submitted (not required)');
  const C1 = await signIn(mail('c1'));
  await fillApplication(C1.c, C1.uid, { ...base, first: 'Can', gender: 'man', interested: ['women'], dob: '1991-05-05', look: LOOKS[2], prompts: [['small_thing_i_love', 'Tea.']] });
  await save(C1.c, { meet_new: 'take_time', when_bothered: 'talk_now', time_together: 'both', show_care: 'words' });
  const subC1 = (await C1.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  check(subC1?.status !== 'submitted' && JSON.stringify(subC1?.missing ?? []).includes('prompt'), 'D93 unchanged: 1 prompt + all four answers is still incomplete');

  // Members are never asked again; answers are not part of what others see.
  check((await get(M.c)).can_edit === false && /application_locked/.test((await save(M.c, { meet_new: 'take_time' })).error?.message ?? ''), 'an approved member is not asked (cannot save)');
  must(await admin.rpc('review_application_v2', { p_user: S.uid, p_decision: 'accept' }));
  const pub = JSON.stringify((await M.c.rpc('get_profile_v2', { p_user: S.uid })).data ?? {});
  check(pub.length > 2 && !/meet_new|depends|connection/.test(pub), 'the public profile does not contain the answers');

  fs.mkdirSync(path.join(repo, '.test-backend'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(repo, '.test-backend', 'connection.json'), JSON.stringify({ draft: mail('p') }), { mode: 0o600 });
  const P = await signIn(mail('p'));
  await fillApplication(P.c, P.uid, { ...base, first: 'Pelin', gender: 'woman', interested: ['men'], dob: '1995-06-06', look: LOOKS[4] });
  console.log(`smoke_connection_answers_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  console.log(`phone account (draft, everything filled, no answers): ${mail('p')}`);
  process.exit(failed ? 1 : 0);
}
function must(r) { if (r.error) throw new Error(r.error.message); return r.data; }
main().catch((e) => { console.error(e); process.exit(1); });
