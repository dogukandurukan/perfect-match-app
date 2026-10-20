// Realtime delivery probe on the LOCAL Supabase (synthetic pair only; created
// once, kept in .test-backend/realtime-probe-pair.json, git-ignored).
// Timestamped, to tell test / client / service timing apart.
//   node scripts/local-backend/probe_realtime_local.mjs setup      → create the pair only
//   node scripts/local-backend/probe_realtime_local.mjs immediate  → insert as soon as SUBSCRIBED fires
//   node scripts/local-backend/probe_realtime_local.mjs system     → insert after "Subscribed to PostgreSQL"
// The local Realtime tenant shuts itself down ~10 min after it starts
// ("rebalancing"); the next join re-creates the replication slot. Compare the
// printed times with: docker logs --timestamps supabase_realtime_tempa-local
// (see docs/tempa/work-packages/V2_REALTIME_RESULT.md).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { admin, ensureMember, LOOKS, repo, signIn } from './_local.mjs';

const mode = process.argv[2] ?? 'immediate';
const T0 = Date.now();
const ts = () => new Date().toISOString().slice(11, 23);
const log = (m) => console.log(`${ts()}  +${String(Date.now() - T0).padStart(5)}ms  ${m}`);
const STATE = path.join(repo, '.test-backend', 'realtime-probe-pair.json');

async function pair() {
  if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const tag = `rt${Date.now().toString(36)}`;
  const mail = (k) => `tempa-local-${tag}-${k}@tempa-test.example.com`;
  const A = await ensureMember({ email: mail('a'), first: 'Rta', gender: 'woman', interested: ['men'], dob: '1993-05-13', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[1] });
  const B = await ensureMember({ email: mail('b'), first: 'Rtb', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const prof = (await A.c.rpc('get_profile_v2', { p_user: B.uid })).data;
  await A.c.rpc('send_like_v2', { p_likee: B.uid, p_target_type: 'photo', p_target_id: prof.photos[0].id, p_note: null, p_request_id: crypto.randomUUID() });
  const likeId = (await admin.from('likes').select('id').eq('liker_id', A.uid).eq('likee_id', B.uid).single()).data.id;
  const acc = (await B.c.rpc('accept_like_v2', { p_like: likeId })).data;
  const s = { a: mail('a'), b: mail('b'), aUid: A.uid, bUid: B.uid, match: acc.match_id };
  fs.mkdirSync(path.dirname(STATE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(STATE, JSON.stringify(s), { mode: 0o600 });
  return s;
}

const s = await pair();
if (mode === 'setup') { console.log('pair ready', s.match); process.exit(0); }
const A = await signIn(s.a);
const B = await signIn(s.b);
A.c.realtime.setAuth(A.token);
log(`mode=${mode}  receiver A=${s.aUid.slice(0, 8)}  sender B=${s.bUid.slice(0, 8)}`);

let tSub = null, tSys = null, tRecv = null;
let gotSystem;
const sysReady = new Promise((r) => { gotSystem = r; });
let gotSub;
const subReady = new Promise((r) => { gotSub = r; });
let gotMsg;
const msg = new Promise((r) => { gotMsg = r; });
const content = `rt-probe ${mode} ${crypto.randomUUID().slice(0, 8)}`;

log('channel.subscribe() sent');
const ch = A.c.channel(`probe-${Date.now()}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${s.aUid}` }, (p) => {
    if (p.new?.content === content) { tRecv = Date.now(); log(`RECEIVED over Realtime (${p.new.content})`); gotMsg(true); }
  })
  .on('system', {}, (p) => { log(`system: ${JSON.stringify(p)}`); if (p?.extension === 'postgres_changes' && p?.status === 'ok') { tSys = Date.now(); gotSystem(true); } })
  .subscribe((st, err) => { log(`status: ${st}${err ? ` ${err.message}` : ''}`); if (st === 'SUBSCRIBED') { tSub = Date.now(); gotSub(true); } });

await subReady;
if (mode === 'system') await Promise.race([sysReady, new Promise((r) => setTimeout(r, 15000))]);
const ins = await B.c.from('messages').insert({ sender_id: s.bUid, receiver_id: s.aUid, content }).select('id, created_at').single();
log(`INSERT done (error=${ins.error?.message ?? 'none'}, db created_at=${ins.data?.created_at})`);
const ok = await Promise.race([msg, new Promise((r) => setTimeout(() => r(false), 12000))]);
if (!ok) log('NOT RECEIVED within 12 s');
log(`summary: SUBSCRIBED +${tSub - T0}ms, system ok ${tSys ? `+${tSys - T0}ms` : 'never (before insert)'}, received ${tRecv ? 'yes' : 'NO'}`);
await A.c.removeChannel(ch);
process.exit(0);
