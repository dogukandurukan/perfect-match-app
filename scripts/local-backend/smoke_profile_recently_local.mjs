// "Recently" on the LOCAL Supabase (real Postgres + Auth + PostgREST, real
// JWTs): get_my_recently_v2 / save_my_recently_v2 / get_profile_v2.recently.
//   node scripts/local-backend/smoke_profile_recently_local.mjs
// FRESH synthetic people only (tempa-local-rec-<tag>-*); never the phone
// accounts and never .test-backend.
//   M  member being edited (woman)      V  member who can see M (man)
//   X  member who cannot see M (woman, wants men)
//   D  draft applicant  S  submitted applicant  Z  suspended member
import crypto from 'node:crypto';
import { admin, env, ensureMember, fillApplication, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const mine = async (c) => (await c.rpc('get_my_recently_v2')).data;
const save = (c, f, version) => c.rpc('save_my_recently_v2', {
  p_book_title: f.bt ?? null, p_book_author: f.ba ?? null, p_song_title: f.st ?? null, p_song_artist: f.sa ?? null, p_song_url: f.su ?? null,
  p_expected_updated_at: version,
});
const rowOf = async (uid) => (await admin.from('profile_recently_v2').select('*').eq('user_id', uid).maybeSingle()).data;
const base = { city: 'İstanbul', district: 'Kadıköy' };

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-rec-${tag}-${k}@tempa-test.example.com`;
  const M = await ensureMember({ ...base, email: mail('m'), first: 'Mina', gender: 'woman', interested: ['men'], dob: '1994-04-04', look: LOOKS[1] });
  const V = await ensureMember({ ...base, email: mail('v'), first: 'Veli', gender: 'man', interested: ['women'], dob: '1992-02-02', look: LOOKS[5] });
  const X = await ensureMember({ ...base, email: mail('x'), first: 'Xena', gender: 'woman', interested: ['men'], dob: '1995-05-05', look: LOOKS[3] });
  const PRIVATE = { intent: 'casual', connection: ['gradual'] };
  await admin.from('connection_answers_v2').insert({ user_id: M.uid, version: 3, answers: PRIVATE });
  const state0 = (await admin.from('account_state_v2').select('*').eq('user_id', M.uid).single()).data;
  const onb0 = (await admin.from('onboarding_v2').select('*').eq('user_id', M.uid).single()).data;
  const seen = async (c = V.c) => (await c.rpc('get_profile_v2', { p_user: M.uid })).data;

  // Empty → nothing shown.
  const g0 = await mine(M.c);
  check(g0 && g0.book_title === null && g0.updated_at === null && (await seen())?.recently === null, 'nothing saved → own form empty, others see no Recently');

  // Book only.
  let r = (await save(M.c, { bt: '  The Book  ', ba: 'An Author' }, null)).data;
  check(r?.ok === true && r.recently.book_title === 'The Book' && r.recently.song_title === null, 'book saved (trimmed), no song');
  let v1 = r.recently.updated_at;
  let p = (await seen())?.recently;
  check(p?.book?.title === 'The Book' && p.book.author === 'An Author' && p.song === null, 'others see the book line only');

  // + song with a safe link.
  r = (await save(M.c, { bt: 'The Book', ba: 'An Author', st: 'A Song', sa: 'An Artist', su: 'https://open.spotify.com/track/abc123' }, v1)).data;
  check(r?.ok === true && r.recently.song_url === 'https://open.spotify.com/track/abc123', 'song + https music link saved');
  v1 = r.recently.updated_at;
  p = (await seen())?.recently;
  check(p?.song?.title === 'A Song' && p.song.artist === 'An Artist' && p.song.url === 'https://open.spotify.com/track/abc123', 'others see the song line with its link');
  const M2 = await signIn(mail('m'));
  check((await mine(M2.c))?.song_title === 'A Song' && (await mine(M2.c)).updated_at === v1, 'a fresh session (reopen) reads it back');

  // Refused values — row unchanged.
  const before = await rowOf(M.uid);
  const bad = [
    ['http link', { bt: 'The Book', st: 'A Song', su: 'http://open.spotify.com/track/x' }],
    ['look-alike host', { bt: 'The Book', st: 'A Song', su: 'https://open.spotify.com.evil.com/x' }],
    ['non-music host', { bt: 'The Book', st: 'A Song', su: 'https://example.com/song' }],
    ['credentials in link', { bt: 'The Book', st: 'A Song', su: 'https://u:p@open.spotify.com/x' }],
    ['@ in path', { bt: 'The Book', st: 'A Song', su: 'https://youtu.be/a@b' }],
    ['space in link', { bt: 'The Book', st: 'A Song', su: 'https://youtu.be/a b' }],
    ['javascript link', { bt: 'The Book', st: 'A Song', su: 'javascript:alert(1)' }],
    ['link without a song', { bt: 'The Book', su: 'https://youtu.be/abc' }],
    ['artist without a song', { bt: 'The Book', sa: 'X' }],
    ['author without a book', { st: 'A Song', ba: 'X' }],
    ['book title 121', { bt: 'x'.repeat(121) }],
    ['author 81', { bt: 'B', ba: 'y'.repeat(81) }],
    ['song title with a line break', { st: 'A\nSong' }],
  ];
  for (const [name, f] of bad) check((await save(M.c, f, v1)).data?.error === 'invalid_value', `${name} → refused`);
  check(JSON.stringify(await rowOf(M.uid)) === JSON.stringify(before), 'after the refusals the row is unchanged');

  // Concurrency.
  check((await save(M.c, { st: 'Other' }, null)).data?.error === 'profile_changed' && (await rowOf(M.uid)).song_title === 'A Song', 'stale version → profile_changed, nothing written');
  const both = await Promise.all([save(M.c, { bt: 'B1' }, v1), save(M.c, { bt: 'B2' }, v1)]);
  check(both.filter((x) => x.data?.ok).length === 1 && both.filter((x) => x.data?.error === 'profile_changed').length === 1, 'two simultaneous saves from the same version → one wins');
  const cur = await mine(M.c);
  const upd = (await M.c.rpc('update_member_profile_v2', { p_changes: { height_cm: 181 }, p_expected: { height_cm: 170 } })).data;
  check(upd?.ok === true && (await mine(M.c)).updated_at === cur.updated_at, 'an Edit profile (Package 1) save doesn’t touch Recently');

  // Remove one part, then everything.
  r = (await save(M.c, { st: 'A Song', sa: 'An Artist' }, cur.updated_at)).data;
  p = (await seen())?.recently;
  check(r?.ok === true && p?.book === null && p.song?.title === 'A Song' && p.song.url === null, 'book removed → only the song line; link removed → not a link');
  r = (await save(M.c, {}, r.recently.updated_at)).data;
  check(r?.ok === true && (await rowOf(M.uid)) === null && (await seen())?.recently === null && (await mine(M.c)).updated_at === null, 'everything removed → row gone, others see no Recently');
  check((await save(M.c, { bt: 'Again' }, null)).data?.ok === true, 'can add again after removing');

  // Visibility + permissions.
  check((await seen(X.c)) === null, 'someone who may not see the profile gets nothing (no Recently either)');
  const D = await signIn(mail('d'));
  await fillApplication(D.c, D.uid, { ...base, first: 'Deniz', gender: 'woman', interested: ['men'], dob: '1996-06-06', look: LOOKS[2] });
  check(/not_member/.test((await save(D.c, { bt: 'X' }, null)).error?.message ?? ''), 'draft applicant → refused');
  const S = await signIn(mail('s'));
  await fillApplication(S.c, S.uid, { ...base, first: 'Seda', gender: 'woman', interested: ['men'], dob: '1993-03-03', look: LOOKS[4] });
  await S.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(/not_member/.test((await save(S.c, { bt: 'X' }, null)).error?.message ?? ''), 'submitted applicant → refused');
  const Z = await ensureMember({ ...base, email: mail('z'), first: 'Zeynep', gender: 'woman', interested: ['men'], dob: '1991-01-01', look: LOOKS[0] });
  await admin.from('account_state_v2').update({ membership_status: 'suspended' }).eq('user_id', Z.uid);
  check(/not_member/.test((await save(Z.c, { bt: 'X' }, null)).error?.message ?? ''), 'suspended member → refused');
  const mBefore = await rowOf(M.uid);
  check((await save(X.c, { bt: 'Xena’s book' }, null)).data?.ok === true && JSON.stringify(await rowOf(M.uid)) === JSON.stringify(mBefore), 'a member only changes their own Recently');
  const direct = await V.c.from('profile_recently_v2').select('*');
  const forge = await V.c.from('profile_recently_v2').insert({ user_id: M.uid, book_title: 'forged' });
  check((!!direct.error || (direct.data ?? []).length === 0) && !!forge.error, 'the table can’t be read or written directly');
  const anon = await fetch(`${env.url}/rest/v1/rpc/get_my_recently_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: '{}' });
  check(anon.status >= 400, 'signed out → refused');
  check(!!(await V.c.rpc('v2_recently_public', { p_user: M.uid })).error && !!(await V.c.rpc('v2_is_music_url', { p_url: 'https://youtu.be/x' })).error, 'helpers not callable by apps');

  // Nothing else changed.
  const state1 = (await admin.from('account_state_v2').select('*').eq('user_id', M.uid).single()).data;
  const onb1 = (await admin.from('onboarding_v2').select('*').eq('user_id', M.uid).single()).data;
  const priv = (await admin.from('connection_answers_v2').select('answers').eq('user_id', M.uid).eq('version', 3).single()).data?.answers;
  check(JSON.stringify({ ...state1, updated_at: 0 }) === JSON.stringify({ ...state0, updated_at: 0 }), 'application / membership state unchanged');
  check(JSON.stringify({ ...onb1, height_cm: 0, updated_at: 0 }) === JSON.stringify({ ...onb0, height_cm: 0, updated_at: 0 }), 'onboarding answers unchanged (apart from the Package 1 height save above)');
  check(JSON.stringify(priv) === JSON.stringify(PRIVATE) && !/gradual|connection_answers/.test(JSON.stringify(await seen())), 'private preferences untouched and not on the profile');

  console.log(`smoke_profile_recently_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
