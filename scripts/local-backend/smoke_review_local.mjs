// The local reviewer tool (scripts/local-backend/review.mjs) on real local
// services, with FRESH synthetic applicants (tempa-local-rev-<tag>-*). Never
// touches other accounts (the owner's phone-1 / draft-1 are checked unchanged).
//   node scripts/local-backend/smoke_review_local.mjs
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { admin, env, fillApplication, LOOKS, repo, signIn } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const review = (args, extraEnv = {}) => {
  const r = spawnSync('node', [path.join(repo, 'scripts/local-backend/review.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const noSecrets = (s) => !s.includes(env.serviceKey) && !s.includes(env.anonKey) && !/eyJ[A-Za-z0-9_-]{20,}/.test(s);

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-rev-${tag}-${k}@tempa-test.example.com`;
  const OWNER = ['tempa-onb-phone-1@tempa-test.example.com', 'tempa-onb-draft-1@tempa-test.example.com'];
  const ownerState = async () => {
    const users = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.filter((u) => OWNER.includes(u.email));
    const rows = (await admin.from('account_state_v2').select('*').in('user_id', users.map((u) => u.id))).data ?? [];
    return JSON.stringify(rows.sort((a, b) => a.user_id.localeCompare(b.user_id)));
  };
  const owner0 = await ownerState();

  const applicant = async (k, n, submit = true) => {
    const s = await signIn(mail(k));
    await fillApplication(s.c, s.uid, { email: mail(k), first: `R${k}`, gender: 'woman', interested: ['men'], dob: `199${n}-06-1${n}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[n] });
    if (submit) await s.c.rpc('submit_application_v2', { p_request_id: crypto.randomUUID() });
    return s;
  };
  const A = await applicant('acc', 1);
  const C = await applicant('chg', 2);
  const R = await applicant('rej', 3);
  const D = await applicant('drf', 4, false);
  const st = async (uid) => (await admin.from('account_state_v2').select('*').eq('user_id', uid).single()).data;
  const gate = async (s) => (await s.c.rpc('get_my_access_v2')).data;

  // list
  const l = review(['list']);
  check(l.code === 0 && [A, C, R].every((_, i) => l.out.includes(mail(['acc', 'chg', 'rej'][i]))) && /submitted\s+pending\/none\s+Racc/.test(l.out) && /draft\s+none\/none\s+Rdrf/.test(l.out) && noSecrets(l.out),
    'list: submitted + draft applications, no keys');

  // show (read-only) + HTML file
  const before = await st(A.uid);
  const sh = review(['show', `--email=${mail('acc')}`]);
  const file = /Review\s+(\S+\.html)/.exec(sh.out)?.[1];
  const html = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  check(sh.code === 0 && /State\s+submitted \/ pending \/ none/.test(sh.out) && /Missing\s+nothing/.test(sh.out) && /2 standard · 0 conversation starter\(s\) · 3 photo\(s\) · selfie yes/.test(sh.out), 'show: state, missing, answer / photo / selfie counts');
  check(!!file && file.startsWith(path.join(os.homedir(), 'tempa-review')) && !file.startsWith(repo)
    && (fs.statSync(file).mode & 0o777) === 0o600 && (fs.statSync(path.dirname(file)).mode & 0o777) === 0o700, 'review file outside the repo; file 600, folder 700');
  const imgs = (html.match(/<img src="http:\/\/127\.0\.0\.1:55421\/storage\/v1\/object\/sign\//g) ?? []).length;
  // The file may contain only the signed links' own short-lived tokens (that
  // is what a signed URL is) — never the service or anon key.
  const jwtOnlyInLinks = (html.match(/eyJ[A-Za-z0-9_.-]+/g) ?? []).length === (html.match(/token=eyJ/g) ?? []).length;
  check(imgs === 4 && /A small thing I love/.test(html) && !html.includes(env.serviceKey) && !html.includes(env.anonKey) && jwtOnlyInLinks && !/signedUrl|https?:\/\/[^"]*supabase\.co/.test(html) && noSecrets(sh.out) && !/token=/.test(sh.out),
    'HTML: 3 photos + selfie as local signed URLs, answers with prompt labels; no keys in file or terminal');
  const imgOk = await fetch(/<img src="([^"]+)"/.exec(html)?.[1].replace(/&amp;/g, '&') ?? '').then((r) => r.ok).catch(() => false);
  check(imgOk, 'a signed image link really loads');
  check(JSON.stringify(await st(A.uid)) === JSON.stringify(before), 'show changed nothing');

  // accept: dry run, then --yes
  const dry = review(['accept', `--email=${mail('acc')}`]);
  check(dry.code === 0 && /Target\s+tempa-local-rev-.*-acc@/.test(dry.out) && /Decision\s+ACCEPT/.test(dry.out) && /Dry run/.test(dry.out) && (await st(A.uid)).application_status === 'submitted', 'accept without --yes: shows target + decision, changes nothing');
  const acc = review(['accept', `--email=${mail('acc')}`, '--yes']);
  const sa = await st(A.uid);
  check(acc.code === 0 && /Applied .* accepted \/ verified \/ active/.test(acc.out) && sa.application_status === 'accepted' && sa.membership_status === 'active' && (await gate(A))?.gate === 'member', 'accept --yes → accepted / verified / active; access gate = member');
  const twice = review(['accept', `--email=${mail('acc')}`, '--yes']);
  check(twice.code !== 0 && /only "submitted"/.test(twice.out), 'an already reviewed application can’t be reviewed again');

  // changes (selfie): warning shown before; selfie deleted after
  const cd = review(['changes', `--email=${mail('chg')}`, '--note=Please retake your selfie in daylight.', '--items=yourProfile.selfie,yourProfile.photos']);
  check(cd.code === 0 && /WARNING\s+yourProfile\.selfie DELETES the current verification selfie/.test(cd.out) && /Dry run/.test(cd.out) && !!(await st(C.uid)).selfie_path, 'changes with selfie: explicit warning in the plan; nothing changed yet');
  const bad = review(['changes', `--email=${mail('chg')}`, '--note=x', '--items=yourProfile.everything', '--yes']);
  const none = review(['changes', `--email=${mail('chg')}`, '--yes']);
  check(bad.code !== 0 && /unknown item/.test(bad.out) && none.code !== 0 && /needs --note/.test(none.out) && (await st(C.uid)).application_status === 'submitted', 'unknown item / no note-or-items refused before any change');
  const ch = review(['changes', `--email=${mail('chg')}`, '--note=Please retake your selfie in daylight.', '--items=yourProfile.selfie,yourProfile.photos', '--yes']);
  const sc = await st(C.uid);
  const gc = await gate(C);
  check(ch.code === 0 && sc.application_status === 'changes_requested' && sc.selfie_path === null && sc.review_items.join() === 'yourProfile.selfie,yourProfile.photos'
    && sc.review_note === 'Please retake your selfie in daylight.' && gc?.gate === 'onboarding', 'changes --yes → changes_requested, selfie removed, items + note stored; app reopens onboarding');

  // reject
  const rj = review(['reject', `--email=${mail('rej')}`, '--yes']);
  const sr = await st(R.uid);
  check(rj.code === 0 && sr.application_status === 'rejected' && sr.verification_status === 'rejected' && (await gate(R))?.gate === 'waiting', 'reject --yes → rejected; app shows the status screen');

  // draft can't be reviewed
  const dr = review(['accept', `--email=${mail('drf')}`, '--yes']);
  const dshow = review(['show', `--email=${mail('drf')}`]);
  check(dr.code !== 0 && /only "submitted" applications can be reviewed \(this one is draft\)/.test(dr.out) && (await st(D.uid)).application_status === 'draft'
    && /Note\s+only "submitted"/.test(dshow.out), 'draft: not reviewable (refused, unchanged); show says so');

  // refusals: non-synthetic account, non-local targets
  const ns = review(['show', '--email=someone@example.com']);
  check(ns.code === 2 && /only synthetic/.test(ns.out), 'non-synthetic address refused');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tempa-rev-'));
  const fake = (url) => {
    const f = path.join(tmp, `${crypto.randomUUID()}.env`);
    fs.writeFileSync(f, `LOCAL_SUPABASE_URL=${url}\nLOCAL_SUPABASE_ANON_KEY=x\nLOCAL_SUPABASE_SERVICE_ROLE_KEY=y\n`, { mode: 0o600 });
    return f;
  };
  const hosted = review(['list'], { TEMPA_LOCAL_ENV_FILE: fake('https://abcdefghijklmnopqrst.supabase.co') });
  const otherLocal = review(['list'], { TEMPA_LOCAL_ENV_FILE: fake('http://127.0.0.1:54321') });
  fs.rmSync(tmp, { recursive: true, force: true });
  check(hosted.code === 2 && /not the local API/.test(hosted.out) && otherLocal.code === 2 && /not the local API/.test(otherLocal.out), 'hosted project / another local project (54321) refused before any request');

  check((await ownerState()) === owner0, 'the owner’s phone-1 and draft-1 applications unchanged');
  console.log(`smoke_review_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('error:', String(e?.message ?? e).replace(/eyJ[A-Za-z0-9_.-]+/g, '<KEY>'));
  process.exit(1);
});
