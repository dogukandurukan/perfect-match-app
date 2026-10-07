// Real V2 Discover (lib/discover/*, components/main/V2DiscoverScreen.tsx):
// stable content ids, safe retries, what each server result does, the
// receiver's "what was liked" text, and that no DEV fixture reaches the real
// screen. Local logic check only — the server side is covered by
// scripts/test-backend/smoke_discover_v2.mjs on real services.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));
const F = require(path.join(ROOT, 'lib/discover/likeFlow.ts'));

const PH = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const PR = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const row = {
  user_id: 'u1', first_name: 'Ada', age: 30, zodiac: 'Aries', city: 'İstanbul', height_cm: 170, work_status: 'full_time', job_title: 'Designer',
  school: null, hometown: null, intent: 'long_term', core_values: ['trust'], interests: ['travel'], smoking: 'no', drinking: null, pets: null,
  pet_kind: null, activity: null, artists: [], books: [], screen: [], date_types: ['coffee'], favorite_spot: null, days_pref: null, time_pref: null,
  prompts: [{ id: PR[1], slot: 2, prompt_id: 'together_we_could', answer: 'Find kumpir' }, { id: PR[0], slot: 1, prompt_id: 'small_thing_i_love', answer: 'Simit' }],
  photo_paths: ['u1/a.jpg', 'u1/b.jpg', 'u1/c.jpg'],
  photos: [{ id: PH[0], path: 'u1/a.jpg' }, { id: PH[1], path: 'u1/b.jpg' }, { id: PH[2], path: 'u1/c.jpg' }],
};

// Server row → person: ids aligned with images, district never invented.
const signed = new Map([['u1/a.jpg', 'https://s/a'], ['u1/b.jpg', null], ['u1/c.jpg', 'https://s/c']]);
const rp = F.realProfileFromServer(row, signed);
ok(eq(rp.person.photoIds, [PH[0], PH[2]]) && eq(rp.photoUrls, ['https://s/a', 'https://s/c']) && rp.person.photoCount === 2,
  'unsignable photo dropped together with its id (ids and images stay aligned)');
ok(eq(rp.person.prompts.map((p) => p.id), [PR[0], PR[1]]), 'prompts in slot order with their stable ids');
ok(rp.person.district === null && L.heroLocation(rp.person) === 'İstanbul', 'no share choice → city on the hero');

// Targets are stable ids, never positions.
const items = L.buildDiscoverLayout(rp.person);
const photoTargets = items.filter((i) => i.type === 'hero' || i.type === 'photo').map((i) => i.target);
const promptTargets = items.filter((i) => i.type === 'prompt').map((i) => i.key);
ok(eq(photoTargets, [`photo:${PH[0]}`, `photo:${PH[2]}`]), 'photo hearts target photo ids (not index)');
ok(eq(promptTargets, [`prompt:${PR[0]}`, `prompt:${PR[1]}`]), 'prompt hearts target prompt row ids');
ok(eq(L.parseTarget(`photo:${PH[1]}`), { type: 'photo', id: PH[1] }) && L.parseTarget('photo:0') === null && L.parseTarget('prompt:small_thing_i_love') === null,
  'only id targets can be sent (index / catalog keys refused client-side)');

// Safe retry ids.
const fresh = (() => { let n = 0; return () => `r${++n}`; })();
const p1 = { likeeId: 'u1', target: `photo:${PH[0]}`, note: 'hi', requestId: 'r-old' };
ok(F.requestIdFor(p1, 'u1', `photo:${PH[0]}`, 'hi', fresh) === 'r-old', 'unknown result → retry of the same content reuses the request id');
ok(F.requestIdFor(p1, 'u1', `photo:${PH[0]}`, 'hi!', fresh) !== 'r-old', 'changed comment → new request id');
ok(F.requestIdFor(null, 'u1', `photo:${PH[0]}`, '', fresh) !== 'r-old', 'first attempt → new id');

// What each result does.
const O = (r, c) => F.likeOutcome(r, c, 'Ada');
const okHeart = O({ kind: 'ok', matched: false, quota: null }, false);
ok(okHeart.advance && !okHeart.showSent && !okHeart.message, 'heart OK → next person');
const okNote = O({ kind: 'ok', matched: true, quota: null }, true);
ok(!okNote.advance && okNote.showSent && okNote.done && !okNote.keepEditor, 'comment OK → stay, sent note, Next profile');
const unk = O({ kind: 'unknown' }, true);
ok(!unk.advance && !unk.showSent && unk.keepEditor && unk.keepPending && !!unk.message, 'unknown → no success, draft kept, request id kept');
const unkHeart = O({ kind: 'unknown' }, false);
ok(!unkHeart.advance && unkHeart.keepPending && !!unkHeart.message, 'unknown heart → no advance, safe retry');
const quota = O({ kind: 'refused', error: 'quota_exhausted', quota: { remaining: 0, limit: 5 } }, true);
ok(!quota.advance && quota.keepEditor && !quota.done, 'out of likes → draft kept, no success');
const already = O({ kind: 'refused', error: 'already_liked', quota: null }, false);
ok(!already.advance && already.done && /already liked Ada/.test(already.message), 'already liked → Next profile, no second like');
const na = O({ kind: 'refused', error: 'not_available', quota: null }, true);
ok(na.done && !na.showSent && !na.advance, 'not available (blocked / hidden) → no success, Next profile');
const bad = O({ kind: 'refused', error: 'invalid_target', quota: null }, true);
ok(bad.reloadProfile && bad.keepEditor && !bad.showSent, 'changed content → reload profile, draft kept');

// Receiver text.
ok(F.likedTargetText({ target_type: 'photo', target_available: true, target_prompt_id: null }) === 'On your photo', 'receiver: on your photo');
ok(F.likedTargetText({ target_type: 'prompt', target_available: true, target_prompt_id: 'small_thing_i_love' }) === 'On your answer: A small thing I love…', 'receiver: which answer');
ok(/no longer/.test(F.likedTargetText({ target_type: 'photo', target_available: false, target_prompt_id: null })), 'receiver: removed content never re-bound');
ok(F.likedTargetText({ target_type: 'profile', target_available: null, target_prompt_id: null }) === null, 'receiver: old profile-level like → no target line');
ok(F.likesLeftText({ remaining: 1, limit: 5 }) === '1 like left' && F.likesLeftText(null) === '', 'counter text from the server quota only');

// Static: the real screen.
const scr = fs.readFileSync(path.join(ROOT, 'components/main/V2DiscoverScreen.tsx'), 'utf8');
const code = scr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/components\/dev|lib\/dev|discover-preview|DISCOVER_PEOPLE|DISCOVER_PHOTOS|PREVIEW_LIKES/.test(code), 'no DEV fixtures in the real screen');
ok(!/from\('likes'\)/.test(code) && /sendLikeV2\(/.test(code), 'likes only through send_like_v2');
ok(!/match_percentage|%/.test(code.replace(/'\d+%'/g, '')), 'no score / percentage');
ok(!/Gesture|PanResponder|Animated\.|Modal\b|Like sent|Profile passed/.test(code), 'no swipe, animation, modal or toast');
ok(/if \(!person \|\| busyRef\.current\) return;/.test(code), 'one send at a time (double tap)');
ok(/onPress=\{next\} style=\{styles\.next\}/.test(code) && /chrome\.nextProfile/.test(code), 'Next profile only advances');
const idx = fs.readFileSync(path.join(ROOT, 'app/(tabs)/index.tsx'), 'utf8');
ok(/if \(v2 === 'yes'\) return <V2DiscoverScreen \/>;/.test(idx), 'Discover tab opens the V2 screen for active V2 members');
const flow = fs.readFileSync(path.join(ROOT, 'lib/discover/discoverV2.ts'), 'utf8');
ok(/get_discovery_candidates_v2/.test(flow) && !/order|sort|score/i.test(flow.split('loadCandidateIds')[1].split('}')[0]), 'Discover order unchanged (server order, no client re-sort)');

module.exports = done('v2_discover_real');
