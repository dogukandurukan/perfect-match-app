// Email sign-in CODE on the LOCAL Supabase, exactly like the app
// (app/v2/welcome.tsx: signInWithOtp + verifyOtp type 'email'), read from the
// local mailbox (Mailpit, 127.0.0.1:55424). Synthetic addresses only; the code
// and session are never printed.
//   node scripts/local-backend/check_email_otp_local.mjs
import { newClient } from './_local.mjs';

const MAIL = 'http://127.0.0.1:55424';
let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Newest message to `to` received after `since`; returns { subject, code, hasLink } (code kept in memory only). */
async function latestMail(to, since) {
  for (let i = 0; i < 20; i += 1) {
    const list = await fetch(`${MAIL}/api/v1/messages?limit=20`).then((r) => r.json());
    const m = (list.messages ?? []).find((x) => x.To?.some((t) => t.Address === to) && Date.parse(x.Created) >= since - 1000);
    if (m) {
      const full = await fetch(`${MAIL}/api/v1/message/${m.ID}`).then((r) => r.json());
      const text = full.Text ?? '';
      const code = /(?<![\w/=&.-])(\d{6})(?![\w])/.exec(text)?.[1] ?? null;
      return { subject: m.Subject, code, hasLink: /\/auth\/v1\/verify/.test(text + (full.HTML ?? '')) };
    }
    await sleep(500);
  }
  return null;
}

async function main() {
  const email = `tempa-local-otp-${Date.now().toString(36)}@tempa-test.example.com`;

  // 1. New user (app: "Join with new onboarding").
  const c = newClient();
  const t0 = Date.now();
  const sent = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  check(!sent.error, 'new user: code requested (same call as the app)');
  const m1 = await latestMail(email, t0);
  check(!!m1 && m1.subject === 'Your Tempa sign-in code' && !!m1.code && !m1.hasLink, 'new user: email contains a 6-digit code (no link)');
  const v1 = await c.auth.verifyOtp({ email, token: m1?.code ?? '000000', type: 'email' });
  check(!v1.error && !!v1.data.session, 'new user: verifyOtp type email signs in');
  const ob = await c.rpc('get_my_onboarding_v2');
  check(!ob.error && ob.data?.state?.application_status === 'draft', 'signed-in session reaches the onboarding (draft)');

  // 2. The same code again is refused.
  const again = await newClient().auth.verifyOtp({ email, token: m1?.code ?? '000000', type: 'email' });
  check(!!again.error && !again.data.session, 'used code is refused');

  // 3. Existing user signs in again: a new code arrives and works; a wrong code doesn't.
  const c2 = newClient();
  await sleep(1200); // local max_frequency = 1s
  const t1 = Date.now();
  check(!(await c2.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })).error, 'existing user: code requested');
  const m2 = await latestMail(email, t1);
  check(!!m2 && !!m2.code && m2.code !== m1?.code && !m2.hasLink, 'existing user: new email with a fresh code');
  const wrong = await c2.auth.verifyOtp({ email, token: m2?.code === '123456' ? '654321' : '123456', type: 'email' });
  check(!!wrong.error, 'wrong code is refused');
  const v2 = await c2.auth.verifyOtp({ email, token: m2?.code ?? '000000', type: 'email' });
  check(!v2.error && v2.data.session?.user?.email === email, 'existing user: the fresh code signs in');

  console.log(`check_email_otp_local (local Supabase, real Auth + mailbox): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>').replace(/\b\d{6}\b/g, '<CODE>'));
  process.exit(1);
});
