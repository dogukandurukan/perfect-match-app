// DEV test sign-in help (2026-10-21): the right code command per backend,
// clear "another account" path; no shared-DEV command shown on LOCAL.
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const D = require(path.join(ROOT, 'lib/devSignIn.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const E = 'tempa-activity-p1-defne@tempa-test.example.com';
ok(D.devCodeCommand('local', E) === `node scripts/local-backend/login-code.mjs ${E}`, 'LOCAL: the local script, for this exact address');
ok(D.devCodeCommand('dev', E) === 'node scripts/dev-backend/test-login-code.mjs' && !/local-backend/.test(D.devCodeCommand('dev', E)), 'DEV: the dev script');
ok(/scripts\/local-backend\/start-app\.sh <email>/.test(D.devSwitchAccountHint('local')) && /sign out/.test(D.devSwitchAccountHint('local')), 'LOCAL: another account = restart Metro with that account, reopen, sign out');
const w = read('app/v2/welcome.tsx');
ok(/devCodeCommand\(backend\.env, normalizeEmail\(email\)\)/.test(w) && !/On your Mac run: node scripts\/dev-backend\/test-login-code\.mjs/.test(w), 'code screen shows the backend-specific command (not the shared-DEV one on LOCAL)');
ok(/made for \$\{normalizeEmail\(email\)\}/.test(w), 'wrong-code error names the address the code must be for');
const lc = read('scripts/local-backend/login-code.mjs');
ok(/This code is for \$\{EMAIL\} only/.test(lc) && /start-app\.sh \$\{EMAIL\}/.test(lc) && /A Metro restart alone does not change who is signed in/.test(lc), 'login-code.mjs explains the account binding and how to switch');
const doc = read('docs/tempa/TEST_ENVIRONMENT.md');
ok(/A new code, same account/.test(doc) && /Another account/.test(doc) && /Restarting Metro does not sign the phone out/.test(doc), 'TEST_ENVIRONMENT: new code vs another account documented');
ok(!/\b\d{6}\b(?=[^\n]*code)/i.test(doc.split('Phone test accounts (LOCAL)')[1] ?? ''), 'no sign-in code written into the doc section');

module.exports = done('dev_sign_in');
