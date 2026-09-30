// Reviewer action on the dev project (service key from .env.dev.local; local
// only — the app never can). Acts on the most recently SUBMITTED application
// unless --user=<uuid> is given. Prints first name + id only.
//   node scripts/dev-backend/review.mjs list
//   node scripts/dev-backend/review.mjs accept [--user=<uuid>]
//   node scripts/dev-backend/review.mjs changes "Retake your selfie in better light" [--items=yourProfile.selfie,yourProfile.photos] [--user=<uuid>]
//   node scripts/dev-backend/review.mjs reject [--user=<uuid>]
import { createClient } from '@supabase/supabase-js';

process.env.TEMPA_TARGET = 'dev';
const { fail, loadTestEnv } = await import('../test-backend/_env.mjs');
const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const [cmd, note] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const { data: states, error } = await admin.from('account_state_v2').select('user_id, application_status, submitted_at')
  .order('submitted_at', { ascending: false, nullsFirst: false });
if (error) fail(error.message);
const names = new Map(((await admin.from('onboarding_v2').select('user_id, first_name')).data ?? []).map((r) => [r.user_id, r.first_name]));
if (cmd === 'list' || !cmd) {
  for (const s of states) console.log(`${s.application_status.padEnd(18)} ${names.get(s.user_id) ?? '—'}  ${s.user_id}`);
  process.exit(0);
}
const target = flag('user') ?? states.find((s) => s.application_status === 'submitted')?.user_id;
if (!target) fail('no submitted application');
const decision = { accept: 'accept', reject: 'reject', changes: 'request_changes' }[cmd];
if (!decision) fail('usage: review.mjs list | accept | changes "<note>" [--items=a,b] | reject');
const items = flag('items')?.split(',').filter(Boolean) ?? null;
const r = await admin.rpc('review_application_v2', { p_user: target, p_decision: decision, p_note: note ?? null, p_items: items });
if (r.error) fail(r.error.message);
console.log(`[review] ${decision} → ${names.get(target) ?? '—'} (${target}): ${r.data.application_status} / ${r.data.verification_status} / ${r.data.membership_status}`);
