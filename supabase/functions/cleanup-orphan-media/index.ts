// Scheduled orphaned-media clean-up (PROPOSED — not deployed). Called by the
// database (pg_cron → public.call_edge_function, key plan) with the Vault-held
// webhook secret. Lists orphans with public.list_orphan_media_v2 (service
// role only; grace period ≥ 1 h) and removes them through the Storage API —
// deleting storage.objects rows in SQL would leave the stored files behind.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeDbCaller, unauthorized } from '../_shared/webhookAuth.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (authorizeDbCaller(req, 'service-role-bearer') !== 'webhook-secret') return unauthorized();
  const { data, error } = await admin.rpc('list_orphan_media_v2', { p_min_age: '24 hours' });
  if (error) return new Response(JSON.stringify({ error: 'list_failed' }), { status: 500 });
  const byBucket = new Map<string, string[]>();
  for (const o of (data ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
  }
  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const chunk = names.slice(i, i + 100);
      const { error: rmError } = await admin.storage.from(bucket).remove(chunk);
      if (rmError) return new Response(JSON.stringify({ error: 'remove_failed', removed }), { status: 500 });
      removed += chunk.length;
    }
  }
  return new Response(JSON.stringify({ removed }), { headers: { 'Content-Type': 'application/json' } });
});
