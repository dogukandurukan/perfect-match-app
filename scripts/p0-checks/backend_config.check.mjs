// Explicit backend selection — never falls back to live.
// Run: node scripts/p0-checks/backend_config.check.mjs
import { LIVE_PROJECT_REF, LIVE_SUPABASE_ANON_KEY, resolveBackend } from '../../lib/backendConfig.ts';

let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeAnon = (ref, role = 'anon') => `${b64({ alg: 'HS256' })}.${b64({ ref, role })}.sig`;
const TEST_REF = 'abcdefghijklmnopqrst';
const testUrl = `https://${TEST_REF}.supabase.co`;

check(!resolveBackend(undefined).ok, 'no config → error (no default)');
check(!resolveBackend({ env: '' }).ok, 'empty env → error');
check(!resolveBackend({ env: 'staging' }).ok, 'unknown env → error');
const live = resolveBackend({ env: 'live' });
check(live.ok && live.projectRef === LIVE_PROJECT_REF, 'live explicit → live');
check(!resolveBackend({ env: 'test' }).ok, 'test without URL/key → error, not live');
check(!resolveBackend({ env: 'test', testUrl }).ok, 'test without key → error');
check(!resolveBackend({ env: 'test', testUrl: 'http://x.supabase.co', testAnonKey: fakeAnon(TEST_REF) }).ok, 'bad URL → error');
check(!resolveBackend({ env: 'test', testUrl: `https://${LIVE_PROJECT_REF}.supabase.co`, testAnonKey: fakeAnon(LIVE_PROJECT_REF) }).ok,
  'test pointing at the live project → error');
check(!resolveBackend({ env: 'test', testUrl, testAnonKey: LIVE_SUPABASE_ANON_KEY }).ok, 'live key with test URL → error');
check(!resolveBackend({ env: 'test', testUrl, testAnonKey: fakeAnon('zzzzzzzzzzzzzzzzzzzz') }).ok, 'key of another project → error');
check(!resolveBackend({ env: 'test', testUrl, testAnonKey: fakeAnon(TEST_REF, 'service_role') }).ok, 'service_role key → error');
check(!resolveBackend({ env: 'test', testUrl, testAnonKey: 'sb_secret_abc' }).ok, 'secret key → error');
check(!resolveBackend({ env: 'test', testUrl: 'https://eiytdoquxlpjvquxmgsp.supabase.co', testAnonKey: fakeAnon('eiytdoquxlpjvquxmgsp') }).ok,
  'AI HQ project refused');
const ok = resolveBackend({ env: 'test', testUrl, testAnonKey: fakeAnon(TEST_REF) });
check(ok.ok && ok.env === 'test' && ok.projectRef === TEST_REF && ok.url === testUrl, 'valid test config → test');
const pub = resolveBackend({ env: 'test', testUrl, testAnonKey: 'sb_publishable_xyz' });
check(pub.ok && pub.projectRef === TEST_REF, 'publishable key accepted');

console.log(`backend config: ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
