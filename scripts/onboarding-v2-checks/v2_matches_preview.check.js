// DEV Matches design preview (lib/dev/matchesPreview.ts + its screen): local
// state only. Checks the flow rules and that the preview code can't reach the
// backend. Local logic check — not a real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, lib, done, ROOT } = require('./_setup');
const M = require(path.join(ROOT, 'lib/dev/matchesPreview.ts'));
const P = lib('yourProfile.ts');

const R = M.previewReducer;
const I = M.INITIAL_PREVIEW_STATE;

// 1. Start: both cards filled, nothing liked, no message.
ok(M.pickStatus(I) === 'new' && M.mutualStatus(I) === 'new', 'start: both cards');
ok(I.mutual.messages.length === 0, 'start: no message exists');

// 3–4. Like a photo with a comment → "Like sent"; the mutual card and chat don't change.
const photo = { kind: 'photo', photoIndex: 1 };
const liked = R(I, { type: 'send_like', target: photo, comment: '  Lovely ferry photo  ' });
ok(M.pickStatus(liked) === 'like_sent', 'like → pick card shows Like sent');
ok(liked.pick.like.comment === 'Lovely ferry photo', 'comment trimmed');
ok(eq(liked.pick.like.target, photo), 'target kept');
ok(liked.mutual === I.mutual && M.mutualStatus(liked) === 'new', 'comment alone opens no chat / no message');
ok(R(liked, { type: 'send_like', target: photo, comment: 'again' }) === liked, 'second like ignored (one per person)');
const noComment = R(I, { type: 'send_like', target: { kind: 'prompt', label: 'L', answer: 'A' }, comment: '   ' });
ok(noComment.pick.like.comment === '' && M.pickStatus(noComment) === 'like_sent', 'comment is optional');
ok(R(I, { type: 'send_like', target: photo, comment: 'x'.repeat(400) }).pick.like.comment.length === M.COMMENT_MAX, 'comment capped at 240');

// 5–6. Say hello: nothing until sent; first message → Conversation started.
ok(R(I, { type: 'send_message', text: '   ' }) === I, 'blank message not created');
const said = R(I, { type: 'send_message', text: ' Hi İpek! ' });
ok(said.mutual.messages.length === 1 && said.mutual.messages[0].text === 'Hi İpek!', 'first message stored locally');
ok(M.mutualStatus(said) === 'conversation_started', 'card → Conversation started');
ok(R(said, { type: 'send_message', text: 'second' }) === said, 'preview stops after first message (continues in Chats)');
ok(said.pick === I.pick, 'message does not touch the pick card');

// 7–8. Empty states + reset.
const noMutual = R(liked, { type: 'scenario', scenario: 'no_mutual' });
ok(M.mutualStatus(noMutual) === 'none' && M.pickStatus(noMutual) === 'new', 'no mutual like state (pick reset to new)');
const noPick = R(I, { type: 'scenario', scenario: 'no_pick' });
ok(M.pickStatus(noPick) === 'none' && M.mutualStatus(noPick) === 'new', 'no new pick state');
ok(R(noPick, { type: 'send_like', target: photo, comment: '' }) === noPick, 'no like without a pick');
ok(R(noMutual, { type: 'send_message', text: 'hi' }) === noMutual, 'no message without a mutual like');
ok(eq(R(said, { type: 'reset' }), I), 'reset → start');
ok(eq(R(noPick, { type: 'scenario', scenario: 'both' }), I), 'both cards scenario = start');

// 2. Profiles go through the shared V2 profile blocks.
for (const key of ['pick', 'mutual']) {
  const person = M.PREVIEW_PEOPLE[key];
  const blocks = P.buildPublicProfileBlocks({ ...person, photos: [1, 2, 3].map((n) => ({ id: `${key}${n}`, uri: `file:///${key}${n}.png` })) });
  ok(blocks[0].type === 'hero' && blocks[0].name === person.name, `${key}: hero with name`);
  ok(blocks.filter((b) => b.type === 'prompt').length === person.prompts.length && blocks.every((b) => b.type !== 'prompt' || b.label), `${key}: prompts with labels`);
  ok(blocks.filter((b) => b.type === 'photo').length === 2, `${key}: extra photos`);
  ok(blocks.some((b) => b.type === 'groups'), `${key}: values/interests resolve`);
}

// Copy rules: no %, no "Continue chatting", no timer / meet-up invite wording.
const copy = Object.values(M.PREVIEW_COPY).map((v) => (typeof v === 'function' ? v('X') : v)).join(' | ');
ok(!/%|continue chatting|ready to meet|tomorrow|countdown|invite/i.test(copy), 'copy has no score / continue chatting / timer / invite');

// The preview code never imports the backend.
const files = ['lib/dev/matchesPreview.ts', 'components/dev/MatchesDesignPreview.tsx', 'app/dev/matches-preview.tsx'];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(!/supabase|onboardingV2\/remote|matchChatV2|from '@\/lib\/(likes|matchInvite|dailyViews)/.test(src), `${f}: no backend import`);
}
ok(/if \(!__DEV__\) return <Redirect/.test(fs.readFileSync(path.join(ROOT, 'app/dev/matches-preview.tsx'), 'utf8')), 'route redirects in production');
ok(/__DEV__ \?[\s\S]{0,200}dev\/matches-preview/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8')), 'Profile entry is DEV-only');

// Round 2: like sheet shows exactly the tapped content.
const sp = M.selectedLikeContent({ kind: 'photo', photoIndex: 2, uri: 'file:///pick3.png' }, 'Defne');
ok(sp.kind === 'photo' && sp.uri === 'file:///pick3.png' && sp.title === 'Like Defne’s photo' && sp.a11y === 'Selected: photo 3', 'sheet: tapped photo shown');
ok(M.selectedLikeContent({ kind: 'photo', photoIndex: 0, uri: 'u' }, 'Defne').a11y === 'Selected: main photo', 'sheet: main photo label');
const pr = M.PREVIEW_PEOPLE.pick.prompts[1];
const spr = M.selectedLikeContent({ kind: 'prompt', label: 'Together, we could…', answer: pr.answer }, 'Defne');
ok(spr.kind === 'prompt' && spr.answer === pr.answer && spr.label === 'Together, we could…' && spr.title === 'Like Defne’s answer', 'sheet: tapped prompt shown');
ok(!('uri' in spr), 'sheet: prompt shows no photo');

// Round 2: visual rules (static).
const screen = fs.readFileSync(path.join(ROOT, 'components/dev/MatchesDesignPreview.tsx'), 'utf8');
ok(/cardPhoto: \{[^}]*aspectRatio: 3 \/ 2/.test(screen), 'Matches cards use a 3:2 photo');
ok(/photo: \{\s*width: '100%',\s*aspectRatio: 4 \/ 5/.test(fs.readFileSync(path.join(ROOT, 'components/onboarding-v2/yourProfile/ProfilePreview.tsx'), 'utf8')), 'full profile keeps 4:5 photos');
ok(/label: C\.viewProfile[^}]*variant: 'outline'/.test(screen) && /label: C\.sayHello, onPress: onSayHello, variant: 'fill'/.test(screen), 'View profile outlined, Say hello filled');
ok(/source=\{FADE\}/.test(screen) && !/Array\.from\(\{ length: 14 \}\)/.test(screen), 'smooth image gradient, no stepped bands');
ok(!/>Cancel</.test(screen) && /onPress=\{onCancel\}[^>]*accessibilityLabel="Close without sending"/.test(screen), 'sheet: top-right close, no Cancel row');
const sheetSrc = screen.slice(screen.indexOf('function LikeSheet('), screen.indexOf('// ─── Local chat preview'));
ok(/onPress=\{\(\) => onSend\(comment\)\}/.test(sheetSrc) && (sheetSrc.match(/onSend\(/g) || []).length === 1, 'sheet: only Send like sends (close / backdrop cancel)');
ok(/maxLength=\{COMMENT_MAX\}/.test(screen) && M.COMMENT_MAX === 240, 'comment limit 240');

module.exports = done('v2_matches_preview');
