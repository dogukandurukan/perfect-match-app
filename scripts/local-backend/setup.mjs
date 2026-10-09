// Sets up Tempa's LOCAL Supabase (Postgres + Auth + Storage + Realtime) in
// ./local-backend — separate from the shared DEV/live project and from other
// local Supabase projects on this machine (own project_id "tempa-local",
// ports 554xx). Free; uses Docker through the Supabase CLI.
//
//   node scripts/local-backend/setup.mjs          # generate migrations, start, reset (empty data)
//   node scripts/local-backend/setup.mjs --stop   # stop this project's containers only
//
// Schema = the sanitized live-schema snapshot (no data, no webhook, no keys)
// + every package in the live order + the proposed Matches package. NO real
// user data is copied. Writes .env.local-backend.local (git-ignored) with the
// LOCAL URL and keys only; refuses anything that isn't this machine.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReplicaSql } from '../../supabase/proposed/tests/replica.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workdir = path.join(repo, 'local-backend');
const migDir = path.join(workdir, 'supabase', 'migrations');
const proposed = path.join(repo, 'supabase', 'proposed');
const CLI = ['--yes', 'supabase@2.120.0'];
const PACKAGES = [
  '20260928130000_p0a_privacy_additive.sql',
  '20260930090000_p1_private_photos.sql',
  '20260930120000_v2_onboarding_persistence.sql',
  '20260930140000_v2_review_discovery_media.sql',
  '20261001090000_v2_public_profile.sql',
  '20261001120000_v2_match_chat_date.sql',
  '20261001140000_v2_discovery_skip_liked.sql',
  '20260928130100_p0b_privacy_restrict.sql',
  '20261008090000_v2_discover_targeted_likes.sql',
  '20261009090000_v2_matches_daily_picks.sql',
];

const fail = (m) => {
  console.error(`[local-backend] ${m}`);
  process.exit(2);
};
const cli = (args, opts = {}) =>
  spawnSync('npx', [...CLI, ...args, '--workdir', workdir], { cwd: workdir, encoding: 'utf8', ...opts });

// Guards: this workdir must be the Tempa local project.
const config = fs.readFileSync(path.join(workdir, 'supabase', 'config.toml'), 'utf8');
if (!/^project_id = "tempa-local"$/m.test(config)) fail('local-backend/supabase/config.toml is not project "tempa-local" — refusing');
if (!/^\[api\][\s\S]*?^port = 55421$/m.test(config)) fail('API port is not 55421 — refusing (port clash guard)');
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) fail('Docker is not running. Start Docker Desktop and re-run.');

if (process.argv.includes('--stop')) {
  const r = cli(['stop'], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// 1. Migrations (regenerated every time from the repo sources).
fs.rmSync(migDir, { recursive: true, force: true });
fs.mkdirSync(migDir, { recursive: true });
fs.writeFileSync(path.join(migDir, '00000000000000_base_live_schema.sql'), buildReplicaSql({ target: 'supabase' }));
PACKAGES.forEach((f, i) => {
  const n = String(10 + i).padStart(14, '0');
  fs.copyFileSync(path.join(proposed, f), path.join(migDir, `${n}_${f.replace(/^\d+_/, '')}`));
});
console.log(`[local-backend] ${PACKAGES.length + 1} migrations generated (schema only, no data)`);

// 2. Start (only this project's containers) and reset to the migrations.
let r = cli(['start'], { stdio: ['ignore', 'inherit', 'inherit'] });
if (r.status !== 0) fail('supabase start failed');
r = cli(['db', 'reset', '--local'], { stdio: ['ignore', 'inherit', 'inherit'] });
if (r.status !== 0) fail('db reset failed (a migration did not apply)');

// 3. Local URL + keys → .env.local-backend.local (git-ignored).
r = cli(['status', '-o', 'env']);
const env = Object.fromEntries(
  (r.stdout ?? '')
    .split('\n')
    .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const apiUrl = env.API_URL ?? '';
if (!/^http:\/\/127\.0\.0\.1:55421$/.test(apiUrl)) fail(`unexpected API_URL (${apiUrl || 'none'}) — refusing`);
if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY || !/127\.0\.0\.1:55422/.test(env.DB_URL ?? '')) fail('status did not return local keys / DB URL');
const out = path.join(repo, '.env.local-backend.local');
fs.writeFileSync(
  out,
  [`LOCAL_SUPABASE_URL=${apiUrl}`, `LOCAL_SUPABASE_ANON_KEY=${env.ANON_KEY}`, `LOCAL_SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
    `LOCAL_DB_URL=${env.DB_URL}`, `LOCAL_MAIL_URL=${env.INBUCKET_URL ?? env.MAILPIT_URL ?? ''}`, ''].join('\n'),
  { mode: 0o600 },
);
console.log('[local-backend] ready: API http://127.0.0.1:55421 · keys in .env.local-backend.local (git-ignored)');
