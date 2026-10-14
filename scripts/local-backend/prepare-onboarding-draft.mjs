// A separate synthetic DRAFT applicant for the D93 phone test, LOCAL Supabase
// only. Everything before "A little more you" is filled through the normal
// V2 path (real Auth code, Storage uploads, onboarding RPCs — the same helper
// the other local scripts use); Running is saved as an activity; standard
// prompts and conversation starters stay EMPTY; nothing is submitted. The
// resume position is set with save_onboarding_v2's normal resume fields, so
// the app opens at "A little more you" after a normal sign-in (no bypass).
//
//   node scripts/local-backend/prepare-onboarding-draft.mjs            # set 1
//   node scripts/local-backend/prepare-onboarding-draft.mjs --set 2    # a fresh one
//
// Only touches tempa-onb-draft-<set>@tempa-test.example.com. If that account
// already has answers or was submitted, it is reported and left unchanged.
import { execFileSync } from 'node:child_process';
import { admin, fail, fillApplication, LOOKS, must, signIn } from './_local.mjs';

const i = process.argv.indexOf('--set');
const set = (i > 0 ? process.argv[i + 1] : '1') ?? '1';
if (!/^[a-z0-9]{1,8}$/.test(set)) fail('--set must be 1–8 lowercase letters / digits');
const email = `tempa-onb-draft-${set}@tempa-test.example.com`;

const { c, uid } = await signIn(email);
const b = must(await c.rpc('get_my_onboarding_v2'), 'load');
const takesNow = must(await c.rpc('get_my_interests_v2'), 'interests').takes ?? [];
if (b.state.application_status !== 'draft' || (b.prompts ?? []).length > 0 || takesNow.length > 0) {
  console.log(`[draft] ${email} is ${b.state.application_status} with ${(b.prompts ?? []).length} prompt(s) and ${takesNow.length} starter(s) — left unchanged. Use --set <new> for a fresh draft.`);
  process.exit(0);
}

// Every section before "A little more you" (photos, selfie, consent, …); no prompts.
await fillApplication(c, uid, {
  email, first: 'Deniz', gender: 'woman', interested: ['men'], dob: '1995-05-15',
  city: 'İstanbul', district: 'Kadıköy', look: LOOKS[3], prompts: [],
});
// Running as an activity (normal Your World save) + resume at "A little more you".
must(await c.rpc('save_onboarding_v2', {
  p_section: 'yourWorld',
  p_data: { interests: ['travel', 'music', 'food'], activities: ['running'] },
  p_resume_step: 2,
  p_resume_section: 'yourProfile',
}), 'your world + resume');

const after = must(await c.rpc('get_my_onboarding_v2'), 'reload');
const missing = execFileSync('docker', ['exec', '-i', 'supabase_db_tempa-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
  `select array_to_string(public.v2_missing_for('${uid}'), ',')`]).toString().trim();
console.log(`[draft] ${email}`);
console.log(`[draft] status ${after.state.application_status} · photos ${after.photos.length} · selfie ${after.state.has_selfie} · prompts ${after.prompts.length} · starters ${(must(await c.rpc('get_my_interests_v2'), 'i').takes ?? []).length}`);
console.log(`[draft] activities ${after.draft.activities?.join(',')} · resume ${after.draft.resume_section}/${after.draft.resume_step}`);
console.log(`[draft] still missing for submit: ${missing || '(nothing)'}  (expected: yourProfile.prompts only)`);
const confirmed = (await admin.auth.admin.getUserById(uid)).data.user?.email_confirmed_at;
console.log(`[draft] email confirmed: ${!!confirmed}`);
