// Conversation starters (0–3 per member) + "Your interests" on the LOCAL
// Supabase (real Postgres + Auth + PostgREST, real JWTs), synthetic only:
//   node scripts/local-backend/smoke_takes_local.mjs
// Needs: setup.mjs (+ 20261014090000_v2_interests_takes + 20261015090000_v2_takes_multi)
// and seed.mjs. Every run creates FRESH synthetic people (tempa-local-take-<tag>-*).
//   M  accepted member (man)       — edits interests + his starters
//   V  eligible viewer (woman)     — sees M's starters on his profile
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

const BOOK = { kind: 'book', source: 'openlibrary', id: 'ol:work:OL1168083W', title: '1984', subtitle: 'George Orwell' };
const FILM = { kind: 'screen', source: 'wikidata', id: 'wd:Q13417189', title: 'Interstellar', subtitle: '2014 · Movie' };
const ARTIST = { kind: 'artist', source: 'musicbrainz', id: 'mb:artist:tarkan-test', title: 'Tarkan' };
const snapRow = (t) => JSON.stringify({ id: t.id, position: t.position, s: `${t.subject_kind}:${t.subject_id}`, q: t.question_id, a: t.answer, u: t.updated_at });

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-take-${tag}-${k}@tempa-test.example.com`;
  const woman = (k, n) => ({ email: mail(k), first: `W${k}`, gender: 'woman', interested: ['men'], dob: `199${n}-03-1${n}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[n] });

  // Takes that existed before this run (incl. ones kept through the multi
  // migration) must come out of the run untouched.
  const others0 = ((await admin.from('profile_takes_v2').select('*')).data ?? []).map(snapRow).sort();

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
  const mine = async (c = M.c) => (await c.rpc('get_my_interests_v2')).data;
  const rows = async () => (await admin.from('profile_takes_v2').select('*').eq('user_id', M.uid).order('position')).data ?? [];
  const save = (c, over = {}, remove = false) => c.rpc('save_interests_v2', {
    p_interests: ['travel', 'music'], p_activities: ['running', 'cooking'], p_artists: [ARTIST], p_books: [BOOK], p_screen: [FILM], ...over, p_remove_take: remove });
  const take = (c, id, kind, subj, q, a) => c.rpc('save_take_v2', { p_take_id: id, p_subject_kind: kind, p_subject_id: subj, p_question_id: q, p_answer: a });

  // 1. Selections.
  const s0 = await mine();
  check(s0?.editable === true && Array.isArray(s0.takes) && s0.takes.length === 0, 'accepted member: editable, no starters yet');
  check((await save(M.c)).data?.ok === true, 'selections saved (activities, book, film, artist)');

  // 2. Three different starters, each its own row; validation.
  const t1 = (await take(M.c, null, 'activity', 'running', 'activity_favourite_part', 'A slow seaside run, then coffee.')).data;
  const t2 = (await take(M.c, null, 'book', BOOK.id, 'book_why', 'Still the most unsettling ending.')).data;
  const t3 = (await take(M.c, null, 'artist', ARTIST.id, 'artist_first_song', 'Kuzu Kuzu, obviously.')).data;
  check([t1, t2, t3].every((r) => r?.ok) && new Set([t1, t2, t3].map((r) => r.take.id)).size === 3 && [t1, t2, t3].map((r) => r.take.position).join() === '1,2,3',
    'three starters added: three ids, positions 1–3 (adding never overwrites)');
  const bad = [
    (await take(M.c, null, 'activity', 'cooking', 'activity_favourite_part', 'fourth')).data?.error,
    (await take(M.c, null, 'activity', 'running', 'activity_favourite_part', 'again')).data?.error,
    (await take(M.c, t2.take.id, 'activity', 'running', 'activity_favourite_part', 'steal')).data?.error,
    (await take(M.c, null, 'activity', 'hiking', 'activity_favourite_part', 'x')).data?.error,
    (await take(M.c, t1.take.id, 'activity', 'running', 'activity_favourite_part', 'a'.repeat(181))).data?.error,
  ];
  check(bad.join() === 'limit_reached,subject_taken,subject_taken,subject_not_selected,invalid_answer', '4th refused; same subject refused (add or change); unselected / 181 chars refused');
  check((await rows()).length === 3, 'still exactly three rows');

  // 3. New session reads them in order; the viewer sees them in the same order.
  const r1 = await mine((await signIn(mail('m'))).c);
  check(r1.takes.map((t) => t.subject_id).join() === `running,${BOOK.id},${ARTIST.id}` && r1.takes.map((t) => t.position).join() === '1,2,3', 'new session: three starters, stable order');
  const pv = (await V.c.rpc('get_profile_v2', { p_user: M.uid })).data;
  check(pv?.takes?.length === 3 && pv.takes.map((t) => t.subject_title).join() === 'Running,1984,Tarkan' && !('id' in pv.takes[0]) && !('take' in pv), 'viewer: three starters in order, no internal id');

  // 4. Edit one → same id; the others untouched.
  const pre = (await rows()).map(snapRow);
  const e2 = (await take(M.c, t2.take.id, 'book', BOOK.id, 'book_stayed', 'The last page.')).data;
  const post = (await rows()).map(snapRow);
  check(e2?.ok && e2.take.id === t2.take.id && e2.take.position === 2 && post[0] === pre[0] && post[2] === pre[2] && post[1] !== pre[1], 'edit one: same id + position, others unchanged');

  // 5. Change one's subject → new id, same position, only the sent text; others untouched.
  const c1 = (await take(M.c, t1.take.id, 'activity', 'cooking', 'activity_perfect_day', 'Slow Sunday menemen.')).data;
  const post2 = (await rows()).map(snapRow);
  check(c1?.ok && c1.take.id !== t1.take.id && c1.take.position === 1 && c1.take.answer === 'Slow Sunday menemen.' && post2[1] === post[1] && post2[2] === post[2],
    'change subject: new id in the same position, old text not carried, others unchanged');

  // 6. Delete one → others untouched; a new one fills the free position.
  const pre3 = (await rows()).map(snapRow);
  const del = (await M.c.rpc('delete_take_v2', { p_take_id: t3.take.id })).data;
  const post3 = (await rows()).map(snapRow);
  check(del?.ok === true && post3.length === 2 && post3[0] === pre3[0] && post3[1] === pre3[1] && (await mine()).artists.length === 1, 'delete one: others and the artist stay');
  const t4 = (await take(M.c, null, 'screen', FILM.id, 'screen_scene', 'The docking scene.')).data;
  check(t4?.ok && t4.take.position === 3, 'new starter takes the free position 3');

  // 7. Removing ONE subject: refused until confirmed; then only that starter goes.
  const pre4 = (await rows()).map(snapRow);
  const noConfirm = (await save(M.c, { p_books: [] })).data;
  check(noConfirm?.ok === false && noConfirm.error === 'take_subject_removed' && noConfirm.takes?.length === 1 && noConfirm.takes[0].subject_title === '1984'
    && JSON.stringify((await rows()).map(snapRow)) === JSON.stringify(pre4) && (await mine()).books.length === 1, 'remove book, unconfirmed / cancelled → book + all starters kept');
  const conf = (await save(M.c, { p_books: [] }, true)).data;
  const post4 = (await rows()).map(snapRow);
  check(conf?.ok === true && conf.takes_removed === 1 && conf.books.length === 0 && post4.length === 2 && post4[0] === pre4[0] && post4[1] === pre4[2],
    'confirmed → book and ONLY its starter removed together; the other two kept');

  // 8. Concurrency: limits hold under parallel requests.
  await save(M.c, { p_books: [BOOK] });
  const race = await Promise.all([
    rpcHttp(tokM, 'save_take_v2', { p_take_id: null, p_subject_kind: 'book', p_subject_id: BOOK.id, p_question_id: 'book_why', p_answer: 'a' }),
    rpcHttp(tokM, 'save_take_v2', { p_take_id: null, p_subject_kind: 'artist', p_subject_id: ARTIST.id, p_question_id: 'artist_when', p_answer: 'b' }),
    rpcHttp(tokM, 'save_take_v2', { p_take_id: null, p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_favourite_part', p_answer: 'c' }),
    rpcHttp(tokM, 'save_take_v2', { p_take_id: null, p_subject_kind: 'book', p_subject_id: BOOK.id, p_question_id: 'book_stayed', p_answer: 'd' }),
  ]);
  const after8 = await rows();
  check(race.every((r) => r.status === 200) && race.filter((r) => r.json?.ok).length === 1 && after8.length === 3
    && new Set(after8.map((t) => `${t.subject_kind}:${t.subject_id}`)).size === 3 && new Set(after8.map((t) => t.position)).size === 3,
    '4 parallel adds with 1 free slot → exactly one added; never 4, never a duplicate subject or position');
  await M.c.rpc('delete_take_v2', { p_take_id: after8[2].id });
  const same = await Promise.all([1, 2, 3].map(() =>
    rpcHttp(tokM, 'save_take_v2', { p_take_id: null, p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_favourite_part', p_answer: 'same' })));
  check(same.filter((r) => r.json?.ok).length <= 1 && (await rows()).filter((t) => t.subject_id === 'running').length <= 1, 'parallel adds for the same subject → at most one');

  // 9. Authorization.
  const mRows = (await rows()).map(snapRow);
  const target = (await rows())[0];
  // X selects the SAME subject, so the request reaches the ownership check.
  await save(X.c, { p_books: [BOOK] });
  const xDel = (await X.c.rpc('delete_take_v2', { p_take_id: target.id })).data;
  const xEdit = (await take(X.c, target.id, target.subject_kind, target.subject_id, target.question_id, 'hijack')).data;
  const xIns = await X.c.from('profile_takes_v2').insert({ user_id: M.uid, position: 3, subject_kind: 'activity', subject_id: 'gym', subject_title: 'Gym', question_id: 'activity_favourite_part', answer: 'hijack' });
  const xUpd = await X.c.from('profile_takes_v2').update({ answer: 'hijack' }).eq('user_id', M.uid).select('id');
  const xSel = (await X.c.from('profile_takes_v2').select('id').eq('user_id', M.uid)).data ?? [];
  const xOnb = await X.c.from('onboarding_v2').update({ activities: ['gym'] }).eq('user_id', M.uid).select('user_id');
  check(xDel?.error === 'not_found' && xEdit?.error === 'not_found' && !!xIns.error && (!!xUpd.error || (xUpd.data ?? []).length === 0) && xSel.length === 0
    && (!!xOnb.error || (xOnb.data ?? []).length === 0) && JSON.stringify((await rows()).map(snapRow)) === JSON.stringify(mRows),
    'third account: cannot delete / edit / insert / read M’s starters or change M’s selections');
  const mDirect = await M.c.from('profile_takes_v2').update({ answer: 'direct' }).eq('user_id', M.uid).select('id');
  check(!!mDirect.error || (mDirect.data ?? []).length === 0, 'even the owner cannot bypass the server operations');
  const anon = await rpcHttp(null, 'delete_take_v2', { p_take_id: target.id });
  check(anon.status === 401, `signed out → refused (HTTP ${anon.status})`);
  // Since D93 (2026-10-16) an applicant may write their OWN starters while
  // the application is editable — but only about their own saved selection;
  // the members-only "Your interests" screen stays closed to them.
  const dTake = await D.c.rpc('save_take_v2', { p_take_id: null, p_subject_kind: 'activity', p_subject_id: 'running', p_question_id: 'activity_favourite_part', p_answer: 'x' });
  const dSel = await D.c.rpc('save_interests_v2', { p_interests: ['travel'], p_activities: ['running'], p_artists: [], p_books: [], p_screen: [], p_remove_take: false });
  check(dTake.data?.error === 'subject_not_selected' && !!dSel.error && (await D.c.rpc('get_my_interests_v2')).data?.editable === false,
    'draft applicant: no starter without an own saved selection; members-only screen closed');

  // 10. Visibility: blocked viewer sees nothing; no starters → empty list.
  await M.c.from('blocks').insert({ blocker_id: M.uid, blocked_id: Y.uid });
  check((await Y.c.rpc('get_profile_v2', { p_user: M.uid })).data === null, 'blocked viewer: no profile, no starters');
  check(((await X.c.rpc('get_profile_v2', { p_user: X.uid })).data?.takes ?? null)?.length === 0, 'no starters → empty list (nothing to show)');

  // 11. Nothing else changed; the general lock is intact; others' takes untouched.
  const after = await snap();
  check(JSON.stringify(after.prompts) === JSON.stringify(before.prompts), 'standard prompts unchanged (same ids, slots, answers)');
  check(JSON.stringify(after.state) === JSON.stringify(before.state) && JSON.stringify(after.basics) === JSON.stringify(before.basics), 'application state and other answers unchanged');
  const locked = await M.c.rpc('save_onboarding_v2', { p_section: 'yourWorld', p_data: { interests: ['gym'] } });
  const lockedPrompts = await M.c.rpc('save_prompts_v2', { p_prompts: [] });
  check(/application_locked/.test(locked.error?.message ?? '') && /application_locked/.test(lockedPrompts.error?.message ?? ''), 'general onboarding / prompt lock still refuses accepted members');
  const othersNow = ((await admin.from('profile_takes_v2').select('*').neq('user_id', M.uid)).data ?? []).map(snapRow).sort();
  check(others0.every((r) => othersNow.includes(r)), `earlier members’ starters (${others0.length}) untouched`);

  console.log(`smoke_takes_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
