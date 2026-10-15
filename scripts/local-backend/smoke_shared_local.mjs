// "Both into this" (D101) on real local services with FRESH synthetic members
// (tempa-local-shr-<tag>-*): the viewer's own get_my_interests_v2 + the other
// person's get_profile_v2, through the same mapping + rule the app uses.
//   node scripts/local-backend/smoke_shared_local.mjs
import { admin, ensureMember, LOOKS } from './_local.mjs';

const { publicProfileFromServer } = await import('../../lib/onboardingV2/serverMapping.ts');
const { sharedHighlights } = await import('../../lib/interests/shared.ts');

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const it = (kind, source, id, title) => ({ kind, source, id, title });
const DUNE_A = it('book', 'openlibrary', 'ol:work:SHR-A', 'Dune');
const DUNE_B = it('book', 'openlibrary', 'ol:work:SHR-B', 'Dune');
const EMMA = it('book', 'openlibrary', 'ol:work:SHR-E', 'Emma');
const TYPED = it('book', 'custom', 'custom:book:1984', '1984');
const FILM = it('screen', 'wikidata', 'wd:SHR-1', 'Interstellar');

/** Exactly the app's composition (useSharedMarks): own selections ∩ their shown profile. */
async function marks(viewer, targetId) {
  const mine = (await viewer.c.rpc('get_my_interests_v2')).data;
  const row = (await viewer.c.rpc('get_profile_v2', { p_user: targetId })).data;
  if (!mine || !row) return { profile: !!row, keys: [] };
  if (targetId === viewer.uid) return { profile: true, keys: [] };
  const them = publicProfileFromServer(row, new Map());
  return { profile: true, keys: sharedHighlights(mine, them, (them.takes ?? []).map((t) => ({ kind: t.kind, id: t.subjectId }))) };
}

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-shr-${tag}-${k}@tempa-test.example.com`;
  const others0 = JSON.stringify(((await admin.from('profile_takes_v2').select('id, answer, updated_at')).data ?? []).sort((a, b) => a.id.localeCompare(b.id)));

  const T = await ensureMember({ email: mail('t'), first: 'Tara', gender: 'woman', interested: ['men'], dob: '1994-03-03', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[1] });
  const V = await ensureMember({ email: mail('v'), first: 'Vedat', gender: 'man', interested: ['women'], dob: '1993-04-04', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const Y = await ensureMember({ email: mail('y'), first: 'Yusuf', gender: 'man', interested: ['women'], dob: '1992-05-05', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[4] });
  const sel = (c, s) => c.rpc('save_interests_v2', { p_interests: s.interests, p_activities: s.activities, p_artists: [], p_books: s.books, p_screen: s.screen, p_remove_take: false });

  check(!(await sel(T.c, { interests: ['travel', 'music', 'food'], activities: ['yoga', 'running'], books: [TYPED, DUNE_A, EMMA], screen: [FILM] })).error, 'target saves selections');
  const tk = (await T.c.rpc('save_take_v2', { p_take_id: null, p_subject_kind: 'screen', p_subject_id: FILM.id, p_question_id: 'screen_why', p_answer: 'The docking scene.' })).data;
  check(tk?.ok === true, 'target has a conversation starter about the film');
  const takeBefore = JSON.stringify((await admin.from('profile_takes_v2').select('*').eq('user_id', T.uid)).data);
  check(!(await sel(V.c, { interests: ['music', 'food'], activities: ['running'], books: [TYPED, DUNE_B, EMMA], screen: [FILM] })).error, 'viewer saves selections');

  // 1. Exact intersection, priority, max 2, starter subject skipped.
  const m1 = await marks(V, T.uid);
  check(m1.profile && m1.keys.join() === `book:openlibrary:${EMMA.id},activity:running`,
    'marks: Emma (same id) + Running; the typed “1984” and a different “Dune” id are not shared; the film is the starter’s subject → not repeated');
  check(JSON.stringify((await marks(V, T.uid)).keys) === JSON.stringify(m1.keys), 'deterministic on a re-read');

  // 2. Own profile: nothing.
  check((await marks(V, V.uid)).keys.length === 0, 'own profile → no marks');

  // 3. Viewer changes selections → the next open shows the current result.
  await sel(V.c, { interests: ['music', 'food'], activities: [], books: [TYPED, DUNE_B], screen: [FILM] });
  const m2 = await marks(V, T.uid);
  check(m2.keys.join() === 'interest:music,interest:food', 'after removing Emma + Running → broad interests (their order)');
  await sel(V.c, { interests: ['sports'], activities: [], books: [], screen: [] });
  check((await marks(V, T.uid)).keys.length === 0, 'nothing shared any more → nothing shown');
  await sel(V.c, { interests: ['music'], activities: ['yoga'], books: [DUNE_A], screen: [] });
  check((await marks(V, T.uid)).keys.join() === `book:openlibrary:${DUNE_A.id},activity:yoga`, 'adding the same Dune id + Yoga → marked again');

  // 4. Another viewer's result is their own (no carry-over between accounts).
  await sel(Y.c, { interests: ['travel'], activities: [], books: [], screen: [] });
  check((await marks(Y, T.uid)).keys.join() === 'interest:travel', 'another account: only its own intersection');

  // 5. Blocked → no profile, nothing to compare.
  await T.c.from('blocks').insert({ blocker_id: T.uid, blocked_id: Y.uid });
  const mb = await marks(Y, T.uid);
  check(!mb.profile && mb.keys.length === 0, 'blocked viewer: no profile, no marks');

  // 6. Read-only for everyone else's data.
  check(JSON.stringify((await admin.from('profile_takes_v2').select('*').eq('user_id', T.uid)).data) === takeBefore, 'target’s conversation starter unchanged');
  const othersNow = JSON.stringify(((await admin.from('profile_takes_v2').select('id, answer, updated_at')).data ?? []).filter((r) => JSON.parse(others0).some((o) => o.id === r.id)).sort((a, b) => a.id.localeCompare(b.id)));
  check(othersNow === others0, 'earlier members’ starters unchanged');

  console.log(`smoke_shared_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
