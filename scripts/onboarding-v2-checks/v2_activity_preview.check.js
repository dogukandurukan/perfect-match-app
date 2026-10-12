// DEV Activity design preview (mockup 2026-10-12, D75–D81): one feed,
// merged like+comment cards, view ≠ accept, ONE "Match & chat" that is
// idempotent and fails visibly, chat context never a message, and that the
// preview can't reach the backend. Local logic check only — not a
// real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const A = require(path.join(ROOT, 'lib/dev/activityPreview.ts'));

const s0 = A.INITIAL_ACTIVITY;
const R = A.activityReducer;
const run = (s, ...acts) => acts.reduce(R, s);
const feedSig = (s) => A.buildFeed(s).map((f) => `${f.kind}:${f.kind === 'interest' ? f.interest.personId : f.match.personId}`);

// Fixture coverage.
const it = (id) => A.interestFor(s0, id);
ok(it('zeynep').target.kind === 'profile' && !it('zeynep').comment && A.interestLabel(it('zeynep').target) === 'Liked you', 'profile like, no comment → "Liked you"');
ok(it('defne').target.kind === 'photo' && it('defne').comment === 'Where was this taken?' && A.interestLabel(it('defne').target) === 'Liked your photo', 'photo like with comment');
ok(it('ece').target.kind === 'prompt' && A.interestLabel(it('ece').target) === 'Liked your answer' && A.promptQuestion(it('ece').target), 'prompt like');
ok(A.matchFor(s0, 'selin') && !A.conversationStarted(A.matchFor(s0, 'selin')) && A.conversationStarted(A.matchFor(s0, 'melis')), 'existing match + started conversation');

// Merging: a like and its comment → one card; unread if any part unread.
ok(A.RAW_EVENTS.filter((e) => e.personId === 'defne').length === 2 && s0.interests.filter((i) => i.personId === 'defne').length === 1, 'like + comment merged into one card');
const merged = A.mergeIncoming([
  { kind: 'comment', personId: 'x', minutesAgo: 5, read: true, text: '  hi  ' },
  { kind: 'like', personId: 'x', minutesAgo: 9, read: false, target: { kind: 'photo', myPhotoIndex: 0 } },
]);
ok(merged.length === 1 && merged[0].comment === 'hi' && merged[0].target.kind === 'photo' && merged[0].minutesAgo === 5 && merged[0].read === false, 'merge: order-independent, newest time, unread wins, trimmed');
ok(A.mergeIncoming([{ kind: 'comment', personId: 'y', minutesAgo: 1, read: false, text: '   ' }])[0].comment === null, 'blank comment → no comment');

// Feed: one vertical list, newest first, one entry per person.
ok(eq(feedSig(s0), ['interest:defne', 'interest:zeynep', 'match:selin', 'interest:ece', 'match:melis']), 'feed: mixed, newest first');
const both = { ...s0, matches: [...s0.matches, { id: 'm-ece', personId: 'ece', minutesAgo: 1, read: true, started: null, messages: [] }] };
ok(!feedSig(both).includes('interest:ece') && feedSig(both).includes('match:ece'), 'a matched person is never also shown as pending');

// View ≠ accept.
const viewed = R(s0, { type: 'open_profile', personId: 'defne' });
ok(A.interestFor(viewed, 'defne').read && !A.matchFor(viewed, 'defne') && viewed.matches.length === s0.matches.length, 'opening the profile marks read, creates no match');
ok(eq(feedSig(viewed), feedSig(s0)), 'going back: feed unchanged (still pending)');

// Match & chat: one match, interest → match row, no message, context kept.
const m1 = run(viewed, { type: 'match_start', personId: 'defne' }, { type: 'match_done', personId: 'defne' });
const dm = A.matchFor(m1, 'defne');
ok(dm && m1.matches.filter((m) => m.personId === 'defne').length === 1 && !A.interestFor(m1, 'defne'), 'Match & chat → exactly one match, card leaves pending');
ok(feedSig(m1)[0] === 'match:defne' && !feedSig(m1).includes('interest:defne'), 'card turns into the match row');
ok(dm.messages.length === 0 && dm.started.comment === 'Where was this taken?' && dm.started.target.kind === 'photo', 'no message sent; comment kept as How-it-started context');
// Repeats / double taps.
const twice = run(viewed, { type: 'match_start', personId: 'defne' }, { type: 'match_start', personId: 'defne' }, { type: 'match_done', personId: 'defne' }, { type: 'match_done', personId: 'defne' });
ok(twice.matches.filter((m) => m.personId === 'defne').length === 1, 'double tap → still one match');
ok(R(m1, { type: 'match_start', personId: 'defne' }) === m1, 'already matched → no new request (Open chat)');
ok(R(s0, { type: 'match_done', personId: 'defne' }) === s0, 'a stray completion without a request does nothing');
ok(run(s0, { type: 'match_start', personId: 'defne' }, { type: 'match_start', personId: 'zeynep' }).matching === 'defne', 'one request in flight at a time');
// Leave the chat without a message, reopen: same match.
const left = run(m1, { type: 'open_chat', matchId: dm.id });
ok(A.matchFor(left, 'defne').id === dm.id && left.matches.length === m1.matches.length, 'leaving without a message keeps the match; reopening uses the same chat');
const sent = R(left, { type: 'send_message', matchId: dm.id, text: 'Hi Defne' });
ok(A.conversationStarted(A.matchFor(sent, 'defne')) && R(sent, { type: 'send_message', matchId: dm.id, text: '  ' }) === sent, 'first real message → conversation started; blank ignored');

// Failure: never looks matched; retry works.
const failed = run(viewed, { type: 'dev_fail_next', on: true }, { type: 'match_start', personId: 'defne' }, { type: 'match_done', personId: 'defne' });
ok(!A.matchFor(failed, 'defne') && A.interestFor(failed, 'defne') && failed.matchError === 'defne' && failed.matching === null, 'failure: no match, card stays, error shown');
const retried = run(failed, { type: 'match_start', personId: 'defne' }, { type: 'match_done', personId: 'defne' });
ok(A.matchFor(retried, 'defne') && retried.matchError === null, 'retry after failure → matched');

// States + copy.
ok(A.buildFeed(R(s0, { type: 'scenario', scenario: 'empty' })).length === 0, 'empty Activity');
const err = R(s0, { type: 'scenario', scenario: 'error' });
ok(err.load === 'error' && R(err, { type: 'retry' }).load === 'ready' && R(s0, { type: 'scenario', scenario: 'loading' }).load === 'loading', 'loading / error → retry');
ok(R(sent, { type: 'reset' }) === s0, 'reset');
ok(A.MATCH_COPY.cta === 'Match & chat' && A.MATCH_COPY.open === 'Open chat' && A.matchedLine('Selin') === 'You and Selin matched', 'copy: Match & chat / Open chat / You and X matched');
ok(A.personPlace('defne') === 'Kadıköy' && A.personPlace('zeynep') === 'Şişli' && A.personPlace('melis') === 'İstanbul', 'card place: shared district, else city');

// Screen source: no superseded actions, no "No comment", no View profile button,
// whole card tappable, read-only profile, chat context via the shared component.
const scr = fs.readFileSync(path.join(ROOT, 'components/dev/activity/ActivityDesignPreview.tsx'), 'utf8');
const lib = fs.readFileSync(path.join(ROOT, 'lib/dev/activityPreview.ts'), 'utf8');
const code = (scr + lib).replace(/\/\/[^\n]*/g, '');
ok(!/Like back|Just match|Match & reply|Match & send|It’s a match|It's a match|No comment|View profile|Likes you|Updates/.test(code), 'no superseded buttons, celebration, "No comment", View profile or tabs');
ok(/<Pressable[\s\S]{0,120}onPress=\{onPress\}[\s\S]{0,400}accessibilityHint="Opens the full profile"/.test(scr), 'whole card opens the profile');
ok(/readOnly: true/.test(scr) && /buildDiscoverLayout\(person\)/.test(scr), 'full V2 profile layout, read-only');
ok(/<LikeContextHeader[^>]*title=\{MATCH_COPY\.howItStarted\}/.test(scr), 'chat context = shared LikeContextHeader ("How it started")');
ok(/Math\.max\(170, feedHeight \/ 2 - CARD_INFO - CARD_GAP\)/.test(scr), 'card photo sized so about two cards fit; photo shrinks, text does not');
ok((scr.match(/onPress=\{onMatch\}/g) || []).length === 1, 'exactly one accept button');

// Round 3 polish (2026-10-12): comment size, one compact How-it-started card,
// smaller hello, send failure, keyboard / large text.
const failSend = run(m1, { type: 'dev_fail_send_next', on: true }, { type: 'send_message', matchId: dm.id, text: 'Hi' });
ok(!A.conversationStarted(A.matchFor(failSend, 'defne')) && failSend.sendError === dm.id && !failSend.failSendNext, 'failed send: no message, conversation not started, error shown');
const okSend = R(failSend, { type: 'send_message', matchId: dm.id, text: 'Hi' });
ok(A.conversationStarted(A.matchFor(okSend, 'defne')) && okSend.sendError === null, 'retry send → conversation started, error cleared');
ok(/cardComment: \{ fontFamily: obFonts\.body, fontSize: 15/.test(scr) && /styles\.cardComment\} numberOfLines=\{2\} ellipsizeMode="tail"/.test(scr), 'card comment: smaller regular text, max 2 lines + ellipsis');
ok(/<Text style=\{styles\.profileComment\}>/.test(scr), 'profile shows the full comment (no line limit)');
ok(/helloTitle: \{ fontFamily: obFonts\.heading, fontSize: 20/.test(scr), 'Say hello title one step smaller (24 → 20)');
ok(/\{started \? \(\s*match\.messages\.map/.test(scr), 'empty state only while no message was sent');
ok(/<ScrollView[\s\S]{0,900}<LikeContextHeader[\s\S]{0,200}\{started \?/.test(scr) && !/howItStarted:/.test(scr), 'How it started: first in the scrolling conversation, no extra wrapper box');
ok(/if \(count > prevCount\.current\) setDraft\(''\)/.test(scr) && !/onSend\(draft\);\s*setDraft\(''\)/.test(scr), 'draft cleared only after a successful send');
ok(/keyboardUp \? obSpacing\.sm : Math\.max\(insetsBottom/.test(scr) && /KeyboardAvoidingView/.test(scr), 'keyboard: input stays above it without the extra home-indicator gap');
ok(!/allowFontScaling=\{false\}|maxFontSizeMultiplier=\{1\}/.test(scr) && !/allowFontScaling=\{false\}/.test(fs.readFileSync(path.join(ROOT, 'components/chat/LikeContext.tsx'), 'utf8')), 'text scaling not disabled');
const lc = fs.readFileSync(path.join(ROOT, 'components/chat/LikeContext.tsx'), 'utf8');
ok(/if \(title\) \{[\s\S]{0,300}styles\.card[\s\S]{0,400}flat \/>/.test(lc), 'titled context = one compact card with flat rows');
ok(/<View style=\{styles\.wrap\}>\s*\{shown\.map[\s\S]{0,200}photoSource=\{photoSource\} \/>/.test(lc) && /row: \{\s*flexDirection: 'row',\s*gap: obSpacing\.md,\s*padding: obSpacing\.md,\s*borderRadius: 14,\s*backgroundColor: obColors\.selectedFill,/.test(lc) && /text: \{ flex: 1, gap: 2 \}/.test(lc), 'untitled path (real chat) keeps its original rows and styles');

// Isolation.
const files = ['lib/dev/activityPreview.ts', 'components/dev/activity/ActivityDesignPreview.tsx', 'components/dev/activity/previewPhotos.ts', 'app/dev/activity-preview.tsx'];
const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n').replace(/\/\/[^\n]*/g, '');
ok(!/supabase|matchInvite|send_like|rpc\(|fetch\(|matchChatV2/.test(src.replace(/import type \{[^}]*\} from '@\/lib\/matchChatV2';/, '')), 'preview never imports Supabase or network helpers (type-only chat import)');
ok(/if \(!__DEV__\) return <Redirect href="\/" \/>/.test(fs.readFileSync(path.join(ROOT, 'app/dev/activity-preview.tsx'), 'utf8')), 'route redirects outside DEV');
const home = fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8');
ok(/__DEV__ \?[\s\S]{0,300}\/dev\/activity-preview[\s\S]{0,400}Activity design preview \(DEV\)/.test(home), 'DEV entry is __DEV__-gated');
ok(!/activity-preview|activityPreview/.test(fs.readFileSync(path.join(ROOT, 'app/(tabs)/notifications.tsx'), 'utf8')), 'real Activity tab untouched by preview code');
const items = fs.readFileSync(path.join(ROOT, 'components/discover/DiscoverProfileItems.tsx'), 'utf8');
ok(/readOnly\?: boolean/.test(items) && !/readOnly/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2DiscoverScreen.tsx'), 'utf8')), 'shared profile: readOnly is opt-in; real Discover does not set it');
const chat = fs.readFileSync(path.join(ROOT, 'app/chat.tsx'), 'utf8');
// Since the Activity integration (2026-10-12, D79) the real V2 chat shows the
// same "How it started" heading; checked in v2_activity_real.check.js.
ok(/<LikeContextHeader likes=\{chatState\?\.likes\} otherName=\{userName\} title=\{MATCH_COPY\.howItStarted\} \/>/.test(chat), 'real chat uses the shared context with the How it started title');

module.exports = done('v2_activity_preview');
