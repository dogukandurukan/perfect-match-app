// Matches daily picks on the LOCAL Supabase (real Postgres + Auth + Storage +
// Realtime, real parallel HTTP connections), synthetic accounts only:
//   node scripts/local-backend/smoke_matches_local.mjs
// Needs: setup.mjs + seed.mjs. Each run creates a FRESH synthetic man, so the
// first daily-pick creation is really the first one.
import crypto from 'node:crypto';
import { admin, env, ensureMember, LOOKS, newClient, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const findings = [];
const check = (c, n) => {
  if (c) passed += 1;
  else { failed += 1; console.log('FAIL', n); }
};
const rpcHttp = (token, fn, args = {}) =>
  fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

async function main() {
  const tag = Date.now().toString(36);
  const X = await ensureMember({ email: `tempa-local-run-${tag}@tempa-test.example.com`, first: 'Runner', gender: 'man', interested: ['women'],
    dob: '1992-06-06', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[1] });
  const { token } = await signIn(`tempa-local-run-${tag}@tempa-test.example.com`);

  // 1. First daily pick under REAL parallel connections.
  const burst = await Promise.all(Array.from({ length: 12 }, () => rpcHttp(token, 'get_daily_picks_v2')));
  const pickIds = new Set(burst.map((b) => b.json?.pick?.user_id));
  const rows = (await admin.from('daily_picks_v2').select('period').eq('user_id', X.uid)).data ?? [];
  check(burst.every((b) => b.status === 200 && b.json?.member === true), '12 parallel first requests: all 200');
  check(pickIds.size === 1 && [...pickIds][0], '12 parallel first requests: one and the same pick');
  check(rows.length === 1, 'exactly one daily_picks_v2 row created under concurrency');
  const day = burst[0].json;
  check(day.refresh_at && new Date(day.refresh_at).getUTCHours() === 9, 'refresh_at = 12:00 Istanbul (09:00 UTC)');
  const pick = day.pick;

  // 2. Discover consistency.
  const disc = (await X.c.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? [];
  check(disc.length > 0 && !disc.some((r) => r.user_id === pick.user_id), 'today’s pick is not in Discover');

  // 3. Photo access (private bucket, signed URL).
  const prof = (await X.c.rpc('get_profile_v2', { p_user: pick.user_id })).data;
  const path = prof?.photos?.[0]?.path;
  const signed = await X.c.storage.from('profile-photos-private').createSignedUrl(path, 600);
  const bytes = signed.data ? await fetch(signed.data.signedUrl).then((r) => (r.ok ? r.arrayBuffer() : null)) : null;
  check(!!bytes && bytes.byteLength > 1000, 'viewer can load the pick’s photo (signed URL, real bytes)');
  const outsider = await signIn('tempa-local-ankara@tempa-test.example.com');
  const denied = await outsider.c.storage.from('profile-photos-private').createSignedUrl(path, 600);
  // Known, PRE-EXISTING gap (P1 package, same on the shared project): the
  // private-photo read policy uses the V1 rule can_view_profile_as_me, not
  // V2 eligibility, so any visible active member who knows a path can sign
  // it. Paths are random and only handed out by visibility-checked RPCs.
  // Reported as a finding (decision needed), not counted as a pass/fail.
  const gap = !denied.error && !!denied.data?.signedUrl;
  findings.push(gap ? 'ineligible member CAN sign another member’s photo when the path is known (V1 storage rule)' : 'ineligible member cannot sign');
  const anon = await newClient().storage.from('profile-photos-private').createSignedUrl(path, 600);
  check(!!anon.error, 'signed-out caller cannot sign it');

  // 4. Like + comment → like back → match; no automatic message; first message via Realtime.
  const req = crypto.randomUUID();
  const like = (await X.c.rpc('send_like_v2', { p_likee: pick.user_id, p_target_type: 'photo', p_target_id: prof.photos[0].id,
    p_note: 'Which ferry is yours?', p_request_id: req, p_source: 'daily_pick' })).data;
  check(like?.ok === true, 'daily_pick like + comment saved');
  const replays = await Promise.all([1, 2, 3].map(() => rpcHttp(token, 'send_like_v2', { p_likee: pick.user_id, p_target_type: 'photo',
    p_target_id: prof.photos[0].id, p_note: 'Which ferry is yours?', p_request_id: req, p_source: 'daily_pick' })));
  const likeRows = (await admin.from('likes').select('id, source').eq('liker_id', X.uid).eq('likee_id', pick.user_id)).data ?? [];
  check(replays.every((r) => r.json?.ok === true && r.json.replayed === true) && likeRows.length === 1 && likeRows[0].source === 'daily_pick',
    '3 parallel retries → one like (source daily_pick)');
  const poolEmail = (await admin.auth.admin.getUserById(pick.user_id)).data.user.email;
  const P = await signIn(poolEmail);
  const pToday = (await P.c.rpc('get_daily_picks_v2')).data;
  const xProf = (await P.c.rpc('get_profile_v2', { p_user: X.uid })).data;
  const backArgs = { p_likee: X.uid, p_target_type: 'prompt', p_target_id: xProf.prompts[0].id, p_note: 'Kadıköy line.', p_request_id: crypto.randomUUID() };
  if (pToday.pick?.user_id === X.uid) backArgs.p_source = 'daily_pick';
  const back = (await P.c.rpc('send_like_v2', backArgs)).data;
  check(back?.ok === true && back.matched === true, 'like back → matched immediately');
  const msgs = async () => ((await admin.from('messages').select('id').or(`and(sender_id.eq.${X.uid},receiver_id.eq.${pick.user_id}),and(sender_id.eq.${pick.user_id},receiver_id.eq.${X.uid})`)).data ?? []).length;
  check((await msgs()) === 0, 'no automatic message from the comments');
  const after = (await X.c.rpc('get_daily_picks_v2')).data;
  check(after.pick.state === 'matched' && after.pick.match_id, 'same card → matched (Say hello) with the match id');
  const chat = (await X.c.rpc('get_chat_v2', { p_match: after.pick.match_id })).data;
  check(chat?.state === 'active' && chat.likes?.length === 2, 'chat: active, both likes as context');

  // The receiver listens like the app's chat (postgres_changes on messages,
  // their own JWT, RLS applied by Realtime).
  P.c.realtime.setAuth(P.token);
  let subscribed;
  const joined = new Promise((r) => { subscribed = r; });
  const received = new Promise((resolve) => {
    const ch = P.c.channel(`smoke-${tag}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${pick.user_id}` },
      (payload) => { resolve(payload.new?.content); ch.unsubscribe(); });
    ch.subscribe((s) => { if (s === 'SUBSCRIBED') subscribed(true); });
    setTimeout(() => resolve(null), 12000);
  });
  check(await Promise.race([joined, new Promise((r) => setTimeout(() => r(false), 10000))]), 'receiver subscribed to Realtime');
  const sent = await X.c.from('messages').insert({ sender_id: X.uid, receiver_id: pick.user_id, content: 'Hello from the local test' });
  check(!sent.error, 'first real message sent (RLS: accepted match)');
  check((await received) === 'Hello from the local test', 'receiver gets it over Realtime');
  check((await X.c.rpc('get_daily_picks_v2')).data.pick.state === 'conversation_started', 'card → Conversation started');

  // 5. Last like unit, two parallel sends → one like.
  const lim = (await X.c.rpc('get_my_like_quota_v2')).data.limit;
  await admin.from('profiles').update({ daily_views_count: lim - 1, daily_views_reset_at: new Date().toISOString() }).eq('id', X.uid);
  const others = disc.filter((r) => r.user_id !== pick.user_id).slice(0, 2);
  const firstPhoto = async (id) => (await X.c.rpc('get_profile_v2', { p_user: id })).data.photos[0].id;
  const race = await Promise.all(await Promise.all(others.map(async (o) =>
    rpcHttp(token, 'send_like_v2', { p_likee: o.user_id, p_target_type: 'photo', p_target_id: await firstPhoto(o.user_id), p_note: null, p_request_id: crypto.randomUUID() }))));
  check(others.length === 2 && race.filter((r) => r.json?.ok === true).length === 1 && race.filter((r) => r.json?.error === 'quota_exhausted').length === 1,
    'last unit: two parallel sends → exactly one like');

  for (const f of findings) console.log(`FINDING: ${f}`);
  console.log(`smoke_matches_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
