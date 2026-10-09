// Fresh one-time sign-in code for the LOCAL phone tester. A newer code always
// replaces the previous one. Shown in the terminal AND written to
// .test-backend/local-phone-code.txt (git-ignored, overwritten each time), so
// it can't be lost when Metro clears the screen.
//   node scripts/local-backend/login-code.mjs
import fs from 'node:fs';
import path from 'node:path';
import { repo, signInCode } from './_local.mjs';

const EMAIL = 'tempa-matches-tester@tempa-test.example.com';
const code = await signInCode(EMAIL);
const dir = path.join(repo, '.test-backend');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, 'local-phone-code.txt');
const at = new Date();
fs.writeFileSync(file, `LOCAL tester: ${EMAIL}\nCode: ${code}\nCreated: ${at.toISOString()} (valid 60 min, single use; a newer code replaces it)\nPhone: signed-out screen → "DEV · Test account sign-in" (not Log In / Join)\n`, { mode: 0o600 });
console.log(`Local tester: ${EMAIL}`);
console.log(`One-time sign-in code: ${code}   (newest; also in .test-backend/local-phone-code.txt)`);
console.log('Phone: signed-out screen → "DEV · Test account sign-in" (not Log In / Join with new onboarding)');
