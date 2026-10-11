// DEV Activity design preview (lib/dev/activityPreview.ts + its screen):
// pending vs unread, view ≠ accept, like back → New matches, no auto
// message, mark-all-read visibility, states, and that the preview can't reach
// the backend. Local logic check only — not a real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const A = require(path.join(ROOT, 'lib/dev/activityPreview.ts'));

const s0 = A.INITIAL_ACTIVITY;
const R = A.activityReducer;

// Fixture coverage: photo+comment, photo without comment, prompt like, new match, started conversation.
const defne = s0.likes.find((l) => l.personId === 'defne');
ok(defne.target.kind === 'photo' && defne.comment && defne.comment.length > 120, 'photo like with a long comment');
ok(s0.likes.some((l) => l.target.kind === 'photo' && !l.comment), 'photo like without comment');
ok(s0.likes.some((l) => l.target.kind === 'prompt' && A.promptQuestion(l.target)), 'prompt like with a real prompt label');
ok(s0.matches.some((m) => !A.conversationStarted(m)) && s0.matches.some((m) => A.conversationStarted(m)), 'new match + started conversation');
ok(s0.likes.every((l) => !l.comment || l.comment.length <= 240), 'comments within the server note limit');

// Count = pending, not unread.
ok(A.pendingCount(s0) === 3 && A.unreadCount(s0) === 3, 'initial: 3 pending; unread counts likes + matches separately');
const viewed = R(s0, { type: 'open_profile', likeId: 'l-defne' });
ok(viewed.likes.length === 3 && viewed.matches.length === s0.matches.length, 'opening a profile does not accept the like');
ok(viewed.likes.find((l) => l.id === 'l-defne').read === true && A.pendingCount(viewed) === 3, 'read like stays pending, count unchanged');

// Like back → match, moved out of likes, no message.
const back = R(viewed, { type: 'like_back', likeId: 'l-defne' });
ok(!back.likes.some((l) => l.personId === 'defne') && A.pendingCount(back) === 2, 'like back removes from Likes you');
const m = back.matches[0];
ok(m.personId === 'defne' && !m.read && m.messages.length === 0, 'like back → unread New match, no automatic message');
ok(m.context[0].comment === defne.comment && !m.messages.some((x) => x.text === defne.comment), 'comment kept as context, never a message');
ok(R(back, { type: 'like_back', likeId: 'l-defne' }) === back, 'second like back is a no-op');

// Chat: opening sends nothing; only an explicit send adds a (local) message.
const opened = R(back, { type: 'open_chat', matchId: m.id });
ok(opened.matches[0].messages.length === 0 && opened.matches[0].read, 'Open chat marks read, sends nothing');
ok(R(opened, { type: 'send_message', matchId: m.id, text: '   ' }) === opened, 'blank message ignored');
const sent = R(opened, { type: 'send_message', matchId: m.id, text: 'Hi Defne' });
ok(A.conversationStarted(sent.matches[0]) && A.matchSubtitle(sent.matches[0]) === 'Conversation started', 'after a message: Conversation started');
ok(!/say hi/i.test(A.matchSubtitle(sent.matches[0])) && A.matchSubtitle(s0.matches.find((x) => x.personId === 'melis')) === 'Conversation started', 'no "Say hi" once a conversation started');

// Mark all as read: whole preview, button only when something is unread.
ok(A.showMarkAllRead(s0), 'Mark all as read shown when unread exists');
const all = R(s0, { type: 'mark_all_read' });
ok(A.unreadCount(all) === 0 && !A.showMarkAllRead(all) && A.pendingCount(all) === 3, 'mark all read: nothing unread, likes still pending');

// States.
ok(eq(R(s0, { type: 'scenario', scenario: 'empty' }), { load: 'ready', likes: [], matches: [] }), 'empty scenario');
const err = R(s0, { type: 'scenario', scenario: 'error' });
ok(err.load === 'error' && !A.showMarkAllRead(err) && R(err, { type: 'retry' }).load === 'ready', 'error → retry');
ok(R(s0, { type: 'scenario', scenario: 'loading' }).load === 'loading', 'loading scenario');
ok(R(sent, { type: 'reset' }) === s0, 'reset');
ok(A.timeAgo(12) === '12m' && A.timeAgo(95) === '1h' && A.timeAgo(60 * 26) === 'Yesterday' && A.timeAgo(60 * 50) === '2d', 'relative times');

// Isolation: no backend import; DEV-only route; real Activity untouched by the preview.
const files = ['lib/dev/activityPreview.ts', 'components/dev/activity/ActivityDesignPreview.tsx', 'components/dev/activity/previewPhotos.ts', 'app/dev/activity-preview.tsx'];
const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
ok(!/supabase|matchChatV2|resolveProfilePhotoUrl|fetch\(/.test(src.replace(/\/\/[^\n]*/g, '')), 'preview never imports Supabase or network helpers');
ok(/if \(!__DEV__\) return <Redirect href="\/" \/>/.test(fs.readFileSync(path.join(ROOT, 'app/dev/activity-preview.tsx'), 'utf8')), 'route redirects outside DEV');
const home = fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8');
ok(/__DEV__ \?[\s\S]{0,300}\/dev\/activity-preview[\s\S]{0,400}Activity design preview \(DEV\)/.test(home), 'DEV entry is __DEV__-gated and clearly named');
ok(!/activity-preview|activityPreview/.test(fs.readFileSync(path.join(ROOT, 'app/(tabs)/notifications.tsx'), 'utf8')), 'real Activity tab does not use preview code');
const scr = fs.readFileSync(path.join(ROOT, 'components/dev/activity/ActivityDesignPreview.tsx'), 'utf8');
ok(/numberOfLines=\{compact \? 3 : undefined\}/.test(scr) && /minWidth: 0/.test(scr), 'long comments clamp on cards and text can shrink on small screens');

module.exports = done('v2_activity_preview');
