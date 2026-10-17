// V2 chat screen redesign (2026-10-17, mockup "Sohbet" left screen): compact
// header, compact expandable "How it started", bubbles with day / time from
// real timestamps, compact input. Pure helpers + static wiring; the look and
// the keyboard behaviour need the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const T = require(path.join(ROOT, 'lib/chat/timeline.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Local-time helpers (the test builds dates in local time too).
const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi).toISOString();
const now = new Date(2026, 9, 17, 22, 20); // Sat 17 Oct 2026, 22:20

ok(T.formatChatTime(at(2026, 9, 17, 9, 5)) === '09:05' && T.formatChatTime(at(2026, 9, 17, 20, 12)) === '20:12', 'time: 24 h, zero-padded');
ok(T.formatChatTime('nope') === '', 'time: invalid → empty');
ok(T.formatChatDay(at(2026, 9, 17, 0, 1), now) === 'Today', 'day: Today');
ok(T.formatChatDay(at(2026, 9, 16, 23, 59), now) === 'Yesterday', 'day: Yesterday');
ok(T.formatChatDay(at(2026, 9, 13, 12, 0), now) === 'Tuesday', 'day: weekday within the week');
ok(T.formatChatDay(at(2026, 9, 10, 12, 0), now) === '10 Oct', 'day: date this year');
ok(T.formatChatDay(at(2025, 11, 31, 12, 0), now) === '31 Dec 2025', 'day: other year');

const A = 'a';
const B = 'b';
const m = (key, iso, sender) => ({ key, at: iso, senderId: sender, item: key });
const rows = T.buildTimeline(
  [
    m('1', at(2026, 9, 16, 20, 0), B),
    m('2', at(2026, 9, 17, 20, 12), B),
    m('3', at(2026, 9, 17, 20, 13), B),
    m('4', at(2026, 9, 17, 20, 18), A),
    m('5', at(2026, 9, 17, 20, 30), A), // > 5 min later: new group
    { key: 'd', at: at(2026, 9, 17, 20, 31), senderId: null, item: 'd' },
    m('6', at(2026, 9, 17, 20, 32), A),
  ],
  now,
);
const shape = rows.map((r) => (r.kind === 'day' ? `[${r.label}]` : `${r.key}:${r.firstOfGroup ? 'F' : '-'}${r.lastOfGroup ? 'L' : '-'}:${r.time ?? ''}`));
ok(
  eq(shape, ['[Yesterday]', '1:FL:20:00', '[Today]', '2:F-:', '3:-L:20:13', '4:FL:20:18', '5:FL:20:30', 'd:FL:', '6:FL:20:32']),
  'timeline: one separator per day, groups break on sender / day / 5 min / date card, time only under the last bubble',
);
ok(eq(T.buildTimeline([], now), []), 'timeline: empty');
ok(eq(rows.filter((r) => r.kind === 'item').map((r) => r.afterDay), [true, true, false, false, false, false, false]), 'timeline: the first bubble of each day is marked (no extra group gap under a day label)');
ok(T.isNearEnd({ contentOffset: { y: 920 }, contentSize: { height: 1600 }, layoutMeasurement: { height: 620 } }) === true, 'near end: within 80 pt');
ok(T.isNearEnd({ contentOffset: { y: 200 }, contentSize: { height: 1600 }, layoutMeasurement: { height: 620 } }) === false, 'near end: reading older messages');

const H = require(path.join(ROOT, 'lib/chat/howItStarted.ts'));
ok(H.likePreview({ note: ' Where was this taken? ', answer: 'x' }) === '“Where was this taken?”', 'preview: comment first, quoted');
ok(H.likePreview({ note: null, answer: 'Long walks' }) === 'Long walks' && H.likePreview({ note: '  ', answer: null }) === null, 'preview: else the answer; nothing → null');
const card = code('components/chat/HowItStartedCard.tsx');
ok(/target_type === 'photo' && url/.test(card) && /'chatbox-ellipses-outline'/.test(card) && /'heart-outline'/.test(card), 'card: photo thumbnail only for photo likes; answer / profile likes get their own icon');
ok(/likeContextLine\(first, otherName\)/.test(card) && /setOpen\(\(v\) => !v\)/.test(card) && /accessibilityState=\{expandable \? \{ expanded: open \}/.test(card), 'card: real like line, tap to expand, expanded state announced');

const chat = code('app/chat.tsx');
ok(/ListHeaderComponent=\{v2Enabled \? <HowItStartedCard likes=\{chatState\?\.likes\}/.test(chat), 'card is the list header (scrolls away with the chat)');
ok(/paddingTop: insets\.top, paddingBottom: 0, paddingHorizontal: 0/.test(chat), 'header: safe-area top only (no extra 12 pt)');
ok(/>View profile</.test(chat) && /onPress=\{openUserProfile\}[\s\S]{0,120}style=\{styles\.headerCenter\}/.test(chat) && /openChatMenu/.test(chat), 'header: photo + name + View profile open the full profile; ⋯ menu kept');
const v2Msg = (chat.match(/function renderMessageV2\([\s\S]*?\n  \}\n/) || [''])[0];
ok(v2Msg.length > 0 && !/myPhotoUrl|myInitial|msgAvatarMine/.test(v2Msg), 'V2: no avatar next to own messages');
ok(/row\.lastOfGroup \?/.test(chat) && /<View style=\{styles\.msgAvatar\} \/>/.test(chat), 'their avatar only beside the last bubble of a group');
ok(/buildTimeline<ChatItem>/.test(chat) && /v2\.daySeparator/.test(chat) && /row\.time \?/.test(chat), 'day separators + time from real timestamps');
ok(!/\b(typing|is_typing|online|last_seen|seen_at|delivered)\b|'Seen'|"Seen"/i.test(chat), 'no fake online / typing / seen state');
ok(/maxWidth: 248, flexShrink: 1/.test(chat), 'bubble width capped and shrinkable (long text / emoji wrap)');
ok(/disabled=\{inputDisabled \|\| !text\.trim\(\) \|\| sending\}/.test(chat) && /v2\.sendBtnDisabled/.test(chat), 'send disabled for an empty message');
ok(/paddingBottom: keyboardShown \? 8 : Math\.max\(insets\.bottom, 8\)/.test(chat), 'input: on the keyboard when open; only the home-indicator inset when closed');
ok(/if \(!nearEndRef\.current && !forceEndRef\.current\) return;/.test(chat) && /nearEndRef\.current = isNearEnd\(e\.nativeEvent\)/.test(chat), 'never pulls a reader of older messages down');
ok(/\.select\('id, sender_id, receiver_id, content, created_at'\)\s*\.single\(\)/.test(chat) && /forceEndRef\.current = true;/.test(chat) && /prev\.some\(\(m\) => m\.id === row\.id\)/.test(chat), 'own message appears right away (read back, de-duplicated with the realtime echo) and stays in view');
ok(/onPress=\{v2Enabled \? openPlusMenu : handleAddPhoto\}/.test(chat) && /'Suggest a date'/.test(chat), '+ menu unchanged');
ok(!/lineHeight/.test((chat.match(/  input: \{[\s\S]*?\n  \},/) || [''])[0]), 'multiline input has no lineHeight (iOS stale paragraph style)');

// Round 3 (2026-10-17): values from measuring the phone screenshot against
// the mockup at the same 393 pt width; V1 keeps its pre-redesign look.
const sty = (name) => (chat.match(new RegExp(`const ${name} = StyleSheet\\.create\\(\\{[\\s\\S]*?\\n\\}\\);`)) || [''])[0];
const v2s = sty('v2');
const v1s = sty('styles');
ok(/headerName: \{ fontFamily: obFonts\.headingRegular, fontSize: 21/.test(v2s) && /headerAvatar: \{ width: 52, height: 52/.test(v2s), 'V2 header: regular-weight serif name, 52 pt photo');
ok(/<Feather name="arrow-left"/.test(chat), 'V2 header: thin back arrow');
ok(/bubble: \{ maxWidth: 248, flexShrink: 1, borderRadius: 11,/.test(v2s) && !/borderBottom(Right|Left)Radius/.test(v2s), 'V2 bubble: ~11 pt uniform corners (no tail), up to ~248 pt wide');
ok(/bubbleText: \{ fontFamily: obFonts\.body, fontSize: 16, lineHeight: 21/.test(v2s), 'V2 body text 16 (same as the mockup)');
ok(/msgAvatar: \{ width: 40, height: 40/.test(v2s) && /msgTimeTheirs: \{ alignSelf: 'flex-start', marginLeft: 50 \}/.test(v2s), 'V2 incoming avatar 40, time aligned with the bubble');
ok(/daySeparator: \{\s*alignSelf: 'center',\s*marginTop: 18,\s*marginBottom: 6,/.test(v2s) && /msgBlockAfterDay: \{ marginTop: 12 \}/.test(v2s), 'V2 day label centred between blocks (not glued to the next bubble)');
ok(/attachBtn: \{ width: 44, height: 44/.test(v2s) && /sendBtn: \{ width: 44, height: 44/.test(v2s) && /minHeight: 44/.test(v2s), 'V2 input: 44 pt controls');
ok(!/maxFontSizeMultiplier|allowFontScaling=\{false\}/.test(chat + read('components/chat/HowItStartedCard.tsx')), 'text scaling not limited (round-2 caps removed)');
const card3 = read('components/chat/HowItStartedCard.tsx');
ok(/const THUMB_W = 48;/.test(card3) && /const THUMB_H = 44;/.test(card3) && /numberOfLines=\{1\}/.test(card3), 'card: ~48 × 44 thumbnail, one line each when collapsed');
// V1 isolation: the legacy screen keeps its pre-redesign styles and layout.
ok(/headerName: \{ fontFamily: obFonts\.heading, fontSize: 19, lineHeight: 25/.test(v1s) && /bubble: \{\s*maxWidth: '75%',/.test(v1s) && /msgAvatarMine:/.test(v1s) && /messagesList: \{ padding: 16, gap: 8, flexGrow: 1 \}/.test(v1s), 'V1 styles = pre-redesign values');
ok(/function renderMessageV1\(/.test(chat) && /if \(!v2Enabled\) \{[\s\S]{0,120}renderMessageV1\(/.test(chat) && /if \(v2Enabled \|\| !currentUserId\) return;/.test(chat), 'V1 renders its old bubbles (own avatar kept, fetched only for V1)');
ok(/v2Enabled \? timelineRows : timelineRows\.filter\(\(r\) => r\.kind !== 'day'\)/.test(chat) && /<ThemedText style=\{styles\.backText\}>←<\/ThemedText>/.test(chat), 'V1: no day separators, old header');
ok(/paddingBottom: keyboardShown \? 12 : insets\.bottom \+ 12/.test(chat), 'V1 input padding unchanged');
const theme = read('lib/onboardingV2/theme.ts');
ok(/headingRegular: 'PlayfairDisplay-Regular'/.test(theme) && /PlayfairDisplay_400Regular\.ttf/.test(theme) && fs.existsSync(path.join(ROOT, 'assets/fonts/PlayfairDisplay_400Regular.ttf')), 'Playfair Display 400 vendored and loaded (OFL, same source as 700)');
const badge = read('components/dev/DevBackendBadge.tsx');
ok(/if \(!__DEV__\) return null;/.test(badge) && /DEV_BUILD_MARK/.test(badge) && /fontScale\.toFixed\(2\)/.test(badge), 'temporary DEV-only build mark + window size + font scale');

module.exports = done('v2_chat_layout');
