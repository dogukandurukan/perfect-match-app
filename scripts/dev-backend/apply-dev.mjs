// Applies the proposed packages to perfect-match-dev — the V2 development
// target by owner decision (2026-09-30: unreleased, no real users). Uses the
// Supabase CLI linked project in ~/dating-app-recovered after verifying that
// the link points at perfect-match-dev (never AI HQ). Each stage runs once;
// progress is recorded in .test-backend/dev-state.json.
//   node scripts/dev-backend/apply-dev.mjs p0a   # P0-A + P1 private bucket
//   node scripts/dev-backend/apply-dev.mjs v2    # V2 persistence + review/discovery/media
//   node scripts/dev-backend/apply-dev.mjs p0b   # P0-B (after the R-P0 client is the one in use)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEV_REF, fail, outDir, repo } from '../test-backend/_env.mjs';

const stage = process.argv[2];
const proposed = path.join(repo, 'supabase', 'proposed');
const files = {
  p0a: ['20260928130000_p0a_privacy_additive.sql', '20260930090000_p1_private_photos.sql'],
  v2: ['20260930120000_v2_onboarding_persistence.sql', '20260930140000_v2_review_discovery_media.sql'],
  p0b: ['20260928130100_p0b_privacy_restrict.sql'],
}[stage];
if (!files) fail('usage: apply-dev.mjs p0a|v2|p0b');

const linkedDir = path.join(os.homedir(), 'dating-app-recovered');
const linked = fs.readFileSync(path.join(linkedDir, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
if (linked !== DEV_REF) fail(`the CLI link in ${linkedDir} is ${linked}, not perfect-match-dev — refusing`);

fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
const stateFile = path.join(outDir, 'dev-state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
for (const f of [...files, '__reload__']) {
  const key = `${stage}:${f}`;
  if (state[key] && f !== '__reload__') {
    console.log(`[apply-dev] ${f}: applied earlier (${state[key]}), skipped`);
    continue;
  }
  const args = f === '__reload__'
    ? ['supabase', 'db', 'query', '--linked', "notify pgrst, 'reload schema';"]
    : ['supabase', 'db', 'query', '--linked', '-f', path.join(proposed, f)];
  console.log(`[apply-dev] ${DEV_REF}: ${f === '__reload__' ? 'reload PostgREST schema' : `applying ${f}`}`);
  const r = spawnSync('npx', args, { cwd: linkedDir, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) {
    console.error((r.stderr ?? '').replace(/eyJ[A-Za-z0-9_.-]+/g, '<REDACTED>').slice(-2000));
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 1), { mode: 0o600 });
    fail(`${f} failed`);
  }
  if (f !== '__reload__') state[key] = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 1), { mode: 0o600 });
}
console.log(`[apply-dev] stage ${stage} done`);
