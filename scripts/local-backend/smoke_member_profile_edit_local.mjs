// Profile → Edit profile, Package 1, on the LOCAL Supabase (real Postgres +
// Auth + PostgREST, real JWTs): update_member_profile_v2.
//   node scripts/local-backend/smoke_member_profile_edit_local.mjs
// FRESH synthetic people only (tempa-local-mpe-<tag>-*); never the phone
// accounts and never .test-backend.
//   M  member being edited (woman)      V  member who views M (man)
//   X  another member                   D  draft applicant
//   S  submitted applicant              Z  suspended member
import crypto from 'node:crypto';
import { admin, env, ensureMember, fillApplication, LOOKS, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const norm = (v) => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])])) : v);
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const upd = (c, changes, expected) => c.rpc('update_member_profile_v2', { p_changes: changes, p_expected: expected });
const row = async (uid) => (await admin.from('onboarding_v2').select('*').eq('user_id', uid).single()).data;
const state = async (uid) => (await admin.from('account_state_v2').select('application_status, verification_status, membership_status, reviewed_at, review_note, submitted_at').eq('user_id', uid).single()).data;
const base = { city: 'İstanbul', district: 'Kadıköy' };

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-mpe-${tag}-${k}@tempa-test.example.com`;
  const M = await ensureMember({ ...base, email: mail('m'), first: 'Mina', gender: 'woman', interested: ['men'], dob: '1994-04-04', look: LOOKS[1] });
  const V = await ensureMember({ ...base, email: mail('v'), first: 'Veli', gender: 'man', interested: ['women'], dob: '1992-02-02', look: LOOKS[5] });
  const X = await ensureMember({ ...base, email: mail('x'), first: 'Xena', gender: 'woman', interested: ['men'], dob: '1995-05-05', look: LOOKS[3] });
  // M answered the private version-3 questions before approval (fixture).
  const PRIVATE = { intent: 'one_night', intent_also: ['casual'], connection: ['gradual'] };
  await admin.from('connection_answers_v2').insert({ user_id: M.uid, version: 3, answers: PRIVATE });
  const st0 = await state(M.uid);
  const r0 = await row(M.uid);
  const pub = async () => (await V.c.rpc('get_profile_v2', { p_user: M.uid })).data;

  // Looking for: clear → not shown; add → shown; never derived from private answers.
  let r = (await upd(M.c, { intent: null }, { intent: 'long_term' })).data;
  check(r?.ok === true && r.profile.intent === null && (await row(M.uid)).intent === null, 'Looking for cleared');
  check((await pub())?.intent == null, 'cleared Looking for → not on the public profile');
  check((await M.c.rpc('get_my_access_v2')).data?.gate === 'member' && !(await V.c.rpc('get_discovery_candidates_v2', { p_limit: 20 })).error && !(await M.c.rpc('get_daily_picks_v2')).error,
    'without Looking for: still a member; discovery and daily picks work');
  r = (await upd(M.c, { intent: 'casual' }, { intent: null })).data;
  check(r?.ok === true && (await pub())?.intent === 'casual', 'Looking for added → shown on the public profile');
  check(/invalid_value/.test((await upd(M.c, { intent: 'one_night' }, { intent: 'casual' })).data?.error ?? ''), 'new private intention ids are not valid "Looking for" values');

  // Height, work status (job title kept), lifestyle, first dates.
  check((await upd(M.c, { height_cm: 180 }, { height_cm: 170 })).data?.ok === true && (await pub())?.height_cm === 180, 'height saved and public');
  r = (await upd(M.c, { work_status: 'student' }, { work_status: 'full_time' })).data;
  const afterWork = await row(M.uid);
  check(r?.ok === true && afterWork.work_status === 'student' && afterWork.job_title === r0.job_title && (await pub())?.job_title === r0.job_title, 'work status changed; job title kept (and still what the profile shows)');
  check((await upd(M.c, { work_status: null }, { work_status: 'student' })).data?.ok === true && (await row(M.uid)).work_status === null, 'work status optional (cleared)');
  check(/invalid_value/.test((await upd(M.c, { pets: 'have_pets' }, { pets: 'like_no_pets' })).data?.error ?? '') && (await row(M.uid)).pets === 'like_no_pets', '"I have pets" without a kind → refused, unchanged');
  check((await upd(M.c, { pets: 'have_pets', pet_kind: 'cat' }, { pets: 'like_no_pets', pet_kind: null })).data?.ok === true && (await row(M.uid)).pet_kind === 'cat', '"I have pets" + kind saved');
  r = (await upd(M.c, { pets: 'neutral' }, { pets: 'have_pets' })).data;
  check(r?.ok === true && (await row(M.uid)).pet_kind === null && r.profile.pet_kind === null, 'another pets answer clears the old kind (final values)');
  check((await upd(M.c, { smoking: 'sometimes', activity: 'very' }, { smoking: 'no', activity: 'somewhat' })).data?.ok === true, 'lifestyle saved');
  r = (await upd(M.c, { date_types: ['dinner'], days_pref: 'either', time_pref: 'evening' }, { date_types: ['coffee', 'walk'], days_pref: 'weekends', time_pref: 'daytime' })).data;
  const p1 = await pub();
  check(r?.ok === true && same(p1?.date_types, ['dinner']) && p1?.days_pref === 'either' && p1?.time_pref === 'evening', 'first-date choices saved and public');

  // Persistence in a fresh session.
  const M2 = await signIn(mail('m'));
  const d2 = (await M2.c.rpc('get_my_onboarding_v2')).data?.draft;
  check(d2?.intent === 'casual' && d2.height_cm === 180 && d2.work_status === null && d2.pets === 'neutral' && d2.smoking === 'sometimes' && same(d2.date_types, ['dinner']) && d2.favorite_spot === r0.favorite_spot,
    'a fresh session (reopen) reads the saved values; favorite spot unchanged');

  // Refused: unknown / locked fields, invalid values, malformed requests — nothing written.
  const before = await row(M.uid);
  const refused = [
    ['first name', { first_name: 'Hacker' }, { first_name: 'Mina' }, 'field_not_editable'],
    ['job title', { job_title: 'CEO' }, { job_title: r0.job_title }, 'field_not_editable'],
    ['favorite spot', { favorite_spot: 'Moda' }, { favorite_spot: null }, 'field_not_editable'],
    ['gender', { gender: 'man' }, { gender: 'woman' }, 'field_not_editable'],
    ['height 300', { height_cm: 300 }, { height_cm: 180 }, 'invalid_value'],
    ['height 170.5', { height_cm: 170.5 }, { height_cm: 180 }, 'invalid_value'],
    ['height as text', { height_cm: '175' }, { height_cm: 180 }, 'invalid_value'],
    ['smoking cleared', { smoking: null }, { smoking: 'sometimes' }, 'invalid_value'],
    ['3 date types', { date_types: ['coffee', 'walk', 'dinner'] }, { date_types: ['dinner'] }, 'invalid_value'],
    ['no date type', { date_types: [] }, { date_types: ['dinner'] }, 'invalid_value'],
    ['duplicate date type', { date_types: ['dinner', 'dinner'] }, { date_types: ['dinner'] }, 'invalid_value'],
    ['unknown time', { time_pref: 'night' }, { time_pref: 'evening' }, 'invalid_value'],
    ['expected keys ≠ changed keys', { height_cm: 181 }, {}, 'invalid_request'],
    ['empty change', {}, {}, 'invalid_request'],
  ];
  for (const [name, ch, ex, code] of refused) check((await upd(M.c, ch, ex)).data?.error === code, `${name} → ${code}`);
  check(same(await row(M.uid), before), 'after the refusals the row is unchanged');

  // Concurrency: stale expected value → profile_changed, nothing written; field-level.
  check((await upd(M.c, { height_cm: 175 }, { height_cm: 170 })).data?.error === 'profile_changed' && (await row(M.uid)).height_cm === 180, 'stale expected value → profile_changed, nothing written');
  const ints = await M.c.rpc('save_interests_v2', { p_interests: ['travel', 'music'], p_activities: [], p_artists: [], p_books: [], p_screen: [], p_remove_take: false });
  check(!ints.error && (await upd(M.c, { height_cm: 176 }, { height_cm: 180 })).data?.ok === true, 'an unrelated edit (interests) doesn’t cause a conflict');
  const both = await Promise.all([upd(M.c, { height_cm: 177 }, { height_cm: 176 }), upd(M.c, { height_cm: 178 }, { height_cm: 176 })]);
  const oks = both.filter((x) => x.data?.ok === true).length;
  const conflicts = both.filter((x) => x.data?.error === 'profile_changed').length;
  check(oks === 1 && conflicts === 1 && [177, 178].includes((await row(M.uid)).height_cm), 'two simultaneous saves from the same loaded value → one wins, the other gets profile_changed');

  // Permissions.
  const D = await signIn(mail('d'));
  await fillApplication(D.c, D.uid, { ...base, first: 'Deniz', gender: 'woman', interested: ['men'], dob: '1996-06-06', look: LOOKS[2] });
  check(/not_member/.test((await upd(D.c, { height_cm: 175 }, { height_cm: 170 })).error?.message ?? '') && (await row(D.uid)).height_cm === 170, 'draft applicant → refused (onboarding lock untouched)');
  const S = await signIn(mail('s'));
  await fillApplication(S.c, S.uid, { ...base, first: 'Seda', gender: 'woman', interested: ['men'], dob: '1993-03-03', look: LOOKS[4] });
  await S.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() });
  check(/not_member/.test((await upd(S.c, { height_cm: 175 }, { height_cm: 170 })).error?.message ?? ''), 'submitted applicant → refused');
  check(/application_locked/.test((await S.c.rpc('save_onboarding_v2', { p_section: 'basics', p_data: { height_cm: 175 } })).error?.message ?? ''), 'general onboarding lock still refuses a submitted applicant');
  const Z = await ensureMember({ ...base, email: mail('z'), first: 'Zeynep', gender: 'woman', interested: ['men'], dob: '1991-01-01', look: LOOKS[0] });
  await admin.from('account_state_v2').update({ membership_status: 'suspended' }).eq('user_id', Z.uid);
  check(/not_member/.test((await upd(Z.c, { height_cm: 175 }, { height_cm: 170 })).error?.message ?? ''), 'suspended member → refused');
  const xBefore = await row(X.uid);
  await upd(X.c, { height_cm: 160 }, { height_cm: 170 });
  check((await row(X.uid)).height_cm === 160 && (await row(M.uid)).height_cm !== 160, 'a member can only change their own profile');
  check(same({ ...xBefore, height_cm: 160, updated_at: null }, { ...(await row(X.uid)), updated_at: null }), 'nothing else on that member changed');
  const anon = await fetch(`${env.url}/rest/v1/rpc/update_member_profile_v2`, { method: 'POST', headers: { apikey: env.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_changes: { height_cm: 175 }, p_expected: { height_cm: 170 } }) });
  check(anon.status >= 400, 'signed out → refused');
  check(!!(await M.c.rpc('v2_member_profile_fields', { o: null })).error, 'helper not callable by apps');

  // Status and private preferences unchanged.
  check(same(await state(M.uid), st0), 'application / verification / membership / review fields unchanged');
  const priv = (await admin.from('connection_answers_v2').select('answers').eq('user_id', M.uid).eq('version', 3).single()).data?.answers;
  const pubText = JSON.stringify(await pub());
  check(same(priv, PRIVATE) && (await pub())?.intent === 'casual' && !/one_night|intent_also|gradual/.test(pubText), 'private preferences untouched, not used for Looking for, not on the profile');

  console.log(`smoke_member_profile_edit_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
