// Optional "How do you connect?" questions (2026-10-22, D104). Pure catalog /
// stage helpers + static wiring + SQL shape. Real local services:
// scripts/local-backend/smoke_connection_answers_local.mjs. Screens need the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const C = require(path.join(ROOT, 'lib/onboardingV2/connection.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

ok(C.CONNECTION_VERSION === 1 && C.CONNECTION_QUESTIONS.length === 4, 'version 1, four questions');
ok(eq(C.CONNECTION_QUESTIONS.map((q) => q.id), ['meet_new', 'when_bothered', 'time_together', 'show_care']), 'stable question ids');
ok(eq(C.CONNECTION_QUESTIONS.map((q) => q.options.map((o) => o.key)), [['open_quickly', 'take_time', 'depends'], ['talk_now', 'time_then_talk', 'depends'], ['plans_ahead', 'spontaneous', 'both'], ['words', 'quality_time', 'actions', 'mix']]), 'stable option ids');
ok(C.CONNECTION_QUESTIONS[0].title === 'When meeting someone new, I usually…' && C.CONNECTION_QUESTIONS[3].options[3].title === 'A mix of these', 'owner copy');
ok(C.CONNECTION_COPY.title === 'How do you connect?' && C.CONNECTION_COPY.helper === 'A few optional questions about what feels right for you in a relationship.' && C.CONNECTION_COPY.explore === 'Explore' && C.CONNECTION_COPY.skip === 'Skip for now', 'invite copy');
ok(/aren’t used for matching/.test(C.CONNECTION_COPY.privacy) && /aren’t shown on your profile/.test(C.CONNECTION_COPY.privacy), 'privacy note');
ok(eq(C.cleanConnectionAnswers({ meet_new: 'take_time', show_care: 'nope', x: 'y' }), { meet_new: 'take_time' }) && eq(C.cleanConnectionAnswers(null), {}) && eq(C.cleanConnectionAnswers(['a']), {}), 'unknown ids / options dropped');
ok(C.nextConnectStage('invite') === 0 && C.nextConnectStage(2) === 3 && C.nextConnectStage(3) === 'done' && C.prevConnectStage(0) === 'invite' && C.prevConnectStage('invite') === null && C.prevConnectStage(2) === 1, 'stages: invite → 4 questions → done; back within');
const allText = JSON.stringify(C.CONNECTION_QUESTIONS) + JSON.stringify(C.CONNECTION_COPY);
ok(!/introvert|extrovert|attachment|personality type|compatib|score|result|diagnos/i.test(allText), 'no test / type / compatibility wording');

const flow = code('components/onboarding-v2/PreviewFlow.tsx');
ok(/pos\.step === PROFILE_STEP\.code && valid && !live\.review && !profile\.applicationPreview/.test(flow), 'only on the live first-submit screen (verified, not an update, not after submit)');
ok(/r\.kind !== 'ok' \|\| !r\.canEdit/.test(flow) && /atFirstSubmit && connectAvail && connectStage !== 'done'/.test(flow), 'only when the server has the package and the draft is editable');
ok(/label: CONNECTION_COPY\.skip, onPress: \(\) => setConnectStage\('done'\)/.test(flow) && (flow.match(/setConnectStage\('done'\)/g) || []).length >= 2, 'Skip for now on the invite and on every question → the submit screen');
ok(/answered \? \(last \? 'Done' : 'Continue'\) : 'Skip question'/.test(flow), 'each question can be skipped');
ok(/liveCode === 'verified' && !connectActive/.test(flow), 'the normal submit screen returns after the questions');
ok(!/PROFILE_STEP\.(connect|connection)/.test(flow) && !/connect/i.test(code('lib/onboardingV2/yourProfile.ts')), 'no new numbered step (resume position unchanged)');
ok(/setConnectNotice\(ok \? null :/.test(flow), 'a failed save is shown and never blocks');
ok(!/AsyncStorage|SecureStore/.test(code('lib/onboardingV2/connectionRemote.ts')), 'answers are not cached on the device (never carried to another account)');
ok(/OnboardingOptionCard/.test(code('components/onboarding-v2/yourProfile/ConnectionFields.tsx')) && !/StyleSheet\.create\(\{[^}]*#[0-9A-F]{6}[^}]*fontFamily: obFonts\.heading/.test(code('components/onboarding-v2/yourProfile/ConnectionFields.tsx')), 'existing onboarding option cards');

const sql = read('supabase/proposed/20261022120000_v2_connection_answers.sql').replace(/^--.*$/gm, '');
ok(/enable row level security/.test(sql) && !/create policy/.test(sql) && /revoke all on public\.connection_answers_v2 from anon, authenticated/.test(sql), 'table: RPCs only');
ok(/perform public\.v2_assert_editable\(\);/.test(sql) && /application_status = 'draft'/.test(sql), 'writes: the applicant themself, draft only');
ok(/raise exception 'invalid_answers'/.test(sql) && /raise exception 'unknown_version'/.test(sql) && /'show_care', jsonb_build_array\('words', 'quality_time', 'actions', 'mix'\)/.test(sql), 'fixed ids + version validated');
ok(!/v2_missing_for|get_top_matches|get_profile_v2|submit_application_v2/.test(sql), 'completeness, matching, profile and submit are not touched');
const others = fs.readdirSync(path.join(ROOT, 'supabase/proposed')).filter((f) => f.endsWith('.sql') && !f.includes('connection_answers')).map((f) => read(path.join('supabase/proposed', f))).join('\n');
ok(!/connection_answers/.test(others), 'no other server package reads the answers');
const appSrc = ['app', 'components', 'lib'].flatMap((d) => fs.readdirSync(path.join(ROOT, d), { recursive: true }).map((f) => path.join(d, String(f))))
  .filter((f) => /\.(ts|tsx)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
ok(appSrc.filter((f) => /connection_answers_v2|connectionRemote/.test(read(f))).sort().join() === ['components/onboarding-v2/PreviewFlow.tsx', 'lib/onboardingV2/connectionRemote.ts'].join(), 'only the onboarding flow uses them');
ok(/20261022120000_v2_connection_answers\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/connection_answers/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
module.exports = done('v2_connection_questions');
