// DEV Matches design preview (approved 3-screen direction, 2026-10-08):
// lib/dev/matchesPreview.ts + components/dev/MatchesDesignPreview.tsx.
// Flow rules, the shared approved profile layout, and that the preview can't
// reach the backend. Local logic check — not a real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/dev/matchesPreview.ts'));
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));

const R = M.previewReducer;
const I = M.INITIAL_PREVIEW_STATE;

// Start: both cards, nothing liked, no message.
ok(M.pickStatus(I) === 'new' && M.mutualStatus(I) === 'new' && I.mutual.messages.length === 0, 'start: both cards, no message');

// Likes inside the profile (photo / prompt target), one per person.
const heart = R(I, { type: 'send_like', target: 'photo:2', comment: '' });
ok(M.pickStatus(heart) === 'like_sent' && heart.pick.like.comment === '' && heart.pick.like.target === 'photo:2', 'heart on a photo → Like sent (that target)');
ok(heart.mutual === I.mutual, 'like leaves the other card untouched (no chat, no message)');
ok(R(heart, { type: 'send_like', target: 'prompt:x', comment: 'again' }) === heart, 'second like refused (one per person)');
const noted = R(I, { type: 'send_like', target: 'prompt:together_we_could', comment: '  Which side?  ' });
ok(noted.pick.like.comment === 'Which side?' && M.pickStatus(noted) === 'like_sent', 'comment like stored (trimmed) → Like sent');
ok(R(I, { type: 'send_like', target: 'photo:0', comment: 'x'.repeat(400) }).pick.like.comment.length === M.COMMENT_MAX, '240 limit');

// Say hello: nothing until sent; first message → Conversation started.
ok(R(I, { type: 'send_message', text: '   ' }) === I, 'no message without text (back without sending keeps Say hello)');
const said = R(I, { type: 'send_message', text: ' Hi Ece! ' });
ok(said.mutual.messages.length === 1 && M.mutualStatus(said) === 'conversation_started', 'first message → Conversation started');
ok(said.pick === I.pick, 'message leaves the pick card untouched');
ok(R(said, { type: 'send_message', text: 'more' }) === said, 'preview stops after the first message (continues in Chats)');

// DEV states.
const sc = (s, x) => R(s, { type: 'scenario', scenario: x });
ok(M.mutualStatus(sc(I, 'no_mutual')) === 'none' && M.pickStatus(sc(I, 'no_mutual')) === 'new', 'No mutual like: pick still works');
ok(M.pickStatus(sc(I, 'no_pick')) === 'none' && M.mutualStatus(sc(I, 'no_pick')) === 'new', 'No new pick: mutual still works');
ok(M.pickStatus(sc(I, 'like_sent')) === 'like_sent' && M.mutualStatus(sc(I, 'like_sent')) === 'new', 'Like sent state');
ok(M.mutualStatus(sc(I, 'conversation_started')) === 'conversation_started' && M.pickStatus(sc(I, 'conversation_started')) === 'new', 'Conversation started state');
ok(/demo/i.test(M.DEMO_FIRST_MESSAGE), 'DEV shortcut message is labelled as a demo');
ok(eq(R(said, { type: 'reset' }), I) && eq(sc(said, 'both'), I), 'Reset / Both cards → start');

// People: fixed synthetic examples on the approved Discover layout.
const pick = M.PREVIEW_PEOPLE.pick;
const mutual = M.PREVIEW_PEOPLE.mutual;
ok(pick.name === 'Defne' && mutual.name === 'Ece', 'fixed synthetic people (Defne, Ece)');
ok(L.heroLocation(pick) === 'İstanbul' && L.heroLocation(mutual) === 'İstanbul', 'location: city (a filled district is not consent)');
const items = L.buildDiscoverLayout(pick);
ok(items[0].type === 'hero' && items.some((i) => i.type === 'prompt') && items.some((i) => i.type === 'details'), 'profile uses the approved Discover layout');
const det = items.find((i) => i.type === 'details').facts;
ok(eq(det.filter((f) => !f.wide).map((f) => f.label), ['Height', 'Zodiac']) && eq(det.filter((f) => f.wide).map((f) => f.label), ['Hometown', 'Job', 'School']), 'About: Height + Zodiac, then full-width rows');

// Copy rules.
const copy = Object.values(M.PREVIEW_COPY).map((v) => (typeof v === 'function' ? v('X') : v)).join(' | ');
ok(!/%|continue chatting|ready to meet|plan a date|tomorrow|countdown|invite|last message/i.test(copy), 'copy: no score / Continue chatting / Ready to meet / Plan a date / timer');
ok(M.PREVIEW_COPY.noPickTitle === 'No new pick right now' && M.PREVIEW_COPY.noMutualTitle === 'No mutual likes yet', 'empty-state titles');

// Static: screen.
const scr = fs.readFileSync(path.join(ROOT, 'components/dev/MatchesDesignPreview.tsx'), 'utf8');
const code = scr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(/DiscoverProfileItems/.test(code) && /buildDiscoverLayout/.test(code), 'View profile uses the shared Discover profile components');
ok(/cardPhoto: \{[^}]*aspectRatio: 1\b/.test(code), 'large near-square card photo (not shrunk to fit both)');
ok(!/Modal|BottomSheet|Animated\.|Gesture|LikeSheet/.test(code), 'no modal / sheet / animation / swipe');
ok(!/name="heart"/.test(code), 'no filled (green) heart and no card-level like action');
ok(/onPress=\{onSayHello\}/.test(code) && /C\.conversationStarted/.test(code) && /C\.conversationNote/.test(code), 'Say hello replaced by Conversation started + note');
ok(/styles\.outlineBtn/.test(code) && /styles\.fillBtn/.test(code), 'View profile outlined, Say hello filled');
ok(/accessibilityLabel="Back to Matches"/.test(code), 'profile back returns to Matches');
ok(/active="Matches"/.test(code), 'tab bar picture with Matches active');
ok(/nothing is sent to Chats/.test(code) && /local demo/.test(code), 'DEV text says the chat is a local demo');
const files = ['lib/dev/matchesPreview.ts', 'components/dev/MatchesDesignPreview.tsx', 'app/dev/matches-preview.tsx', 'components/discover/useInlineEditorKeyboard.ts'];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(!/supabase|onboardingV2\/remote|matchChatV2|discover\/discoverV2|@\/lib\/(likes|matchInvite|dailyViews)/.test(src), `${f}: no backend import`);
}
ok(/if \(!__DEV__\) return <Redirect/.test(fs.readFileSync(path.join(ROOT, 'app/dev/matches-preview.tsx'), 'utf8')), 'route redirects in production');
ok(/__DEV__ \?[\s\S]{0,200}dev\/matches-preview/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8')), 'Profile entry is DEV-only');

module.exports = done('v2_matches_preview');
