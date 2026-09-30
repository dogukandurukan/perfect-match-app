// Resumable move of profile photos from the legacy public `user-photos`
// bucket into `profile-photos-private` (plan §4.3). Storage copy and the DB
// update are separate systems, so every phase is idempotent and recorded in
// ops.photo_migration; after any failure just re-run. Phase 7 (deleting the
// old objects) is NOT done here — old files stay until explicitly approved.
//   TEMPA_TARGET=dev node scripts/dev-backend/migrate_photos.mjs
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { DEV_REF, fail, loadTestEnv } from '../test-backend/_env.mjs';

const env = loadTestEnv({ needService: true });
if (env.ref !== DEV_REF) fail('dev target only');
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const linkedDir = path.join(os.homedir(), 'dating-app-recovered');
function sql(q) {
  const r = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--output-format', 'json', q], { cwd: linkedDir, encoding: 'utf8' });
  if (r.status !== 0) fail(`sql failed: ${(r.stderr ?? '').slice(-400)}`);
  return JSON.parse(r.stdout).rows ?? [];
}

// Phase 2 — plan rows (new name fixed before any copy, so retries reuse it).
sql(`insert into ops.photo_migration (old_bucket, old_path, new_path, owner_id)
  select 'user-photos', ph.path, p.id || '/' || md5(random()::text || ph.path) || '.' ||
         coalesce(nullif(lower(substring(ph.path from '\\.([A-Za-z0-9]+)$')), ''), 'jpg'), p.id
  from profiles p cross join lateral unnest(coalesce(p.photos, '{}')) as ph(path)
  where exists (select 1 from storage.objects o where o.bucket_id = 'user-photos' and o.name = ph.path)
  on conflict (old_bucket, old_path) do nothing`);
const pending = sql(`select old_path, new_path from ops.photo_migration where copied_at is null`);
console.log(`[migrate] planned: ${sql('select count(*)::int n from ops.photo_migration')[0].n}, to copy: ${pending.length}`);

// Phase 3 — copy (overwrite-safe), then mark.
for (const row of pending) {
  const { data: blob, error } = await admin.storage.from('user-photos').download(row.old_path);
  if (error) fail('download failed — re-run later');
  const bytes = Buffer.from(await blob.arrayBuffer());
  const up = await admin.storage.from('profile-photos-private').upload(row.new_path, bytes, { upsert: true, contentType: blob.type || 'image/jpeg' });
  if (up.error) fail('upload failed — re-run later');
  sql(`update ops.photo_migration set copied_at = now() where old_path = '${row.old_path.replace(/'/g, "''")}' and copied_at is null`);
}

// Phase 4 — switch references, per user, only for copied rows.
sql(`with m as (select owner_id, old_path, new_path from ops.photo_migration where copied_at is not null and db_updated_at is null)
  update profiles p set photos = (select array_agg(coalesce((select m2.new_path from m m2 where m2.owner_id = p.id and m2.old_path = x), x) order by ord)
                                  from unnest(p.photos) with ordinality as t(x, ord))
  where p.id in (select owner_id from m)`);
sql(`update ops.photo_migration set db_updated_at = now()
  where copied_at is not null and db_updated_at is null
    and exists (select 1 from profiles p where p.id = owner_id and new_path = any(p.photos))`);

// Phase 5 — verify.
const bad = sql(`select count(*)::int n from profiles p cross join lateral unnest(coalesce(p.photos,'{}')) x(path)
  where not exists (select 1 from storage.objects o where o.bucket_id = 'profile-photos-private' and o.name = x.path)
    and not x.path like 'http%'`)[0].n;
const left = sql(`select count(*)::int n from ops.photo_migration where db_updated_at is null`)[0].n;
console.log(`[migrate] references not in the private bucket: ${bad}; rows not finished: ${left}`);
console.log('[migrate] old objects in user-photos are kept (phase 7 needs explicit approval)');
process.exit(bad === 0 && left === 0 ? 0 : 1);
