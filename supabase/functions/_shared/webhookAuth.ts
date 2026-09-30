// Caller check for functions invoked by the database (webhook trigger /
// pg_cron), replacing the service-role JWT that used to be embedded in the
// trigger text (P0 key plan, docs/tempa/P0_KEY_ROTATION_PLAN.md).
//
// New path: header `x-tempa-webhook-secret` must equal the function secret
// TEMPA_WEBHOOK_SECRET (same value the database reads from Vault at call
// time). The value is never logged.
//
// Transition only: while TEMPA_ALLOW_LEGACY_WEBHOOK_AUTH === '1', the old
// callers are still accepted (Bearer = service-role key for the push
// webhook; no auth at all for the reminder cron). Unset it in step 5.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export type CallerKind = 'webhook-secret' | 'legacy' | null;

export function authorizeDbCaller(req: Request, legacy: 'service-role-bearer' | 'unauthenticated'): CallerKind {
  const expected = Deno.env.get('TEMPA_WEBHOOK_SECRET') ?? '';
  const got = req.headers.get('x-tempa-webhook-secret') ?? '';
  if (expected.length >= 32 && got && safeEqual(expected, got)) return 'webhook-secret';

  if (Deno.env.get('TEMPA_ALLOW_LEGACY_WEBHOOK_AUTH') === '1') {
    if (legacy === 'unauthenticated') return 'legacy';
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (bearer && serviceKey && safeEqual(bearer, serviceKey)) return 'legacy';
  }
  return null;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
