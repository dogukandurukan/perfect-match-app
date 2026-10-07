// Discover targeted likes + comment on the REAL services of perfect-match-dev:
//   TEMPA_TARGET=dev node scripts/test-backend/smoke_discover_v2.mjs
// Sender → DB → receiver with real email-code sessions (normal user rights)
// of EXISTING synthetic accounts only (never the owner's phone / personal
// accounts). Two dev-pool members eligible for the sender are used as extra
// likees. Every row this run creates between these accounts is removed at
// the end; counters / premium / hidden flags are restored. Prints pass/fail
// only — no keys, codes or URLs.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv } from './_env.mjs';

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const MAN = 'cca06005-cf37-4928-ba40-81456d7831f1';
const WOMAN = '67acc178-1a83-4d2f-b38b-8392329cc501';
const PHONE = '13adb65c'; // owner's synthetic phone account — must never be touched

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) passed += 1;
  else { failed += 1; console.log('FAIL', n); }
};
const rid = () => crypto.randomUUID();

async function synthetic(id) {
  if (id.startsWith(PHONE)) fail('refusing to use the phone test account');
  const u = (await admin.auth.admin.getUserById(id)).data.user;
  if (!u?.email?.endsWith('@tempa-test.example.com')) fail(`${id} is not a synthetic account — refusing`);
  return u;
}
async function signIn(id) {
  const u = await synthetic(id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.email });
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ email: u.email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) fail(`sign-in failed for a synthetic account: ${v.error.message}`);
  return c;
}

const ids = [];
let startedAt = null;
// Removes only what this run created (created_at ≥ start) among these
// accounts, plus the established MAN↔WOMAN test pair (same reset as
// smoke_match_chat_v2). Older rows of the dev-pool members stay untouched.
async function cleanup() {
  if (!ids.length) return;
  const pair = (q, a, b, x = 'user_a_id', y = 'user_b_id') => q.or(`and(${x}.eq.${a},${y}.eq.${b}),and(${x}.eq.${b},${y}.eq.${a})`);
  const pairMs = (await pair(admin.from('matches').select('id'), MAN, WOMAN)).data ?? [];
  const newMs = startedAt ? ((await admin.from('matches').select('id').in('user_a_id', ids).in('user_b_id', ids).gte('created_at', startedAt)).data ?? []) : [];
  for (const m of [...pairMs, ...newMs]) await admin.from('date_proposals_v2').delete().eq('match_id', m.id);
  await pair(admin.from('matches').delete(), MAN, WOMAN);
  await pair(admin.from('likes').delete(), MAN, WOMAN, 'liker_id', 'likee_id');
  await pair(admin.from('messages').delete(), MAN, WOMAN, 'sender_id', 'receiver_id');
  await pair(admin.from('blocks').delete(), MAN, WOMAN, 'blocker_id', 'blocked_id');
  await admin.from('notifications').delete().in('user_id', [MAN, WOMAN]).in('related_user_id', [MAN, WOMAN]);
  if (startedAt) {
    await admin.from('matches').delete().in('user_a_id', ids).in('user_b_id', ids).gte('created_at', startedAt);
    await admin.from('likes').delete().in('liker_id', ids).in('likee_id', ids).gte('created_at', startedAt);
    await admin.from('messages').delete().in('sender_id', ids).in('receiver_id', ids).gte('created_at', startedAt);
    await admin.from('blocks').delete().in('blocker_id', ids).in('blocked_id', ids).gte('created_at', startedAt);
    await admin.from('notifications').delete().in('user_id', ids).in('related_user_id', ids).gte('created_at', startedAt);
  }
}

async function main() {
  const A = await signIn(MAN);
  const B = await signIn(WOMAN);
  ids.push(MAN, WOMAN);

  // Two more likees for the sender, from the synthetic dev pool.
  const cand = ((await A.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? []).map((r) => r.user_id);
  const extra = [];
  for (const id of cand) {
    if (id === WOMAN || id.startsWith(PHONE)) continue;
    const u = (await admin.auth.admin.getUserById(id)).data.user;
    if (u?.email?.endsWith('@tempa-test.example.com')) extra.push(id);
    if (extra.length === 2) break;
  }
  if (extra.length < 2) fail('need two synthetic dev-pool members eligible for the sender');
  const [C, D] = extra;
  ids.push(C, D);

  // Saved state to restore.
  const saved = (await admin.from('profiles').select('id, daily_views_count, daily_views_reset_at, is_premium, is_hidden').in('id', ids)).data ?? [];
  const restore = async () => {
    for (const r of saved) {
      await admin.from('profiles').update({ daily_views_count: r.daily_views_count, daily_views_reset_at: r.daily_views_reset_at, is_premium: r.is_premium, is_hidden: r.is_hidden }).eq('id', r.id);
    }
  };
  const setCount = (id, n) => admin.from('profiles').update({ daily_views_count: n, daily_views_reset_at: new Date().toISOString() }).eq('id', id);

  try {
    await cleanup();
    startedAt = new Date(Date.now() - 5000).toISOString();
    await admin.from('profiles').update({ is_premium: false }).in('id', [MAN, WOMAN]);
    await setCount(MAN, 0);
    await setCount(WOMAN, 0);
    const likeRows = async (liker, likee) => (await admin.from('likes').select('*').eq('liker_id', liker).eq('likee_id', likee)).data ?? [];
    const quota = async (c) => (await c.rpc('get_my_like_quota_v2')).data;
    const send = (c, likee, type, target, note, request = rid()) => c.rpc('send_like_v2', { p_likee: likee, p_target_type: type, p_target_id: target, p_note: note, p_request_id: request });

    // ---- profile ids -------------------------------------------------------
    const cand2 = ((await A.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? []).map((r) => r.user_id);
    check(cand2.includes(WOMAN), 'sender sees the receiver in Discover');
    const pB = (await A.rpc('get_profile_v2', { p_user: WOMAN })).data;
    const pC = (await A.rpc('get_profile_v2', { p_user: C })).data;
    const pA = (await B.rpc('get_profile_v2', { p_user: MAN })).data;
    check(pB?.photos?.length >= 2 && pB.photos.every((p) => /^[0-9a-f-]{36}$/.test(p.id) && p.path), 'profile: every photo has a stable id');
    check(pB?.prompts?.length >= 1 && pB.prompts.every((p) => /^[0-9a-f-]{36}$/.test(p.id)), 'profile: every prompt has a stable id');
    check(pB && !('location_district' in pB) && !('district' in pB) && !('location_label' in pB) && !('last_name' in pB) && !('date_of_birth' in pB),
      'profile: no district / label / surname / DOB (no explicit share choice → city only)');
    check(((await A.from('onboarding_v2').select('first_name').eq('user_id', WOMAN)).data ?? []).length === 0, 'raw onboarding draft not readable');
    const q0 = await quota(A);
    check(q0?.limit === 5 && q0?.remaining === 5, 'quota from server: free limit 5 (existing rule), 5 left');

    // ---- refused before anything is written --------------------------------
    const direct = await A.from('likes').insert({ liker_id: MAN, likee_id: WOMAN, target_type: 'profile', status: 'sent' });
    if (!direct.error || !/use_send_like_v2/.test(direct.error.message)) console.log('  direct write result:', direct.error ? direct.error.message : 'NO ERROR (row written)');
    check(!!direct.error && /use_send_like_v2/.test(direct.error.message), 'direct table write by a V2 member is refused');
    const wrongOwner = await send(A, C, 'photo', pB.photos[0].id, null);
    check(wrongOwner.data?.ok === false && wrongOwner.data.error === 'invalid_target', "another person's photo id is refused");
    const wrongPrompt = await send(A, WOMAN, 'prompt', pC.prompts?.[0]?.id ?? rid(), null);
    check(wrongPrompt.data?.ok === false && wrongPrompt.data.error === 'invalid_target', "another person's prompt id is refused");
    const badType = await send(A, WOMAN, 'profile', pB.photos[0].id, null);
    check(badType.data?.ok === false && badType.data.error === 'invalid_target', 'untargeted / unknown type refused');
    const longNote = await send(A, WOMAN, 'photo', pB.photos[1].id, 'x'.repeat(241));
    check(longNote.data?.ok === false && longNote.data.error === 'note_too_long', 'comment over 240 refused');
    check((await likeRows(MAN, WOMAN)).length === 0 && (await quota(A)).remaining === 5, 'failed sends: no like, no quota used');

    // ---- like + comment: one operation, idempotent -------------------------
    const note = 'Which ferry route is your favourite?';
    const r1 = rid();
    const s1 = await send(A, WOMAN, 'photo', pB.photos[1].id, `  ${note}  `, r1);
    check(s1.data?.ok === true && s1.data.replayed === false && s1.data.quota.remaining === 4, 'photo like + comment saved, one like used');
    const rowsAB = await likeRows(MAN, WOMAN);
    check(rowsAB.length === 1 && rowsAB[0].target_type === 'photo' && rowsAB[0].target_key === pB.photos[1].id && rowsAB[0].note === note,
      'DB: the exact photo id + trimmed comment, one row');
    const replays = await Promise.all([1, 2, 3].map(() => send(A, WOMAN, 'photo', pB.photos[1].id, note, r1)));
    check(replays.every((r) => r.data?.ok === true && r.data.replayed === true && r.data.like_id === s1.data.like_id), 'retry with the same request: same result');
    check((await likeRows(MAN, WOMAN)).length === 1 && (await quota(A)).remaining === 4, 'retries/double taps: still one like, one unit used');
    const again = await send(A, WOMAN, 'prompt', pB.prompts[0].id, null);
    check(again.data?.ok === false && again.data.error === 'already_liked' && (await quota(A)).remaining === 4, 'second like to the same person refused, no unit used');
    check(((await A.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? []).every((r) => r.user_id !== WOMAN), 'liked person leaves the sender’s Discover');
    check(((await A.rpc('get_my_matches_v2')).data ?? []).length === 0
      && ((await admin.from('messages').select('id').eq('sender_id', MAN).eq('receiver_id', WOMAN)).data ?? []).length === 0,
      'a comment alone opens no chat and writes no message');

    // ---- receiver: Likes you -----------------------------------------------
    const lockedCards = (await B.rpc('get_my_liker_cards', { p_limit: 50 })).data ?? [];
    check(lockedCards.length >= 1 && lockedCards.every((r) => r.liker_id === null && r.note === null && r.target_photo_path === null),
      'non-premium receiver: count only (premium rule unchanged)');
    await admin.from('profiles').update({ is_premium: true }).eq('id', WOMAN);
    const cards = (await B.rpc('get_my_liker_cards', { p_limit: 50 })).data ?? [];
    const cA = cards.find((r) => r.liker_id === MAN);
    check(cA && cA.note === note && cA.target_type === 'photo' && cA.target_available === true && cA.target_photo_path === pB.photos[1].path,
      'premium receiver sees the comment and WHICH photo it was on');
    // Content gone → never shown as another photo.
    await admin.from('likes').update({ target_key: rid() }).eq('id', s1.data.like_id);
    const gone = ((await B.rpc('get_my_liker_cards', { p_limit: 50 })).data ?? []).find((r) => r.liker_id === MAN);
    check(gone && gone.target_available === false && gone.target_photo_path === null && gone.note === note, 'removed content: marked unavailable, not re-bound');
    await admin.from('likes').update({ target_key: pB.photos[1].id }).eq('id', s1.data.like_id);
    // Hidden sender → disappears from the receiver.
    await admin.from('profiles').update({ is_hidden: true }).eq('id', MAN);
    check(!((await B.rpc('get_my_liker_cards', { p_limit: 50 })).data ?? []).some((r) => r.liker_id === MAN), 'hidden sender is not shown to the receiver');
    await admin.from('profiles').update({ is_hidden: saved.find((x) => x.id === MAN)?.is_hidden ?? false }).eq('id', MAN);

    // ---- mutual: existing match flow, notes not duplicated -----------------
    const r2 = rid();
    const back = await send(B, MAN, 'prompt', pA.prompts[0].id, 'Kadıköy line, obviously.', r2);
    check(back.data?.ok === true && back.data.matched === true, 'receiver likes back (prompt + comment) → matched');
    const m = (await admin.from('matches').select('id, status, chat_opened, source').or(`and(user_a_id.eq.${MAN},user_b_id.eq.${WOMAN}),and(user_a_id.eq.${WOMAN},user_b_id.eq.${MAN})`)).data ?? [];
    check(m.length === 1 && m[0].status === 'accepted' && m[0].chat_opened === true && m[0].source === 'mutual_like', 'one accepted match, chat open (existing flow)');
    await send(B, MAN, 'prompt', pA.prompts[0].id, 'Kadıköy line, obviously.', r2);
    const msgs = (await admin.from('messages').select('sender_id, content').or(`and(sender_id.eq.${MAN},receiver_id.eq.${WOMAN}),and(sender_id.eq.${WOMAN},receiver_id.eq.${MAN})`)).data ?? [];
    check(msgs.length === 2 && msgs.filter((x) => x.content === note).length === 1, 'each comment opens the chat once; retry adds nothing');

    // ---- last unit, concurrent requests ------------------------------------
    await setCount(MAN, 4);
    const pD = (await A.rpc('get_profile_v2', { p_user: D })).data;
    const race = await Promise.all([send(A, C, 'photo', pC.photos[0].id, null), send(A, D, 'photo', pD.photos[0].id, null)]);
    const oks = race.filter((r) => r.data?.ok === true).length;
    const outs = race.filter((r) => r.data?.error === 'quota_exhausted').length;
    const qr = await quota(A);
    check(oks === 1 && outs === 1 && qr.remaining === 0 && qr.used === 5, 'last unit: two concurrent sends → exactly one like');
    check(qr.resets_at !== null, 'server gives the reset time (not shown in UI yet)');
    await admin.from('likes').delete().eq('liker_id', MAN).in('likee_id', [C, D]);
    await setCount(MAN, 0);

    // ---- blocked / hidden / not visible ------------------------------------
    await admin.from('blocks').insert({ blocker_id: D, blocked_id: MAN });
    const blocked = await send(A, D, 'photo', pD.photos[0].id, 'hi');
    check(blocked.data?.ok === false && blocked.data.error === 'not_available', 'blocked pair: like refused');
    check((await A.rpc('get_profile_v2', { p_user: D })).data === null, 'blocked pair: profile not readable');
    await admin.from('blocks').delete().eq('blocker_id', D).eq('blocked_id', MAN);
    await admin.from('profiles').update({ is_hidden: true }).eq('id', C);
    const hidden = await send(A, C, 'photo', pC.photos[0].id, null);
    check(hidden.data?.ok === false && hidden.data.error === 'not_available', 'hidden person: like refused');
    await admin.from('profiles').update({ is_hidden: saved.find((x) => x.id === C)?.is_hidden ?? false }).eq('id', C);
    check((await likeRows(MAN, C)).length === 0 && (await likeRows(MAN, D)).length === 0 && (await quota(A)).remaining === 5,
      'refused sends wrote nothing and used no unit');
    const missing = await send(A, C, 'photo', pC.photos[0].id, null, null);
    check(missing.data?.ok === false && missing.data.error === 'invalid_request', 'missing request id refused');
    const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
    check(!!(await anon.rpc('send_like_v2', { p_likee: C, p_target_type: 'photo', p_target_id: pC.photos[0].id, p_note: null, p_request_id: rid() })).error,
      'signed-out caller refused');
  } finally {
    await cleanup();
    await restore();
  }
  console.log(`smoke_discover_v2 (dev, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<REDACTED>'));
  process.exit(1);
});
