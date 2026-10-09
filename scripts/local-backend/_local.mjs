// Shared helpers for the LOCAL Supabase (scripts/local-backend/setup.mjs).
// Reads .env.local-backend.local only and refuses anything that is not this
// machine's loopback API on port 55421 — never the shared DEV/live project.
// Synthetic accounts only (@tempa-test.example.com), created through the
// NORMAL V2 path (same RPCs as the app).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { renderPortraits } from '../dev-backend/portraits.mjs';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function fail(m) {
  console.error(`[local-backend] ${m}`);
  process.exit(2);
}

export function loadLocalEnv() {
  const f = path.join(repo, '.env.local-backend.local');
  if (!fs.existsSync(f)) fail('missing .env.local-backend.local — run: node scripts/local-backend/setup.mjs');
  const env = Object.fromEntries(
    fs.readFileSync(f, 'utf8').split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]),
  );
  if (env.LOCAL_SUPABASE_URL !== 'http://127.0.0.1:55421') fail('LOCAL_SUPABASE_URL is not the local API (http://127.0.0.1:55421) — refusing');
  if (/supabase\.co/.test(JSON.stringify(env))) fail('a hosted Supabase address is in the local env file — refusing');
  if (!env.LOCAL_SUPABASE_ANON_KEY || !env.LOCAL_SUPABASE_SERVICE_ROLE_KEY) fail('local keys missing — re-run setup');
  return { url: env.LOCAL_SUPABASE_URL, anonKey: env.LOCAL_SUPABASE_ANON_KEY, serviceKey: env.LOCAL_SUPABASE_SERVICE_ROLE_KEY };
}

export const env = loadLocalEnv();
export const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
export const newClient = () => createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const must = (r, what) => {
  if (r.error) fail(`${what}: ${r.error.message}`);
  return r.data;
};

/** Ensures the synthetic user exists, then signs in with a real email code. */
export async function signIn(email) {
  if (!email.endsWith('@tempa-test.example.com')) fail('not a synthetic address — refusing');
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already/i.test(created.error.message)) fail(`createUser: ${created.error.message}`);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) fail(`generateLink: ${link.error.message}`);
  const c = newClient();
  const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) fail(`sign-in failed (${email}): ${v.error.message}`);
  return { c, uid: v.data.user.id, token: v.data.session.access_token };
}

/** Fresh one-time code for the phone (verified by the app, not here). */
export async function signInCode(email) {
  const link = must(await admin.auth.admin.generateLink({ type: 'magiclink', email }), 'code');
  return link.properties.email_otp;
}

const L = (skin, shade, hair, style, top, bg, scene, accessory, item) => ({ skin, skinShade: shade, hair, brow: hair, hairStyle: style, top, bg, scene, accessory, item });
const LOOKS = [
  L('#E2B593', '#C99A7A', '#3B2A20', 'wavy', '#1F3A2E', '#E6ECE3', 'sea', 'earrings', 'books'),
  L('#F0C9A8', '#D6AD8C', '#1E1611', 'bun', '#8C4B3C', '#EDE6D6', 'city', 'none', 'camera'),
  L('#C68E68', '#AB7552', '#7A4B2A', 'pixie', '#C9A227', '#F1E4D3', 'cafe', 'none', 'music'),
  L('#E8BE9B', '#CFA07D', '#A36A3E', 'long', '#5E7D6A', '#EDE6D6', 'park', 'earrings', 'plant'),
  L('#B97A57', '#9E6545', '#2A1C14', 'bob', '#1F3A2E', '#E6ECE3', 'park', 'none', 'bike'),
  L('#E5BA97', '#CB9F7C', '#4A2F22', 'curly', '#5E7D6A', '#F1E4D3', 'sea', 'glasses', 'coffee'),
];

/**
 * Creates (or completes) an accepted V2 member through the normal path.
 * p: { email, first, gender, interested, dob, city, district, look, prompts }
 */
export async function ensureMember(p) {
  const { c, uid } = await signIn(p.email);
  const st = (await admin.from('account_state_v2').select('application_status').eq('user_id', uid).maybeSingle()).data;
  if (st?.application_status === 'accepted') return { c, uid };
  const b = must(await c.rpc('get_my_onboarding_v2'), 'load');
  if (b.state.application_status === 'draft' || b.state.application_status === 'changes_requested') {
    const save = async (section, data) => must(await c.rpc('save_onboarding_v2', { p_section: section, p_data: data }), `save ${section}`);
    const slug = p.district.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[^a-z]/g, '');
    await save('basics', { first_name: p.first, last_name: 'Synthetic', date_of_birth: p.dob, gender: p.gender, interested_in: p.interested,
      location_id: `tr-${p.city === 'İstanbul' ? 'istanbul' : 'ankara'}-${slug}`, location_city: p.city, location_district: p.district,
      location_label: `${p.district}, ${p.city}, Turkey`, height_cm: 170 });
    await save('compatibility', { intent: 'long_term', social_energy: 'mix', message_frequency: 'few_checkins', relationship_space: 'balance',
      emotional_expression: 'open', meeting_pace: 'after_chatting', core_values: ['trust', 'fun'] });
    await save('yourLife', { smoking: 'no', drinking: 'sometimes', pets: 'like_no_pets', pet_kind: null, activity: 'somewhat' });
    await save('yourWorld', { work_status: 'full_time', job_title: 'Synthetic tester', school: null, hometown: null,
      interests: ['travel', 'music', 'food'], artists: [], books: [], screen: [] });
    await save('yourDates', { date_types: ['coffee', 'walk'], favorite_spot: null, days_pref: 'weekends', time_pref: 'daytime' });
    const look = p.look ?? LOOKS[0];
    if ((b.photos ?? []).length < 3) {
      for (const img of renderPortraits(look).slice((b.photos ?? []).length)) {
        const pth = `${uid}/${crypto.randomBytes(12).toString('hex')}.png`;
        must(await c.storage.from('profile-photos-private').upload(pth, img, { contentType: 'image/png' }), 'upload photo');
        must(await c.rpc('add_profile_photo_v2', { p_path: pth }), 'register photo');
      }
    }
    must(await c.rpc('save_prompts_v2', { p_prompts: (p.prompts ?? [['small_thing_i_love', `A small thing ${p.first} loves.`], ['together_we_could', 'Find the best simit.']])
      .map(([id, answer], i) => ({ slot: i + 1, prompt_id: id, answer })) }), 'prompts');
    if (!b.state.has_selfie) {
      const sp = `${uid}/${crypto.randomBytes(16).toString('hex')}.png`;
      must(await c.storage.from('verification-selfies').upload(sp, renderPortraits({ ...look, accessory: 'none' })[0], { contentType: 'image/png' }), 'upload selfie');
      must(await c.rpc('set_verification_selfie_v2', { p_path: sp }), 'register selfie');
    }
    must(await c.from('profiles').update({ privacy_consent_at: new Date().toISOString() }).eq('id', uid), 'consent');
    const sub = must(await c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() }), 'submit');
    if (sub.status !== 'submitted') fail(`${p.email} not submittable: ${JSON.stringify(sub.missing ?? sub)}`);
  }
  must(await admin.rpc('review_application_v2', { p_user: uid, p_decision: 'accept' }), 'accept');
  return { c, uid };
}

export { LOOKS };
