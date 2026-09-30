// One command to prepare the SEPARATE test project in the right order:
//   node scripts/test-backend/setup.mjs
// Steps (each runs once; progress in .test-backend/setup-state.json, so a
// failed run can simply be re-run and continues where it stopped):
//   1 base   sanitized live schema (no data, no webhook, no keys)
//   2 p0a    P0-A + P1 private photo bucket
//   3 v2     V2 persistence + review loop / V2 eligibility / orphan listing
//   4 seed   synthetic people + the two phone accounts
//   5 smoke  P0 checks on real Auth/REST/Storage/Realtime (stage p0a)
//   6 v2e2e  V2 end-to-end on real services (two synthetic accounts)
// P0-B is NOT applied here: apply it after the phone test with
//   node scripts/test-backend/apply.mjs p0b && node scripts/test-backend/smoke.mjs --stage p0b
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTestEnv, outDir } from './_env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = loadTestEnv({ needDb: true, needService: true }); // validates the file, refuses live
const stateFile = path.join(outDir, 'setup-state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
if (state.projectRef && state.projectRef !== env.ref) {
  console.error('[setup] setup-state.json belongs to another project — delete .test-backend/setup-state.json first');
  process.exit(2);
}
state.projectRef = env.ref;

const steps = [
  ['base', ['apply.mjs', 'base']],
  ['p0a', ['apply.mjs', 'p0a']],
  ['v2', ['apply.mjs', 'v2']],
  ['seed', ['seed.mjs']],
  ['smoke', ['smoke.mjs', '--stage', 'p0a']],
  ['v2e2e', ['smoke_v2.mjs']],
];
for (const [name, args] of steps) {
  if (state[name]) {
    console.log(`[setup] ${name}: done earlier, skipped`);
    continue;
  }
  console.log(`[setup] ${name}: running`);
  const r = spawnSync(process.execPath, [path.join(here, args[0]), ...args.slice(1)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[setup] ${name}: FAILED — fix and re-run this command (finished steps are skipped)`);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 1), { mode: 0o600 });
    process.exit(1);
  }
  state[name] = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 1), { mode: 0o600 });
}
console.log(`[setup] ${env.ref}: test project ready. Start the app with: scripts/test-backend/start-app.sh`);
