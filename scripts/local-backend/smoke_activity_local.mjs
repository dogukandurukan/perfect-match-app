// Activity → profile → Match & chat on the LOCAL Supabase (real Postgres +
// Auth + Storage + Realtime + PostgREST, real JWTs), synthetic accounts only:
//   node scripts/local-backend/smoke_activity_local.mjs
// Needs: setup.mjs (+ the Activity package) and seed.mjs. Every run creates
// FRESH synthetic people (tempa-local-act-<tag>-*), so earlier runs and the
// phone accounts are never touched.
//
//   A  (woman) likes B's photo with a comment        → "Liked your photo"
//   D  (woman) likes B's answer with a comment        → "Liked your answer"
//   E  (woman) whole-profile like, no comment         → "Liked you"
//      (inserted with the service role: the whole-profile heart, D81, is not
//       built yet — send_like_v2 only takes photo / prompt targets)
//   B  (man)   the recipient — Activity, profile, Match & chat, first message
//   C  (woman) an unrelated third account — must be refused everywhere
import crypto from 'node:crypto';
import { admin, env, ensureMember, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const rpcHttp = (token, fn, args = {}) =>
  fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const pairFilter = (x, y) => `and(user_a_id.eq.${x},user_b_id.eq.${y}),and(user_a_id.eq.${y},user_b_id.eq.${x})`;
const msgFilter = (x, y) => `and(sender_id.eq.${x},receiver_id.eq.${y}),and(sender_id.eq.${y},receiver_id.eq.${x})`;

async function like(from, to, kind, note) {
  const prof = (await from.c.rpc('get_profile_v2', { p_user: to.uid })).data;
  const target = kind === 'photo' ? prof.photos[0].id : prof.prompts[0].id;
  const today = (await from.c.rpc('get_daily_picks_v2')).data;
  const args = { p_likee: to.uid, p_target_type: kind, p_target_id: target, p_note: note, p_request_id: crypto.randomUUID() };
  if (today?.pick?.user_id === to.uid) args.p_source = 'daily_pick';
  return (await from.c.rpc('send_like_v2', args)).data;
}

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-act-${tag}-${k}@tempa-test.example.com`;
  const woman = (k, first, i) => ({ email: mail(k), first, gender: 'woman', interested: ['men'], dob: `199${i}-05-1${i}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[i] });
  const A = await ensureMember(woman('a', 'Defne', 1));
  const D = await ensureMember(woman('d', 'Ece', 2));
  const E = await ensureMember(woman('e', 'Zeynep', 3));
  const C = await ensureMember(woman('c', 'Third', 4));
  const B = await ensureMember({ email: mail('b'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });
  const tokB = (await signIn(mail('b'))).token;

  // 1. Incoming interest.
  const la = await like(A, B, 'photo', 'Where was this taken?');
  const ld = await like(D, B, 'prompt', 'Boyoz with a strong tea, obviously.');
  check(la?.ok && !la.matched && ld?.ok && !ld.matched, 'A (photo + comment) and D (answer + comment) like B through send_like_v2');
  const le = await admin.from('likes').insert({ liker_id: E.uid, likee_id: B.uid, target_type: 'profile', target_key: null, note: null, status: 'sent' }).select('id').single();
  check(!le.error, 'E whole-profile like without a comment (service role — D81 heart not built)');
  const likeId = async (from) => (await admin.from('likes').select('id').eq('liker_id', from.uid).eq('likee_id', B.uid).single()).data.id;
  const idA = await likeId(A);
  const idD = await likeId(D);
  const idE = await likeId(E);

  // 2. Premium rule kept (count only), local tester made premium in DATA.
  const free = (await B.c.rpc('get_my_activity_v2')).data;
  check(free?.member === true && free.premium === false && free.pending_count === 3 && free.pending.length === 0,
    'non-premium: count only, no identity (existing premium rule)');
  await admin.from('profiles').update({ is_premium: true }).eq('id', B.uid);

  const act1 = (await B.c.rpc('get_my_activity_v2')).data;
  const card = (id) => act1.pending.find((p) => p.like_id === id);
  check(act1.pending.length === 3 && new Set(act1.pending.map((p) => p.user_id)).size === 3, 'B sees 3 cards, one per person');
  check(card(idA)?.target_type === 'photo' && card(idA).note === 'Where was this taken?' && !!card(idA).target_photo_path && card(idA).user_id === A.uid
    && card(idA).first_name === 'Defne' && card(idA).city === 'İstanbul' && !!card(idA).photo_path, 'photo like: comment + my liked photo + liker identity');
  check(card(idD)?.target_type === 'prompt' && !!card(idD).target_prompt_id && !!card(idD).target_answer && !!card(idD).note, 'answer like: my answer + comment');
  check(card(idE)?.target_type === 'profile' && card(idE).note === null, 'profile like: no comment → note null (nothing shown)');
  check(act1.pending.every((p) => p.seen === false) && act1.matches.length === 0, 'nothing read, no matches yet');
  const quota0 = (await B.c.rpc('get_my_like_quota_v2')).data;
  const views0 = (await admin.from('profiles').select('daily_views_count').eq('id', B.uid).single()).data.daily_views_count;

  // Liker's photo is viewable by B (private bucket, signed URL, real bytes).
  const signed = await B.c.storage.from('profile-photos-private').createSignedUrl(card(idA).photo_path, 600);
  const bytes = signed.data ? await fetch(signed.data.signedUrl).then((r) => (r.ok ? r.arrayBuffer() : null)) : null;
  check(!!bytes && bytes.byteLength > 1000, 'B can load the liker’s photo (signed URL)');

  // 3. Open the profile and go back: read, no match.
  const prof = (await B.c.rpc('get_profile_v2', { p_user: A.uid })).data;
  check(prof?.user_id === A.uid && prof.photos.length >= 3 && prof.prompts.length >= 2, 'B opens A’s full V2 profile');
  const seen = (await B.c.rpc('mark_like_seen_v2', { p_like: idA })).data;
  check(seen?.ok === true, 'opening marks only that like read');
  const act2 = (await B.c.rpc('get_my_activity_v2')).data;
  const pairRows = async () => (await admin.from('matches').select('id, status, chat_opened, source').or(pairFilter(A.uid, B.uid))).data ?? [];
  check(act2.pending.find((p) => p.like_id === idA)?.seen === true && act2.pending.filter((p) => p.seen).length === 1,
    'A’s card read; loading the list twice marked nothing else');
  check((await pairRows()).length === 0 && act2.pending.length === 3, 'profile open + back: no match, card still pending');

  // 4. Authorization: nobody but B accepts / marks A's like.
  const notMine = [
    (await A.c.rpc('accept_like_v2', { p_like: idA })).data,
    (await C.c.rpc('accept_like_v2', { p_like: idA })).data,
    (await C.c.rpc('accept_like_v2', { p_like: idD })).data,
    (await C.c.rpc('mark_like_seen_v2', { p_like: idE })).data,
  ];
  check(notMine.every((r) => r?.ok === false && r.error === 'not_found') && (await pairRows()).length === 0,
    'liker / third account cannot accept or mark someone else’s like (not_found, nothing written)');
  const anonAccept = await fetch(`${env.url}/rest/v1/rpc/accept_like_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_like: idA }) });
  check(anonAccept.status === 401 || anonAccept.status === 403 || anonAccept.status === 404, `signed-out accept refused (HTTP ${anonAccept.status})`);

  // 5. Match & chat — 5 parallel requests (double tap / retries) → ONE match.
  const burst = await Promise.all(Array.from({ length: 5 }, () => rpcHttp(tokB, 'accept_like_v2', { p_like: idA })));
  const ids = new Set(burst.map((b) => b.json?.match_id));
  check(burst.every((b) => b.status === 200 && b.json?.ok === true) && ids.size === 1 && burst.filter((b) => b.json.replayed === false).length === 1,
    '5 parallel Match & chat → all ok, same match id, created once');
  const matchId = [...ids][0];
  const rows = await pairRows();
  check(rows.length === 1 && rows[0].id === matchId && rows[0].status === 'accepted' && rows[0].chat_opened === true, 'one accepted match row, chat open');
  const msgCount = async () => ((await admin.from('messages').select('id').or(msgFilter(A.uid, B.uid))).data ?? []).length;
  check((await msgCount()) === 0, 'match exists with NO message; the comment is not a message');
  const likeRows = (await admin.from('likes').select('liker_id, status, match_id').or(`and(liker_id.eq.${A.uid},likee_id.eq.${B.uid}),and(liker_id.eq.${B.uid},likee_id.eq.${A.uid})`)).data ?? [];
  check(likeRows.length === 1 && likeRows[0].status === 'matched' && likeRows[0].match_id === matchId, 'incoming like linked to the match; no reverse like created');
  const quota1 = (await B.c.rpc('get_my_like_quota_v2')).data;
  const views1 = (await admin.from('profiles').select('daily_views_count').eq('id', B.uid).single()).data.daily_views_count;
  check(quota1.remaining === quota0.remaining && views1 === views0, 'daily like quota unchanged by accepting');
  const retry = (await B.c.rpc('accept_like_v2', { p_like: idA })).data;
  check(retry?.ok === true && retry.replayed === true && retry.match_id === matchId && (await pairRows()).length === 1, 'retry after a lost response → same match');
  const notif = (await admin.from('notifications').select('user_id').eq('type', 'mutual_match').in('user_id', [A.uid, B.uid])).data ?? [];
  check(notif.length === 2, 'existing mutual_match notification for both sides (once)');

  // 6. Feed: card → match row, never both.
  const act3 = (await B.c.rpc('get_my_activity_v2')).data;
  const row = act3.matches.find((m) => m.match_id === matchId);
  check(!act3.pending.some((p) => p.user_id === A.uid) && row?.other_id === A.uid && row.last_message === null, 'B: A’s card became a match row (no conversation yet)');
  check((await A.c.rpc('get_my_activity_v2')).data.matches.some((m) => m.match_id === matchId), 'A sees the match too');

  // 7. Chat context: the like + comment, not a message.
  const chat = (await B.c.rpc('get_chat_v2', { p_match: matchId })).data;
  check(chat?.state === 'active' && chat.likes.length === 1 && chat.likes[0].from_me === false && chat.likes[0].note === 'Where was this taken?' && !!chat.likes[0].photo_path,
    'chat “How it started”: A liked your photo + comment');

  // 8. Third account: no access to the pair's chat / messages.
  check((await C.c.rpc('get_chat_v2', { p_match: matchId })).data === null, 'third account: chat context null');
  const spoof = await C.c.from('messages').insert({ sender_id: A.uid, receiver_id: B.uid, content: 'spoof' });
  const cold = await C.c.from('messages').insert({ sender_id: C.uid, receiver_id: B.uid, content: 'hi' });
  check(!!spoof.error && !!cold.error, 'third account cannot send as A, nor message B without a match');
  const cMatch = await C.c.from('matches').update({ status: 'passed' }).eq('id', matchId).select('id');
  check(!cMatch.error && (cMatch.data ?? []).length === 0 && (await pairRows())[0].status === 'accepted', 'third account cannot change the match');

  // 9. First real message, delivered over Realtime to A.
  // Like the app: one signed-in client listening with its OWN session token.
  const AR = await signIn(mail('a'));
  AR.c.realtime.setAuth(AR.token);
  let subscribed;
  const joined = new Promise((r) => { subscribed = r; });
  const received = new Promise((resolve) => {
    const ch = AR.c.channel(`act-${tag}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${A.uid}` },
      (payload) => { resolve(payload.new?.content); ch.unsubscribe(); });
    ch.subscribe((s) => { if (s === 'SUBSCRIBED') subscribed(true); });
    setTimeout(() => resolve(null), 12000);
  });
  check(await Promise.race([joined, new Promise((r) => setTimeout(() => r(false), 10000))]), 'A subscribed to Realtime');
  const sent = await B.c.from('messages').insert({ sender_id: B.uid, receiver_id: A.uid, content: 'Hi Defne! Moda pier.' });
  check(!sent.error, 'B sends the first real message');
  check((await received) === 'Hi Defne! Moda pier.', 'A receives it over Realtime');
  const cSees = (await C.c.from('messages').select('id').or(msgFilter(A.uid, B.uid))).data ?? [];
  check(cSees.length === 0, 'third account sees none of their messages');

  // 10. "Restart": brand-new sessions read everything back from the server.
  const A2 = await signIn(mail('a'));
  const B2 = await signIn(mail('b'));
  const aMsgs = (await A2.c.from('messages').select('id, content, read_at').or(msgFilter(A.uid, B.uid))).data ?? [];
  check(aMsgs.length === 1 && aMsgs[0].content === 'Hi Defne! Moda pier.' && aMsgs[0].read_at === null, 'new A session: message from the server, unread');
  const unreadA = (await A2.c.rpc('get_my_matches_v2')).data.find((m) => m.match_id === matchId)?.unread;
  const read = await A2.c.from('messages').update({ read_at: new Date().toISOString() }).eq('sender_id', B.uid).eq('receiver_id', A.uid).is('read_at', null).select('id');
  check(unreadA === 1 && !read.error && (read.data ?? []).length === 1, 'A reads it (read_at written by the receiver)');
  const A3 = await signIn(mail('a'));
  const after = (await A3.c.rpc('get_my_matches_v2')).data.find((m) => m.match_id === matchId);
  check(after?.unread === 0 && after.last_message === 'Hi Defne! Moda pier.', 'another new A session: read state kept');
  const b2act = (await B2.c.rpc('get_my_activity_v2')).data;
  const b2row = b2act.matches.find((m) => m.match_id === matchId);
  check(b2row?.last_message === 'Hi Defne! Moda pier.' && b2row.last_from_me === true && !b2act.pending.some((p) => p.user_id === A.uid),
    'new B session: same match, conversation started, no pending card');
  check(b2act.pending.find((p) => p.like_id === idD)?.seen === false && b2act.pending.find((p) => p.like_id === idE)?.seen === false, 'other cards still unread after restart');

  // 11. Existing rules kept: block → card gone, accept refused; unmatch → not revived.
  await B.c.from('blocks').insert({ blocker_id: B.uid, blocked_id: D.uid });
  const blocked = (await B.c.rpc('accept_like_v2', { p_like: idD })).data;
  const act4 = (await B.c.rpc('get_my_activity_v2')).data;
  check(blocked?.ok === false && !act4.pending.some((p) => p.user_id === D.uid) && ((await admin.from('matches').select('id').or(pairFilter(B.uid, D.uid))).data ?? []).length === 0,
    'blocked liker: card gone, Match & chat refused, nothing written');
  const accE = (await B.c.rpc('accept_like_v2', { p_like: idE })).data;
  check(accE?.ok === true && accE.replayed === false, 'profile like (no comment) → Match & chat works');
  const un = (await B.c.rpc('unmatch_v2', { p_match: accE.match_id })).data;
  const again = (await B.c.rpc('accept_like_v2', { p_like: idE })).data;
  const eRows = (await admin.from('matches').select('status').or(pairFilter(B.uid, E.uid))).data ?? [];
  check(un?.status === 'passed' && again?.ok === false && eRows.length === 1 && eRows[0].status === 'passed'
    && !(await B.c.rpc('get_my_activity_v2')).data.matches.some((m) => m.other_id === E.uid),
    'unmatch: not revived by a repeated Match & chat, gone from the feed');

  console.log(`smoke_activity_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
