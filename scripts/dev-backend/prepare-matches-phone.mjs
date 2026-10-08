// Prepares a SEPARATE synthetic phone account for the real V2 Matches test:
//   TEMPA_TARGET=dev node scripts/dev-backend/prepare-matches-phone.mjs
//
// NOT RUN in the 2026-10-09 round: the daily-picks package
// (supabase/proposed/20261009090000_v2_matches_daily_picks.sql) is not
// applied to the shared project (DEV = live). The script refuses to do
// anything until `get_daily_picks_v2` exists on the target.
//
// What it does (synthetic data only; the owner's phone account
// tempa-dev-tester / 13adb65c… is never used or changed):
//   1. creates or completes tempa-matches-tester@tempa-test.example.com
//      through the NORMAL V2 path (same RPCs as the app): a 31-year-old man
//      in İstanbul looking for women, 3 generated "DEV · SYNTHETIC" photos,
//      2 prompts, selfie, consent, submit → reviewer accept;
//   2. creates ONE mutual match with a dev-pool member through send_like_v2
//      from both real sessions (the tester's like is a Discover like; the pool
//      member's is a Discover or daily_pick like as the server allows), so
//      "You both liked" has someone with no message yet;
//   3. prints a fresh one-time sign-in code for the tester (terminal only).
// Idempotent. Prints no keys or URLs.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { renderPortraits } from './portraits.mjs';

process.env.TEMPA_TARGET = 'dev';
const { fail, loadTestEnv } = await import('../test-backend/_env.mjs');
const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL = 'tempa-matches-tester@tempa-test.example.com';
const PHONE_ACCOUNT = '13adb65c';
const must = (r, what) => {
  if (r.error) fail(`${what}: ${r.error.message}`);
  return r.data;
};

async function signIn(email) {
  if (!email.endsWith('@tempa-test.example.com')) fail('not a synthetic account — refusing');
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) fail(`generateLink: ${link.error.message}`);
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) fail(`sign-in failed: ${v.error.message}`);
  if (v.data.user.id.startsWith(PHONE_ACCOUNT)) fail('refusing to use the owner’s phone account');
  return { c, uid: v.data.user.id };
}

const { c, uid } = await signIn(EMAIL);

// 0. Guard: the daily-picks package must exist on this target.
const probe = await c.rpc('get_daily_picks_v2');
if (probe.error && /could not find the function|PGRST202/i.test(`${probe.error.message} ${probe.error.code}`)) {
  fail('get_daily_picks_v2 is not on this project — apply the daily-picks package to a separate test project first. Nothing was changed.');
}

// 1. The tester itself (normal path).
const b = must(await c.rpc('get_my_onboarding_v2'), 'load');
if (b.state.application_status !== 'accepted') {
  if (b.state.application_status === 'draft' || b.state.application_status === 'changes_requested') {
    const save = async (section, data) => must(await c.rpc('save_onboarding_v2', { p_section: section, p_data: data }), `save ${section}`);
    await save('basics', { first_name: 'Tester', last_name: 'Synthetic', date_of_birth: '1995-03-03', gender: 'man', interested_in: ['women'],
      location_id: 'tr-istanbul-kadikoy', location_city: 'İstanbul', location_district: 'Kadıköy', location_label: 'Kadıköy, İstanbul, Turkey', height_cm: 180 });
    await save('compatibility', { intent: 'long_term', social_energy: 'mix', message_frequency: 'few_checkins', relationship_space: 'balance',
      emotional_expression: 'open', meeting_pace: 'after_chatting', core_values: ['trust', 'fun'] });
    await save('yourLife', { smoking: 'no', drinking: 'sometimes', pets: 'like_no_pets', pet_kind: null, activity: 'somewhat' });
    await save('yourWorld', { work_status: 'full_time', job_title: 'Test engineer', school: null, hometown: null,
      interests: ['travel', 'music', 'food'], artists: [], books: [], screen: [] });
    await save('yourDates', { date_types: ['coffee', 'walk'], favorite_spot: null, days_pref: 'weekends', time_pref: 'daytime' });
    const look = { skin: '#C68E68', skinShade: '#AB7552', hair: '#2A1C14', brow: '#2A1C14', hairStyle: 'pixie', top: '#1F3A2E', bg: '#E6ECE3', scene: 'city', accessory: 'glasses', item: 'camera' };
    if ((b.photos ?? []).length < 3) {
      for (const img of renderPortraits(look).slice((b.photos ?? []).length)) {
        const path = `${uid}/${crypto.randomBytes(12).toString('hex')}.png`;
        must(await c.storage.from('profile-photos-private').upload(path, img, { contentType: 'image/png' }), 'upload photo');
        must(await c.rpc('add_profile_photo_v2', { p_path: path }), 'register photo');
      }
    }
    must(await c.rpc('save_prompts_v2', { p_prompts: [
      { slot: 1, prompt_id: 'small_thing_i_love', answer: 'A synthetic test morning coffee.' },
      { slot: 2, prompt_id: 'together_we_could', answer: 'Test every Matches state.' }] }), 'prompts');
    if (!b.state.has_selfie) {
      const sp = `${uid}/${crypto.randomBytes(16).toString('hex')}.png`;
      must(await c.storage.from('verification-selfies').upload(sp, renderPortraits({ ...look, accessory: 'none' })[0], { contentType: 'image/png' }), 'upload selfie');
      must(await c.rpc('set_verification_selfie_v2', { p_path: sp }), 'register selfie');
    }
    must(await c.from('profiles').update({ privacy_consent_at: new Date().toISOString() }).eq('id', uid), 'consent');
    must(await c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() }), 'submit');
  }
  must(await admin.rpc('review_application_v2', { p_user: uid, p_decision: 'accept' }), 'accept');
}

// 2. One mutual match (no message) with a synthetic pool member.
const mine = must(await c.rpc('get_my_matches_v2'), 'matches');
if (mine.length === 0) {
  const today = must(await c.rpc('get_daily_picks_v2'), 'daily picks');
  const cand = must(await c.rpc('get_discovery_candidates_v2', { p_limit: 50 }), 'candidates');
  const users = (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data?.users ?? [];
  const pool = new Map(users.filter((u) => u.email?.startsWith('tempa-pool-')).map((u) => [u.id, u.email]));
  const other = cand.find((r) => pool.has(r.user_id) && r.user_id !== today.pick?.user_id);
  if (!other) fail('no eligible synthetic pool member for the mutual match');
  const firstPhoto = async (client, id) => (await client.rpc('get_profile_v2', { p_user: id })).data?.photos?.[0]?.id;
  const a = must(await c.rpc('send_like_v2', { p_likee: other.user_id, p_target_type: 'photo', p_target_id: await firstPhoto(c, other.user_id), p_note: null, p_request_id: crypto.randomUUID() }), 'like');
  if (!a.ok) fail(`tester like refused: ${a.error}`);
  const { c: oc } = await signIn(pool.get(other.user_id));
  const theirPick = must(await oc.rpc('get_daily_picks_v2'), 'their picks');
  const args = { p_likee: uid, p_target_type: 'photo', p_target_id: await firstPhoto(oc, uid), p_note: null, p_request_id: crypto.randomUUID() };
  if (theirPick.pick?.user_id === uid) args.p_source = 'daily_pick';
  const back = must(await oc.rpc('send_like_v2', args), 'like back');
  if (!back.ok || !back.matched) fail(`like back did not match: ${back.error ?? 'no match'}`);
}

// 3. Sign-in code for the phone (terminal only).
const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL }), 'code');
console.log(`Matches phone tester ready: ${EMAIL}`);
console.log(`One-time sign-in code: ${link.properties.email_otp}`);
