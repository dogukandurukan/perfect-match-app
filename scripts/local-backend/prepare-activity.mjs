// Phone accounts for the Activity → profile → Match & chat test on the LOCAL
// Supabase only (synthetic @tempa-test.example.com, normal V2 path). Creates
// NEW accounts; never touches the Matches tester, the pool or any other
// account. Re-runnable: existing accounts / likes are kept as they are.
//
//   node scripts/local-backend/prepare-activity.mjs            # set "p1"
//   node scripts/local-backend/prepare-activity.mjs --set p2   # a fresh set
//
// Set <s> (İstanbul, all mutually eligible):
//   tempa-activity-<s>-receiver   Mert  (man)   — sign in here first (Activity)
//   tempa-activity-<s>-defne      Defne (woman) — liked his photo + comment;
//                                                 sign in here to see the message
//   tempa-activity-<s>-ece        Ece   (woman) — liked his answer + comment
//   tempa-activity-<s>-zeynep     Zeynep(woman) — whole-profile like, no comment
//     (written with the service role: the whole-profile heart, D81, is not
//      built yet, and send_like_v2 only takes photo / prompt targets)
// The receiver is made premium IN THE LOCAL DATA so all cards are visible
// (existing premium rule; no code bypass, nothing on the shared project).
import crypto from 'node:crypto';
import { admin, ensureMember, LOOKS, must } from './_local.mjs';

const i = process.argv.indexOf('--set');
const set = (i > 0 ? process.argv[i + 1] : 'p1') ?? 'p1';
if (!/^[a-z0-9]{1,8}$/.test(set)) throw new Error('--set must be 1–8 lowercase letters / digits');
const mail = (k) => `tempa-activity-${set}-${k}@tempa-test.example.com`;
const woman = (k, first, n, district) => ({ email: mail(k), first, gender: 'woman', interested: ['men'], dob: `199${n}-0${n}-1${n}`, city: 'İstanbul', district, look: LOOKS[n] });

const B = await ensureMember({ email: mail('receiver'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy',
  look: { ...LOOKS[2], hairStyle: 'pixie', accessory: 'glasses' } });
const A = await ensureMember(woman('defne', 'Defne', 1, 'Moda'));
const E = await ensureMember(woman('ece', 'Ece', 2, 'Beşiktaş'));
const Z = await ensureMember(woman('zeynep', 'Zeynep', 3, 'Şişli'));
must(await admin.from('profiles').update({ is_premium: true }).eq('id', B.uid), 'receiver premium (local data)');

const existing = async (from) => (await admin.from('likes').select('id, status').eq('liker_id', from.uid).eq('likee_id', B.uid).maybeSingle()).data;
async function like(from, kind, note) {
  if (await existing(from)) return 'kept';
  const prof = must(await from.c.rpc('get_profile_v2', { p_user: B.uid }), 'profile');
  const today = must(await from.c.rpc('get_daily_picks_v2'), 'daily picks');
  const args = { p_likee: B.uid, p_target_type: kind, p_target_id: kind === 'photo' ? prof.photos[1]?.id ?? prof.photos[0].id : prof.prompts[0].id,
    p_note: note, p_request_id: crypto.randomUUID() };
  if (today.pick?.user_id === B.uid) args.p_source = 'daily_pick';
  const r = must(await from.c.rpc('send_like_v2', args), 'send_like_v2');
  if (!r.ok) throw new Error(`like refused: ${r.error}`);
  return 'sent';
}
console.log(`[activity] Defne → photo + comment: ${await like(A, 'photo', 'Where was this taken?')}`);
console.log(`[activity] Ece → answer + comment: ${await like(E, 'prompt', 'Count me in — which simit place is the best one?')}`);
if (!(await existing(Z))) {
  must(await admin.from('likes').insert({ liker_id: Z.uid, likee_id: B.uid, target_type: 'profile', target_key: null, note: null, status: 'sent' }), 'profile like');
  console.log('[activity] Zeynep → whole profile, no comment: sent (service role)');
} else console.log('[activity] Zeynep → whole profile, no comment: kept');

for (const [n, who] of [['Defne', A], ['Ece', E], ['Zeynep', Z]]) {
  const l = await existing(who);
  console.log(`[activity] ${n.padEnd(6)} like status: ${l?.status}${l?.status === 'matched' ? '  (already matched — use --set <new> for a fresh round)' : ''}`);
}
console.log(`\nPhone (Mac and phone on the same Wi-Fi):
  1. scripts/local-backend/start-app.sh ${mail('receiver')}
  2. later, to see the message on the other side:
     scripts/local-backend/start-app.sh ${mail('defne')}`);
