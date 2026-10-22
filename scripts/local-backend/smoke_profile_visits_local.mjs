// Profile visits on the LOCAL Supabase (real Postgres + Auth + PostgREST, real
// JWTs): record_profile_visit_v2 / ack_profile_visits_notice_v2 /
// get_my_profile_visits_v2.
//   node scripts/local-backend/smoke_profile_visits_local.mjs
// FRESH synthetic people only (tempa-local-visit-<tag>-*); never the phone
// accounts. P and H are kept for the phone check (.test-backend/profile-visits.json).
//   H  host (woman member)           V  visitor (man member, eligible for H)
//   X  another man member (cannot view V)   H2 a second host
//   D  draft applicant                       P  phone visitor (man, premium, has a like from H)
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
const rec = async (c, uid) => (await c.rpc('record_profile_visit_v2', { p_user: uid })).data;
const mine = async (c) => (await c.rpc('get_my_profile_visits_v2')).data;
const row = async (v, h) => (await admin.from('profile_visits_v2').select('*').eq('visitor_id', v).eq('visited_id', h).maybeSingle()).data;
const premium = (uid, on) => admin.from('profiles').update({ is_premium: on }).eq('id', uid);

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-visit-${tag}-${k}@tempa-test.example.com`;
  const base = { city: 'İstanbul', district: 'Kadıköy' };
  const H = await ensureMember({ ...base, email: mail('h'), first: 'Hale', gender: 'woman', interested: ['men'], dob: '1993-05-13', look: LOOKS[1] });
  const V = await ensureMember({ ...base, email: mail('v'), first: 'Vedat', gender: 'man', interested: ['women'], dob: '1992-02-02', look: LOOKS[5] });
  const X = await ensureMember({ ...base, email: mail('x'), first: 'Xavi', gender: 'man', interested: ['women'], dob: '1991-03-03', look: LOOKS[4] });
  const P = await ensureMember({ ...base, email: mail('p'), first: 'Pars', gender: 'man', interested: ['women'], dob: '1994-04-04', look: LOOKS[0] });
  const D = await signIn(mail('d'));
  await fillApplication(D.c, D.uid, { ...base, first: 'Doruk', gender: 'man', interested: ['women'], dob: '1995-04-04', look: LOOKS[2] });
  await premium(H.uid, false);

  // Notice first: nothing is recorded before the visitor acknowledged it.
  const n0 = await rec(V.c, H.uid);
  check(n0?.recorded === false && n0.reason === 'notice_required' && !(await row(V.uid, H.uid)), 'before the notice is acknowledged → notice_required, nothing written');
  check((await mine(V.c))?.notice_ack === false, 'notice_ack reported false before acknowledging');
  check((await V.c.rpc('ack_profile_visits_notice_v2')).data?.ok === true && (await mine(V.c)).notice_ack === true, 'acknowledging the notice');

  // First visit.
  const r1 = await rec(V.c, H.uid);
  const row1 = await row(V.uid, H.uid);
  check(r1?.recorded === true && r1.again === false && row1?.visits === 1, 'first full-profile open → recorded, "Viewed your profile"');

  // Repeats inside the window: no change, no fake "Visited again".
  const repeats = await Promise.all([rec(V.c, H.uid), rec(V.c, H.uid), rec(V.c, H.uid)]);
  const row1b = await row(V.uid, H.uid);
  check(repeats.every((x) => x?.recorded === false && x.reason === 'within_window') && row1b.visits === 1 && row1b.last_visit_at === row1.last_visit_at,
    'reopen / repeated requests within 24 h → within_window, row unchanged');

  // Non-premium host: only how many people.
  const h0 = await mine(H.c);
  check(h0?.count === 1 && h0.premium === false && Array.isArray(h0.visits) && h0.visits.length === 0, 'non-premium host sees only the count (1), no identities');

  // Premium host: the person, first-visit label.
  await premium(H.uid, true);
  const h1 = await mine(H.c);
  const item = h1?.visits?.[0];
  check(h1.count === 1 && item?.user_id === V.uid && item.first_name === 'Vedat' && item.again === false && item.photo_path, 'premium host sees the visitor (name, photo) with "Viewed your profile"');
  const keys = Object.keys(item ?? {}).sort().join();
  check(keys === 'again,age,city,first_name,last_visit_at,photo_path,user_id', `no exact visit count is returned per person (only again yes/no) [${keys}]`);

  // A separate visit after the window (test setup moves the last visit back).
  await admin.from('profile_visits_v2').update({ last_visit_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() }).eq('visitor_id', V.uid).eq('visited_id', H.uid);
  const r2 = await rec(V.c, H.uid);
  const h2 = await mine(H.c);
  check(r2?.recorded === true && r2.again === true && h2.visits[0]?.again === true && h2.count === 1, 'a visit after 24 h → "Visited again" (still one row / one person)');
  const r3 = await rec(V.c, H.uid);
  check(r3?.reason === 'within_window' && (await row(V.uid, H.uid)).visits === 2, 'straight after that: within_window again');

  // Not counted.
  check((await rec(V.c, V.uid))?.reason === 'own', 'own profile → not a visit');
  await X.c.rpc('ack_profile_visits_notice_v2');
  check((await rec(X.c, V.uid))?.reason === 'not_visible' && !(await row(X.uid, V.uid)), 'a profile the visitor cannot view (ineligible pair) → not_visible');
  check((await rec(D.c, H.uid))?.reason === 'not_member', 'a draft applicant cannot record visits');
  check((await mine(D.c))?.member === false && (await mine(D.c)).count === 0, 'a draft applicant reads no visits');

  // Visits are not likes / matches / notifications, and not in the Activity badge.
  const likes = (await admin.from('likes').select('id').or(`and(liker_id.eq.${V.uid},likee_id.eq.${H.uid}),and(liker_id.eq.${H.uid},likee_id.eq.${V.uid})`)).data ?? [];
  const matches = (await admin.from('matches').select('id, status').or(`and(user_a_id.eq.${V.uid},user_b_id.eq.${H.uid}),and(user_a_id.eq.${H.uid},user_b_id.eq.${V.uid})`)).data ?? [];
  const notes = (await admin.from('notifications').select('id').eq('user_id', H.uid)).data ?? [];
  const act = (await H.c.rpc('get_my_activity_v2')).data;
  check(likes.length === 0 && !matches.some((m) => m.status === 'accepted') && notes.length === 0, 'no like, match or notification created');
  check(act && (act.pending_count ?? act.pending?.length ?? 0) === 0 && (act.pending ?? []).length === 0, 'Activity likes (badge source) unchanged: 0');

  // Isolation.
  const xs = await mine(X.c);
  check(xs.count === 0 && xs.visits.length === 0, 'another member does not see H’s visitors');
  const direct = await X.c.from('profile_visits_v2').select('*');
  check(!!direct.error || (direct.data ?? []).length === 0, 'the table is not readable directly');
  const forge = await X.c.from('profile_visits_v2').insert({ visitor_id: V.uid, visited_id: X.uid });
  check(!!forge.error && !(await row(V.uid, X.uid)), 'nobody can write a visit for someone else (direct insert refused)');
  const anon = await fetch(`${env.url}/rest/v1/rpc/get_my_profile_visits_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: '{}' });
  const anonRec = await fetch(`${env.url}/rest/v1/rpc/record_profile_visit_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user: H.uid }) });
  check(anon.status >= 400 && anonRec.status >= 400, 'signed out → refused (read and record)');

  // Block: the visitor disappears from the host's list; no new visits either way.
  const blk = await H.c.from('blocks').insert({ blocker_id: H.uid, blocked_id: V.uid });
  const hb = await mine(H.c);
  check(!blk.error && hb.count === 0 && hb.visits.length === 0, 'host blocks the visitor → not listed (count 0)');
  await admin.from('profile_visits_v2').update({ last_visit_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() }).eq('visitor_id', V.uid).eq('visited_id', H.uid);
  check((await rec(V.c, H.uid))?.reason === 'not_visible', 'a blocked pair cannot record a visit');

  // Deleted / suspended visitor → not listed (suspension via the existing account state).
  const H2 = await ensureMember({ ...base, email: mail('h2'), first: 'Hilal', gender: 'woman', interested: ['men'], dob: '1993-06-06', look: LOOKS[3] });
  await premium(H2.uid, true);
  await X.c.rpc('ack_profile_visits_notice_v2');
  const xr = await rec(X.c, H2.uid);
  check(xr?.recorded === true && (await mine(H2.c)).count === 1, 'setup: X visits H2');
  await admin.from('profiles').update({ deleted_at: new Date().toISOString(), is_hidden: true }).eq('id', X.uid);
  check((await mine(H2.c)).count === 0, 'a deleted visitor is not listed');

  // Phone setup: H likes P's photo (P premium sees it in Activity → opens the
  // full profile → notice → a visit H then sees). P has not acknowledged yet.
  await premium(P.uid, true);
  const pp = (await H.c.rpc('get_profile_v2', { p_user: P.uid })).data;
  await H.c.from('blocks').delete().eq('blocker_id', H.uid).eq('blocked_id', V.uid);
  const like = (await H.c.rpc('send_like_v2', { p_likee: P.uid, p_target_type: 'photo', p_target_id: pp?.photos?.[0]?.id, p_note: null, p_request_id: crypto.randomUUID() })).data;
  check(like?.ok === true, 'phone setup: H likes P');
  fs.mkdirSync(path.join(repo, '.test-backend'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(repo, '.test-backend', 'profile-visits.json'), JSON.stringify({ visitor: mail('p'), host: mail('h') }), { mode: 0o600 });

  console.log(`smoke_profile_visits_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  console.log(`phone accounts: visitor ${mail('p')} · host ${mail('h')}`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
