// Verifies the DEV test sign-in on the real dev project without printing any
// code: real OTP → real session → onboarding from the start → resume after a
// new sign-in; older code invalid; real addresses refused; personal accounts
// untouched. Uses a throwaway synthetic account so the DEV test account itself
// stays fresh.   node scripts/dev-backend/verify-test-login.mjs
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { DEV_TEST_EMAIL, devAdmin, ensureTestAccount, issueCode } from './devTestLogin.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));
const { env, admin } = devAdmin();
const anon = () => createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// personal accounts: snapshot (ids + updated_at only)
const personal = async () =>
  (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users
    .filter((u) => !u.email?.endsWith('@tempa-test.example.com'))
    .map((u) => `${u.id}:${u.updated_at}`).sort().join('|');
const before = await personal();

// a real address is refused (run as a child so its exit doesn't stop us)
const refuse = spawnSync(process.execPath, ['--input-type=module', '-e',
  "import('./scripts/dev-backend/devTestLogin.mjs').then(async (m) => { const { admin } = m.devAdmin(); await m.issueCode(admin, 'someone@gmail.com'); console.log('ISSUED'); })"],
  { encoding: 'utf8' });
check(refuse.status !== 0 && !refuse.stdout.includes('ISSUED'), 'a real (non-test) address is refused');

const email = `tempa-dev-verify-${crypto.randomBytes(3).toString('hex')}@tempa-test.example.com`;
const acc = await ensureTestAccount(admin, email);
check(acc.created, 'throwaway synthetic account created (no password)');
const oldCode = await issueCode(admin, email);
const code = await issueCode(admin, email);
const c1 = anon();
const stale = await c1.auth.verifyOtp({ email, token: oldCode, type: 'email' });
check(!!stale.error, 'an older code no longer works once a newer one is issued');
const v = await c1.auth.verifyOtp({ email, token: code, type: 'email' });
check(!v.error && !!v.data.session, 'the one-time code opens a real session');
const reuse = await anon().auth.verifyOtp({ email, token: code, type: 'email' });
check(!!reuse.error, 'the same code cannot be used twice');

const b1 = await c1.rpc('get_my_onboarding_v2');
check(!b1.error && b1.data.state.application_status === 'draft' && !b1.data.draft.resume_section,
  'onboarding starts from the beginning (empty draft)');
check((await c1.rpc('get_my_access_v2')).data?.gate === 'onboarding', 'gate: onboarding (no Home)');
const sv = await c1.rpc('save_onboarding_v2', { p_section: 'basics', p_data: { first_name: 'Verify', last_name: 'Test' }, p_resume_step: 2 });
check(!sv.error, 'answer saved on the server');

const c2 = anon(); // "app reopened / signed in again"
const v2 = await c2.auth.verifyOtp({ email, token: await issueCode(admin, email), type: 'email' });
check(!v2.error, 'signing in again with a new code');
const b2 = (await c2.rpc('get_my_onboarding_v2')).data;
check(b2?.draft?.first_name === 'Verify' && b2?.draft?.resume_section === 'basics' && b2?.draft?.resume_step === 2,
  'resumes at the saved step with the saved answer');
check(!!(await c2.from('account_state_v2').update({ application_status: 'accepted' }).eq('user_id', v.data.user.id)).error
  || (await admin.from('account_state_v2').select('application_status').eq('user_id', v.data.user.id).single()).data?.application_status === 'draft',
  'server permissions unchanged: the test session cannot approve itself');

const tester = await ensureTestAccount(admin, DEV_TEST_EMAIL);
const testerProfile = await admin.from('profiles').select('id').eq('id', tester.id);
check((testerProfile.data ?? []).length === 0, `DEV test account ${tester.created ? 'created' : 'exists'} and has not started onboarding`);
check((await personal()) === before, 'personal accounts untouched');

console.log(`[verify test login] ${env.ref}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
