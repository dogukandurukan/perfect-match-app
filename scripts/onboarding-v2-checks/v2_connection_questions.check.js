// "What you're looking for" (D104b, version 3, 2026-10-25): intention,
// priorities and connection style. Pure catalog / edit / summary / stage /
// save helpers + static wiring + SQL shape. Real local services:
// scripts/local-backend/smoke_connection_answers_local.mjs. Screens need the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const C = require(path.join(ROOT, 'lib/onboardingV2/connection.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const sorted = (o) => JSON.stringify(o, Object.keys(o).sort());

module.exports = (async () => {
  // Catalog + copy.
  ok(C.CONNECTION_VERSION === 3 && C.QUESTION_COUNT === 3, 'version 3, three questions');
  ok(eq(C.INTENTS.map((i) => i.title), ['A one-night connection', 'Casual dating, without commitment', 'Seeing where things go', 'A long-term relationship', 'A relationship leading to marriage', 'Still figuring it out']), 'intention options (owner copy)');
  ok(eq(C.INTENTS.map((i) => i.key), ['one_night', 'casual', 'see_where', 'long_term', 'marriage', 'figuring_out']) && !C.INTENTS.some((i) => ['meet_new', 'plan_first_date'].includes(i.key)), 'new stable intention ids (no old ids reused)');
  ok(!C.ALSO_OPEN_KEYS.includes('figuring_out') && C.ALSO_OPEN_KEYS.length === 5, '"Still figuring it out" is not an "Also open to" option');
  ok(eq(C.PRIORITY_TOPICS.map((t) => t.title), ['Active lifestyle', 'Shared interests', 'Education', 'Work & career', 'Money mindset', 'Living arrangements', 'Plans for children']), 'priority topics');
  ok(eq(C.PRIORITY_TOPICS.flatMap((t) => t.details.map((d) => d.title)), ['Exercises regularly', 'Enjoys being active together', 'Has a university degree', 'Has a steady job', 'Values their career', 'Is financially independent', 'Has a similar approach to spending and saving', 'Lives alone', 'Has a similar daily routine', 'Wants children in the future', 'Does not want children', 'Is still deciding']), 'priority details (owner copy)');
  ok(C.PRIORITY_TOPICS.find((t) => t.key === 'children').mode === 'single' && C.PRIORITY_TOPICS.find((t) => t.key === 'interests').mode === 'interests', 'children = single choice; shared interests = own interests');
  ok(eq(C.CONNECTION_OPTIONS.map((o) => o.title), ['Regular contact and clear mutual interest', 'Letting closeness grow gradually', 'Keeping time and space for myself', 'Talking openly about expectations', 'Finding our own rhythm together', 'I’m not sure yet']), 'connection options (owner copy)');
  const K = C.CONNECTION_COPY;
  ok(K.intentTitle === 'What are you looking for?' && K.intentHelper === 'Choose what fits you best right now.' && K.prioritiesTitle === 'What matters to you?' && K.prioritiesHelper === 'Choose up to 3 priorities.' && K.connectionTitle === 'How do you like to connect?' && K.connectionHelper === 'Choose up to 2 that feel right for you.', 'question titles / helpers');
  ok(K.summaryTitle === 'What you’re looking for' && K.summaryHelper === 'Based on the preferences you shared.' && K.continueToApplication === 'Continue to application' && K.editPreferences === 'Edit preferences' && K.alsoOpen === 'Also open to…', 'summary copy');
  ok(/aren’t used for matching yet/.test(K.privacy) && /aren’t shown on your profile/.test(K.privacy), 'privacy describes the real behaviour (private, not used for matching yet)');
  const allText = JSON.stringify([C.INTENTS, C.PRIORITY_TOPICS, C.CONNECTION_OPTIONS, K]).replace('aren’t a personality assessment', '');
  ok(!/introvert|extrovert|avoidant|anxious|attachment|personality|compatib|score|%|wealth|income|rich/i.test(allText), 'no personality / attachment labels, scores, compatibility or wealth wording');
  ok(!/change this later/i.test(JSON.stringify(K)), 'no "You can change this later" promise');

  // Intention edits.
  let n = C.setPrimaryIntent(['see_where', 'casual'], 'casual');
  ok(n.intent === 'casual' && eq(n.also, ['see_where']), 'a new main intention removes itself from "Also open to", others kept');
  ok(eq(C.toggleAlsoOpen(['see_where'], 'long_term', 'long_term'), ['see_where']), 'the main intention can’t be chosen again under "Also open to"');
  ok(eq(C.toggleAlsoOpen([], 'figuring_out', 'long_term'), []), '"Still figuring it out" can’t be an extra');
  ok(eq(C.toggleAlsoOpen(['casual'], 'marriage', 'long_term'), ['casual', 'marriage']) && eq(C.toggleAlsoOpen(['casual', 'marriage'], 'casual', 'long_term'), ['marriage']), 'several extras; toggled off again');
  ok(eq(C.withIntent('figuring_out', [])({}), { intent: 'figuring_out' }), '"Still figuring it out" saves just that — never "open to everything"');

  // Priorities.
  let p = {};
  for (const t of ['active', 'education', 'money', 'children']) p = C.toggleTopic(p, t);
  ok(eq(Object.keys(p), ['active', 'education', 'money']), 'at most 3 priority topics');
  ok(!C.prioritiesComplete(p), 'a topic without a detail is not complete');
  p = C.toggleDetail(p, 'active', 'exercises');
  p = C.toggleDetail(p, 'active', 'active_together');
  p = C.setImportance(p, 'active', 'active_together', 'must_have');
  p = C.toggleDetail(p, 'education', 'degree');
  p = C.toggleDetail(p, 'money', 'independent');
  ok(C.prioritiesComplete(p) && p.active.exercises === 'preference' && p.active.active_together === 'must_have', 'details default to Preference; Must-have per detail');
  p = C.toggleTopic(p, 'money');
  ok(!('money' in p) && C.toggleTopic(p, 'money').money && eq(C.toggleTopic(p, 'money').money, {}), 'removing a topic removes its details and importance');
  let ch = C.toggleTopic({}, 'children');
  ch = C.toggleDetail(ch, 'children', 'wants');
  ch = C.toggleDetail(ch, 'children', 'deciding');
  ok(eq(ch.children, { deciding: 'preference' }), 'children: one choice only');
  let si = C.toggleTopic({}, 'interests');
  for (const k of ['travel', 'books', 'music', 'food']) si = C.toggleDetail(si, 'interests', k);
  ok(Object.keys(si.interests).length === 3, 'shared interests: at most 3');
  ok(eq(C.withPriorities(null, true)({ priorities: p, intent: 'casual' }), { intent: 'casual', priorities_none: true }), '"No specific preferences" replaces (clears) chosen priorities');

  // Connection style.
  let c = C.toggleConnection([], 'gradual');
  c = C.toggleConnection(c, 'open_talk');
  ok(eq(C.toggleConnection(c, 'own_space'), ['gradual', 'open_talk']), 'at most 2 connection choices');
  ok(eq(C.toggleConnection(c, 'not_sure'), ['not_sure']) && eq(C.toggleConnection(['not_sure'], 'gradual'), ['gradual']), '"I’m not sure yet" never together with another choice');

  // Clean (mirrors the server).
  const ik = ['travel', 'books'];
  ok(eq(C.cleanConnectionAnswers({ intent: 'casual', intent_also: ['casual', 'figuring_out', 'marriage'], meet_new: 'x' }, ik), { intent: 'casual', intent_also: ['marriage'] }), 'clean: duplicate / figuring_out extras and old ids dropped');
  ok(eq(C.cleanConnectionAnswers({ priorities: { interests: { travel: 'must_have', chess: 'preference' }, children: { wants: 'preference', deciding: 'preference' } } }, ik), { priorities: { interests: { travel: 'must_have' }, children: { wants: 'preference' } } }), 'clean: only own interests; one children choice');
  ok(eq(C.cleanConnectionAnswers({ connection: ['not_sure', 'gradual'] }, ik), {}) && eq(C.cleanConnectionAnswers({ intent_also: ['casual'] }, ik), {}), 'clean: invalid combinations dropped');

  // Summary (fixed text, only answered parts, per-detail importance).
  ok(C.intentSummary({}) === null && C.prioritiesSummary({}, () => '') === null && C.connectionStyleSummary({}) === null, 'skipped parts → nothing shown, nothing inferred');
  const s = { intent: 'long_term', intent_also: ['see_where'], priorities: { active: { exercises: 'preference' }, interests: { books: 'must_have' } }, connection: ['gradual', 'open_talk'] };
  ok(eq(C.intentSummary(s), { main: 'A long-term relationship.', also: 'Also open to seeing where things go.' }), 'intention summary');
  ok(eq(C.prioritiesSummary(s, (k) => ({ books: 'Books' })[k]), [{ topic: 'Active lifestyle', details: [{ title: 'Exercises regularly', importance: 'Preference' }] }, { topic: 'Shared interests', details: [{ title: 'Books', importance: 'Must-have' }] }]), 'priorities summary keeps Preference / Must-have per detail (mixed, not “Not requirements”)');
  ok(C.prioritiesSummary({ priorities_none: true }, () => '') === 'none', '"No specific preferences" summary');
  ok(C.connectionStyleSummary(s) === 'Letting closeness grow gradually and talking openly about expectations.' && C.connectionStyleSummary({ connection: ['not_sure'] }) === 'Not sure yet.', 'connection style summary');

  // Stages.
  ok(C.nextConnectStage('invite', {}) === 0 && C.nextConnectStage(0, {}) === 1 && C.nextConnectStage(1, {}) === 2, 'invite → 1 → 2 → 3');
  ok(C.nextConnectStage(2, {}) === 'done' && C.nextConnectStage(2, { connection: ['gradual'] }) === 'summary' && C.nextConnectStage('summary', s) === 'done', 'summary only with answers; summary → submit screen');
  ok(C.prevConnectStage(0) === 'invite' && C.prevConnectStage(2) === 1 && C.prevConnectStage('summary') === 2 && C.prevConnectStage('summary', true) === 'done', 'back within the section');
  ok(C.initialConnectStage({}) === 'invite' && C.initialConnectStage({ intent: 'casual' }) === 'done', 'current answers → no invite again (View/Edit on the submit screen)');

  // Saving (stubbed server): partial, edit, failure + retry, clear, old versions untouched.
  const server = { data: {}, fail: false };
  const save = async (a) => { if (server.fail) return false; server.data = JSON.parse(JSON.stringify(a)); return true; };
  let r = await C.commitConnection({}, C.withIntent('see_where', ['casual']), save);
  ok(r.ok && eq(r.saved, { intent: 'see_where', intent_also: ['casual'] }), 'partial answer saved (intention only)');
  r = await C.commitConnection(r.saved, C.withIntent('casual', ['casual', 'marriage']), save);
  ok(r.ok && sorted(r.saved) === sorted({ intent: 'casual', intent_also: ['marriage'] }), 'edit: duplicate extra removed when the main intention changes');
  server.fail = true;
  const before = r.saved;
  r = await C.commitConnection(before, C.withConnection(['gradual']), save);
  ok(!r.ok && eq(r.saved, before) && !('connection' in server.data), 'failed save → nothing shown as saved');
  server.fail = false;
  r = await C.commitConnection(before, C.withConnection(['gradual']), save);
  ok(r.ok && eq(r.saved.connection, ['gradual']), 'retry saves');
  r = await C.commitConnection(r.saved, C.withConnection([]), save);
  ok(r.ok && !('connection' in r.saved) && r.saved.intent === 'casual', 'Clear answer removes only that part');

  // Wiring.
  const flow = code('components/onboarding-v2/PreviewFlow.tsx');
  ok(/pos\.step === PROFILE_STEP\.code && valid && !live\.review && !profile\.applicationPreview/.test(flow), 'only on the live first-submit screen');
  ok(/if \(!hasLive \|\| !CONNECTION_ENABLED\) return;/.test(flow), 'one setting turns it off (old intent step then shows again)');
  ok(/hideOldIntent && n && n\.section === 'compatibility' && n\.step === 1\) return \{ section: 'compatibility', step: 2 \}/.test(flow) && /hideOldIntent && b && b\.section === 'compatibility' && b\.step === 1\) return prevPos\(b\)/.test(flow), 'old Compatibility intent step skipped while the section is on (asked once)');
  ok(/setHideOldIntent\(r\.canEdit \|\| !!r\.answers\.intent\)/.test(flow), 'hidden only with the server package (draft, or a saved new intention)');
  ok(/const intentRequired = connectAvail && !compat\.intent;/.test(flow) && /secondary = intentRequired \? null : \{ label: CONNECTION_COPY\.skip,/.test(flow) && /secondary = intentRequired \? null : \{ label: CONNECTION_COPY\.skipQuestion/.test(flow), 'required intention: no Skip on the invite or the intention question');
  ok(/connectStage === 'done' && intentRequired && !connectSaved\.intent \? 'invite'/.test(flow), 'can’t reach Submit without the required intention');
  ok(/disabled: !cIntent \|\| connectBusy/.test(flow) && /disabled: !prioritiesComplete\(cPrios\) \|\| connectBusy/.test(flow) && /disabled: cConn\.length === 0 \|\| connectBusy/.test(flow), 'Continue disabled until the screen is valid');
  ok(/if \(!r\.ok\) return setConnectNotice\(CONNECTION_COPY\.saveError\);/.test(flow), 'failed save stays with a retry message');
  ok(/CONNECTION_COPY\.noPreferencesConfirmBody/.test(flow), '"No specific preferences" warns before clearing chosen priorities');
  ok(/label: CONNECTION_COPY\.continueToApplication, onPress: \(\) => goConnect\('done'\)/.test(flow) && !/continueToApplication[^\n]*submit/.test(flow), 'the summary never submits');
  ok(/setConnectStage\(initialConnectStage\(r\.answers\)\)/.test(flow) && /hasAnyAnswer\(connectSaved\) \? \(\s*<ConnectionSubmitCard/.test(flow), 'no invite on every open; View from the submit screen');
  ok(!/PROFILE_STEP\.(connect|connection)/.test(flow) && !/connect/i.test(code('lib/onboardingV2/yourProfile.ts')), 'no new numbered step (resume position unchanged)');
  const fields = code('components/onboarding-v2/yourProfile/ConnectionFields.tsx');
  ok(/OnboardingOptionCard/.test(fields) && !/#[0-9A-Fa-f]{6}/.test(fields), 'existing onboarding option cards + tokens, no new colours');
  ok(/mode="single"[^\n]*selected=\{intent === o\.key\}/.test(fields) && /mode="multi"[^\n]*selected=\{on\}/.test(fields), 'radio for the intention, square checkboxes for connection style');
  ok(!/compat|matching score/i.test(code('lib/onboardingV2/connectionRemote.ts')) && /d\.supports\.includes\(CONNECTION_VERSION\)/.test(code('lib/onboardingV2/connectionRemote.ts')), 'reads version 3 only, and only from a server that supports it');
  ok(!/connection_answers|connectionRemote|lib\/onboardingV2\/connection/.test(read('lib/onboardingV2/yourProfile.ts') + read('lib/onboardingV2/serverMapping.ts')), 'not in the profile preview or the public-profile mapping');

  // Server package.
  const sql = read('supabase/proposed/20261025090000_v2_connection_intent_priorities.sql').replace(/^--.*$/gm, '');
  ok(/if p_version = 3 then\s+if not public\.v2_connection_check_v3\(v_me, p_answers\)/.test(sql), 'version 3 validated by its own rules');
  ok(/'not_sure' = any\(v_arr\) and cardinality\(v_arr\) > 1/.test(sql) && /cardinality\(v_arr\) not between 1 and 2/.test(sql) && /not between 1 and 3/.test(sql), 'server limits: 2 connection choices, not_sure alone, 1–3 topics');
  ok(/d = 'other' or not \(d = any\(coalesce\(v_interests, '\{\}'\)\)\)/.test(sql) && /k = 'children' and \(select count\(\*\) from jsonb_object_keys\(v\)\) <> 1/.test(sql), 'server: shared interests from the user’s own interests; one children choice');
  ok(/\(a->>'intent'\) = any\(v_arr\)/.test(sql) && /not \(a \? 'intent'\)/.test(sql), 'server: extras need a main intention and never repeat it');
  ok(/o\.intent is null and not public\.v2_connection_has_intent\(p_uid\)/.test(sql) && /c\.version = 3 and c\.answers \? 'intent'/.test(sql), 'completeness: old intent OR new main intention (never mapped)');
  ok(!/get_profile_v2|get_top_matches|get_discovery|daily_picks|update onboarding_v2|set intent/.test(sql), 'profile, matching and the old intent field are not touched');
  ok(/'supports', jsonb_build_array\(1, 2, 3\)/.test(sql), 'reader tells the app which versions exist');
  const others = fs.readdirSync(path.join(ROOT, 'supabase/proposed')).filter((f) => f.endsWith('.sql') && !/connection_(answers|intent)/.test(f)).map((f) => read(path.join('supabase/proposed', f))).join('\n');
  ok(!/connection_answers/.test(others), 'no other server package reads the answers');
  const appSrc = ['app', 'components', 'lib'].flatMap((d) => fs.readdirSync(path.join(ROOT, d), { recursive: true }).map((f) => path.join(d, String(f))))
    .filter((f) => /\.(ts|tsx)$/.test(f) && fs.statSync(path.join(ROOT, f)).isFile());
  ok(appSrc.filter((f) => /connection_answers_v2|connectionRemote/.test(read(f))).sort().join() === ['components/onboarding-v2/PreviewFlow.tsx', 'lib/onboardingV2/connectionRemote.ts'].join(), 'only the onboarding flow uses them');
  const setup = read('scripts/local-backend/setup.mjs');
  ok(/20261025090000_v2_connection_intent_priorities\.sql/.test(setup) && !/connection_/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
  return done('v2_connection_questions');
})();
