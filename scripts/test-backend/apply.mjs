// Applies one stage to the SEPARATE Supabase test project:
//   node scripts/test-backend/apply.mjs base   (sanitized live schema, no data)
//   node scripts/test-backend/apply.mjs p0a    (P0-A + P1 private photos)
//   node scripts/test-backend/apply.mjs p0b    (P0-B)
// Uses `supabase db query --db-url` with the TEST connection string only —
// never --linked (the linked project may be live).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReplicaSql } from '../../supabase/proposed/tests/replica.mjs';
import { fail, loadTestEnv, outDir, repo } from './_env.mjs';

const stage = process.argv[2];
const env = loadTestEnv({ needDb: true });
const proposed = path.join(repo, 'supabase', 'proposed');
const files = {
  base: [['00_base.sql', buildReplicaSql({ target: 'supabase' })]],
  p0a: [
    ['10_p0a.sql', fs.readFileSync(path.join(proposed, '20260928130000_p0a_privacy_additive.sql'), 'utf8')],
    ['11_p1_private_photos.sql', fs.readFileSync(path.join(proposed, '20260930090000_p1_private_photos.sql'), 'utf8')],
  ],
  p0b: [['20_p0b.sql', fs.readFileSync(path.join(proposed, '20260928130100_p0b_privacy_restrict.sql'), 'utf8')]],
}[stage];
if (!files) fail('usage: apply.mjs base|p0a|p0b');

for (const [name, sql] of [...files, ['99_reload.sql', "notify pgrst, 'reload schema';"]]) {
  const f = path.join(outDir, name);
  fs.writeFileSync(f, sql, { mode: 0o600 });
  console.log(`[test-backend] ${env.ref}: applying ${name}`);
  const r = spawnSync('npx', ['supabase', 'db', 'query', '--db-url', env.dbUrl, '-f', f], {
    cwd: outDir, // no supabase/ folder here → no linked project involved
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    // stderr can echo the connection string — redact it.
    console.error((r.stderr ?? '').split(env.dbUrl).join('<TEST_DB_URL>'));
    fail(`${name} failed`);
  }
}
console.log(`[test-backend] ${env.ref}: stage ${stage} applied`);
