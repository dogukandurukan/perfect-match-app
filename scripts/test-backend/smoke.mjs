// Automated smoke test against the SEPARATE test project's real Auth,
// PostgREST, Storage and Realtime:
//   node scripts/test-backend/smoke.mjs --stage p0a   (after apply p0a + seed)
//   node scripts/test-backend/smoke.mjs --stage p0b   (after apply p0b)
// Uses only the synthetic İzmir smoke users (Smoke1/Smoke2) for anything that
// changes state, plus read-only checks as Deniz, so the phone test starts from
// the seeded state. Prints pass/fail only — no keys, passwords or URLs.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv, outDir } from './_env.mjs';

const stageArg = process.argv.find((a) => a.startsWith('--stage'))?.split('=')[1] ?? process.argv[process.argv.indexOf('--stage') + 1];
if (!['p0a', 'p0b'].includes(stageArg)) fail('usage: smoke.mjs --stage p0a|p0b');
const env = loadTestEnv({ needService: true });
const saved = JSON.parse(fs.readFileSync(path.join(outDir, 'accounts.local.json'), 'utf8'));
if (saved.projectRef !== env.ref) fail('accounts.local.json belongs to another project');
const { ids, logins } = saved;
const BUCKET = 'profile-photos-private';

let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = () => createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(key) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: logins[key].email, password: logins[key].password });
  check(!error, `auth: ${logins[key].name} signs in`);
  return c;
}
const firstPhoto = async (id) => (await admin.from('profiles').select('photos').eq('id', id).single()).data?.photos?.[0];
const jwtTtl = (signedUrl) => {
  const token = new URL(signedUrl).searchParams.get('token');
  const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return p.exp - p.iat;
};

async function main() {
  const deniz = await signIn('A');
  const s1 = await signIn('S1');
  const s2 = await signIn('S2');

  // --- reads as Deniz (no state change) ------------------------------------
  const card = async (key) => (await deniz.from('profile_cards').select('id, intent').eq('id', ids[key])).data ?? [];
  check((await card('ECE')).length === 1, 'cards: visible person');
  check((await card('ZEYNEP')).length === 1, 'cards: hidden person with an accepted chat stays visible');
  for (const k of ['MELIS', 'BUSE', 'NIL']) check((await card(k)).length === 0, `cards: ${k} not visible`);
  check((await card('ECE'))[0]?.intent === 'open_to_relationship', 'cards: "Looking for" shown on a visible card');
  const priv = await deniz.from('profiles').select('phone_number').eq('id', ids.ECE);
  if (stageArg === 'p0a') check((priv.data ?? []).length === 1, 'P0-A: other profiles row still readable (closed only by P0-B — expected)');
  else check(!priv.error && (priv.data ?? []).length === 0, 'P0-B: other profiles row not readable');
  const disc = await deniz.rpc('get_discovery_cards', { p_limit: 20 });
  check(!disc.error && (disc.data ?? []).length > 0, 'discovery works');
  check((disc.data ?? []).every((r) => !('district' in r) && !(r.reasons ?? []).includes('Nearby')), 'discovery: no district / "Nearby"');
  const likers = await deniz.rpc('get_my_liker_cards', { p_limit: 50 });
  const likerIds = (likers.data ?? []).map((r) => r.liker_id);
  check(likerIds.includes(ids.LARA) && !likerIds.includes(ids.BUSE) && !likerIds.includes(ids.NIL),
    'liked-you: Lara yes, hidden Buse / blocking Nil no');
  check(Number(likers.data?.[0]?.total_count ?? 0) === 1, 'liked-you count excludes hidden / blocking likers');

  // --- Storage: signing follows visibility; 15-min TTL; expiry + re-sign ----
  const sign = async (c, key, ttl = 900) => c.storage.from(BUCKET).createSignedUrl(await firstPhoto(ids[key]), ttl);
  const ece = await sign(deniz, 'ECE');
  check(!ece.error && jwtTtl(ece.data.signedUrl) === 900, 'storage: visible photo signs with a 15-minute URL');
  check((await fetch(ece.data.signedUrl)).status === 200, 'storage: signed URL loads');
  check(!(await sign(deniz, 'ZEYNEP')).error, 'storage: hidden person with accepted chat still signable');
  for (const k of ['MELIS', 'BUSE', 'NIL']) check(!!(await sign(deniz, k)).error, `storage: ${k} photo not signable`);
  const publicTry = await fetch(`${env.url}/storage/v1/object/public/${BUCKET}/${await firstPhoto(ids.ECE)}`);
  check(publicTry.status >= 400, 'storage: no public URL access to the private bucket');
  const anonList = await client().storage.from(BUCKET).list(ids.ECE);
  check((anonList.data ?? []).length === 0, 'storage: anon cannot list');
  const short = await sign(deniz, 'ECE', 5);
  check((await fetch(short.data.signedUrl)).status === 200, 'expiry: URL works before expiry');
  await sleep(7000);
  check((await fetch(short.data.signedUrl)).status >= 400, 'expiry: the same URL fails after expiry');
  const again = await sign(deniz, 'ECE');
  check(!again.error && (await fetch(again.data.signedUrl)).status === 200, 'expiry: re-signing (what the app does) works again');

  // --- invite → accept → realtime chat → block, with the smoke users -------
  const [a, b] = ids.S1 < ids.S2 ? [ids.S1, ids.S2] : [ids.S2, ids.S1];
  const up = await s1.rpc('upsert_match', { p_user_a: a, p_user_b: b, p_match_score: 70 });
  check(!up.error, 'invite: candidate row');
  const row = (await s1.from('matches').select('id').eq('user_a_id', a).eq('user_b_id', b).single()).data;
  const inv = await s1.from('matches').update({ invited_by: ids.S1, chat_opened: true, status: 'pending' }).eq('id', row.id).select('chat_opened').single();
  check(!inv.error && inv.data.chat_opened === false, 'invite: never opens the chat by itself');
  check(!!(await s1.from('messages').insert({ sender_id: ids.S1, receiver_id: ids.S2, content: 'early' })).error,
    'chat: no message before acceptance');
  const acc = await s2.from('matches').update({ status: 'accepted' }).eq('id', row.id).select('chat_opened').single();
  check(!acc.error && acc.data.chat_opened === true, 'accept: opens the chat (mutual consent)');

  let received = false;
  const channel = s2
    .channel(`smoke-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${ids.S2}` },
      () => { received = true; })
    .subscribe();
  for (let i = 0; i < 40 && channel.state !== 'joined'; i++) await sleep(250);
  await sleep(1000);
  const sent = await s1.from('messages').insert({ sender_id: ids.S1, receiver_id: ids.S2, content: 'hello from smoke' });
  check(!sent.error, 'chat: message after acceptance');
  for (let i = 0; i < 40 && !received; i++) await sleep(250);
  check(received, 'realtime: receiver gets the message live');
  await s2.removeChannel(channel);

  const blk = await s1.from('blocks').insert({ blocker_id: ids.S1, blocked_id: ids.S2 });
  check(!blk.error, 'block: works');
  check(((await s2.from('profile_cards').select('id').eq('id', ids.S1)).data ?? []).length === 0, 'block: blocked side loses the card');
  check(((await s1.from('profile_cards').select('id').eq('id', ids.S2)).data ?? []).length === 0, 'block: blocker loses the card too');
  check(!!(await sign(s2, 'S1')).error && !!(await sign(s1, 'S2')).error, 'block: no new photo URLs either way');
  check(!!(await s2.from('messages').insert({ sender_id: ids.S2, receiver_id: ids.S1, content: 'after block' })).error,
    'block: no messages');
  const list = await s1.rpc('get_my_blocked_users');
  check(!list.error && list.data?.[0]?.first_name === 'Smoke2' && !('photos' in (list.data?.[0] ?? {})), 'block: unblock list shows first name only');

  // restore the smoke pair so the script can be re-run
  await admin.from('blocks').delete().eq('blocker_id', ids.S1);
  await admin.from('messages').delete().in('sender_id', [ids.S1, ids.S2]);
  await admin.from('matches').delete().eq('id', row.id);

  console.log(`[smoke ${stageArg}] ${env.ref}: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
await main();
