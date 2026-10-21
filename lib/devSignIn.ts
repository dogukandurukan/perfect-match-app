// DEV-only test sign-in help text (pure). The phone's "DEV · Test account
// sign-in" screen is bound to the account Metro was started with
// (TEMPA_DEV_TEST_EMAIL, set by start-app.sh). A code made for another
// account is refused there; switching accounts means restarting Metro with
// that account and reopening the app — a Metro restart alone does not change
// who is signed in on the phone.

/** Command that prints a new code for THIS backend and THIS account. */
export function devCodeCommand(env: string, email: string): string {
  if (env === 'local') return `node scripts/local-backend/login-code.mjs ${email}`;
  return 'node scripts/dev-backend/test-login-code.mjs';
}

/** How to sign in as a different test account on this backend. */
export function devSwitchAccountHint(env: string): string {
  if (env === 'local') return 'Another account? Stop Metro, run scripts/local-backend/start-app.sh <email>, then reopen the app and sign out first.';
  return 'Another account? Stop Metro, run scripts/dev-backend/start-app.sh, then reopen the app and sign out first.';
}
