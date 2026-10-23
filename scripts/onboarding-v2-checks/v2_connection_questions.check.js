// Optional dating-preference questions (D104, version 2, 2026-10-23). Pure
// catalog / summary / stage / save helpers + static wiring + SQL shape. Real
// local services: scripts/local-backend/smoke_connection_answers_local.mjs.
// Screens need the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const C = require(path.join(ROOT, 'lib/onboardingV2/connection.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

module.exports = (async () => {
  const Q = C.CONNECTION_QUESTIONS;
  ok(C.CONNECTION_VERSION === 2 && Q.length === 2, 'version 2, two questions (two owner questions repeat the required onboarding)');
  ok(eq(Q.map((q) => q.id), ['plan_first_date', 'first_date_comfort']), 'new stable question ids');
  ok(!Q.some((q) => ['meet_new', 'when_bothered', 'time_together', 'show_care'].includes(q.id)), 'version-1 question ids are not reused');
  ok(eq(Q.map((q) => q.options.map((o) => o.key)), [['decide_together', 'few_options', 'suggest_first', 'any'], ['short_casual', 'quiet_place', 'small_activity', 'chatted_before']]), 'stable option ids');
  ok(Q[0].title === 'When planning a first date, I like…' && eq(Q[0].options.map((o) => o.title), ['Deciding together', 'Having a few options to choose from', 'Making the first suggestion', 'Any of these works for me']), 'owner copy: planning a first date');
  ok(Q[1].title === 'On a first date, I feel more comfortable with…' && eq(Q[1].options.map((o) => o.title), ['Something short and casual', 'A quiet place where we can talk', 'A small activity together', 'Having chatted a little beforehand']), 'owner copy: first-date comfort');
  ok(C.CONNECTION_COPY.title === 'How do you like to connect?' && C.CONNECTION_COPY.helper === 'A few optional questions to put your dating preferences into words.' && C.CONNECTION_COPY.explore === 'Explore' && C.CONNECTION_COPY.skip === 'Skip for now', 'invite copy');
  ok(/aren’t used for matching/.test(C.CONNECTION_COPY.privacy) && /aren’t shown on your profile/.test(C.CONNECTION_COPY.privacy), 'invite says: not on the profile, not used for matching');
  ok(C.CONNECTION_COPY.summaryTitle === 'Your dating preferences' && C.CONNECTION_COPY.editAnswers === 'Edit answers' && C.CONNECTION_COPY.skipRemaining === 'Skip remaining questions' && C.CONNECTION_COPY.clearAnswer === 'Clear answer', 'summary / skip / clear copy');
  ok(Q.every((q) => q.options.every((o) => typeof o.summary === 'string' && o.summary.length > 10)), 'a fixed summary sentence for every option');
  const allText = JSON.stringify(Q) + JSON.stringify(C.CONNECTION_COPY).replace('not a personality assessment', '');
  ok(!/introvert|extrovert|attachment|personality|compatib|score|result|diagnos|\bcall\b|video|phone/i.test(allText), 'no test / type / compatibility wording, no call or video feature implied');

  // Answers + summary.
  ok(eq(C.cleanConnectionAnswers({ plan_first_date: 'any', first_date_comfort: 'nope', meet_new: 'take_time' }), { plan_first_date: 'any' }), 'unknown / version-1 ids are dropped');
  ok(eq(C.connectionSummary({}), []), 'no answers → no summary rows');
  const one = C.connectionSummary({ first_date_comfort: 'quiet_place' });
  ok(one.length === 1 && one[0].text === 'A quiet place where you can talk feels most comfortable to you.', 'one answer → one summary line');
  ok(eq(C.connectionSummary({ first_date_comfort: 'short_casual', plan_first_date: 'decide_together' }).map((r) => r.id), ['plan_first_date', 'first_date_comfort']), 'summary in question order');

  // Stages.
  ok(C.nextConnectStage('invite', {}) === 0 && C.nextConnectStage(0, {}) === 1, 'invite → question 1 → question 2');
  ok(C.nextConnectStage(1, {}) === 'done' && C.afterQuestions({}) === 'done', 'all skipped → straight to submit (no summary)');
  ok(C.nextConnectStage(1, { plan_first_date: 'any' }) === 'summary' && C.afterQuestions({ plan_first_date: 'any' }) === 'summary', 'partial answers → summary');
  ok(C.nextConnectStage('summary', {}) === 'done', 'summary Continue → submit screen');
  ok(C.prevConnectStage(0) === 'invite' && C.prevConnectStage(1) === 0 && C.prevConnectStage('summary') === 1 && C.prevConnectStage('summary', true) === 'done' && C.prevConnectStage('invite') === null, 'back within the section; summary from submit returns there');

  // Saving (stubbed server): partial, edit, clear, failure.
  const server = { data: {}, fail: false, calls: 0 };
  const save = async (a) => { server.calls += 1; if (server.fail) return false; server.data = { ...a }; return true; };
  let s = {};
  let r = await C.commitConnectionAnswer(s, 'plan_first_date', 'few_options', save);
  ok(r.ok && eq(r.saved, { plan_first_date: 'few_options' }) && eq(server.data, r.saved), 'partial answer saved');
  s = r.saved;
  r = await C.commitConnectionAnswer(s, 'plan_first_date', 'suggest_first', save);
  ok(r.ok && r.saved.plan_first_date === 'suggest_first', 'answer edited');
  s = r.saved;
  server.fail = true;
  r = await C.commitConnectionAnswer(s, 'first_date_comfort', 'small_activity', save);
  ok(!r.ok && eq(r.saved, { plan_first_date: 'suggest_first' }) && eq(server.data, { plan_first_date: 'suggest_first' }), 'failed save → confirmed answers unchanged (nothing shown as saved)');
  server.fail = false;
  r = await C.commitConnectionAnswer(s, 'first_date_comfort', 'small_activity', save);
  ok(r.ok && C.answeredCount(r.saved) === 2, 'retry after a failure saves');
  s = r.saved;
  r = await C.commitConnectionAnswer(s, 'plan_first_date', null, save);
  ok(r.ok && eq(r.saved, { first_date_comfort: 'small_activity' }) && eq(server.data, r.saved), 'Clear answer removes only that answer');

  // Wiring.
  const flow = code('components/onboarding-v2/PreviewFlow.tsx');
  ok(/pos\.step === PROFILE_STEP\.code && valid && !live\.review && !profile\.applicationPreview/.test(flow), 'only on the live first-submit screen (verified, not an update, not after submit)');
  ok(/if \(!hasLive \|\| !CONNECTION_ENABLED\) return;/.test(flow) && /r\.kind !== 'ok' \|\| !r\.canEdit/.test(flow), 'one setting turns it off; also hidden without the server package or a draft');
  ok(/atFirstSubmit && connectAvail && !connectActive && answeredCount\(connectSaved\) > 0/.test(flow), 'submit-screen card only with saved answers');
  ok(/disabled: !connectSelected \|\| connectBusy/.test(flow), 'Continue disabled without a selection');
  ok(/onPick=\{\(key\) => \{\s*setConnectPick\(key\);/.test(flow) && !/onPick=[^\n]*goConnect/.test(flow), 'picking does not save or advance');
  ok(/if \(!r\.ok\) return setConnectNotice\(CONNECTION_COPY\.saveError\);/.test(flow), 'a failed save stays on the question with a retry message');
  ok(/label: CONNECTION_COPY\.skipQuestion, onPress: \(\) => goConnect\(nextConnectStage\(connectStage, connectSaved\)\)/.test(flow), 'Skip question keeps the saved answer');
  ok(/label: CONNECTION_COPY\.skipRemaining, onPress: \(\) => goConnect\(afterQuestions\(connectSaved\)\)/.test(flow), 'Skip remaining questions ends the section, answers kept');
  ok(/connectStage === 'summary'\) \{\s*\/?\/?[^\n]*\n?\s*primary = \{ label: CONNECTION_COPY\.continue, onPress: \(\) => goConnect\('done'\) \}/.test(flow) && !/summary[^\n]*submit\(\)/.test(flow), 'the summary never submits');
  ok(/onClear=\{\(\) => void commitConnect\(null, false\)\}/.test(flow), 'explicit Clear answer');
  ok(/liveCode === 'verified' && !connectActive/.test(flow), 'the normal submit screen returns after the section');
  ok(!/PROFILE_STEP\.(connect|connection)/.test(flow) && !/connect/i.test(code('lib/onboardingV2/yourProfile.ts')), 'no new numbered step (resume position unchanged)');
  const fields = code('components/onboarding-v2/yourProfile/ConnectionFields.tsx');
  ok(/OnboardingOptionCard/.test(fields) && !/#[0-9A-Fa-f]{6}/.test(fields), 'existing onboarding option cards + tokens, no new colours');
  ok(/CONNECTION_COPY\.cardStatus/.test(fields) && C.CONNECTION_COPY.cardStatus === 'Private · Saved', '"Saved" only on the card that needs saved answers');
  const remote = code('lib/onboardingV2/connectionRemote.ts');
  ok(!/AsyncStorage|SecureStore/.test(remote) && /p_version: CONNECTION_VERSION/.test(remote) && /d\.version === CONNECTION_VERSION/.test(remote), 'reads this version only; not cached on the device');

  // Server package.
  const sql = read('supabase/proposed/20261023090000_v2_connection_answers_versions.sql').replace(/^--.*$/gm, '');
  ok(/add primary key \(user_id, version\)/.test(sql) && /on conflict \(user_id, version\)/.test(sql), 'answers kept per version (version 2 never overwrites version 1)');
  ok(/when p_version = 1 then/.test(sql) && /'plan_first_date', jsonb_build_array\('decide_together', 'few_options', 'suggest_first', 'any'\)/.test(sql) && /'first_date_comfort', jsonb_build_array\('short_casual', 'quiet_place', 'small_activity', 'chatted_before'\)/.test(sql), 'catalog: version 1 kept, version 2 ids');
  ok(/perform public\.v2_assert_editable\(\);/.test(sql) && /application_status = 'draft'/.test(sql) && /raise exception 'invalid_answers'/.test(sql), 'writes: the applicant themself, draft only, ids validated');
  ok(/get_my_connection_answers_v2\(p_version int default 1\)/.test(sql) && /version = p_version/.test(sql), 'reads one version');
  ok(!/v2_missing_for|get_top_matches|get_profile_v2|submit_application_v2/.test(sql), 'completeness, matching, profile and submit are not touched');
  const others = fs.readdirSync(path.join(ROOT, 'supabase/proposed')).filter((f) => f.endsWith('.sql') && !f.includes('connection_answers')).map((f) => read(path.join('supabase/proposed', f))).join('\n');
  ok(!/connection_answers/.test(others), 'no other server package reads the answers');
  const appSrc = ['app', 'components', 'lib'].flatMap((d) => fs.readdirSync(path.join(ROOT, d), { recursive: true }).map((f) => path.join(d, String(f))))
    .filter((f) => /\.(ts|tsx)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
  ok(appSrc.filter((f) => /connection_answers_v2|connectionRemote/.test(read(f))).sort().join() === ['components/onboarding-v2/PreviewFlow.tsx', 'lib/onboardingV2/connectionRemote.ts'].join(), 'only the onboarding flow uses them');
  const setup = read('scripts/local-backend/setup.mjs');
  ok(/20261023090000_v2_connection_answers_versions\.sql/.test(setup) && !/connection_answers/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
  return done('v2_connection_questions');
})();
