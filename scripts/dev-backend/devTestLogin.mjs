// DEV test sign-in helper (Mac only; never shipped in the app).
// Issues a REAL one-time Supabase email code for ONE allowed synthetic test
// account on the dev project, using the Auth admin API (generateLink →
// email_otp). No email is sent, so it does not depend on the Magic Link
// template or SMTP. The app verifies the code with the normal verifyOtp call
// and gets a normal session — there is no bypass, no fixed code, no password
// and no admin key in the app.
//
// Guards: dev project only (TEMPA_TARGET=dev, .env.dev.local); only
// @tempa-test.example.com addresses; the account has no password.
import { createClient } from '@supabase/supabase-js';

process.env.TEMPA_TARGET = 'dev';
const { DEV_REF, fail, loadTestEnv } = await import('../test-backend/_env.mjs');

export const DEV_TEST_EMAIL = 'tempa-dev-tester@tempa-test.example.com';
const ALLOWED = /^[a-z0-9._+-]+@tempa-test\.example\.com$/;

export function devAdmin() {
  const env = loadTestEnv({ needService: true });
  if (env.ref !== DEV_REF) fail('dev project only');
  return { env, admin: createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

/** Ensures the synthetic account exists (created without a password). */
export async function ensureTestAccount(admin, email) {
  if (!ALLOWED.test(email)) fail('only @tempa-test.example.com test accounts are allowed');
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email === email);
    if (hit) return { id: hit.id, created: false };
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) fail(`createUser: ${error.message}`);
  return { id: data.user.id, created: true };
}

/** A fresh real one-time code (replaces any earlier unused one). */
export async function issueCode(admin, email) {
  if (!ALLOWED.test(email)) fail('only @tempa-test.example.com test accounts are allowed');
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) fail(`generateLink: ${error.message}`);
  const code = data?.properties?.email_otp;
  if (!code) fail('no email_otp returned');
  return code;
}
