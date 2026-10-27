// Profile → Edit profile, Package 1 (2026-10-27): Looking for, height, work
// status, lifestyle and first-date choices for approved members.
// Pure logic (lib/profile/memberProfileCore.ts) + static wiring + SQL shape.
// The static parts only show the code is wired; they are NOT UI behaviour
// tests — taps, prompts and layout need the phone. Real local services:
// scripts/local-backend/smoke_member_profile_edit_local.mjs.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/profile/memberProfileCore.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const server = { intent: 'long_term', height_cm: 172, work_status: 'full_time', job_title: 'Designer', smoking: 'no', drinking: 'sometimes',
  pets: 'have_pets', pet_kind: 'dog', activity: 'somewhat', date_types: ['coffee', 'walk'], days_pref: 'weekends', time_pref: 'evening', first_name: 'X' };
const f = M.fieldsFromServer(server);

// Mapping.
ok(eq(f, { intent: 'long_term', heightCm: 172, workStatus: 'full_time', smoking: 'no', drinking: 'sometimes', pets: 'have_pets', petKind: 'dog', activity: 'somewhat', dateTypes: ['coffee', 'walk'], days: 'weekends', time: 'evening' }), 'server draft → editable fields (nothing else carried)');
ok(eq(M.fieldsFromServer({}).dateTypes, []) && M.fieldsFromServer({}).intent === null, 'missing values → empty / null');
ok(eq([...M.EDITABLE_SERVER_KEYS].sort(), ['activity', 'date_types', 'days_pref', 'drinking', 'height_cm', 'intent', 'pet_kind', 'pets', 'smoking', 'time_pref', 'work_status']), 'only the Package 1 server keys');

// Changes + expected (only what changed, with the loaded values).
ok(eq(M.changesFor('height', f, { ...f, heightCm: 180 }), { changes: { height_cm: 180 }, expected: { height_cm: 172 } }), 'height: changed key + loaded value');
ok(eq(M.changesFor('lookingFor', f, { ...f, intent: null }), { changes: { intent: null }, expected: { intent: 'long_term' } }), 'Looking for can be cleared (null)');
ok(eq(M.changesFor('height', f, f).changes, {}) && !M.isDirty('lifestyle', f, f), 'no change → nothing to save');
ok(eq(M.changesFor('height', f, { ...f, intent: 'casual' }).changes, {}), 'a section only sends its own fields');
ok(eq(M.changesFor('lifestyle', f, { ...f, pets: 'neutral' }), { changes: { pets: 'neutral', pet_kind: null }, expected: { pets: 'have_pets', pet_kind: 'dog' } }), 'pets away from "I have pets" clears the pet kind');
ok(eq(M.changesFor('work', f, { ...f, workStatus: 'student' }).changes, { work_status: 'student' }), 'work status change never touches the job title');

// Validity.
ok(M.sectionProblem('lookingFor', { ...f, intent: null }) === null && M.sectionProblem('lookingFor', { ...f, intent: 'one_night' }) !== null, 'Looking for: optional, old three options only');
ok(M.sectionProblem('height', { ...f, heightCm: 89 }) && M.sectionProblem('height', { ...f, heightCm: 251 }) && M.sectionProblem('height', { ...f, heightCm: null }) && M.sectionProblem('height', { ...f, heightCm: 172 }) === null, 'height required, 90–250');
ok(M.sectionProblem('work', { ...f, workStatus: null }) === null, 'work status optional');
ok(M.sectionProblem('lifestyle', { ...f, petKind: null }) !== null && M.sectionProblem('lifestyle', M.normalise({ ...f, pets: 'neutral' })) === null && M.sectionProblem('lifestyle', { ...f, smoking: null }) !== null, 'lifestyle: all required; pet kind required only with pets');
ok(M.sectionProblem('dates', { ...f, dateTypes: [] }) && M.sectionProblem('dates', { ...f, dateTypes: ['coffee', 'walk', 'dinner'] }) && M.sectionProblem('dates', { ...f, days: null }) && M.sectionProblem('dates', f) === null, 'first dates: 1–2 types, days and time required');

// Summaries + errors.
ok(M.sectionSummary('lookingFor', { ...f, intent: null }) === 'Not shown on your profile' && M.sectionSummary('lookingFor', f) === 'A serious relationship', 'Looking for summary (cleared → not shown)');
ok(M.sectionSummary('dates', f) === 'Coffee · A walk — Weekends · Evening', 'first dates summary');
ok(M.saveError('profile_changed').changed === true && M.saveError(null).changed === false && /try again/i.test(M.saveError(null).text), 'conflict → Reload; other failures → retry');

// UI round 2026-10-27: plain lifestyle words (as on the profile), incl. activity.
ok(M.sectionSummary('lifestyle', { ...f, pets: 'like_no_pets', petKind: null }) === "Doesn't smoke · Drinks sometimes · " + require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts')).lifestylePhrases({ smoking: null, drinking: null, pets: 'like_no_pets', petKind: null, activity: null }).pets + ' · Somewhat active', 'lifestyle summary: plain words + activity');
ok(M.sectionSummary('lifestyle', f) === "Doesn't smoke · Drinks sometimes · Has a dog · Somewhat active", 'lifestyle summary with a pet kind');

// Static wiring (not UI behaviour).
const sec = code('app/v2/edit-profile-section.tsx');
ok(/addListener\('beforeRemove'/.test(sec) && /if \(!dirty \|\| busy\.current\) return;/.test(sec) && /Discard changes\?/.test(sec), 'wired: Discard changes prompt');
ok(/if \(r\.ok\) \{\s*setSaved\(r\.fields\);\s*setDraft\(r\.fields\);/.test(sec) && /setBanner\(\{ kind: 'error', text: r\.text, changed: r\.changed \}\)/.test(sec), 'wired: saved state only from the server; failure keeps the draft');
ok(/banner\.changed \?/.test(sec) && /Reload your profile\?/.test(sec), 'wired: Reload after a conflict (asks when dirty)');
ok(/disabled=\{saving \|\| !dirty \|\| !!problem\}/.test(sec), 'wired: Save disabled when unchanged / invalid / saving');
ok(/DateTypesFields hideSpot/.test(sec) && !/spotText: draft/.test(sec), 'wired: favorite spot not editable here');
ok(!/connection_answers|connectionRemote|loadConnectionAnswers|onboardingV2\/connection/.test(sec + code('lib/profile/memberProfile.ts') + code('lib/profile/memberProfileCore.ts')), 'private preferences never read or written');
const hub = code('app/v2/edit-profile.tsx');
ok(/open\('\/v2\/edit-photos'\)/.test(hub) && /to: '\/v2\/edit-interests'/.test(hub), 'Photos and Interests open the existing editors');
ok(/label: 'Gender'[^\n]*visibility: 'Private', to: null/.test(hub) && /label: 'Interested in'[^\n]*visibility: 'Private', to: null/.test(hub), 'gender / interested in: Private, locked');
ok(/Details with a lock can’t be changed yet\./.test(read('app/v2/edit-profile.tsx')) && /lock-closed-outline/.test(hub) && !/This detail can’t be changed yet/.test(hub) && !/support|mailto|contact us/i.test(hub), 'one lock note per section + lock icons; no support link');
ok(/useFocusEffect/.test(hub), 'list reloads on focus (shows saved values)');
const home = code('components/main/V2ProfileHome.tsx');
ok(/router\.push\('\/v2\/edit-profile'/.test(home) && !/router\.push\('\/v2\/edit-(photos|interests)'/.test(home) && /label="Preview"[\s\S]*own=1/.test(home), 'Profile tab: Edit profile + Preview (own public view); no Photos / Interests shortcuts');
ok(/hideSpot \? null :/.test(code('components/onboarding-v2/yourDates/YourDatesFields.tsx')) && !/hideSpot/.test(code('components/onboarding-v2/PreviewFlow.tsx')), 'onboarding still shows the favorite spot');

// Server package.
const sql = read('supabase/proposed/20261027090000_v2_member_profile_edit.sql').replace(/^--.*$/gm, '');
ok(/v_uid uuid := public\.v2_assert_member_profile_edit\(\);/.test(sql) && !/v2_assert_editable/.test(sql), 'active members only; the general onboarding lock is not used or changed');
ok(/v_allowed text\[\] := array\['intent','height_cm','work_status','smoking','drinking','pets','pet_kind',\s*'activity','date_types','days_pref','time_pref'\]/.test(sql) && /'field_not_editable'/.test(sql), 'allow-list; unknown fields refused');
ok(/is distinct from \(p_expected -> k\)/.test(sql) && /'profile_changed'/.test(sql) && /for update/.test(sql), 'field-level conflict check on a locked row');
ok(/v_new := v_cur \|\| p_changes;/.test(sql) && /pet_kind/.test(sql) && /between 90 and 250/.test(sql), 'final (merged) values validated');
ok(!/job_title\s*=|favorite_spot\s*=|account_state_v2|connection_answers|update profiles/.test(sql), 'job title, favorite spot, account / review state, private preferences and profiles untouched');
ok(/20261027090000_v2_member_profile_edit\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/member_profile_edit/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
module.exports = done('v2_member_profile_edit');
