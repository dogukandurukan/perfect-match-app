// Real V2 Matches client (components/main/V2DailyMatchesScreen.tsx,
// app/v2/match-profile.tsx, lib/matches/*, chat like context, Chats
// "Account unavailable"). Local logic / static check only — the server rules
// are covered by supabase/proposed/tests/http_matches.test.mjs (replica).
const fs = require('fs');
const path = require('path');
const { ok, done, ROOT } = require('./_setup');
const F = require(path.join(ROOT, 'lib/discover/likeFlow.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Outcome of a refused stale pick: nothing spent, ask for a refresh.
const st = F.likeOutcome({ kind: 'refused', error: 'stale_pick', quota: null }, true, 'Ada');
ok(st.refreshPicks && !st.advance && !st.showSent && !st.done && /nothing was sent/.test(st.message), 'stale_pick → refresh request, no success, nothing sent');

// Chat context wording (pure part of components/chat/LikeContext.tsx).
const ctx = read('components/chat/LikeContext.tsx');
ok(/You liked \$\{name\}’s \$\{what\}/.test(ctx) && /\$\{name\} liked your \$\{what\}/.test(ctx), 'like context names who liked what');

// Real Matches screen.
const scr = code('components/main/V2DailyMatchesScreen.tsx');
ok(/loadDailyPicks\(\)/.test(scr) && /if \(load\.kind === 'unsupported'\) return <V2MatchesScreen \/>;/.test(scr), 'server daily picks; previous V2 list when the server lacks them');
ok(!/components\/dev|lib\/dev|DISCOVER_PEOPLE|PREVIEW_|previewPerson/.test(scr), 'no DEV fixtures in the real screen');
ok(!/new Date|Date\.now|setInterval|setTimeout/.test(scr), 'no device clock / timer: the period comes from the server');
ok(!/from\('messages'\)|insert|send_message|sendMessage/.test(scr) && /pathname: '\/chat'/.test(scr), 'Say hello only opens the real chat (no automatic message)');
ok(/PersonCard/.test(scr) && /MatchesTitle/.test(scr) && /SectionHead/.test(scr) && /from '@\/components\/matches\/v2\/DailyMatchCards'/.test(scr), 'approved shared cards');
ok(/kind: 'loading'/.test(scr) && /kind: 'error'/.test(scr) && /EmptyCard/.test(scr), 'loading, error and empty are separate states');
ok(/noMutualTodayTitle/.test(scr) && /noMutualTitle/.test(scr) && /noPickTitle/.test(scr), 'D66 empty states');
ok(!/Plans|loadDatePlans|MatchesSegmentedControl/.test(scr), 'two cards only (date suggestions live in the chat)');
ok(!/%|match_percentage|score/.test(scr.replace(/'\d+%'/g, '')), 'no score / percentage');
ok(/<V2DailyMatchesScreen \/>/.test(read('app/(tabs)/matches.tsx')), 'Matches tab uses the daily screen on V2 backends');

// Profile route.
const prof = code('app/v2/match-profile.tsx');
ok(/DiscoverProfileItems/.test(prof) && /buildDiscoverLayout/.test(prof) && /useInlineEditorKeyboard/.test(prof), 'profile uses the shared Discover components + keyboard handling');
ok(/sendLikeV2\(person\.id, target, noteText \|\| null, requestId, 'daily_pick'\)/.test(prof), 'likes from Matches are sent as daily_pick (server-validated)');
ok(/canLike = isPick && !!card && card\.state === 'new'/.test(prof), 'only today’s pick in state new can be liked; mutual is read-only');
ok(/router\.back\(\)/.test(prof) && /accessibilityLabel="Back to Matches"/.test(prof), 'back returns to Matches (no next candidate)');
ok(/setStale\(true\)/.test(prof) && /Back to Matches/.test(prof), 'outdated pick → refresh request, nothing spent');

// Discover keeps working on servers without p_source; daily_pick adds it.
const dv = code('lib/discover/discoverV2.ts');
ok(/if \(source === 'daily_pick'\) args\.p_source = 'daily_pick';/.test(dv), 'p_source sent only for daily_pick (5-argument Discover call unchanged)');
ok(/out\.refreshPicks/.test(code('components/main/V2DiscoverScreen.tsx')), 'Discover handles a person who became today’s pick');

// Chat: context, not messages; suspended → read-only history.
const chat = code('app/chat.tsx');
ok(/ListHeaderComponent=\{v2Enabled \? <LikeContextHeader/.test(chat), 'likes shown as chat context');
ok(/chatState\?\.state === 'unavailable'/.test(chat) && /Account unavailable/.test(chat) && /inputDisabled = chatLoading \|\| inputLocked \|\| accountUnavailable/.test(chat), 'suspended: history readable, input closed, “Account unavailable”');
ok(/'Account unavailable'/.test(code('app/(tabs)/messages.tsx')), 'Chats shows Account unavailable rows');

// The migration stays proposed (not applied by any script to the shared project).
const apply = read('scripts/dev-backend/apply-dev.mjs');
ok(!/20261009090000_v2_matches_daily_picks/.test(apply), 'the daily-picks package is not wired into apply-dev (shared project)');

module.exports = done('v2_matches_real');
