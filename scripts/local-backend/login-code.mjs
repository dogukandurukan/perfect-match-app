// Prints a fresh one-time sign-in code for the LOCAL phone tester (terminal only).
//   node scripts/local-backend/login-code.mjs
import { signInCode } from './_local.mjs';

const EMAIL = 'tempa-matches-tester@tempa-test.example.com';
console.log(`Local tester: ${EMAIL}`);
console.log(`One-time sign-in code: ${await signInCode(EMAIL)}`);
