// Approved member photo order on the LOCAL Supabase (real Postgres + Auth +
// PostgREST, real JWTs): reorder_member_photos_v2.
//   node scripts/local-backend/smoke_member_photos_local.mjs
// FRESH synthetic people only (tempa-local-mphoto-<tag>-*); never the phone
// accounts. M is kept for the phone check (.test-backend/member-photos.json).
//   M  approved member, 3 photos       L  likes M's 2nd photo
//   O  another approved member         D  draft applicant (application editable)
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
const photosOf = async (uid) => (await admin.from('profile_photos_v2').select('id, storage_path, position').eq('user_id', uid).order('position')).data ?? [];
const reorder = (c, ids, expected) => c.rpc('reorder_member_photos_v2', { p_ids: ids, p_expected: expected });

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-mphoto-${tag}-${k}@tempa-test.example.com`;
  const M = await ensureMember({ email: mail('m'), first: 'Mira', gender: 'woman', interested: ['men'], dob: '1993-05-13', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[1] });
  const L = await ensureMember({ email: mail('l'), first: 'Lev', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const O = await ensureMember({ email: mail('o'), first: 'Ola', gender: 'woman', interested: ['men'], dob: '1992-03-03', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[3] });
  const D = await signIn(mail('d'));
  await fillApplication(D.c, D.uid, { first: 'Dila', gender: 'woman', interested: ['men'], dob: '1995-04-04', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[2] });
  fs.mkdirSync(path.join(repo, '.test-backend'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(repo, '.test-backend', 'member-photos.json'), JSON.stringify({ member: mail('m'), uid: M.uid }), { mode: 0o600 });

  const before = await photosOf(M.uid);
  const [p1, p2, p3] = before.map((p) => p.id);
  check(before.length === 3, 'setup: approved member with 3 photos');

  // A like on M's 2nd photo (the photo id is the like's target).
  const prof = (await L.c.rpc('get_profile_v2', { p_user: M.uid })).data;
  const target = prof.photos.find((x) => x.id === p2)?.id;
  const today = (await L.c.rpc('get_daily_picks_v2')).data;
  const likeArgs = { p_likee: M.uid, p_target_type: 'photo', p_target_id: target, p_note: 'Love this one', p_request_id: crypto.randomUUID() };
  if (today?.pick?.user_id === M.uid) likeArgs.p_source = 'daily_pick';
  const lk = (await L.c.rpc('send_like_v2', likeArgs)).data;
  check(lk?.ok === true, 'setup: L likes M’s 2nd photo');

  // Reorder: [p3, p1, p2] → p3 main.
  const r = await reorder(M.c, [p3, p1, p2], [p1, p2, p3]);
  const after = await photosOf(M.uid);
  check(!r.error && r.data?.changed === true && after.map((p) => p.id).join() === [p3, p1, p2].join(), 'member reorders: positions follow the new order');
  check(after.every((p, i) => p.storage_path === before.find((b) => b.id === p.id).storage_path) && after.length === 3, 'no photo added, removed or changed — only positions');
  // L may see M (eligible pair); O (woman, interested in men) may not — by the existing rules.
  const pub = (await L.c.rpc('get_profile_v2', { p_user: M.uid })).data;
  check(pub?.photos?.map((x) => x.id).join() === [p3, p1, p2].join(), 'others see the new order (View profile, as L)');
  const copy = (await admin.from('profiles').select('photos').eq('id', M.uid).single()).data.photos;
  check(copy.join() === after.map((p) => p.storage_path).join(), 'profiles.photos copy (older screens / chat header) in the new order');
  const fresh = await signIn(mail('m'));
  const own = (await fresh.c.rpc('get_my_onboarding_v2')).data;
  check(own.photos.slice().sort((a, b) => a.position - b.position).map((x) => x.id).join() === [p3, p1, p2].join(), 'a fresh session reads the saved order');

  // The like still targets the same photo.
  const likeRow = (await admin.from('likes').select('target_key, target_type').eq('liker_id', L.uid).eq('likee_id', M.uid).single()).data;
  const act = (await M.c.rpc('get_my_activity_v2')).data;
  check(likeRow.target_key === p2 && likeRow.target_type === 'photo', 'the like still targets photo p2 (by id, now in position 3)');
  check(!act.premium || act.pending.find((x) => x.user_id === L.uid)?.target_photo_path === before.find((b) => b.id === p2).storage_path, 'Activity context still shows the liked photo itself');

  // Stale order / wrong sets.
  const stale = await reorder(M.c, [p1, p2, p3], [p1, p2, p3]);
  check(/photos_changed/.test(stale.error?.message ?? ''), 'stale expected order (changed elsewhere) → photos_changed, nothing written');
  const cur = [p3, p1, p2];
  const oPhoto = (await photosOf(O.uid))[0].id;
  for (const [name, ids] of [['missing', [p3, p1]], ['extra', [p3, p1, p2, crypto.randomUUID()]], ['duplicate', [p3, p3, p1]], ['foreign', [p3, p1, oPhoto]], ['empty', []]]) {
    const x = await reorder(M.c, ids, cur);
    check(/photo_set_mismatch/.test(x.error?.message ?? ''), `${name} id set → photo_set_mismatch`);
  }
  check((await photosOf(M.uid)).map((p) => p.id).join() === cur.join(), 'after all refusals the order is unchanged');

  // Other callers.
  const oBefore = (await photosOf(O.uid)).map((p) => p.id).join();
  const oTry = await reorder(O.c, cur, cur);
  check(/photo_set_mismatch|photos_changed/.test(oTry.error?.message ?? '') && (await photosOf(M.uid)).map((p) => p.id).join() === cur.join() && (await photosOf(O.uid)).map((p) => p.id).join() === oBefore,
    'another member cannot reorder M’s photos (refused; M and O unchanged)');
  const dPhotos = await photosOf(D.uid);
  const dTry = await reorder(D.c, dPhotos.map((p) => p.id).reverse(), dPhotos.map((p) => p.id));
  check(/not_member/.test(dTry.error?.message ?? ''), 'a draft applicant is refused by the member function');
  const dOwn = await D.c.rpc('reorder_profile_photos_v2', { p_ids: dPhotos.map((p) => p.id).reverse() });
  check(!dOwn.error && (await photosOf(D.uid))[0].id === dPhotos[dPhotos.length - 1].id, 'the draft applicant’s own reorder (application path) still works');
  const mOld = await M.c.rpc('reorder_profile_photos_v2', { p_ids: cur });
  check(/application_locked/.test(mOld.error?.message ?? ''), 'the application path stays locked for the member');
  const anon = await fetch(`${env.url}/rest/v1/rpc/reorder_member_photos_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_ids: cur, p_expected: cur }) });
  check(anon.status >= 400, 'signed out → refused');

  // Two saves at once from the same order: one wins, the other is told.
  const [a, b] = await Promise.all([reorder(M.c, [p1, p2, p3], cur), reorder(M.c, [p2, p3, p1], cur)]);
  const wins = [a, b].filter((x) => !x.error).length;
  const told = [a, b].filter((x) => /photos_changed/.test(x.error?.message ?? '')).length;
  const final = (await photosOf(M.uid)).map((p) => p.id).join();
  check(wins === 1 && told === 1 && (final === [p1, p2, p3].join() || final === [p2, p3, p1].join()), 'concurrent saves: one applied, the other gets photos_changed (no silent overwrite)');

  // Leave M with p3 as the main photo for the phone check.
  const now = (await photosOf(M.uid)).map((p) => p.id);
  await reorder(M.c, [p3, p1, p2], now);
  console.log(`smoke_member_photos_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  console.log(`phone account: ${mail('m')} (approved member, 3 photos)`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
