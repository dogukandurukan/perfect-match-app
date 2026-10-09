// Synthetic people for the LOCAL Supabase only (no real data copied):
//   node scripts/local-backend/seed.mjs
// 6 women in İstanbul (looking for men), 1 woman in Ankara (never eligible),
// the phone tester (man, İstanbul, looking for women) and a second man for
// the service tests. The tester gets ONE mutual match with no message, made
// through send_like_v2 from both real sessions. Idempotent.
import crypto from 'node:crypto';
import { admin, ensureMember, LOOKS, must } from './_local.mjs';

export const TESTER = 'tempa-matches-tester@tempa-test.example.com';
const POOL = ['Defne', 'Ece', 'Selin', 'Zeynep', 'Melis', 'Asya'].map((first, i) => ({
  email: `tempa-local-pool-${i + 1}@tempa-test.example.com`, first, gender: 'woman', interested: ['men'],
  dob: `199${i}-0${(i % 9) + 1}-1${i}`, city: 'İstanbul', district: ['Kadıköy', 'Beşiktaş', 'Şişli', 'Üsküdar', 'Moda', 'Cihangir'][i], look: LOOKS[i],
}));
const people = [
  ...POOL,
  { email: 'tempa-local-ankara@tempa-test.example.com', first: 'Bade', gender: 'woman', interested: ['men'], dob: '1994-04-04', city: 'Ankara', district: 'Çankaya', look: LOOKS[2] },
  { email: TESTER, first: 'Tester', gender: 'man', interested: ['women'], dob: '1995-03-03', city: 'İstanbul', district: 'Kadıköy', look: { ...LOOKS[2], hairStyle: 'pixie', accessory: 'glasses' } },
  { email: 'tempa-local-viewer@tempa-test.example.com', first: 'Viewer', gender: 'man', interested: ['women'], dob: '1993-02-02', city: 'İstanbul', district: 'Şişli', look: LOOKS[4] },
];

const made = {};
for (const p of people) {
  made[p.email] = await ensureMember(p);
  console.log(`[seed] ${p.first.padEnd(7)} accepted`);
}

// One mutual match for the tester (last pool member), no message.
const tester = made[TESTER];
const other = made[POOL[5].email];
const has = (await admin.from('matches').select('id').or(`and(user_a_id.eq.${tester.uid},user_b_id.eq.${other.uid}),and(user_a_id.eq.${other.uid},user_b_id.eq.${tester.uid})`)).data ?? [];
if (has.length === 0) {
  const firstPhoto = async (cl, id) => (await cl.rpc('get_profile_v2', { p_user: id })).data?.photos?.[0]?.id;
  const send = async (cl, me, likee) => {
    const today = must(await cl.rpc('get_daily_picks_v2'), 'daily picks');
    const args = { p_likee: likee, p_target_type: 'photo', p_target_id: await firstPhoto(cl, likee), p_note: null, p_request_id: crypto.randomUUID() };
    if (today.pick?.user_id === likee) args.p_source = 'daily_pick';
    return must(await cl.rpc('send_like_v2', args), `like from ${me}`);
  };
  const a = await send(tester.c, 'tester', other.uid);
  const b = await send(other.c, 'pool', tester.uid);
  if (!a.ok || !b.ok || !b.matched) throw new Error(`mutual match not created: ${a.error ?? ''} ${b.error ?? ''}`);
  console.log('[seed] tester ↔ Asya: mutual match (no message)');
}
console.log('[seed] done (synthetic only)');
