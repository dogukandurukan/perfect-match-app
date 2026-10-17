// "Both into this" (D101): exact shared selections on another person's full
// V2 profile. Pure rule + wiring (static). Real-service check:
// scripts/local-backend/smoke_shared_local.mjs.
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const S = require(path.join(ROOT, 'lib/interests/shared.ts'));
const Y = require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const it = (kind, source, id, title) => ({ kind, source, id, title });
const base = { interests: [], activities: [], artists: [], books: [], screen: [] };
const them = {
  interests: ['travel', 'music', 'food'],
  activities: ['yoga', 'running'],
  artists: [it('artist', 'musicbrainz', 'mb:1', 'Tarkan')],
  books: [it('book', 'custom', 'custom:book:1984', '1984'), it('book', 'openlibrary', 'ol:work:A', 'Dune'), it('book', 'openlibrary', 'ol:work:B', 'Emma')],
  screen: [it('screen', 'wikidata', 'wd:Q1', 'Interstellar')],
};
const me = {
  interests: ['music', 'food'],
  activities: ['running', 'yoga'],
  artists: [it('artist', 'musicbrainz', 'mb:1', 'Tarkan')],
  books: [it('book', 'custom', 'custom:book:1984', '1984'), it('book', 'openlibrary', 'ol:work:B', 'Emma'), it('book', 'openlibrary', 'ol:work:Z', 'Dune')],
  screen: [it('screen', 'wikidata', 'wd:Q1', 'Interstellar')],
};

ok(S.sharedHighlights(me, them).join() === 'book:openlibrary:ol:work:B,screen:wikidata:wd:Q1', 'priority book → film, max 2; custom “1984” and a different “Dune” id never count');
ok(S.sharedHighlights(me, them, [{ kind: 'screen', id: 'wd:Q1' }]).join() === 'book:openlibrary:ol:work:B,artist:musicbrainz:mb:1', 'a starter’s subject is not marked again; next by priority');
ok(S.sharedHighlights({ ...me, books: [], screen: [], artists: [] }, them).join() === 'activity:yoga,activity:running', 'activities in THEIR profile order');
ok(S.sharedHighlights({ ...base, interests: ['food', 'music'] }, them).join() === 'interest:music,interest:food', 'broad interests last, their order');
ok(S.sharedHighlights(base, them).length === 0 && S.sharedHighlights(me, base).length === 0, 'nothing shared → nothing');
ok(S.sharedHighlights({ ...base, books: [it('book', 'wikidata', 'ol:work:B', 'Emma')] }, them).length === 0, 'same id but a different source → not shared');
ok(JSON.stringify(S.sharedHighlights(me, them)) === JSON.stringify(S.sharedHighlights(me, them)) && S.SHARED_MAX === 2 && S.SHARED_LABEL === 'Both into this', 'deterministic; label / max');
ok(S.tasteMarkKey(it('book', 'custom', 'custom:book:x', 'x')) === null, 'typed entries have no key');

const bl = Y.buildPublicProfileBlocks({ name: 'D', age: 30, zodiac: null, city: null, heightCm: null, workStatus: null, jobTitle: '', school: null, hometown: null, intent: null, values: [],
  interests: ['music'], activities: ['running'], life: require(path.join(ROOT, 'lib/onboardingV2/yourLife.ts')).EMPTY_LIFE_DRAFT,
  dates: require(path.join(ROOT, 'lib/onboardingV2/yourDates.ts')).EMPTY_DATES_DRAFT, artists: [], books: [], screen: [], prompts: [], photos: [] });
const facts = bl.filter((b) => b.type === 'groups').flatMap((b) => b.groups).flatMap((g) => g.items);
ok(facts.some((f) => f.markKey === 'interest:music') && facts.some((f) => f.markKey === 'activity:running'), 'interest / activity rows carry their mark key');

// Wiring.
const hook = code('lib/interests/useSharedMarks.ts');
ok(/viewerId === them\.id\) return setRes\(\{ tag, keys: \[\] \}\)/.test(hook) && /r\.kind !== 'ok'/.test(hook) && /onAuthStateChange\(\(\) => setRes\(null\)\)/.test(hook)
  && /res\.tag === tag/.test(hook) && /useFocusEffect/.test(hook) && !/AsyncStorage|localStorage|SecureStore/.test(hook),
  'hook: own profile / errors → nothing; only for the exact person + selections; cleared on sign-in change; re-read on focus; never persisted');
ok(/loadMyInterests\(\)/.test(hook) && !/rpc\(|from\(/.test(hook), 'hook: only the viewer’s own interests (existing RPC), no new server call');
ok(/shared,/.test(read('components/main/V2DiscoverScreen.tsx')) && /shared,/.test(read('app/v2/match-profile.tsx')) && /shared,/.test(read('app/v2/activity-profile.tsx'))
  && /markShared=\{!isOwn\}/.test(read('app/v2/profile.tsx')), 'Discover / Matches / Activity / chat → profile use it; own profile never');
ok(!/shared/.test(code('components/onboarding-v2/PreviewFlow.tsx')), 'onboarding preview: no marks');
const dpi = read('components/discover/DiscoverProfileItems.tsx');
const pp = read('components/onboarding-v2/yourProfile/ProfilePreview.tsx');
ok(/shared\?\.has\(f\.markKey\)/.test(dpi) && /shared\?\.has\(tasteMarkKey\(it\)/.test(dpi) && /shared\?\.has\(f\.markKey\)/.test(pp) && /shared\?\.has\(tasteMarkKey\(it\)/.test(pp), 'both renderers mark only on existing rows');
ok(/both: \{ fontFamily: obFonts\.body, fontSize: 13/.test(dpi) && /both: \{ fontFamily: obFonts\.body, fontSize: 13/.test(pp) && !/perfect match|% match|Animated/i.test(code('lib/interests/shared.ts') + code('lib/interests/useSharedMarks.ts')), 'small secondary text; no score / animation');
ok(!/shared|Both into/.test(code('components/interests/TakeCard.tsx')), 'conversation starters unchanged');

// V2 Chats empty text (2026-10-17); V1 unchanged.
const msgs = read('app/(tabs)/messages.tsx');
ok(/v2Enabled\s*\?\s*'When you match with someone, your conversation will appear here\.'\s*:\s*'Once someone accepts your invite, the conversation opens right here\.'/.test(msgs), 'Chats empty: V2 text; V1 text kept');

module.exports = done('v2_shared_interests');
