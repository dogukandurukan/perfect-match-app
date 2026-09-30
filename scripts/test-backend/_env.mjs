// Loads .env.test.local and refuses anything that is not clearly the separate
// TEST project. Never prints key or password values.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIVE_REF = 'fyqwjduzpnjuxqsloxih';
export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const outDir = path.join(repo, '.test-backend');

function claim(jwt, name) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))[name] ?? null;
  } catch {
    return null;
  }
}

export function loadTestEnv({ needDb = false, needService = false } = {}) {
  const file = path.join(repo, '.env.test.local');
  if (!fs.existsSync(file)) fail(`missing ${file} (copy scripts/test-backend/env.example)`);
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  const url = env.TEST_SUPABASE_URL ?? '';
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url);
  if (!m) fail('TEST_SUPABASE_URL must be https://<ref>.supabase.co');
  const ref = m[1];
  if (ref === LIVE_REF) fail('TEST_SUPABASE_URL is the LIVE project — refusing.');
  const anon = env.TEST_SUPABASE_ANON_KEY ?? '';
  if (!anon) fail('TEST_SUPABASE_ANON_KEY missing');
  if (anon.startsWith('sb_secret_')) fail('TEST_SUPABASE_ANON_KEY is a secret key');
  if (!anon.startsWith('sb_publishable_') && (claim(anon, 'ref') !== ref || claim(anon, 'role') !== 'anon')) {
    fail('TEST_SUPABASE_ANON_KEY is not the anon key of the test project');
  }
  const out = { url: `https://${ref}.supabase.co`, ref, anonKey: anon };
  if (needService) {
    const svc = env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!svc) fail('TEST_SUPABASE_SERVICE_ROLE_KEY missing');
    if (!svc.startsWith('sb_secret_') && (claim(svc, 'ref') !== ref || claim(svc, 'role') !== 'service_role')) {
      fail('TEST_SUPABASE_SERVICE_ROLE_KEY is not the service key of the test project');
    }
    out.serviceKey = svc;
  }
  if (needDb) {
    const db = env.TEST_DB_URL ?? '';
    if (!db.startsWith('postgres')) fail('TEST_DB_URL missing');
    if (db.includes(LIVE_REF)) fail('TEST_DB_URL points at the LIVE project — refusing.');
    if (!db.includes(ref)) fail('TEST_DB_URL does not belong to the test project in TEST_SUPABASE_URL');
    out.dbUrl = db;
  }
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  return out;
}

export function fail(msg) {
  console.error(`[test-backend] ${msg}`);
  process.exit(2);
}
