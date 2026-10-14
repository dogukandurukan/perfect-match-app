// "Interests & conversation starter" (D87–D93): pure rules + wiring. Local
// logic / static check only — server rules are covered on the LOCAL Supabase
// by scripts/local-backend/smoke_takes_local.mjs (real services).
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const T = require(path.join(ROOT, 'lib/interests/takes.ts'));
const Y = require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts'));
const S = require(path.join(ROOT, 'lib/onboardingV2/serverMapping.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const sql = read('supabase/proposed/20261014090000_v2_interests_takes.sql');

// Catalog matches the server exactly (keys + order) and stays separate.
const sqlKeys = /array\['running'[^\]]*\]/.exec(sql)[0].match(/'([a-z]+)'/g).map((x) => x.slice(1, -1));
ok(T.ACTIVITIES.map((a) => a.key).join() === sqlKeys.join() && sqlKeys.length === 12, '12 activities, same keys as the server');
ok(!T.ACTIVITIES.some((a) => require(path.join(ROOT, 'lib/onboardingV2/yourWorld.ts')).INTERESTS.some((i) => i.key === a.key && a.key !== 'gaming')), 'activities are their own list (only “gaming” exists in both by name)');
ok(T.MAX_ACTIVITIES === 5 && /v2_is_subset\(activities, array\[[^\]]*\], 5\)/.test(sql), 'max 5 activities (client + server)');
ok(T.TAKE_MAX === 180 && /between 1 and 180/.test(sql), '1–180 characters (client + server)');
for (const [kind, qs] of Object.entries(T.TAKE_QUESTIONS)) {
  ok(qs.length === 2 && qs.every((q) => new RegExp(`subject_kind = '${kind}' and question_id in \\('${qs[0].id}', '${qs[1].id}'\\)`).test(sql)), `${kind}: two short questions, same ids as the server`);
}

// Activities toggle.
let a = [];
for (const k of ['running', 'walking', 'cycling', 'hiking', 'swimming', 'gym']) a = T.toggleActivity(a, k);
ok(a.length === 5 && !a.includes('gym') && T.toggleActivity(a, 'running').length === 4 && T.toggleActivity([], 'skydiving').length === 0, 'toggle: 6th refused, tap removes, unknown ignored');

// Subjects: own saved activities / books / films / artists only (never broad interests).
const sel = { interests: ['sports', 'books'], activities: ['running'], artists: [{ kind: 'artist', source: 'custom', id: 'custom:artist:tarkan', title: 'Tarkan' }],
  books: [{ kind: 'book', source: 'openlibrary', id: 'ol:work:OL1W', title: '1984' }], screen: [] };
const opts = T.subjectOptions(sel);
ok(opts.map((o) => `${o.kind}:${o.id}`).join() === 'activity:running,book:ol:work:OL1W,artist:custom:artist:tarkan' && opts[0].title === 'Running', 'subjects = saved activities / books / films / artists (no broad interest)');

// Editor: another subject never inherits the old answer.
const take = { id: 't1', subject_kind: 'activity', subject_id: 'running', subject_title: 'Running', question_id: 'activity_favourite_part', answer: 'Seaside run.' };
const d0 = T.draftFromTake(take, opts);
ok(d0.subject.id === 'running' && d0.answer === 'Seaside run.' && !T.takeDraftChanged(d0, take), 'edit starts from the saved take');
const d1 = T.chooseSubject(d0, opts[1]);
ok(d1.subject.id === 'ol:work:OL1W' && d1.answer === '' && d1.questionId === 'book_why', 'change subject → empty answer, first question of the new kind');
ok(T.chooseSubject(d0, opts[0]) === d0, 'same subject → draft unchanged');
ok(T.chooseQuestion(d1, 'activity_perfect_day') === d1 && T.chooseQuestion(d1, 'book_stayed').questionId === 'book_stayed', 'question must belong to the subject kind');
ok(T.setAnswer(d1, 'x'.repeat(200)).answer.length === 180 && !T.takeDraftValid(T.setAnswer(d1, '   ')) && T.takeDraftValid(T.setAnswer(d1, 'Bir cümle.')), 'answer: capped at 180, blank invalid, Turkish fine');

// Removing the take's subject is detected (the server asks for confirmation too).
ok(T.removesTakeSubject({ ...sel, activities: [] }, take) && !T.removesTakeSubject({ ...sel, books: [] }, take) && !T.removesTakeSubject(sel, null), 'removing the take’s subject is detected; unrelated removals are not');

// Display: card under the main photo; nothing when absent; never "You both".
const base = { name: 'Defne', age: 30, zodiac: null, city: 'İstanbul', heightCm: null, workStatus: null, jobTitle: '', school: null, hometown: null, intent: null, values: [],
  interests: [], life: require(path.join(ROOT, 'lib/onboardingV2/yourLife.ts')).EMPTY_LIFE_DRAFT, dates: require(path.join(ROOT, 'lib/onboardingV2/yourDates.ts')).EMPTY_DATES_DRAFT,
  artists: [], books: [], screen: [], prompts: [], photos: [{ id: 'p', uri: 'x' }] };
const shown = { kind: 'activity', subjectTitle: 'Running', questionId: 'activity_favourite_part', answer: 'Seaside run.' };
const withTake = Y.buildPublicProfileBlocks({ ...base, take: shown, activities: ['running', 'yoga'] });
ok(withTake[0].type === 'hero' && withTake[1].type === 'take' && withTake[1].take.answer === 'Seaside run.', 'take card right under the main photo');
ok(withTake.some((b) => b.type === 'groups' && b.groups.some((g) => g.title === 'Activities' && g.items.map((i) => i.text).join() === 'Running,Yoga')), 'activities shown as their own group');
ok(!Y.buildPublicProfileBlocks(base).some((b) => b.type === 'take') && !Y.buildPublicProfileBlocks({ ...base, take: null }).some((b) => b.type === 'take'), 'no take → no card (no empty box for others)');
ok(S.publicTakeFromServer({ subject_kind: 'book', subject_id: 'x', subject_title: '1984', question_id: 'book_why', answer: ' Why not. ' }).answer === 'Why not.'
  && S.publicTakeFromServer({ subject_kind: 'nope', subject_id: 'x', subject_title: '1984', question_id: 'book_why', answer: 'a' }) === null
  && S.publicTakeFromServer(null) === null, 'server take mapping: known kind, non-empty answer');
ok(!Y.buildPublicProfileBlocks({ ...base, take: { ...shown, questionId: 'nope' } }).some((b) => b.type === 'take') && T.takeQuestionText('book_why') === 'Why this book?', 'unknown question → no card');
ok(!/^import (?!type)/m.test(read('lib/onboardingV2/serverMapping.ts')), 'serverMapping keeps no runtime imports (plain-Node checks load it)');
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));
const person = { ...base, id: 'u', district: null, photoCount: 1, photoIds: ['p1'], prompts: [], take: shown };
const lay = L.buildDiscoverLayout(person);
ok(lay[0].type === 'hero' && lay[1].type === 'take', 'full V2 profile (Discover / Matches / Activity): take right after the hero');
const card = read('components/interests/TakeCard.tsx');
ok(!/You both|in common|HeartButton|onLike|Comment/.test(code('components/interests/TakeCard.tsx')) && /Add a conversation starter/.test(card), 'card: no shared-interest claim, no like / comment; own empty state copy');
ok(/case 'take':[\s\S]{0,120}<TakeCard/.test(read('components/discover/DiscoverProfileItems.tsx')) && /case 'take':[\s\S]{0,120}<TakeCard/.test(read('components/onboarding-v2/yourProfile/ProfilePreview.tsx')), 'both profile renderers draw the read-only card');
const pv = read('components/onboarding-v2/PublicProfileView.tsx');
ok(/onAddTake && !state\.blocks\.some\(\(b\) => b\.type === 'take'\)/.test(pv) && /own === '1'/.test(read('app/v2/profile.tsx')) && /&own=1/.test(read('components/main/V2ProfileHome.tsx')), '“Add a conversation starter” only on the own profile');
ok(/\[userId, refreshKey\]/.test(pv) && /useFocusEffect/.test(read('app/v2/profile.tsx')), 'own profile reloads from the server when it regains focus');

// Edit screen.
const ed = code('app/v2/edit-interests.tsx');
ok(/saveSelections\(sel, removeTake\)/.test(ed) && /kind === 'confirm'/.test(ed) && /Remove both/.test(ed) && /Cancel/.test(ed), 'removing the take’s subject: explicit confirm / cancel');
ok(/if \(r\.kind === 'ok'\) \{\s*applySaved\(r\.value\)/.test(ed) && /setBanner\(\{ kind: 'error', text: r\.message \}\)/.test(ed), 'state replaced only from the server answer; failure keeps the draft + shows an error');
ok(/beforeRemove/.test(ed) && /Discard changes\?/.test(ed), 'leaving with unsaved changes asks first');
ok(!/save_prompts_v2|savePrompts|save_onboarding_v2|photos|selfie|first_name/.test(ed), 'edit screen touches no prompts / photos / identity');
ok(/Interests & conversation starter/.test(read('components/main/V2ProfileHome.tsx')) && /label="Edit profile" variant="outline" disabled/.test(read('components/main/V2ProfileHome.tsx')), 'Profile: new entry; general Edit profile still disabled');

// Server package: narrow, member-only, general lock untouched, wiring.
ok(!/v2_assert_editable\(\)\s*returns/.test(sql) && /is_active_v2_member\(v_uid\)/.test(sql), 'general v2_assert_editable not redefined; member-only gate');
ok(/revoke all on public\.profile_takes_v2 from public, anon, authenticated;\s*grant select on public\.profile_takes_v2 to authenticated;/.test(sql), 'no client writes to profile_takes_v2');
ok(/take_subject_removed/.test(sql) && /p_remove_take/.test(sql), 'subject removal needs confirmation (server)');
ok(!/save_prompts_v2|delete from profile_prompts_v2|update account_state_v2/.test(sql.replace(/--.*$/gm, '')), 'no prompt / application-state writes');
ok(/v2_can_view_public_profile\(auth\.uid\(\), p_user\)/.test(sql), 'take shown only under the existing profile visibility rule');
ok(!/20261014090000_v2_interests_takes/.test(read('scripts/dev-backend/apply-dev.mjs')) && /20261014090000_v2_interests_takes\.sql/.test(read('scripts/local-backend/setup.mjs')), 'LOCAL setup only; not wired into apply-dev');

module.exports = done('v2_interests_takes');
