// DEV phone-test helper: plays the OTHER side of the phone test account's
// match, so the receiver side of a date suggestion can be tried on ONE phone.
//
//   node scripts/dev-backend/date-partner.mjs status
//   node scripts/dev-backend/date-partner.mjs propose [hoursFromNow=50] ["Place"]
//   node scripts/dev-backend/date-partner.mjs counter [hoursFromNow=74] ["Place"]   # answers the phone's pending suggestion
//   node scripts/dev-backend/date-partner.mjs accept                              # accepts the phone's pending suggestion
//   node scripts/dev-backend/date-partner.mjs decline                             # "Not now" to the phone's pending suggestion
//   node scripts/dev-backend/date-partner.mjs say "Hello!"                        # a chat message from the partner
//
// Safety:
//   * perfect-match-dev only (TEMPA_TARGET=dev, .env.dev.local; never AI HQ);
//   * the partner (default 2344b540-…, "Test") and the phone account
//     (13adb65c-…) must both be synthetic @tempa-test.example.com accounts;
//   * the partner signs in through the normal email-code path (admin issues
//     the one-time code locally, the client verifies it) and then uses ONLY
//     the same RPCs as the app — every server rule (participants, active
//     chat, one pending, no self-accept, block / unmatch) still applies;
//   * it never acts as the phone account, never resets or unmatches it, and
//     adds nothing to the app (no bypass).
// Prints no keys, codes or URLs.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

process.env.TEMPA_TARGET = 'dev';
const { fail, loadTestEnv } = await import('../test-backend/_env.mjs');

const PHONE = '13adb65c-4f0b-4fee-9362-6337ba2e3041';
const PARTNER = process.env.DATE_PARTNER_ID ?? '2344b540-d011-402d-805f-b9dd113ecae8';
const [cmd, a1, a2] = process.argv.slice(2);

const env = loadTestEnv({ needService: true });
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const synthetic = async (id) => (await admin.auth.admin.getUserById(id)).data.user?.email?.endsWith('@tempa-test.example.com');
if (!(await synthetic(PHONE)) || !(await synthetic(PARTNER))) fail('both accounts must be synthetic @tempa-test.example.com accounts — refusing');

const email = (await admin.auth.admin.getUserById(PARTNER)).data.user.email;
const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
if (v.error) fail(`partner sign-in failed: ${v.error.message}`);

const matches = (await c.rpc('get_my_matches_v2')).data ?? [];
const m = matches.find((x) => x.other_id === PHONE);
if (!m) fail('no active match between the partner and the phone account (blocked / unmatched / never matched)');
const chat = (await c.rpc('get_chat_v2', { p_match: m.match_id })).data;
const pendingFromPhone = (chat?.proposals ?? []).find((p) => p.status === 'pending' && !p.mine);
const fmt = (p) => `${p.status.padEnd(9)} ${p.mine ? 'partner' : 'phone  '} ${new Date(p.meeting_at).toLocaleString('en-GB', { timeZone: 'Europe/Istanbul' })}${p.place ? ` · ${p.place}` : ''}`;
const at = (h, d) => new Date(Date.now() + Number(h ?? d) * 3600e3).toISOString();
const show = (r, label) => {
  if (r.error) fail(`${label}: ${r.error.message}`);
  console.log(`[partner] ${label} → ${r.data?.status ?? 'ok'}${r.data?.already ? ' (already done)' : ''}`);
};

switch (cmd) {
  case 'status':
  case undefined:
    console.log(`[partner] match ${m.match_id.slice(0, 8)}… active=${chat?.active}`);
    for (const p of chat?.proposals ?? []) console.log('  ' + fmt(p));
    if (!(chat?.proposals ?? []).length) console.log('  (no suggestions yet)');
    break;
  case 'propose':
    show(await c.rpc('propose_date_v2', { p_match: m.match_id, p_meeting_at: at(a1, 50), p_place: a2 ?? 'Moda sahil', p_request_id: crypto.randomUUID() }), 'propose');
    break;
  case 'counter':
    if (!pendingFromPhone) fail('no pending suggestion from the phone to answer');
    show(await c.rpc('respond_date_v2', { p_proposal: pendingFromPhone.id, p_action: 'counter', p_meeting_at: at(a1, 74), p_place: a2 ?? 'Karaköy', p_request_id: crypto.randomUUID() }), 'counter');
    break;
  case 'accept':
  case 'decline':
    if (!pendingFromPhone) fail('no pending suggestion from the phone to answer');
    show(await c.rpc('respond_date_v2', { p_proposal: pendingFromPhone.id, p_action: cmd }), cmd);
    break;
  case 'say':
    if (!a1) fail('usage: say "message"');
    show(await c.from('messages').insert({ sender_id: PARTNER, receiver_id: PHONE, content: a1 }).select('id').single(), 'message');
    break;
  default:
    fail('usage: status | propose [h] ["place"] | counter [h] ["place"] | accept | decline | say "text"');
}
