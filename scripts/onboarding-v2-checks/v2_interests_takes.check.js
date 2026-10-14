// "Your interests" + conversation starters (D87–D97): pure rules + wiring.
// Local logic / static check only — server rules are covered on the LOCAL
// Supabase by scripts/local-backend/smoke_takes_local.mjs (real services).
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const T = require(path.join(ROOT, 'lib/interests/takes.ts'));
const Y = require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts'));
const S = require(path.join(ROOT, 'lib/onboardingV2/serverMapping.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const sql1 = read('supabase/proposed/20261014090000_v2_interests_takes.sql');
const sql = read('supabase/proposed/20261015090000_v2_takes_multi.sql');
const sqlCode = sql.replace(/--.*$/gm, '');

// Catalog + questions match the server.
const sqlKeys = /array\['running'[^\]]*\]/.exec(sql1)[0].match(/'([a-z]+)'/g).map((x) => x.slice(1, -1));
ok(T.ACTIVITIES.map((a) => a.key).join() === sqlKeys.join() && sqlKeys.length === 12, '12 activities, same keys as the server');
ok(T.MAX_ACTIVITIES === 5 && T.TAKE_MAX === 180 && T.MAX_TAKES === 3, 'limits: 5 activities, 180 characters, 3 starters');
for (const [kind, qs] of Object.entries(T.TAKE_QUESTIONS)) {
  ok(qs.length === 2 && new RegExp(`p_subject_kind = '${kind}' and p_question_id in \\('${qs[0].id}', '${qs[1].id}'\\)`).test(sql), `${kind}: two questions, same keys as the server`);
}
ok(T.takeQuestionText('activity_perfect_day', 'running') === 'What does your ideal run look like?' && T.takeQuestionText('activity_perfect_day', 'yoga') === 'What does a perfect one look like?'
  && T.questionsFor({ kind: 'activity', id: 'running' })[1].text === 'What does your ideal run look like?', 'Running wording (same key, same meaning); other activities unchanged');

// Activities toggle.
let a = [];
for (const k of ['running', 'walking', 'cycling', 'hiking', 'swimming', 'gym']) a = T.toggleActivity(a, k);
ok(a.length === 5 && !a.includes('gym') && T.toggleActivity(a, 'running').length === 4 && T.toggleActivity([], 'skydiving').length === 0, 'toggle: 6th refused, tap removes, unknown ignored');

// Subjects + free subjects (one starter per subject).
const sel = { interests: ['sports'], activities: ['running', 'cooking'], artists: [{ kind: 'artist', source: 'custom', id: 'custom:artist:tarkan', title: 'Tarkan' }],
  books: [{ kind: 'book', source: 'openlibrary', id: 'ol:work:OL1W', title: '1984' }], screen: [] };
const opts = T.subjectOptions(sel);
ok(opts.map((o) => `${o.kind}:${o.id}`).join() === 'activity:running,activity:cooking,book:ol:work:OL1W,artist:custom:artist:tarkan', 'subjects = saved activities / books / films / artists (no broad interest)');
const tk = (id, pos, kind, subj) => ({ id, position: pos, subject_kind: kind, subject_id: subj, subject_title: subj, question_id: kind === 'activity' ? 'activity_favourite_part' : 'book_why', answer: `a${id}` });
const takes = [tk('t2', 2, 'book', 'ol:work:OL1W'), tk('t1', 1, 'activity', 'running')];
ok(T.orderedTakes(takes).map((t) => t.id).join() === 't1,t2', 'stable order by position');
ok(T.freeSubjects(opts, takes, null).map((o) => o.id).join() === 'cooking,custom:artist:tarkan' && T.freeSubjects(opts, takes, 't1').some((o) => o.id === 'running'), 'a subject with a starter is not offered again (except to its own starter)');
ok(T.canAddTake(takes, opts) && !T.canAddTake([...takes, tk('t3', 3, 'activity', 'cooking')], opts), 'no 4th add');

// Editor drafts.
const n = T.newTakeDraft();
ok(n.takeId === null && n.choosing === true && n.answer === '', 'add: new draft (never overwrites another)');
const e = T.editTakeDraft(takes[1], opts);
ok(e.takeId === 't1' && !e.choosing && e.answer === 'at1' && !T.takeDraftChanged(e, takes), 'edit: from the saved starter, same id');
const c = T.changeSubjectDraft(takes[1]);
ok(c.takeId === 't1' && c.subject === null && c.answer === '' && c.choosing, 'change subject: nothing carried over');
const c2 = T.chooseSubject(e, opts[1]);
ok(c2.subject.id === 'cooking' && c2.answer === '' && c2.questionId === 'activity_favourite_part' && T.chooseSubject(e, opts[0]).answer === 'at1', 'picking another subject clears the text; same subject keeps it');
ok(T.chooseQuestion(c2, 'book_why') === c2 && T.setAnswer(c2, 'x'.repeat(200)).answer.length === 180 && !T.takeDraftValid(T.setAnswer(c2, '  ')) && T.takeDraftValid(T.setAnswer(c2, 'Bir cümle.')), 'question per kind; 180 cap; blank invalid; Turkish fine');

// Removing selections: only the dependent starters.
ok(T.takesRemovedBy({ ...sel, books: [] }, takes).map((t) => t.id).join() === 't2' && T.takesRemovedBy(sel, takes).length === 0, 'only starters of removed subjects are affected');

// Display.
const base = { name: 'Defne', age: 30, zodiac: null, city: 'İstanbul', heightCm: null, workStatus: null, jobTitle: '', school: null, hometown: null, intent: null, values: [],
  interests: [], life: require(path.join(ROOT, 'lib/onboardingV2/yourLife.ts')).EMPTY_LIFE_DRAFT, dates: require(path.join(ROOT, 'lib/onboardingV2/yourDates.ts')).EMPTY_DATES_DRAFT,
  artists: [], books: [], screen: [], prompts: [], photos: [{ id: 'p', uri: 'x' }] };
const pt = (subj, q) => ({ kind: 'activity', subjectId: subj, subjectTitle: subj, questionId: q, answer: `about ${subj}` });
const three = [pt('running', 'activity_perfect_day'), pt('yoga', 'activity_favourite_part'), pt('cooking', 'activity_favourite_part')];
const shownT = three[0];
const bl = Y.buildPublicProfileBlocks({ ...base, takes: three, activities: ['running', 'yoga'] });
ok(bl[0].type === 'hero' && bl[1].type === 'takes' && bl[1].takes.map((t) => t.subjectId).join() === 'running,yoga,cooking', 'one section with 0–3 starters, under the main photo, in order');
ok(!Y.buildPublicProfileBlocks(base).some((b) => b.type === 'takes') && !Y.buildPublicProfileBlocks({ ...base, takes: [] }).some((b) => b.type === 'takes'), 'no starters → no section');
ok(Y.buildPublicProfileBlocks({ ...base, takes: [pt('yoga', 'nope')] }).every((b) => b.type !== 'takes'), 'unknown question → not shown');
ok(bl.some((b) => b.type === 'groups' && b.groups.some((g) => g.title === 'Activities')), 'activities shown as their own group');
ok(S.publicTakesFromServer([{ subject_kind: 'book', subject_id: 'x', subject_title: '1984', question_id: 'book_why', answer: ' Why. ' }, { subject_kind: 'nope', subject_id: 'y', subject_title: 'z', question_id: 'book_why', answer: 'a' }])
  .map((t) => t.answer).join() === 'Why.' && S.publicTakesFromServer(null).length === 0, 'server list mapping: known kinds, non-empty answers, order kept');
ok(!/^import (?!type)/m.test(read('lib/onboardingV2/serverMapping.ts')), 'serverMapping keeps no runtime imports (plain-Node checks load it)');
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));
const lay = L.buildDiscoverLayout({ ...base, id: 'u', district: null, photoCount: 1, photoIds: ['p1'], prompts: [], takes: three });
ok(lay[0].type === 'hero' && lay[1].type === 'takes' && lay[1].takes.length === 3, 'full V2 profile: the section right after the hero');
const card = code('components/interests/TakeCard.tsx');
ok(!/You both|in common|HeartButton|onLike|Comment/.test(card) && /if \(takes\.length === 0\) return null;/.test(card), 'section: no shared-interest claim, no like / comment, nothing when empty');
ok(/answer: \{ fontFamily: obFonts\.body, fontSize: 16/.test(card) && !/answer: \{ fontFamily: obFonts\.heading/.test(card), 'answers in regular body text (not large serif)');
ok(/case 'takes':[\s\S]{0,120}<TakesSection/.test(read('components/discover/DiscoverProfileItems.tsx')) && /case 'takes':[\s\S]{0,120}<TakesSection/.test(read('components/onboarding-v2/yourProfile/ProfilePreview.tsx')), 'both profile renderers draw the read-only section');
ok(/onAddTake && !state\.blocks\.some\(\(b\) => b\.type === 'takes'\)/.test(read('components/onboarding-v2/PublicProfileView.tsx')) && /&own=1/.test(read('components/main/V2ProfileHome.tsx')), '“Add a conversation starter” only on the own profile');

// Edit screen + the shared starters editor (also used in onboarding).
const ed = code('app/v2/edit-interests.tsx');
const te = code('components/interests/TakesEditor.tsx');
ok(/Your interests/.test(ed) && /<TakesEditor/.test(ed) && /<ActivitiesField/.test(ed) && /Conversation starters/.test(te) && /`\$\{takes\.length\} of \$\{MAX_TAKES\}`/.test(te), 'titles “Your interests” / “Conversation starters” + “n of 3” counter (shared editor)');
ok(/!draft && takes\.length < MAX_TAKES/.test(te) && /canAddTake\(takes, options\)/.test(te), 'no add offered at three');
ok(/d\.choosing \|\| !d\.subject/.test(te) && /freeSubjects\(options, takes, d\.takeId\)/.test(te), 'subject list only while adding / changing, one starter per subject');
ok(/hideLabel/.test(ed) && !/MediaFields|ArtistsFields|LiveNote|public catalogs/.test(ed), 'no repeated section labels or catalog notes');
ok(/saveTake\(draft\.takeId,/.test(te) && /deleteTake\(t\.id\)/.test(te) && /kind === 'confirm'/.test(ed) && /Your other answers stay/.test(ed), 'per-starter save / delete; removal confirm names only the affected starters');
ok(/if \(r\.kind === 'error'\) \{[\s\S]{0,120}onNotice\(\{ kind: 'error', text: r\.message \}\)/.test(te) && /beforeRemove/.test(ed) && /Discard this answer\?/.test(te), 'failure keeps the draft; nothing dropped silently');
ok(!/save_prompts_v2|savePrompts|save_onboarding_v2|photos|selfie|first_name/.test(ed + te), 'edit screen / editor touch no prompts / photos / identity');
ok(/ctrl\.setQuery\(text\)/.test(read('components/onboarding-v2/yourWorld/Typeahead.tsx')) && /Try again/.test(read('components/onboarding-v2/yourWorld/Typeahead.tsx')), 'search failure: short error with Try again, in place');

// D93 — onboarding: 2 standard answers OR 1 standard + 1 starter.
const P = require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts'));
const ans = (id, t) => ({ promptId: id, answer: t });
const two = [ans('small_thing_i_love', 'x'), ans('together_we_could', 'y'), { promptId: null, answer: '' }];
const one = [ans('small_thing_i_love', 'x'), { promptId: null, answer: '' }, { promptId: null, answer: '' }];
const none = [{ promptId: null, answer: '' }, { promptId: null, answer: '' }, { promptId: null, answer: '' }];
ok(P.answersValid(two, 0) && !P.answersValid(one, 0) && P.answersValid(one, 1) && !P.answersValid(none, 3), 'D93: 2 standard, or 1 standard + 1 starter; starters alone never');
ok(P.answersValid(one, 0) === P.promptsValid(one) && P.answersValid(two, 0) === P.promptsValid(two), 'no starters → exactly the old rule');
const prof = { ...P.EMPTY_PROFILE_DRAFT, prompts: one };
ok(!P.isProfileStepValid(P.PROFILE_STEP.prompts, prof) && P.isProfileStepValid(P.PROFILE_STEP.prompts, { ...prof, takes: [shownT] }) && P.checklist({ ...prof, takes: [shownT] }).answers, 'prompts step + checklist use the D93 rule');
ok(P.buildProfilePreview(require(path.join(ROOT, 'lib/onboardingV2/basics.ts')).EMPTY_BASICS_DRAFT, require(path.join(ROOT, 'lib/onboardingV2/compatibility.ts')).EMPTY_COMPAT_DRAFT, base.life, { ...require(path.join(ROOT, 'lib/onboardingV2/yourWorld.ts')).EMPTY_WORLD_DRAFT }, base.dates, { ...prof, takes: [shownT], photos: [{ id: 'p', uri: 'x' }] }).some((b) => b.type === 'takes'), 'onboarding preview shows saved starters');
const M = require(path.join(ROOT, 'lib/onboardingV2/serverMapping.ts'));
const w0 = { ...require(path.join(ROOT, 'lib/onboardingV2/yourWorld.ts')).EMPTY_WORLD_DRAFT, interests: ['travel'], activities: ['running'] };
ok(!('activities' in M.worldToServer(w0)) && M.worldToServer(w0, true).activities.join() === 'running' && !('activities' in M.worldFromServer({ interests: ['travel'] })) && M.worldFromServer({ activities: ['yoga'] }).activities.join() === 'yoga',
  'activities sent only to supporting servers (older servers get the old payload)');
const pf = code('components/onboarding-v2/PreviewFlow.tsx');
ok(/worldToServer\(world, takesSupported\)/.test(pf) && /saveWorldSection\(data, resume, false\)/.test(pf) && /confirmRemoveStarters\(w\.confirm\)/.test(pf) && /saveWorldSection\(data, resume, true\)/.test(pf) && /refreshStarters\(\)/.test(pf),
  'onboarding Your World: removing a starter’s subject asks; Cancel keeps both; then starters reload');
ok(/takesSupported && starters &&[\s\S]{0,1500}<TakesEditor/.test(pf) && /starterCount=\{takesSupported \? \(profile\.takes \?\? \[\]\)\.length : undefined\}/.test(pf) && /takesSupported && \([\s\S]{0,40}<ActivitiesField/.test(pf), 'onboarding: starters editor + activities only when supported; one required prompt with a starter');
ok(/confirm_remove_takes: true/.test(read('lib/onboardingV2/remote.ts')) && /take_subject_removed/.test(read('lib/onboardingV2/remote.ts')), 'remote: Your World save recognises the confirmation request');
// D93 copy (2026-10-15): one rule line; old servers keep the old helper.
ok(/D93_PROMPTS_HELPER = 'Answer two prompts, or one prompt and one conversation starter\.'/.test(pf) && /takesSupported && pos\.section === 'yourProfile' && pos\.step === PROFILE_STEP\.prompts\s*\?\s*D93_PROMPTS_HELPER\s*:\s*helperFor\(pos\)/.test(pf)
  && P.PROFILE_SCREENS[1].helper === 'Pick 2 prompts. Add a third if you like.' && !/Prefer one prompt\?/.test(pf), 'D93 helper only on supporting servers; old helper kept; no repeated long note');
const pfl = code('components/onboarding-v2/yourProfile/PromptsFields.tsx');
ok(/const requiredCount = d93 \? \(\(starterCount \?\? 0\) > 0 \? 1 : 2\) : \(requiredProp \?\? REQUIRED_PROMPTS\)/.test(pfl) && /Math\.min\(filledAll, 2\) \+ \(filledAll === 1 && \(starterCount \?\? 0\) > 0 \? 1 : 0\)/.test(pfl)
  && /d93 \? `\$\{d93Have\} of 2 answers` : `\$\{answered\} of \$\{requiredCount\} required answered`/.test(pfl) && /d93 && i === 1 \? 'Or a conversation starter' : 'Required'/.test(pfl),
  'D93 counter / labels: a starter counts only next to a prompt; second card Optional once a starter exists; old text otherwise');
const d93 = read('supabase/proposed/20261016090000_v2_onboarding_takes.sql');
const d93c = d93.replace(/--.*$/gm, '');
ok(/>= 2\s*or \(\(select count\(\*\) from profile_prompts_v2 p where p\.user_id = p_uid and btrim\(p\.answer\) <> ''\) >= 1\s*and public\.v2_valid_take_count\(p_uid\) >= 1\)/.test(d93c), 'server: v2_missing_for uses the D93 rule');
ok(/if public\.is_active_v2_member\(v_uid\) then return v_uid; end if;\s*perform public\.v2_assert_editable\(\);/.test(d93c) && (d93c.match(/v2_assert_take_writer\(\);/g) || []).length === 2, 'server: starters writable by active members or the editable applicant only');
ok(!/create or replace function public\.v2_assert_editable|create or replace function public\.save_prompts_v2|create or replace function public\.submit_application_v2/.test(d93c), 'general lock, save_prompts_v2 and submit unchanged');
ok(/raise exception 'take_subject_removed' using errcode = 'P0001', detail = v_orphans/.test(d93c) && /'activities','artists','books','screen','confirm_remove_takes'/.test(d93c), 'server: Your World stores activities; removing a starter’s subject needs confirmation');

// Server package.
ok(/drop constraint if exists profile_takes_v2_user_id_key/.test(sql) && /update public\.profile_takes_v2 set position = 1 where position is null/.test(sql) && !/delete from public\.profile_takes_v2;/.test(sqlCode),
  'migration keeps existing starters (id + content), position 1');
ok(/profile_takes_v2_user_subject_uniq/.test(sql) && /profile_takes_v2_user_position_uniq/.test(sql) && /check \(position between 1 and 3\)/.test(sql), 'unique subject / position per member, max 3 (indexes)');
ok(/limit_reached/.test(sql) && /subject_taken/.test(sql) && /for update/.test(sql), 'limits checked under the per-user lock');
ok(!/save_prompts_v2|delete from profile_prompts_v2|update account_state_v2|v2_assert_editable\(\)\s*returns/.test(sqlCode), 'no prompt / application-state writes; general lock not redefined');
ok(/v2_can_view_public_profile\(auth\.uid\(\), p_user\)/.test(sql), 'starters shown only under the existing visibility rule');
ok(!/2026101[456]09/.test(read('scripts/dev-backend/apply-dev.mjs')) && /20261015090000_v2_takes_multi\.sql/.test(read('scripts/local-backend/setup.mjs')) && /20261016090000_v2_onboarding_takes\.sql/.test(read('scripts/local-backend/setup.mjs')), 'LOCAL setup only; not wired into apply-dev');

module.exports = done('v2_interests_takes');
