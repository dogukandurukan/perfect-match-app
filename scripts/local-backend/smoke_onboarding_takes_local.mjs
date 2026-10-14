// D93 on the LOCAL Supabase (real Postgres + Auth + PostgREST, real JWTs),
// synthetic only:   node scripts/local-backend/smoke_onboarding_takes_local.mjs
// Needs: setup.mjs (+ 20261016090000_v2_onboarding_takes) and seed.mjs. Every
// run creates FRESH synthetic applicants (tempa-local-onb-<tag>-*).
// An application is complete with 2 standard answers OR 1 standard answer +
// 1 conversation starter; starters alone never count.
import crypto from 'node:crypto';
import { admin, env, ensureMember, fillApplication, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const BOOK = { kind: 'book', source: 'openlibrary', id: 'ol:work:OL1168083W', title: '1984', subtitle: 'George Orwell' };
const FILM = { kind: 'screen', source: 'wikidata', id: 'wd:Q13417189', title: 'Interstellar' };
const ONE = [['small_thing_i_love', 'Morning tea on the balcony.']];

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-onb-${tag}-${k}@tempa-test.example.com`;
  const person = (k, n, prompts) => ({ email: mail(k), first: `A${k}`, gender: 'woman', interested: ['men'], dob: `199${n}-04-1${n}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[n], prompts });
  const applicant = async (k, n, prompts) => {
    const s = await signIn(mail(k));
    await fillApplication(s.c, s.uid, person(k, n, prompts));
    return s;
  };
  const submit = async (c) => (await c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() })).data;
  const world = (c, data) => c.rpc('save_onboarding_v2', { p_section: 'yourWorld', p_data: { interests: ['travel'], artists: [], books: [], screen: [], activities: [], ...data } });
  const take = (c, id, kind, subj, q, a) => c.rpc('save_take_v2', { p_take_id: id, p_subject_kind: kind, p_subject_id: subj, p_question_id: q, p_answer: a });
  const status = async (uid) => (await admin.from('account_state_v2').select('application_status').eq('user_id', uid).single()).data.application_status;

  // 1. Path 1 — two standard answers (unchanged rule).
  const A = await applicant('a', 1, undefined);
  const sa = await submit(A.c);
  check(sa?.status === 'submitted', 'two standard answers → submitted');

  // 2. One standard answer alone → refused; + a starter → submitted.
  const B = await applicant('b', 2, ONE);
  const sb0 = await submit(B.c);
  check(sb0?.status === 'draft' && (sb0.missing ?? []).includes('yourProfile.prompts') && sb0.missing.length === 1, 'one standard answer, no starter → refused (only prompts missing)');
  check(!(await world(B.c, { books: [BOOK], activities: ['running'] })).error, 'applicant saves Your World with a book + an activity (save_onboarding_v2)');
  const bt = (await take(B.c, null, 'book', BOOK.id, 'book_why', 'Still the most unsettling ending.')).data;
  check(bt?.ok === true, 'applicant (draft) can write their own starter');
  const B2 = await signIn(mail('b'));
  const b2 = (await B2.c.rpc('get_my_interests_v2')).data;
  const b2o = (await B2.c.rpc('get_my_onboarding_v2')).data;
  check(b2?.takes?.length === 1 && b2.takes[0].answer.startsWith('Still') && b2o?.draft?.activities?.join() === 'running' && b2o.prompts.length === 1,
    'new session: starter, activities and the one standard answer read back');
  const sb1 = await submit(B2.c);
  check(sb1?.status === 'submitted', 'one standard answer + one starter → submitted');
  const locked = await take(B2.c, null, 'activity', 'running', 'activity_favourite_part', 'after submit');
  const lockedDel = await B2.c.rpc('delete_take_v2', { p_take_id: bt.take.id });
  check(/application_locked/.test(locked.error?.message ?? '') && /application_locked/.test(lockedDel.error?.message ?? '') && (await B2.c.rpc('get_my_interests_v2')).data.takes.length === 1,
    'after submitting (pending review): starters locked like every other answer');

  // 3. Starters alone are never enough (0 standard + 3 starters).
  const C = await applicant('c', 3, []);
  await world(C.c, { books: [BOOK], screen: [FILM], activities: ['running'] });
  await take(C.c, null, 'book', BOOK.id, 'book_why', 'one');
  await take(C.c, null, 'screen', FILM.id, 'screen_why', 'two');
  await take(C.c, null, 'activity', 'running', 'activity_favourite_part', 'three');
  const sc = await submit(C.c);
  check((await C.c.rpc('get_my_interests_v2')).data.takes.length === 3 && sc?.status === 'draft' && sc.missing.includes('yourProfile.prompts'), 'no standard answer + three starters → refused');

  // 4. Removing the subject: confirm required; then the starter no longer counts.
  const D = await applicant('d', 4, ONE);
  await world(D.c, { books: [BOOK] });
  const dt = (await take(D.c, null, 'book', BOOK.id, 'book_why', 'Orwell.')).data;
  const noConfirm = await world(D.c, { books: [] });
  const dAfter = (await D.c.rpc('get_my_interests_v2')).data;
  check(/take_subject_removed/.test(noConfirm.error?.message ?? '') && noConfirm.error?.details === '1984' && dAfter.books.length === 1 && dAfter.takes.length === 1 && dAfter.takes[0].id === dt.take.id,
    'remove the starter’s book without confirming → refused, book + starter kept');
  const conf = await world(D.c, { books: [], confirm_remove_takes: true });
  const dGone = (await D.c.rpc('get_my_interests_v2')).data;
  const sd = await submit(D.c);
  check(!conf.error && dGone.books.length === 0 && dGone.takes.length === 0 && sd?.status === 'draft' && sd.missing.includes('yourProfile.prompts'),
    'confirmed → book and starter removed together; the application is incomplete again');

  // 5. Validation through the onboarding path.
  const badAct = await world(D.c, { activities: ['skydiving'] });
  const tooMany = await world(D.c, { activities: ['running', 'walking', 'cycling', 'hiking', 'swimming', 'gym'] });
  const blank = (await take(D.c, null, 'activity', 'running', 'activity_favourite_part', '   ')).data;
  check(!!badAct.error && !!tooMany.error && blank?.error !== undefined, 'unknown / 6 activities and a blank starter are refused');

  // 6. Changes requested → editable again; resubmit with 1 + starter works.
  check(!(await admin.rpc('review_application_v2', { p_user: B.uid, p_decision: 'request_changes', p_note: 'Please add a clearer photo.' })).error, 'reviewer requests changes');
  const again = (await take(B2.c, bt.take.id, 'book', BOOK.id, 'book_stayed', 'The last page.')).data;
  const sb2 = await submit(B2.c);
  check(again?.ok === true && again.take.id === bt.take.id && sb2?.status === 'submitted', 'changes requested: starter editable again (same id), resubmitted');

  // 7. Rejected / suspended / other people / signed out.
  const R = await applicant('r', 5, undefined);
  await submit(R.c);
  await admin.rpc('review_application_v2', { p_user: R.uid, p_decision: 'reject' });
  const rw = await take(R.c, null, 'activity', 'running', 'activity_favourite_part', 'x');
  check(/application_locked/.test(rw.error?.message ?? '') && (await status(R.uid)) === 'rejected', 'rejected applicant cannot write starters');
  const S = await ensureMember(person('s', 0, undefined));
  await admin.from('account_state_v2').update({ membership_status: 'suspended' }).eq('user_id', S.uid);
  const sw = await take(S.c, null, 'activity', 'running', 'activity_favourite_part', 'x');
  check(/application_locked/.test(sw.error?.message ?? ''), 'suspended member cannot write starters');
  const X = await applicant('x', 2, ONE);
  const xDel = (await X.c.rpc('delete_take_v2', { p_take_id: bt.take.id })).data;
  const xIns = await X.c.from('profile_takes_v2').insert({ user_id: B.uid, position: 2, subject_kind: 'book', subject_id: BOOK.id, subject_title: '1984', question_id: 'book_why', answer: 'x' });
  check(xDel?.error === 'not_found' && !!xIns.error && (await admin.from('profile_takes_v2').select('id').eq('user_id', B.uid)).data.length === 1, 'another applicant cannot touch someone else’s starter');
  const anon = await fetch(`${env.url}/rest/v1/rpc/save_take_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_take_id: null, p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_favourite_part', p_answer: 'x' }) });
  check(anon.status === 401, `signed out → refused (HTTP ${anon.status})`);

  // 8. The general lock is unchanged for submitted applicants.
  const lockSave = await B2.c.rpc('save_onboarding_v2', { p_section: 'yourWorld', p_data: { interests: ['music'] } });
  check(/application_locked/.test(lockSave.error?.message ?? ''), 'submitted applicant: save_onboarding_v2 still locked');

  console.log(`smoke_onboarding_takes_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
