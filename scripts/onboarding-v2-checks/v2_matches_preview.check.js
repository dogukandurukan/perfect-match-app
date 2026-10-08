// DEV Matches design preview (approved 3-screen direction + daily-pick
// decisions D61–D66, 2026-10-08): lib/dev/matchesPreview.ts +
// components/dev/MatchesDesignPreview.tsx. Flow rules, the simulated daily
// period, the shared profile layout, and that the preview can't reach the
// backend. Local logic check — not a real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/dev/matchesPreview.ts'));
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));

const R = M.previewReducer;
const I = M.INITIAL_PREVIEW_STATE;
const like = (s, comment = '') => R(s, { type: 'send_like', personId: s.pickId, target: 'photo:2', comment });
const msg = (s, id, text = 'Hi!') => R(s, { type: 'send_message', personId: id, text });
const refresh = (s) => R(s, { type: 'refresh' });

// Start: both cards, nothing liked, no message, different people.
ok(M.pickStatus(I) === 'new' && M.mutualStatus(I) === 'new' && I.pickId === 'defne' && I.mutualId === 'ece', 'start: Defne picked, Ece mutual');

// Likes (inside the profile), one per person, no chat.
const liked = like(I);
ok(M.pickStatus(liked) === 'like_sent' && liked.likes.defne.target === 'photo:2', 'heart → Like sent (that target)');
ok(liked.mutualId === I.mutualId && M.mutualStatus(liked) === 'new' && eq(liked.matchOrder, I.matchOrder), 'like leaves the other card and matches untouched');
ok(like(liked, 'again') === liked, 'second like refused (one per person)');
ok(R(I, { type: 'send_like', personId: 'ece', target: 'photo:0', comment: '' }) === I, 'a match (or non-featured person) cannot be liked here');
ok(like(I, '  Which side?  ').likes.defne.comment === 'Which side?' && like(I, 'x'.repeat(400)).likes.defne.comment.length === M.COMMENT_MAX, 'comment trimmed, 240 limit');
ok(msg(liked, 'defne') === liked, 'one-sided like opens no chat (no message possible)');

// D65: picked person likes back → same card updates, never a second copy.
ok(R(I, { type: 'they_like_back' }) === I, 'they like back only after your like');
const mutualPick = R(liked, { type: 'they_like_back' });
ok(M.pickStatus(mutualPick) === 'matched' && mutualPick.mutualId === 'ece', 'liked back: pick card shows the match, the mutual section keeps its own person');
ok(mutualPick.pickId !== mutualPick.mutualId, 'never the same person in both sections');
const pickTalk = msg(mutualPick, 'defne');
ok(M.pickStatus(pickTalk) === 'conversation_started', 'Say hello on the pick card → Conversation started on that card');

// D64: Say hello / first message; Conversation started for the rest of the period.
ok(msg(I, 'ece', '   ') === I, 'no message without text (Say hello stays)');
const talked = msg(I, 'ece', ' Hi Ece! ');
ok(M.mutualStatus(talked) === 'conversation_started' && talked.messages.ece.length === 1, 'first message → Conversation started');
ok(msg(talked, 'ece', 'more') === talked, 'only the first message (continues in Chats)');

// D63/D64/D66: simulated 12:00 refresh — featured cards change, nothing ends.
const p2 = refresh(talked);
ok(p2.period === 2 && p2.pickId === 'mert', 'refresh: a new pick nobody saw featured before');
ok(p2.mutualId === null && M.mutualStatus(p2) === 'none_today', 'refresh: Ece (already talking) is not featured again → “No new mutual match to feature today”');
ok(eq(p2.matchOrder, talked.matchOrder) && eq(p2.messages, talked.messages) && eq(p2.likes, talked.likes), 'refresh: likes, matches and conversations do not end');
const p2b = refresh(mutualPick);
ok(p2b.pickId === 'mert' && p2b.mutualId === 'ece', 'refresh: earliest mutual match without a conversation is featured');
const p2c = refresh(R(R(like(I), { type: 'they_like_back' }), { type: 'send_message', personId: 'ece', text: 'hi' }));
ok(p2c.mutualId === 'defne', 'refresh: yesterday’s pick-turned-match moves to You both liked (once, not twice)');
const p3 = refresh(p2);
ok(p3.pickId === null && M.pickStatus(p3) === 'none', 'no new candidate → No new pick (Defne / Mert never re-offered)');
ok(!refresh(I).featuredPicks.slice(0, -1).includes(refresh(I).pickId), 'a featured pick is never offered again as new');
ok(M.mutualStatus({ ...I, mutualId: null, matchOrder: [] }) === 'none', 'no matches at all → No mutual likes yet');

// DEV shortcuts + reset.
const sc = (s, x) => R(s, { type: 'scenario', scenario: x });
ok(M.mutualStatus(sc(I, 'no_mutual')) === 'none' && M.pickStatus(sc(I, 'no_mutual')) === 'new', 'No mutual like: pick still works');
ok(M.pickStatus(sc(I, 'no_pick')) === 'none' && M.mutualStatus(sc(I, 'no_pick')) === 'new', 'No new pick: mutual still works');
ok(M.pickStatus(sc(I, 'like_sent')) === 'like_sent' && M.mutualStatus(sc(I, 'conversation_started')) === 'conversation_started', 'Like sent / Conversation started shortcuts');
ok(/demo/i.test(M.DEMO_FIRST_MESSAGE), 'DEV shortcut message is labelled as a demo');
ok(eq(R(p3, { type: 'reset' }), I) && eq(sc(p3, 'both'), I), 'Reset / Both cards → start');

// People on the approved layout; location rule.
const defne = M.previewPerson('defne');
ok(L.heroLocation(defne) === 'İstanbul', 'location: city (a filled district is not consent)');
const det = L.buildDiscoverLayout(defne).find((i) => i.type === 'details').facts;
ok(eq(det.filter((f) => !f.wide).map((f) => f.label), ['Height', 'Zodiac']) && eq(det.filter((f) => f.wide).map((f) => f.label), ['Hometown', 'Job', 'School']), 'About: Height + Zodiac, then full-width rows');

// Copy rules (D61, D62).
const C = M.PREVIEW_COPY;
ok(C.dailyLine === 'Daily picks · Refresh at 12:00' && C.pickedCaption === 'Someone new to get to know.' && C.mutualCaption === 'A mutual match to get to know.', 'daily line + section captions');
const copy = Object.values(C).map((v) => (typeof v === 'function' ? v('X') : v)).join(' | ');
ok(!/%|continue chatting|ready to meet|plan a date|tomorrow|countdown|invite|last message|\d+:\d+:\d+|\bin \d+ ?(h|min)/i.test(copy), 'copy: no score / Continue chatting / Plan a date / seconds countdown');

// Static: screen.
const scr = fs.readFileSync(path.join(ROOT, 'components/dev/MatchesDesignPreview.tsx'), 'utf8');
const code = scr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(/C\.dailyLine/.test(code) && /C\.pickedCaption/.test(code) && /C\.mutualCaption/.test(code), 'daily line and captions rendered');
ok(!/setInterval|setTimeout|Date\.now|new Date/.test(code), 'no timer or clock in the preview (refresh is a DEV button)');
ok(/SIMULATED/.test(code) && /no timer, no clock and no selection algorithm/.test(code), 'DEV text says the daily refresh is simulated');
ok(/DiscoverProfileItems/.test(code) && /buildDiscoverLayout/.test(code), 'View profile uses the shared Discover profile components');
ok(/cardPhoto: \{[^}]*aspectRatio: 1\b/.test(code), 'large card photo kept');
ok(!/Modal|BottomSheet|Animated\.|Gesture|LikeSheet/.test(code) && !/name="heart"/.test(code), 'no modal / sheet / animation / filled heart / card-level like');
ok(/styles\.outlineBtn/.test(code) && /styles\.fillBtn/.test(code), 'View profile outlined, Say hello filled');
ok(/accessibilityLabel="Back to Matches"/.test(code) && /active="Matches"/.test(code), 'profile back → Matches; tab bar picture with Matches active');
const files = ['lib/dev/matchesPreview.ts', 'components/dev/MatchesDesignPreview.tsx', 'app/dev/matches-preview.tsx', 'components/discover/useInlineEditorKeyboard.ts'];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(!/supabase|onboardingV2\/remote|matchChatV2|discover\/discoverV2|@\/lib\/(likes|matchInvite|dailyViews)/.test(src), `${f}: no backend import`);
}
ok(/if \(!__DEV__\) return <Redirect/.test(fs.readFileSync(path.join(ROOT, 'app/dev/matches-preview.tsx'), 'utf8')), 'route redirects in production');
ok(/__DEV__ \?[\s\S]{0,200}dev\/matches-preview/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8')), 'Profile entry is DEV-only');

module.exports = done('v2_matches_preview');
