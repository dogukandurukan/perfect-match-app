// Match → chat → date suggestion on the REAL services of perfect-match-dev:
//   TEMPA_TARGET=dev node scripts/test-backend/smoke_match_chat_v2.mjs
// Uses two EXISTING synthetic V2 members (never the owner's phone test
// account or personal accounts). Sign-in is the normal email-code path
// (admin generateLink → email_otp → client verifyOtp). The pair ends
// unmatched; a re-run first clears only this pair's own test rows
// (likes / match / suggestions / messages / blocks between these two ids).
// Prints pass/fail only — no keys, codes or URLs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv, outDir } from './_env.mjs';

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const MAN = 'cca06005-cf37-4928-ba40-81456d7831f1';
const WOMAN = '67acc178-1a83-4d2f-b38b-8392329cc501';
const OUTSIDER = '2344b540-d011-402d-805f-b9dd113ecae8';

let passed = 0;
let failed = 0;
const results = [];
const check = (c, n) => {
  results.push({ name: n, ok: !!c });
  if (c) passed += 1;
  else { failed += 1; console.log('FAIL', n); }
};
const errIs = (r, t) => !!r.error && (r.error.message ?? '').includes(t);

async function signIn(id) {
  const u = (await admin.auth.admin.getUserById(id)).data.user;
  if (!u?.email?.endsWith('@tempa-test.example.com')) fail(`${id} is not a synthetic account — refusing`);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.email });
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ email: u.email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) fail(`sign-in failed for a synthetic account: ${v.error.message}`);
  return c;
}

const pairFilter = (q, a, b) => q.or(`and(user_a_id.eq.${a},user_b_id.eq.${b}),and(user_a_id.eq.${b},user_b_id.eq.${a})`);

async function resetPair() {
  const ms = (await pairFilter(admin.from('matches').select('id'), MAN, WOMAN)).data ?? [];
  for (const m of ms) await admin.from('date_proposals_v2').delete().eq('match_id', m.id);
  await pairFilter(admin.from('matches').delete(), MAN, WOMAN);
  await admin.from('likes').delete().or(`and(liker_id.eq.${MAN},likee_id.eq.${WOMAN}),and(liker_id.eq.${WOMAN},likee_id.eq.${MAN})`);
  await admin.from('messages').delete().or(`and(sender_id.eq.${MAN},receiver_id.eq.${WOMAN}),and(sender_id.eq.${WOMAN},receiver_id.eq.${MAN})`);
  await admin.from('blocks').delete().or(`and(blocker_id.eq.${MAN},blocked_id.eq.${WOMAN}),and(blocker_id.eq.${WOMAN},blocked_id.eq.${MAN})`);
  await admin.from('notifications').delete().in('user_id', [MAN, WOMAN]).in('related_user_id', [MAN, WOMAN]);
}

async function main() {
  await resetPair();
  const A = await signIn(MAN);
  const B = await signIn(WOMAN);
  const O = await signIn(OUTSIDER);
  const pair = async () => (await pairFilter(admin.from('matches').select('id, status, chat_opened, source, meetup_confirmed, confirmed_place'), MAN, WOMAN)).data ?? [];
  const fut = (h) => new Date(Date.now() + h * 3600e3).toISOString();

  // ---- likes → match ---------------------------------------------------------
  check(!(await A.from('likes').insert({ liker_id: MAN, likee_id: WOMAN, target_type: 'profile', status: 'sent' })).error, 'A likes B');
  check((await pair()).every((m) => m.status !== 'accepted' && m.chat_opened !== true), 'one-sided like: no match, no chat');
  check(((await A.rpc('get_my_matches_v2')).data ?? []).length === 0, 'one-sided like: Matches empty');
  check(!!(await A.from('messages').insert({ sender_id: MAN, receiver_id: WOMAN, content: 'early' })).error, 'one-sided like: no messages');
  // ---- "Likes you" → shared V2 profile (before the match) ------------------
  const bPremium = (await admin.from('profiles').select('is_premium').eq('id', WOMAN).single()).data?.is_premium === true;
  const cards = (await B.rpc('get_my_liker_cards', { p_limit: 50 })).data ?? [];
  const card = cards.find((r) => r.liker_id === MAN);
  check(bPremium ? !!card : cards.every((r) => r.liker_id === null),
    `Likes you: identity only for premium (B premium=${bPremium})`);
  const lp = (await B.rpc('get_profile_v2', { p_user: MAN })).data;
  const ALLOWED = ['activity', 'age', 'artists', 'books', 'city', 'core_values', 'date_types', 'days_pref', 'drinking',
    'favorite_spot', 'first_name', 'height_cm', 'hometown', 'intent', 'interests', 'job_title', 'pet_kind', 'pets',
    'photo_paths', 'prompts', 'school', 'screen', 'smoking', 'time_pref', 'user_id', 'work_status', 'zodiac'];
  check(lp && JSON.stringify(Object.keys(lp).sort()) === JSON.stringify(ALLOWED), 'Likes you → full V2 profile with only the allowed fields');
  check(((await B.from('onboarding_v2').select('first_name').eq('user_id', MAN)).data ?? []).length === 0, 'Likes you: raw draft not readable');
  check(errIs(await O.rpc('propose_date_v2', { p_match: crypto.randomUUID(), p_meeting_at: new Date(Date.now() + 3600e3).toISOString(), p_place: null, p_request_id: crypto.randomUUID() }), 'chat_not_active'),
    'no suggestion without a match');
  check(!(await B.from('likes').insert({ liker_id: WOMAN, likee_id: MAN, target_type: 'profile', status: 'sent' })).error, 'B likes A back');
  const p0 = await pair();
  check(p0.length === 1 && p0[0].status === 'accepted' && p0[0].chat_opened === true && p0[0].source === 'mutual_like',
    'mutual like: exactly one match, chat open');
  const mid = p0[0].id;
  const ma = (await A.rpc('get_my_matches_v2')).data ?? [];
  check(ma.length === 1 && ma[0].other_id === WOMAN && !!ma[0].first_name
    && Object.keys(ma[0]).every((k) => !/score|percent|category|reason/.test(k)), 'Matches: the real match only, no score fields');
  check(!((await A.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? []).some((r) => r.user_id === WOMAN), 'matched → not in Discover');
  check(!!(await B.rpc('get_profile_v2', { p_user: MAN })).data, 'matched: profile opens');
  check(!(await A.from('messages').insert({ sender_id: MAN, receiver_id: WOMAN, content: 'Hello!' })).error, 'chat: A says hello');
  check(!!(await A.from('matches').update({ invited_by: MAN }).eq('id', mid)).error, 'no pre-match / new invitations from clients');

  // ---- suggestion, counter, accept ------------------------------------------
  check(errIs(await A.rpc('propose_date_v2', { p_match: mid, p_meeting_at: new Date(Date.now() - 60000).toISOString(), p_place: null, p_request_id: crypto.randomUUID() }), 'invalid_time'),
    'a past time is refused by the server');
  const r1 = crypto.randomUUID();
  const s1 = await A.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(48), p_place: 'Moda', p_request_id: r1 });
  check(!s1.error && s1.data.status === 'pending' && s1.data.mine === true, 'A suggests a date → pending ("Awaiting reply")');
  const taps = await Promise.all([1, 2, 3].map(() => A.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(48), p_place: 'Moda', p_request_id: r1 })));
  const count = async () => ((await admin.from('date_proposals_v2').select('id').eq('match_id', mid)).data ?? []).length;
  check(taps.every((t) => !t.error && t.data.id === s1.data.id) && (await count()) === 1, '3 rapid repeat taps: one suggestion');
  check(errIs(await A.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(50), p_place: null, p_request_id: crypto.randomUUID() }), 'proposal_pending'),
    'one pending suggestion at a time');
  check(errIs(await A.rpc('respond_date_v2', { p_proposal: s1.data.id, p_action: 'accept' }), 'cannot_respond_own_proposal'),
    'A cannot accept own suggestion');
  const chatB = (await B.rpc('get_chat_v2', { p_match: mid })).data;
  check(chatB?.active === true && chatB.proposals.length === 1 && chatB.proposals[0].mine === false, 'B sees the card (Accept / Suggest another time / Not now)');
  const r2 = crypto.randomUUID();
  const c1 = await B.rpc('respond_date_v2', { p_proposal: s1.data.id, p_action: 'counter', p_meeting_at: fut(72), p_place: 'Karaköy', p_request_id: r2 });
  check(!c1.error && c1.data.status === 'pending' && c1.data.reply_to === s1.data.id, 'B suggests another time → pending, linked');
  const c1b = await B.rpc('respond_date_v2', { p_proposal: s1.data.id, p_action: 'counter', p_meeting_at: fut(72), p_place: 'Karaköy', p_request_id: r2 });
  check(!c1b.error && c1b.data.id === c1.data.id && (await count()) === 2, 'repeat counter: no duplicate');
  check((await pair())[0].meetup_confirmed !== true, 'a suggestion / counter is NOT an accepted plan');
  const planA = (await A.rpc('get_my_date_plans_v2')).data ?? [];
  check(planA.length === 1 && planA[0].status === 'pending' && planA[0].mine === false, 'Plans: A has one suggestion to answer');
  check(errIs(await B.rpc('respond_date_v2', { p_proposal: c1.data.id, p_action: 'accept' }), 'cannot_respond_own_proposal'),
    'B cannot accept own counter');
  const acc = await A.rpc('respond_date_v2', { p_proposal: c1.data.id, p_action: 'accept' });
  check(!acc.error && acc.data.status === 'accepted', 'A accepts → accepted');
  check((await A.rpc('respond_date_v2', { p_proposal: c1.data.id, p_action: 'accept' })).data?.already === true, 'repeat accept: no change');
  const after = (await pair())[0];
  check(after.meetup_confirmed === true && after.confirmed_place === 'Karaköy', 'the agreed plan is on the match');
  const planB = (await B.rpc('get_my_date_plans_v2')).data ?? [];
  check(planB.length === 1 && planB[0].status === 'accepted', 'Plans: one accepted plan, pending list empty');
  check(!!(await A.from('matches').update({ meeting_at: fut(200) }).eq('id', mid)).error, 'direct date-column writes are refused');
  const nB = (await B.from('notifications').select('type').eq('related_user_id', MAN)).data ?? [];
  const nA = (await A.from('notifications').select('type').eq('related_user_id', WOMAN)).data ?? [];
  // A suggested → B notified; B countered → A notified; A accepted B's counter → B notified.
  check(nB.some((n) => n.type === 'date_proposed') && nB.some((n) => n.type === 'date_accepted') && nA.some((n) => n.type === 'date_proposed'),
    'real Activity events: date_proposed / date_accepted');

  // ---- outsider ---------------------------------------------------------------
  check((await O.rpc('get_chat_v2', { p_match: mid })).data === null, 'outsider: no chat state');
  check(((await O.from('date_proposals_v2').select('id').eq('match_id', mid)).data ?? []).length === 0, 'outsider: cannot read suggestions');
  check(errIs(await O.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(30), p_place: null, p_request_id: crypto.randomUUID() }), 'chat_not_active'),
    'outsider: cannot suggest');
  check(errIs(await O.rpc('respond_date_v2', { p_proposal: c1.data.id, p_action: 'decline' }), 'proposal_not_found'), 'outsider: cannot respond');

  // ---- block, then unmatch -------------------------------------------------
  const s3 = await B.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(96), p_place: null, p_request_id: crypto.randomUUID() });
  check(!s3.error && s3.data.status === 'pending', 'B suggests a new date (reschedule)');
  check(!(await B.from('blocks').insert({ blocker_id: WOMAN, blocked_id: MAN })).error, 'B blocks A');
  check(errIs(await A.rpc('respond_date_v2', { p_proposal: s3.data.id, p_action: 'accept' }), 'chat_not_active'), 'after block: accept refused');
  check(errIs(await A.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(30), p_place: null, p_request_id: crypto.randomUUID() }), 'chat_not_active'),
    'after block: suggestion refused');
  check(((await A.rpc('get_my_matches_v2')).data ?? []).length === 0, 'after block: gone from Matches');
  check((await A.rpc('get_profile_v2', { p_user: WOMAN })).data === null, 'after block: profile closed');
  check(!!(await A.from('messages').insert({ sender_id: MAN, receiver_id: WOMAN, content: 'x' })).error, 'after block: no messages');
  await admin.from('blocks').delete().eq('blocker_id', WOMAN).eq('blocked_id', MAN);
  const un = await A.rpc('unmatch_v2', { p_match: mid });
  check(!un.error && un.data.status === 'passed', 'A unmatches');
  check((await A.rpc('unmatch_v2', { p_match: mid })).data?.already === true, 'repeat unmatch: no change');
  check(errIs(await A.rpc('respond_date_v2', { p_proposal: s3.data.id, p_action: 'accept' }), 'proposal_not_pending'), 'after unmatch: pending suggestion cancelled');
  check(errIs(await B.rpc('propose_date_v2', { p_match: mid, p_meeting_at: fut(30), p_place: null, p_request_id: crypto.randomUUID() }), 'chat_not_active'),
    'after unmatch: suggestion refused');
  check(!!(await B.from('messages').insert({ sender_id: WOMAN, receiver_id: MAN, content: 'x' })).error, 'after unmatch: no messages');
  check((await B.rpc('get_profile_v2', { p_user: MAN })).data === null && (await A.rpc('get_profile_v2', { p_user: WOMAN })).data === null,
    'after unmatch: profiles closed both ways (old card / direct link)');
  check(((await B.rpc('get_my_matches_v2')).data ?? []).length === 0, 'after unmatch: gone from Matches');
  check(!((await B.rpc('get_discovery_candidates_v2', { p_limit: 50 })).data ?? []).some((r) => r.user_id === MAN), 'after unmatch: not back in Discover');

  fs.writeFileSync(path.join(outDir, `evidence-match-chat-${Date.now()}.json`), JSON.stringify({ mid, results,
    proposals: (await admin.from('date_proposals_v2').select('status, reply_to, created_at').eq('match_id', mid).order('created_at')).data,
    match: (await pair())[0] }, null, 1), { mode: 0o600 });
  console.log(`[smoke match-chat v2] ${env.ref}: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
await main();
