// The local phone launcher can only ever point the app at THIS Mac's local
// Supabase: app.config.js → extra.backend → resolveBackend.
// Run: node scripts/p0-checks/local_launcher.check.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { LIVE_SUPABASE_ANON_KEY, resolveBackend } from '../../lib/backendConfig.ts';

const require = createRequire(import.meta.url);
let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const localKey = `${b64({ alg: 'HS256' })}.${b64({ iss: 'supabase-demo', role: 'anon' })}.sig`;

const withEnv = (vars, fn) => {
  const keep = { ...process.env };
  for (const k of ['TEMPA_BACKEND', 'TEMPA_LOCAL_SUPABASE_URL', 'TEMPA_LOCAL_SUPABASE_ANON_KEY', 'TEMPA_TEST_SUPABASE_URL', 'TEMPA_TEST_SUPABASE_ANON_KEY', 'EAS_BUILD_PROFILE']) delete process.env[k];
  Object.assign(process.env, vars);
  try { return fn(); } finally { process.env = keep; }
};
const appConfig = require('../../app.config.js');
const backendFor = (vars) => withEnv(vars, () => appConfig({ config: { extra: {} } }).extra.backend);

const b = backendFor({ TEMPA_BACKEND: 'local', TEMPA_LOCAL_SUPABASE_URL: 'http://192.168.1.100:55421', TEMPA_LOCAL_SUPABASE_ANON_KEY: localKey });
const r = resolveBackend(b);
check(r.ok && r.env === 'local' && r.url === 'http://192.168.1.100:55421', 'launcher env → app backend LOCAL on the LAN address');
check(!resolveBackend(backendFor({ TEMPA_BACKEND: 'local' })).ok, 'local without URL/key → app refuses to start (no fallback)');
check(!resolveBackend(backendFor({ TEMPA_BACKEND: 'local', TEMPA_LOCAL_SUPABASE_URL: 'https://fyqwjduzpnjuxqsloxih.supabase.co', TEMPA_LOCAL_SUPABASE_ANON_KEY: localKey })).ok, 'local pointed at the shared project → refused');
check(!resolveBackend(backendFor({ TEMPA_BACKEND: 'local', TEMPA_LOCAL_SUPABASE_URL: 'http://192.168.1.100:55421', TEMPA_LOCAL_SUPABASE_ANON_KEY: LIVE_SUPABASE_ANON_KEY })).ok, 'local with the live key → refused');
check(backendFor({ EAS_BUILD_PROFILE: 'production', TEMPA_BACKEND: 'local', TEMPA_LOCAL_SUPABASE_URL: 'http://192.168.1.100:55421' }).env === 'live', 'production build stays pinned to live (local never shipped)');

const sh = fs.readFileSync(new URL('../local-backend/start-app.sh', import.meta.url), 'utf8');
check(/export TEMPA_BACKEND=local/.test(sh) && /unset TEMPA_TEST_SUPABASE_URL TEMPA_TEST_SUPABASE_ANON_KEY/.test(sh) && !/supabase\.co/.test(sh), 'launcher: TEMPA_BACKEND=local only, no hosted URL');
check(/10\.\*\|192\.168\.\*\|172\.1\[6-9\]/.test(sh) && /exit 2/.test(sh), 'launcher: private LAN address required, otherwise stops');
const env = fs.readFileSync(new URL('../local-backend/_local.mjs', import.meta.url), 'utf8');
check(/LOCAL_SUPABASE_URL !== 'http:\/\/127\.0\.0\.1:55421'/.test(env), 'local test scripts accept only http://127.0.0.1:55421');
console.log(`local launcher: ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
