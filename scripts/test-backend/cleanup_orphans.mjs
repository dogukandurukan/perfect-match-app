// Orphaned-media clean-up on the SEPARATE test project (service key, local).
//   node scripts/test-backend/cleanup_orphans.mjs            # dry run: counts only
//   node scripts/test-backend/cleanup_orphans.mjs --delete   # remove via the Storage API
// Orphans = objects in profile-photos-private / verification-selfies that no
// profile or V2 row references, older than the grace period (default 24 h,
// never below 1 h, so in-flight uploads are safe). Removing rows from
// storage.objects in SQL would NOT delete the stored file — the Storage API
// is used, and the result is re-checked. Prints counts only, never paths.
import { createClient } from '@supabase/supabase-js';
import { fail, loadTestEnv } from './_env.mjs';

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const doDelete = process.argv.includes('--delete');
const hoursArg = process.argv.find((a) => a.startsWith('--older-than-hours='));
const hours = Math.max(1, Number(hoursArg?.split('=')[1] ?? 24));

const list = async () => {
  const { data, error } = await admin.rpc('list_orphan_media_v2', { p_min_age: `${hours} hours` });
  if (error) fail(`list_orphan_media_v2: ${error.message}`);
  return data ?? [];
};

const before = await list();
const byBucket = new Map();
for (const o of before) byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
console.log(`[cleanup] ${env.ref}: ${before.length} orphan object(s) older than ${hours} h`,
  Object.fromEntries([...byBucket].map(([b, n]) => [b, n.length])));
if (!doDelete || before.length === 0) process.exit(0);

for (const [bucket, names] of byBucket) {
  for (let i = 0; i < names.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
    if (error) fail(`remove from ${bucket}: ${error.message}`);
  }
}
const after = await list();
console.log(`[cleanup] ${env.ref}: removed ${before.length - after.length}, remaining ${after.length}`);
process.exit(after.length === 0 ? 0 : 1);
