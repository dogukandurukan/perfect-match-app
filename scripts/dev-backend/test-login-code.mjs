// Prints a fresh one-time sign-in code for the DEV test account (your own
// terminal only). Run again whenever you need a new code.
//   node scripts/dev-backend/test-login-code.mjs
import { DEV_TEST_EMAIL, devAdmin, ensureTestAccount, issueCode } from './devTestLogin.mjs';

const { admin } = devAdmin();
const acc = await ensureTestAccount(admin, DEV_TEST_EMAIL);
const code = await issueCode(admin, DEV_TEST_EMAIL);
console.log('');
console.log('  DEV test account:', DEV_TEST_EMAIL, acc.created ? '(created now — starts onboarding from the beginning)' : '');
console.log('  One-time sign-in code:', code, '  (single use; a newer code replaces it)');
console.log('');
