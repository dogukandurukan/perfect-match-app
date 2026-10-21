// V2 Activity tab badge on the LOCAL Supabase (real Postgres + Auth +
// PostgREST, real JWTs), with the app's count rule (lib/activity/feed.ts):
//   node scripts/local-backend/smoke_activity_badge_local.mjs
// FRESH synthetic people only (tempa-local-badge-<tag>-*); never the phone
// accounts. R (premium in local data) and R2 (not premium) receive likes from
// L1…L4. The badge = unseen pending likes R can see.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { admin, ensureMember, LOOKS, repo, signIn } from './_local.mjs';

const require = createRequire(import.meta.url);
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req.startsWith('@/')) req = path.join(repo, req.slice(2)); return orig.call(this, req, ...a); };
require(path.join(repo, 'node_modules/sucrase/register/ts'));
const { parseActivity, unseenLikeCount } = require(path.join(repo, 'lib/activity/feed.ts'));

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};

async function like(from, to, note) {
  const prof = (await from.c.rpc('get_profile_v2', { p_user: to.uid })).data;
  const today = (await from.c.rpc('get_daily_picks_v2')).data;
  const args = { p_likee: to.uid, p_target_type: 'photo', p_target_id: prof.photos[0].id, p_note: note, p_request_id: crypto.randomUUID() };
  if (today?.pick?.user_id === to.uid) args.p_source = 'daily_pick';
  return (await from.c.rpc('send_like_v2', args)).data;
}
const activity = async (c) => parseActivity((await c.rpc('get_my_activity_v2')).data);
const badge = async (c) => unseenLikeCount(await activity(c));
const likeIdOf = async (from, to) => (await admin.from('likes').select('id').eq('liker_id', from.uid).eq('likee_id', to.uid).single()).data.id;

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-badge-${tag}-${k}@tempa-test.example.com`;
  const woman = (k, first, i) => ({ email: mail(k), first, gender: 'woman', interested: ['men'], dob: `199${i}-05-1${i}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[i] });
  const man = (k, first, i) => ({ email: mail(k), first, gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[i] });
  const L1 = await ensureMember(woman('l1', 'Ada', 1));
  const L2 = await ensureMember(woman('l2', 'Bade', 2));
  const L3 = await ensureMember(woman('l3', 'Cem', 3));
  const L4 = await ensureMember(woman('l4', 'Deniz', 4));
  const R = await ensureMember(man('r', 'Rec', 5));
  const R2 = await ensureMember(man('r2', 'Recnp', 0));
  await admin.from('profiles').update({ is_premium: true }).eq('id', R.uid); // local data, as the other Activity tests

  check((await badge(R.c)) === 0, 'no likes → 0 (no badge)');
  for (const L of [L1, L2, L3]) await like(L, R, null);
  check((await badge(R.c)) === 3, 'three pending likes → 3');
  await activity(R.c);
  await activity(R.c);
  check((await badge(R.c)) === 3, 'loading the Activity list (twice) marks nothing seen');

  const l1 = await likeIdOf(L1, R);
  const stranger = (await L2.c.rpc('mark_like_seen_v2', { p_like: l1 })).data;
  check(stranger?.ok === false && (await badge(R.c)) === 3, 'someone else cannot mark R’s like seen');
  const seen = (await R.c.rpc('mark_like_seen_v2', { p_like: l1 })).data;
  check(seen?.ok === true && (await badge(R.c)) === 2, 'R opens L1’s profile → seen → 2');

  const acc = (await R.c.rpc('accept_like_v2', { p_like: await likeIdOf(L2, R) })).data;
  check(acc?.ok === true && (await badge(R.c)) === 1, 'Match & chat with L2 → no longer pending → 1');

  const blk = await R.c.from('blocks').insert({ blocker_id: R.uid, blocked_id: L3.uid });
  check(!blk.error && (await badge(R.c)) === 0, 'R blocks L3 (existing removal) → 0');

  await like(L4, R, 'New one');
  check((await badge(R.c)) === 1, 'a new like → 1');
  const Rnew = await signIn(mail('r'));
  check((await badge(Rnew.c)) === 1, 'a fresh session (sign-in again) reads the same count from the server');

  await like(L1, R2, null);
  const a2 = await activity(R2.c);
  check(a2.premium === false && a2.pendingCount === 1 && unseenLikeCount(a2) === 0, 'not premium: 1 pending (count only), badge 0 — identities hidden, none can be opened');
  check((await badge(R2.c)) === 0 && (await badge(R.c)) === 1, 'each account sees only its own count');

  console.log(`smoke_activity_badge_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
