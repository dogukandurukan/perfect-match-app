// "Interests & conversation starter" on the LOCAL Supabase (real Postgres +
// Auth + PostgREST, real JWTs), synthetic accounts only:
//   node scripts/local-backend/smoke_takes_local.mjs
// Needs: setup.mjs (+ 20261014090000_v2_interests_takes) and seed.mjs. Every
// run creates FRESH synthetic people (tempa-local-take-<tag>-*).
//   M  accepted member (man)       — edits interests + his take
//   V  eligible viewer (woman)     — sees M's take on his profile
//   Y  viewer M blocks (woman)     — must not see anything
//   X  unrelated third (woman)     — must not change anything of M's
//   D  draft applicant (not accepted) — must be refused
import crypto from 'node:crypto';
import { admin, env, ensureMember, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const rpcHttp = (token, fn, args = {}) =>
  fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const BOOK_1984 = { kind: 'book', source: 'openlibrary', id: 'ol:work:OL1168083W', title: '1984', subtitle: 'George Orwell' };
const FILM = { kind: 'screen', source: 'wikidata', id: 'wd:Q13417189', title: 'Interstellar', subtitle: '2014 · Movie' };
const ARTIST = { kind: 'artist', source: 'musicbrainz', id: 'mb:artist:tarkan-test', title: 'Tarkan' };

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-take-${tag}-${k}@tempa-test.example.com`;
  const woman = (k, n) => ({ email: mail(k), first: `W${k}`, gender: 'woman', interested: ['men'], dob: `199${n}-03-1${n}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[n] });
  const M = await ensureMember({ email: mail('m'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const V = await ensureMember(woman('v', 1));
  const Y = await ensureMember(woman('y', 2));
  const X = await ensureMember(woman('x', 3));
  const D = await signIn(mail('d'));
  await D.c.rpc('get_my_onboarding_v2');
  const tokM = (await signIn(mail('m'))).token;

  const snap = async () => ({
    prompts: (await admin.from('profile_prompts_v2').select('id, slot, prompt_id, answer').eq('user_id', M.uid).order('slot')).data,
    state: (await admin.from('account_state_v2').select('application_status, verification_status, membership_status').eq('user_id', M.uid).single()).data,
    basics: (await admin.from('onboarding_v2').select('first_name, date_of_birth, location_city, intent, smoking, date_types').eq('user_id', M.uid).single()).data,
  });
  const before = await snap();

  // 1. Start: no take, nothing new.
  const s0 = (await M.c.rpc('get_my_interests_v2')).data;
  check(s0?.editable === true && s0.take === null && s0.activities.length === 0 && s0.interests.length >= 1, 'accepted member: editable, no take, no activities yet');

  // 2. Selections (broad interests 1–10, activities ≤ 5, taste ≤ 3).
  const save = (c, over = {}, remove = false) => c.rpc('save_interests_v2', {
    p_interests: ['travel', 'music'], p_activities: ['running', 'cooking'], p_artists: [ARTIST], p_books: [BOOK_1984], p_screen: [FILM],
    ...over, p_remove_take: remove });
  const s1 = (await save(M.c)).data;
  check(s1?.ok === true && s1.activities.join() === 'running,cooking' && s1.books[0].id === BOOK_1984.id && s1.screen[0].id === FILM.id,
    'save selections: activities + source ids kept');
  const bad = [
    (await save(M.c, { p_interests: [] })).data,
    (await save(M.c, { p_activities: ['running', 'walking', 'cycling', 'hiking', 'swimming', 'gym'] })).data,
    (await save(M.c, { p_activities: ['skydiving'] })).data,
    (await save(M.c, { p_books: [BOOK_1984, BOOK_1984] })).data,
    (await save(M.c, { p_books: [{ ...BOOK_1984, hack: 1 }] })).data,
  ];
  check(bad.map((b) => b?.error).join() === 'invalid_interests,invalid_activities,invalid_activities,invalid_taste,invalid_taste', 'invalid selections refused');
  check((await M.c.rpc('get_my_interests_v2')).data.activities.join() === 'running,cooking', 'refused saves wrote nothing');

  // 3. Take: validation, then save.
  const take = (c, kind, id, q, a) => c.rpc('save_take_v2', { p_subject_kind: kind, p_subject_id: id, p_question_id: q, p_answer: a });
  const t0 = [
    (await take(M.c, 'activity', 'hiking', 'activity_favourite_part', 'x')).data?.error,
    (await take(M.c, 'activity', 'running', 'book_why', 'x')).data?.error,
    (await take(M.c, 'activity', 'running', 'activity_favourite_part', 'a'.repeat(181))).data?.error,
    (await take(M.c, 'activity', 'running', 'activity_favourite_part', '   ')).data?.error,
    (await take(M.c, 'book', 'ol:work:NOT-MINE', 'book_why', 'x')).data?.error,
  ];
  check(t0.join() === 'subject_not_selected,invalid_question,invalid_answer,invalid_answer,subject_not_selected', 'take refused: unselected subject, wrong question, 181 chars, blank');
  const t1 = (await take(M.c, 'activity', 'running', 'activity_favourite_part', 'A slow seaside run, then finding a good coffee.')).data;
  check(t1?.ok === true && t1.take.subject_title === 'Running' && t1.take.answer.startsWith('A slow seaside'), 'take saved (title from the server, not the client)');
  const t180 = (await take(M.c, 'activity', 'running', 'activity_favourite_part', 'ç'.repeat(180))).data;
  check(t180?.ok === true && t180.take.id === t1.take.id, '180 characters accepted (Turkish letters), same subject → same id');
  const t2 = (await take(M.c, 'activity', 'running', 'activity_perfect_day', 'Sahil boyunca yavaş bir koşu.')).data;
  check(t2?.ok === true && t2.take.id === t1.take.id && t2.take.question_id === 'activity_perfect_day', 'edit (question + answer): same id');

  // 4. Fresh sessions read the current take; others see it via get_profile_v2.
  const M2 = await signIn(mail('m'));
  const r1 = (await M2.c.rpc('get_my_interests_v2')).data;
  check(r1.take?.answer === 'Sahil boyunca yavaş bir koşu.' && r1.take.id === t1.take.id, 'new session: current take from the server');
  const pv = (await V.c.rpc('get_profile_v2', { p_user: M.uid })).data;
  check(pv?.take?.answer === 'Sahil boyunca yavaş bir koşu.' && pv.take.subject_title === 'Running' && !('id' in pv.take) && pv.activities.join() === 'running,cooking',
    'eligible viewer sees the take + activities (no internal id)');

  // 5. Change subject: new row / id; the old answer is not carried over.
  const t3 = (await take(M.c, 'book', BOOK_1984.id, 'book_why', 'Still the most unsettling ending I have read.')).data;
  check(t3?.ok === true && t3.take.id !== t1.take.id && t3.take.subject_title === '1984' && t3.take.answer.startsWith('Still'), 'new subject → new take id, only the answer sent');
  check(((await admin.from('profile_takes_v2').select('id').eq('user_id', M.uid)).data ?? []).length === 1, 'still exactly one take per user');

  // 6. Removing the take's subject: refused without confirmation, atomic with it.
  const noConfirm = (await save(M.c, { p_books: [] })).data;
  const after1 = (await M.c.rpc('get_my_interests_v2')).data;
  check(noConfirm?.ok === false && noConfirm.error === 'take_subject_removed' && noConfirm.take?.subject_title === '1984'
    && after1.books.length === 1 && after1.take?.id === t3.take.id, 'remove subject, cancelled/unconfirmed → both kept');
  const confirm = (await save(M.c, { p_books: [] }, true)).data;
  check(confirm?.ok === true && confirm.take_removed === true && confirm.books.length === 0 && confirm.take === null, 'confirmed → subject and take removed together');
  const other = (await save(M.c, { p_activities: ['cooking'] })).data;
  check(other?.ok === true && other.take_removed === false, 'removing something unrelated never needs confirmation');

  // 7. Delete the take alone: selection stays.
  await take(M.c, 'activity', 'cooking', 'activity_favourite_part', 'Slow Sunday menemen.');
  const del = (await M.c.rpc('delete_take_v2')).data;
  const after2 = (await M.c.rpc('get_my_interests_v2')).data;
  check(del?.ok === true && del.deleted === true && after2.take === null && after2.activities.join() === 'cooking', 'delete take alone → activity kept');
  check((await V.c.rpc('get_profile_v2', { p_user: M.uid })).data?.take === null, 'viewer: no take → none (no empty card data)');

  // 8. Concurrency: parallel take saves + a confirmed subject removal stay consistent.
  await save(M.c, { p_activities: ['cooking', 'running'] });
  const burst = await Promise.all([
    rpcHttp(tokM, 'save_take_v2', { p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_favourite_part', p_answer: 'one' }),
    rpcHttp(tokM, 'save_take_v2', { p_subject_kind: 'activity', p_subject_id: 'cooking', p_question_id: 'activity_favourite_part', p_answer: 'two' }),
    rpcHttp(tokM, 'save_interests_v2', { p_interests: ['travel'], p_activities: ['cooking'], p_artists: [], p_books: [], p_screen: [], p_remove_take: true }),
    rpcHttp(tokM, 'save_take_v2', { p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_perfect_day', p_answer: 'three' }),
  ]);
  const fin = (await M.c.rpc('get_my_interests_v2')).data;
  const rows = (await admin.from('profile_takes_v2').select('subject_id').eq('user_id', M.uid)).data ?? [];
  check(burst.every((b) => b.status === 200) && rows.length <= 1 && (!fin.take || fin.activities.includes(fin.take.subject_id)),
    'parallel saves: at most one take, always tied to a saved selection');

  // 9. Authorization.
  await take(M.c, 'activity', 'cooking', 'activity_favourite_part', 'Menemen, no onions.');
  const mTake = (await admin.from('profile_takes_v2').select('*').eq('user_id', M.uid).single()).data;
  const xIns = await X.c.from('profile_takes_v2').insert({ user_id: M.uid, subject_kind: 'activity', subject_id: 'cooking', subject_title: 'Cooking', question_id: 'activity_favourite_part', answer: 'hijack' });
  const xUpd = await X.c.from('profile_takes_v2').update({ answer: 'hijack' }).eq('user_id', M.uid).select('id');
  const xDel = await X.c.from('profile_takes_v2').delete().eq('user_id', M.uid).select('id');
  const xSel = (await X.c.from('profile_takes_v2').select('id').eq('user_id', M.uid)).data ?? [];
  const xOnb = await X.c.from('onboarding_v2').update({ activities: ['gym'] }).eq('user_id', M.uid).select('user_id');
  const mNow = (await admin.from('profile_takes_v2').select('*').eq('user_id', M.uid).single()).data;
  check(!!xIns.error && (!!xUpd.error || (xUpd.data ?? []).length === 0) && (!!xDel.error || (xDel.data ?? []).length === 0) && xSel.length === 0
    && (!!xOnb.error || (xOnb.data ?? []).length === 0) && mNow.answer === mTake.answer && mNow.id === mTake.id,
    'third account: cannot insert / update / delete / read M’s take or change M’s selections');
  const xOwn = (await take(X.c, 'activity', 'cooking', 'activity_favourite_part', 'mine')).data;
  check(xOwn?.ok === false && xOwn.error === 'subject_not_selected' && (await admin.from('profile_takes_v2').select('answer').eq('user_id', M.uid).single()).data.answer === mTake.answer,
    'third account’s own save never reaches M (and needs its own selection)');
  const mDirect = await M.c.from('profile_takes_v2').update({ answer: 'direct' }).eq('user_id', M.uid).select('id');
  check(!!mDirect.error || (mDirect.data ?? []).length === 0, 'even the owner cannot bypass the server operations');
  const anon = await rpcHttp(null, 'save_take_v2', { p_subject_kind: 'activity', p_subject_id: 'cooking', p_question_id: 'activity_favourite_part', p_answer: 'x' });
  check(anon.status === 401, `signed out → refused (HTTP ${anon.status})`);
  const dTake = await D.c.rpc('save_take_v2', { p_subject_kind: 'activity', p_subject_id: 'cooking', p_question_id: 'activity_favourite_part', p_answer: 'x' });
  const dSave = await D.c.rpc('save_interests_v2', { p_interests: ['travel'], p_activities: [], p_artists: [], p_books: [], p_screen: [], p_remove_take: false });
  check(!!dTake.error && !!dSave.error && (await D.c.rpc('get_my_interests_v2')).data?.editable === false, 'draft applicant: not editable through these operations');

  // 10. Visibility: blocked viewer sees nothing.
  await M.c.from('blocks').insert({ blocker_id: M.uid, blocked_id: Y.uid });
  check((await Y.c.rpc('get_profile_v2', { p_user: M.uid })).data === null, 'blocked viewer: no profile, no take');

  // 11. Nothing else changed; the general lock is intact.
  const after = await snap();
  check(JSON.stringify(after.prompts) === JSON.stringify(before.prompts), 'standard prompts unchanged (same ids, slots, answers)');
  check(JSON.stringify(after.state) === JSON.stringify(before.state) && JSON.stringify(after.basics) === JSON.stringify(before.basics), 'application state and other answers unchanged');
  const locked = await M.c.rpc('save_onboarding_v2', { p_section: 'yourWorld', p_data: { interests: ['gym'] } });
  const lockedPrompts = await M.c.rpc('save_prompts_v2', { p_prompts: [] });
  check(/application_locked/.test(locked.error?.message ?? '') && /application_locked/.test(lockedPrompts.error?.message ?? ''), 'general onboarding / prompt lock still refuses accepted members');

  console.log(`smoke_takes_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
