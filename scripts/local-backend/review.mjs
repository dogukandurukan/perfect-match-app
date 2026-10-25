// LOCAL reviewer tool for V2 applications (tempa-local only). No admin panel:
// decisions go through the EXISTING server operation review_application_v2
// (service role, this machine only) — no direct status SQL, no rule changes.
//
//   node scripts/local-backend/review.mjs list
//   node scripts/local-backend/review.mjs show    --email=<x@tempa-test.example.com>
//   node scripts/local-backend/review.mjs accept  --email=<…> [--yes]
//   node scripts/local-backend/review.mjs changes --email=<…> --note="…" [--items=yourProfile.selfie,yourProfile.photos] [--yes]
//   node scripts/local-backend/review.mjs reject  --email=<…> [--note="…"] [--yes]
//
// Without --yes a decision is only SHOWN (target, current state, decision,
// consequences) and nothing changes. `show` is read-only and writes a local
// HTML review file (photos + selfie as short-lived signed URLs, no keys)
// OUTSIDE the repo: ~/tempa-review/<account>-<time>.html (dir 700, file 600).
// Guards: _local.mjs accepts only http://127.0.0.1:55421 with local keys
// (never a hosted project); only @tempa-test.example.com accounts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { admin, fail } from './_local.mjs';

const { promptById } = await import('../../lib/onboardingV2/promptCatalog.ts');
const { takeQuestionText, TAKE_KIND_LABEL, activityLabel } = await import('../../lib/interests/takes.ts');

const SIGNED_TTL_SEC = 600;
// Same list as the server check constraint account_state_v2_review_items_check.
const REVIEW_ITEMS = ['basics.name', 'basics.birthday', 'basics.gender', 'basics.interested_in', 'basics.location', 'basics.height',
  'compatibility.answers', 'compatibility.values', 'yourLife.answers', 'yourLife.pet_kind', 'yourWorld.interests',
  'yourDates.date_types', 'yourDates.when', 'yourProfile.photos', 'yourProfile.prompts', 'yourProfile.selfie'];

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const yes = args.includes('--yes');
const SYNTH = /^[a-z0-9._+-]+@tempa-test\.example\.com$/;

const must = (r, what) => {
  if (r.error) fail(`${what}: ${r.error.message}`);
  return r.data;
};

async function allSyntheticUsers() {
  const out = [];
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`list users: ${error.message}`);
    out.push(...data.users.filter((u) => SYNTH.test(u.email ?? '')));
    if (data.users.length < 1000) break;
  }
  return out;
}

async function target() {
  const email = (flag('email') ?? '').trim().toLowerCase();
  if (!email) fail('missing --email=<account@tempa-test.example.com>');
  if (!SYNTH.test(email)) fail('only synthetic @tempa-test.example.com accounts — refusing');
  const user = (await allSyntheticUsers()).find((u) => u.email === email);
  if (!user) fail(`no local account ${email}`);
  const state = must(await admin.from('account_state_v2').select('*').eq('user_id', user.id).maybeSingle(), 'state');
  if (!state) fail(`${email} has no V2 application`);
  const ob = must(await admin.from('onboarding_v2').select('*').eq('user_id', user.id).maybeSingle(), 'onboarding');
  return { email, user, state, ob };
}

const stateLine = (s) => `${s.application_status} / ${s.verification_status} / ${s.membership_status}`;
const age = (dob) => (dob ? Math.floor((Date.now() - Date.parse(dob)) / (365.25 * 864e5)) : null);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function list() {
  const users = await allSyntheticUsers();
  // In chunks: hundreds of ids in one ?in=(…) exceed the URL length limit.
  const ids = users.map((u) => u.id);
  const chunked = async (table, cols, label) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) out.push(...(must(await admin.from(table).select(cols).in('user_id', ids.slice(i, i + 100)), label) ?? []));
    return out;
  };
  const states = await chunked('account_state_v2', 'user_id, application_status, verification_status, membership_status, submitted_at', 'states');
  const names = new Map((await chunked('onboarding_v2', 'user_id, first_name', 'names')).map((r) => [r.user_id, r.first_name]));
  const email = new Map(users.map((u) => [u.id, u.email]));
  const order = { submitted: 0, changes_requested: 1, draft: 2, accepted: 3, rejected: 4 };
  const rows = (states ?? []).sort((a, b) => (order[a.application_status] ?? 9) - (order[b.application_status] ?? 9)
    || String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')));
  const waiting = rows.filter((r) => r.application_status === 'submitted').length;
  console.log(`Local applications (tempa-local) — ${waiting} waiting for review`);
  for (const r of rows) {
    console.log(`${r.application_status.padEnd(18)} ${`${r.verification_status}/${r.membership_status}`.padEnd(17)} ${(names.get(r.user_id) ?? '—').padEnd(10)} ${email.get(r.user_id)}`);
  }
}

async function show() {
  const { email, user, state, ob } = await target();
  const missing = must(await admin.rpc('v2_missing_for', { p_uid: user.id }), 'missing') ?? [];
  const prompts = must(await admin.from('profile_prompts_v2').select('slot, prompt_id, answer').eq('user_id', user.id).order('slot'), 'prompts') ?? [];
  const takes = must(await admin.from('profile_takes_v2').select('position, subject_kind, subject_id, subject_title, question_id, answer').eq('user_id', user.id).order('position'), 'takes') ?? [];
  const photos = must(await admin.from('profile_photos_v2').select('position, storage_path').eq('user_id', user.id).order('position'), 'photos') ?? [];
  const sign = async (bucket, p) => (p ? (await admin.storage.from(bucket).createSignedUrl(p, SIGNED_TTL_SEC)).data?.signedUrl ?? null : null);
  const photoUrls = [];
  for (const p of photos) photoUrls.push(await sign('profile-photos-private', p.storage_path));
  const selfieUrl = await sign('verification-selfies', state.selfie_path);
  const events = must(await admin.from('application_events_v2').select('event, created_at, items').eq('user_id', user.id).order('created_at'), 'events') ?? [];

  // Terminal: a short summary (no URLs, no keys).
  console.log(`Account   ${email}  (${user.id})`);
  console.log(`State     ${stateLine(state)}${state.submitted_at ? `  · submitted ${state.submitted_at}` : ''}${state.reviewed_at ? `  · reviewed ${state.reviewed_at}` : ''}`);
  console.log(`Missing   ${missing.length ? missing.join(', ') : 'nothing'}`);
  console.log(`Answers   ${prompts.length} standard · ${takes.length} conversation starter(s) · ${photos.length} photo(s) · selfie ${state.selfie_path ? 'yes' : 'no'}`);
  if (state.application_status !== 'submitted') console.log(`Note      only "submitted" applications can be reviewed (this one is ${state.application_status}).`);

  const dir = path.join(os.homedir(), 'tempa-review');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const file = path.join(dir, `${email.split('@')[0]}-${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
  const facts = [
    ['Name', `${ob?.first_name ?? ''}${age(ob?.date_of_birth) ? `, ${age(ob.date_of_birth)}` : ''}`],
    ['City', ob?.location_city], ['Gender / looking for', `${ob?.gender ?? ''} → ${(ob?.interested_in ?? []).join(', ')}`],
    ['Intent', ob?.intent], ['Values', (ob?.core_values ?? []).join(', ')], ['Interests', (ob?.interests ?? []).join(', ')],
    ['Activities', (ob?.activities ?? []).map((k) => activityLabel(k) ?? k).join(', ')],
    ['Artists', (ob?.artists ?? []).map((x) => x.title).join(', ')], ['Books', (ob?.books ?? []).map((x) => x.title).join(', ')],
    ['Movies & series', (ob?.screen ?? []).map((x) => x.title).join(', ')], ['Job', ob?.job_title],
  ];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Tempa local review</title>
<style>body{font:16px/1.45 -apple-system,system-ui,sans-serif;margin:24px auto;max-width:880px;padding:0 16px;background:#F7F3EA;color:#1F2A24}
h1{font-size:22px}h2{font-size:17px;margin-top:28px}.box{background:#FFFDF8;border:1px solid #E4DCCB;border-radius:12px;padding:12px 16px;margin:8px 0}
.warn{background:#FFF4E5}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.grid img,.selfie img{width:100%;border-radius:10px;border:1px solid #E4DCCB}
.selfie{max-width:260px}td{padding:3px 12px 3px 0;vertical-align:top}.muted{color:#6B6F66;font-size:14px}code{background:#EEE7D8;padding:1px 5px;border-radius:5px}</style></head><body>
<h1>Local review — ${esc(email)}</h1>
<p class="muted">tempa-local only · generated ${esc(new Date().toISOString())} · image links expire after ${SIGNED_TTL_SEC / 60} minutes (run <code>show</code> again for new ones) · read-only: nothing was changed.</p>
<div class="box"><b>State:</b> ${esc(stateLine(state))}${state.review_note ? `<br><b>Last review note:</b> ${esc(state.review_note)}` : ''}</div>
<div class="box ${missing.length ? 'warn' : ''}"><b>Missing:</b> ${missing.length ? esc(missing.join(', ')) : 'nothing'}</div>
<h2>Profile</h2><div class="box"><table>${facts.map(([k, v]) => `<tr><td class="muted">${esc(k)}</td><td>${esc(v) || '—'}</td></tr>`).join('')}</table></div>
<h2>Standard answers (${prompts.length})</h2>${prompts.map((p) => `<div class="box"><div class="muted">${esc(promptById(p.prompt_id)?.en ?? p.prompt_id)}</div>${esc(p.answer)}</div>`).join('') || '<p class="muted">None</p>'}
<h2>Conversation starters (${takes.length})</h2>${takes.map((t) => `<div class="box"><div class="muted">${esc(t.subject_title)} · ${esc(TAKE_KIND_LABEL[t.subject_kind] ?? t.subject_kind)} — ${esc(takeQuestionText(t.question_id, t.subject_id) ?? t.question_id)}</div>${esc(t.answer)}</div>`).join('') || '<p class="muted">None</p>'}
<h2>Photos (${photos.length})</h2><div class="grid">${photoUrls.map((u, i) => (u ? `<img src="${esc(u)}" alt="Photo ${i + 1}">` : `<div class="box">Photo ${i + 1}: could not be signed</div>`)).join('')}</div>
<h2>Verification selfie (private)</h2><div class="selfie">${selfieUrl ? `<img src="${esc(selfieUrl)}" alt="Selfie">` : '<p class="muted">No selfie</p>'}</div>
<h2>History</h2>${events.map((e) => `<div class="muted">${esc(e.created_at)} · ${esc(e.event)}${e.items ? ` · ${esc(e.items.join(', '))}` : ''}</div>`).join('') || '<p class="muted">None</p>'}
<h2>Decide (terminal)</h2><div class="box"><code>node scripts/local-backend/review.mjs accept --email=${esc(email)}</code><br>
<code>node scripts/local-backend/review.mjs changes --email=${esc(email)} --note="…" --items=…</code><br>
<code>node scripts/local-backend/review.mjs reject --email=${esc(email)}</code><br><span class="muted">Each first shows the plan; add <code>--yes</code> to apply.</span></div>
</body></html>`;
  fs.writeFileSync(file, html, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`Review    ${file}`);
  console.log(`Open      open "${file}"   (Mac browser; image links valid ${SIGNED_TTL_SEC / 60} min)`);
}

async function decide(kind) {
  const { email, user, state } = await target();
  const decision = { accept: 'accept', changes: 'request_changes', reject: 'reject' }[kind];
  const note = flag('note') ?? null;
  const items = flag('items') ? flag('items').split(',').map((x) => x.trim()).filter(Boolean) : null;
  if (items) {
    const bad = items.filter((x) => !REVIEW_ITEMS.includes(x));
    if (bad.length) fail(`unknown item(s): ${bad.join(', ')} — allowed: ${REVIEW_ITEMS.join(', ')}`);
  }
  if (kind === 'changes' && !(note?.trim()) && !(items?.length)) fail('changes needs --note="…" and/or --items=…');

  console.log(`Target    ${email}  (${user.id})`);
  console.log(`Current   ${stateLine(state)}`);
  console.log(`Decision  ${decision.toUpperCase()}${note ? `  · note: "${note}"` : ''}${items ? `  · items: ${items.join(', ')}` : ''}`);
  if (state.application_status !== 'submitted') fail(`only "submitted" applications can be reviewed (this one is ${state.application_status}) — nothing changed`);
  if (kind === 'accept') console.log('Effect    accepted / verified / active → the member gets into the app (Refresh or reopen on the phone).');
  if (kind === 'reject') console.log('Effect    rejected → the member stays on the status screen with the rejection text.');
  if (kind === 'changes') {
    console.log('Effect    changes_requested → onboarding reopens at the first requested item; the member submits again.');
    if (items?.includes('yourProfile.selfie')) console.log('WARNING   yourProfile.selfie DELETES the current verification selfie — the member must take a new one.');
  }
  if (!yes) {
    console.log('Dry run   nothing changed. Add --yes to apply this decision.');
    return;
  }
  const r = await admin.rpc('review_application_v2', { p_user: user.id, p_decision: decision, p_note: note, p_items: items });
  if (r.error) fail(`review_application_v2: ${r.error.message} — nothing changed`);
  console.log(`Applied   ${email} → ${stateLine(r.data)}`);
}

if (cmd === 'list' || !cmd) await list();
else if (cmd === 'show') await show();
else if (['accept', 'changes', 'reject'].includes(cmd)) await decide(cmd);
else fail('usage: review.mjs list | show --email=… | accept --email=… [--yes] | changes --email=… --note=… [--items=…] [--yes] | reject --email=… [--yes]');
process.exit(0);
