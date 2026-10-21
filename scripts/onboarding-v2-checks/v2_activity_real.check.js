// Real V2 Activity client (components/activity/*, app/v2/activity-profile.tsx,
// lib/activity/*, chat "How it started"). Local logic / static check only —
// the server rules are covered on the LOCAL Supabase by
// scripts/local-backend/smoke_activity_local.mjs (real services).
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const F = require(path.join(ROOT, 'lib/activity/feed.ts'));
const C = require(path.join(ROOT, 'lib/activity/copy.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const like = (o) => ({ like_id: 'l1', user_id: 'u1', first_name: 'Defne', age: 28, city: 'İstanbul', photo_path: 'u1/a.png', target_type: 'photo', note: null,
  created_at: '2026-10-12T10:00:00Z', seen: false, target_photo_path: 'me/p.png', target_prompt_id: null, target_answer: null, ...o });
const match = (o) => ({ match_id: 'm1', other_id: 'u9', first_name: 'Selin', photo_path: null, matched_at: '2026-10-12T09:00:00Z', last_message: null,
  last_message_at: null, last_from_me: null, unread: 0, ...o });

// Parse.
const d = F.parseActivity({ member: true, premium: true, pending_count: 2, pending: [like({ note: '  ' }), like({ like_id: 'l2', user_id: 'u2', note: ' Hi ' })], matches: [] });
ok(d.pending[0].note === null && d.pending[1].note === 'Hi', 'blank comment = none (nothing shown); comment trimmed');
ok(F.parseActivity(null).pending.length === 0 && F.parseActivity(null).member === false, 'missing data → empty, not member');
const locked = F.parseActivity({ member: true, premium: false, pending_count: 3, pending: [], matches: [] });
ok(locked.pendingCount === 3 && locked.pending.length === 0, 'non-premium: count only (existing premium rule)');

// Feed: one person once, match row wins, newest first.
const feed = F.buildActivityFeed({
  pending: [like({ like_id: 'a', user_id: 'u1', created_at: '2026-10-12T10:00:00Z' }), like({ like_id: 'b', user_id: 'u2', created_at: '2026-10-12T11:00:00Z' }),
    like({ like_id: 'c', user_id: 'u2', created_at: '2026-10-12T08:00:00Z' })],
  matches: [match({ other_id: 'u1', matched_at: '2026-10-12T12:00:00Z' })],
});
ok(feed.length === 2 && feed[0].kind === 'match' && feed[0].match.other_id === 'u1' && feed[1].kind === 'interest' && feed[1].interest.like_id === 'b',
  'matched person only as a match row; one card per person; newest first');
ok(F.conversationStarted(match({ last_message: 'Hi' })) && !F.conversationStarted(match({})), 'Conversation started only with a stored message');

// Accept outcome text: failure never looks matched.
ok(F.acceptErrorText({ kind: 'ok', matchId: 'm', userId: 'u', replayed: false }, 'Defne') === null, 'ok → no error');
ok(/Couldn’t match/.test(F.acceptErrorText({ kind: 'unknown' }, 'Defne')), 'no answer → retryable error');
ok(/isn’t available/.test(F.acceptErrorText({ kind: 'refused', error: 'not_available' }, 'Defne')), 'refused → not available');

// Copy (shared with the DEV preview).
ok(C.interestLabelFor('profile') === 'Liked you' && C.interestLabelFor('photo') === 'Liked your photo' && C.interestLabelFor('prompt') === 'Liked your answer', 'interaction lines');
ok(C.MATCH_COPY.cta === 'Match & chat' && C.MATCH_COPY.open === 'Open chat' && C.matchedLine('Selin') === 'You and Selin matched', 'Match & chat / Open chat / You and X matched');
ok(C.minutesSince('2026-10-12T10:00:00Z', Date.parse('2026-10-12T11:30:00Z')) === 90 && C.minutesSince(null) === 0, 'minutesSince');
ok(require(path.join(ROOT, 'lib/dev/activityPreview.ts')).MATCH_COPY === C.MATCH_COPY, 'preview uses the same copy object');

// Screen.
const scr = code('components/activity/V2ActivityScreen.tsx');
ok(/loadActivity\(\)/.test(scr) && /if \(load\.kind === 'unsupported'\) return <>\{fallback\}<\/>;/.test(scr), 'server snapshot; previous screen when the server lacks the package');
ok(!/markLikeSeen|acceptLike|mark_like_seen|accept_like/.test(scr), 'loading / showing the list never marks read or accepts');
ok(/prev\.kind === 'ready' \? prev : \{ kind: 'error'/.test(scr) && /Couldn’t load activity/.test(scr), 'load error = error state with retry (never an empty list)');
ok(/pathname: '\/v2\/activity-profile'/.test(scr) && /pathname: '\/chat'/.test(scr), 'card → full profile; row → existing chat');
ok(!/components\/dev|lib\/dev|activityPreview/.test(scr + code('app/v2/activity-profile.tsx') + code('lib/activity/activityV2.ts') + code('lib/activity/feed.ts')), 'no DEV preview code in the real flow');
ok(!/from\('messages'\)|insert\(/.test(scr + code('app/v2/activity-profile.tsx')), 'Activity never writes a message');
ok(/<V2ActivityScreen fallback=\{<LegacyNotificationsScreen \/>\} \/>/.test(read('app/(tabs)/notifications.tsx')) && /if \(v2Enabled\)/.test(read('app/(tabs)/notifications.tsx')),
  'Activity tab: new screen on V2 backends only (production V1 unchanged)');

// Profile route.
const prof = code('app/v2/activity-profile.tsx');
ok(/readOnly: true/.test(prof) && /buildDiscoverLayout\(person\)/.test(prof) && /DiscoverProfileItems/.test(prof), 'full V2 profile, read-only (no hearts / comments)');
ok((prof.match(/onPress=\{\(\) => void matchAndChat\(\)\}/g) || []).length === 1, 'exactly one action button');
ok(/if \(i && !i\.seen && !markedRef\.current\)/.test(prof) && (prof.match(/markLikeSeen\(/g) || []).length === 1, 'opening marks only this like read, once');
ok(/if \(!interest \|\| busyRef\.current\) return;/.test(prof) && /disabled=\{busy\}/.test(prof), 'no second request while one is in flight');
ok(/if \(r\.kind === 'ok'\) \{\s*void activityBadge\.refresh\(\);[^\n]*\n\s*return openChat\(r\.matchId\);\s*\}/.test(prof) && /setError\(acceptErrorText\(r, name\)\)/.test(prof), 'opens the chat only after the server confirmed; otherwise an error');
ok(/if \(match\) return openChat\(match\.match_id\);/.test(prof), 'already matched → Open chat (existing chat)');
ok(!/It’s a match|It's a match|Like back|Just match/.test(prof + scr), 'no celebration / superseded buttons');

// Chat (D79).
const chat = read('app/chat.tsx');
ok(/<HowItStartedCard /.test(chat) && /How it started/.test(read('components/chat/HowItStartedCard.tsx')) && /MATCH_COPY\.hello\(userName\)/.test(chat) && /MATCH_COPY\.helloText/.test(chat), 'V2 chat: How it started + Say hello empty state');
ok(/You matched — say hi 👋/.test(chat), 'V1 chat empty text unchanged');
ok(/!!title \|\| l\.target_type !== 'profile' \|\| !!l\.note/.test(read('components/chat/LikeContext.tsx')), 'titled context also shows a whole-profile like');

// Match rows (2026-10-13): ~15% smaller avatar / padding, same text; one time format.
const items = read('components/activity/ActivityFeedItems.tsx');
ok(/matchAvatar: \{ width: 44, height: 44/.test(items) && /minHeight: 61/.test(items) && /paddingVertical: 8\.5/.test(items)
  && /matchTitle: \{ fontFamily: obFonts\.bodyMedium, fontSize: 16/.test(items), 'match row ~15% tighter, title size unchanged, row ≥ 44 pt');
ok(/`Conversation started · \$\{timeAgoLong\(mins\)\}` : timeAgoLong\(mins\)/.test(scr), 'time: "3m ago" and "Conversation started · 3m ago"');
ok(C.timeAgoLong(3) === '3m ago' && `Conversation started · ${C.timeAgoLong(3)}` === 'Conversation started · 3m ago', 'time strings');

// Chat keyboard layout (2026-10-15): the quiz scrolls with the content; only
// the input row is pinned above the keyboard.
const chatSrc = read('app/chat.tsx');
ok(/ListFooterComponent=\{icebreakerPanel\}/.test(chatSrc) && /\{!listShown \? icebreakerPanel : null\}/.test(chatSrc)
  && (chatSrc.match(/Quick this-or-that ✨/g) || []).length === 1, 'chat: quiz is part of the scrolling list (no fixed panel over the hello)');
// Since 2026-10-17: only while the reader is at the end (or just sent).
ok(/setKeyboardShown\(true\);[\s\S]{0,240}scrollToEndIfFollowing\(\)/.test(chatSrc) && /onContentSizeChange=\{\([^)]*\) => \{[\s\S]{0,500}scrollToEndIfFollowing\(\);\s*\}\}/.test(chatSrc), 'chat: keeps the end (last message / quiz) in view on keyboard + new content');

// Package wiring.
ok(!/20261012090000_v2_activity_accept/.test(read('scripts/dev-backend/apply-dev.mjs')), 'Activity package not wired into apply-dev (shared project)');
ok(/20261012090000_v2_activity_accept\.sql/.test(read('scripts/local-backend/setup.mjs')), 'Activity package in the LOCAL setup');
const sql = read('supabase/proposed/20261012090000_v2_activity_accept.sql');
ok(/v_like\.likee_id <> v_me/.test(sql) && /pg_advisory_xact_lock/.test(sql) && !/daily_views_count/.test(sql) && !/insert into messages/i.test(sql), 'server: recipient-only, locked, no quota, no message');
ok(/revoke all on function public\.accept_like_v2\(uuid\) from public, anon;/.test(sql), 'not callable signed out');

module.exports = done('v2_activity_real');
