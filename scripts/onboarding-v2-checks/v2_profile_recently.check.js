// "Recently" (D106, 2026-10-27): a book and a song under the name. Pure
// logic (link check, limits, display, server mapping, profile layout) +
// static wiring + SQL shape. Static parts only show the code is wired; they
// are NOT UI behaviour tests (taps, opening links, layout need the phone).
// Real local services: scripts/local-backend/smoke_profile_recently_local.mjs.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const R = require(path.join(ROOT, 'lib/profile/recentlyCore.ts'));
const S = require(path.join(ROOT, 'lib/onboardingV2/serverMapping.ts'));
const Y = require(path.join(ROOT, 'lib/onboardingV2/yourProfile.ts'));
const L = require(path.join(ROOT, 'lib/discover/profileLayout.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Link check.
const good = ['https://open.spotify.com/track/abc123', 'https://music.apple.com/tr/album/x?i=1', 'https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc', 'https://soundcloud.com/a/b', 'https://www.deezer.com/track/1', 'https://tidal.com/browse/track/1', 'https://fizy.com/track/1'];
const bad = ['http://open.spotify.com/track/abc', 'javascript:alert(1)', 'https://open.spotify.com.evil.com/x', 'https://evilspotify.com/x', 'https://user:pw@open.spotify.com/x', 'https://open.spotify.com/x y', 'https://open.spotify.com/a@b', 'https://example.com/song', 'https://spotify.com\n/x', 'ftp://spotify.com/x', `https://open.spotify.com/${'a'.repeat(500)}`, 'https://..spotify.com/x'];
ok(good.every(R.isSafeMusicUrl), 'https music-service links accepted');
ok(bad.every((u) => !R.isSafeMusicUrl(u)), 'http, other schemes / hosts, look-alike hosts, credentials, spaces, @ in path, too long → refused');

// Form rules.
const E = R.EMPTY_RECENTLY;
ok(R.recentlyProblem(E) === null, 'both empty is valid (nothing shown)');
ok(R.recentlyProblem({ ...E, bookTitle: 'The Creative Act', bookAuthor: 'Rick Rubin' }) === null && R.recentlyProblem({ ...E, songTitle: 'Lovely Day' }) === null, 'book only / song only valid; author and artist optional');
ok(R.recentlyProblem({ ...E, bookAuthor: 'Someone' }) && R.recentlyProblem({ ...E, songArtist: 'Someone' }) && R.recentlyProblem({ ...E, songUrl: 'https://youtu.be/x1' }), 'author / artist / link need a title');
ok(R.recentlyProblem({ ...E, bookTitle: 'x'.repeat(121) }) && R.recentlyProblem({ ...E, songTitle: 'S', songArtist: 'y'.repeat(81) }) && R.recentlyProblem({ ...E, bookTitle: 'A\nB' }), 'length limits; single line');
ok(R.recentlyProblem({ ...E, songTitle: 'S', songUrl: 'http://open.spotify.com/x' }) !== null, 'an unsafe link can’t be saved');
ok(R.sameRecently({ ...E, bookTitle: ' A ' }, { ...E, bookTitle: 'A' }) && !R.sameRecently({ ...E, bookTitle: 'A' }, E), 'dirty check ignores surrounding spaces');

// Display.
ok(R.recentlyForDisplay(E) === null, 'empty → nothing to show');
ok(eq(R.recentlyForDisplay({ ...E, songTitle: 'Lovely Day', songArtist: 'Bill Withers' }), { book: null, song: { title: 'Lovely Day', artist: 'Bill Withers', url: null } }), 'song only → no book line');
ok(R.recentlyLine('Lovely Day', 'Bill Withers') === 'Lovely Day — Bill Withers' && R.recentlyLine('Lovely Day', null) === 'Lovely Day', 'one line; the dash only with a second part');
ok(R.openableSongUrl({ title: 'x', artist: null, url: 'https://youtu.be/abc' }) === 'https://youtu.be/abc' && R.openableSongUrl({ title: 'x', artist: null, url: 'http://evil.com' }) === null && R.openableSongUrl({ title: 'x', artist: null, url: null }) === null, 'a link opens only when it passes the check again');
ok(S.publicRecentlyFromServer(null) === null && S.publicRecentlyFromServer({ book: null, song: null }) === null && eq(S.publicRecentlyFromServer({ book: { title: ' A ', author: '' }, song: null }), { book: { title: 'A', author: null }, song: null }), 'server mapping: empty → null, trimmed');

// Profile layout (shared builders): right under the name; nothing when empty.
const person = { name: 'A', age: 30, zodiac: null, city: 'İstanbul', heightCm: null, workStatus: null, jobTitle: '', school: null, hometown: null, intent: null, values: [], interests: [], life: { smoking: null, drinking: null, pets: null, activity: null, petKind: null }, dates: { dateTypes: [], spotText: '', days: null, time: null }, artists: [], books: [], screen: [], prompts: [], photos: [{ id: 'p1', uri: 'x' }] };
const rec = { book: { title: 'B', author: null }, song: null };
const blocks = Y.buildPublicProfileBlocks({ ...person, recently: rec });
ok(blocks[0].type === 'hero' && blocks[1].type === 'recently', 'own preview / others: Recently right after the name + photo');
ok(!Y.buildPublicProfileBlocks(person).some((b) => b.type === 'recently') && !Y.buildPublicProfileBlocks({ ...person, recently: null }).some((b) => b.type === 'recently'), 'no Recently block (title hidden) when empty');
const layout = L.buildDiscoverLayout({ ...person, id: 'u', district: null, photoCount: 1, prompts: [], recently: rec });
ok(layout[0].type === 'hero' && layout[1].type === 'recently' && !L.buildDiscoverLayout({ ...person, id: 'u', district: null, photoCount: 1, prompts: [] }).some((i) => i.type === 'recently'), 'Discover / Matches profile: same rule');

// Static wiring (not UI behaviour).
const rows = code('components/profile/RecentlyRows.tsx');
ok(/const songUrl = openableSongUrl\(/.test(rows) && /songUrl \? \(\s*<TouchableOpacity/.test(rows) && /Linking\.openURL\(url\)/.test(rows), 'song is tappable only with a safe link; opens outside the app');
ok(/if \(!recently && !onEdit\) return null;/.test(rows), 'others: nothing (not even the title) when both are empty');
ok(!/onLike|LikeHeart|comment/i.test(rows) && /<RecentlyRows recently=\{b\.recently\} \/>/.test(code('components/onboarding-v2/yourProfile/ProfilePreview.tsx')), 'no like / comment on Recently; no edit access on profiles');
const home = code('components/main/V2ProfileHome.tsx');
ok(/<RecentlyRows recently=\{data\.recently\} onEdit=/.test(home) && /label="Preview"/.test(home) && /label="Edit profile"/.test(home), 'My Profile: Recently with edit access, Edit profile, Preview');
const ed = code('app/v2/edit-recently.tsx');
ok(/addListener\('beforeRemove'/.test(ed) && /Discard changes\?/.test(ed) && /setBanner\(\{ kind: 'error', text: r\.text, changed: r\.changed \}\)/.test(ed) && /saveMyRecently\(draft, version\)/.test(ed), 'editor wired: draft, Discard, error keeps draft, version sent');
ok(!/fetch\(|axios|itunes|spotify\.com\/v1|api\./i.test(ed + code('lib/profile/recently.ts')), 'no external API / automatic lookup');
const ep = code('app/v2/edit-profile.tsx');
ok(/accessibilityRole="tab"/.test(ep) && /scrollTo\(\{ y:/.test(ep) && /onLayout=\{at\('photos'\)\}/.test(ep) && /onLayout=\{at\('answers'\)\}/.test(ep) && /onLayout=\{at\('details'\)\}/.test(ep), 'Edit profile: Photos / Answers / Details scroll to their part');
ok(!/ImagePicker|add_profile_photo|delete_profile_photo|save_prompts_v2|connection_answers|loadConnectionAnswers/.test(ep), 'no photo add / delete, prompt editing or private preferences');
ok(!/\b(story|stories|ring|rings|expires?|autoplay)\b|future feature|\bMert\b|Rick Rubin|Bill Withers/i.test(rows + home + ed + ep), 'no story / ring / expiry / autoplay, no mockup sample content or design notes');

// UI round 2026-10-27 (static wiring only — the phone shows the result).
ok(/const labels = \(keys: unknown/.test(ep) && /labels\(d\.interests, INTERESTS\)/.test(ep) && /labels\(d\.core_values, VALUE_OPTIONS\)/.test(ep) && !/count\(interests|count\(values/.test(ep), 'Edit profile shows the real interests / values, not counts');
ok(/node\.measureInWindow\(/.test(ep) && /offset\.current \+ \(titleTop - viewTop\) - TITLE_GAP/.test(ep) && /<View ref=\{viewportRef\}/.test(ep) && /if \(jumping\.current\) return;/.test(ep), 'tab jump uses real on-screen positions (title vs. the top of the scroll area)');
const prof = code('app/v2/profile.tsx');
ok(!/onAddTake/.test(prof) && /isOwn \? 'Preview' : 'Profile'/.test(prof) && /onLoaded=\{isOwn \? undefined : recordVisit\}/.test(prof), 'own Preview: no owner prompts; other profiles unchanged');
ok(/onEdit && recently \?[\s\S]{0,400}\) : onEdit \?/.test(rows) && !/addRow/.test(rows), 'empty Recently: a compact add link on the title row');
ok(/if \(r\.ok\) \{\s*Keyboard\.dismiss\(\);/.test(ed) && /keyboardDismissMode="interactive"/.test(ed), 'Recently editor: keyboard closes after a save; fields scroll with the keyboard open');
ok(!/dev\/(matches|discover|activity)-preview/.test(home) && /__DEV__ \?[\s\S]{0,900}Developer \(DEV only\)/.test(read('app/settings.tsx')), 'DEV design previews: Settings, DEV only; not on My Profile');

// Server package.
const sql = read('supabase/proposed/20261027120000_v2_profile_recently.sql').replace(/^--.*$/gm, '');
ok(/v_uid uuid := public\.v2_assert_member_profile_edit\(\);/.test(sql) && !/v2_assert_editable/.test(sql), 'active members only; the general onboarding lock is not used or changed');
ok(/enable row level security/.test(sql) && !/create policy/.test(sql) && /revoke all on public\.profile_recently_v2 from anon, authenticated/.test(sql), 'table: RPCs only');
ok(/r\.updated_at is distinct from p_expected_updated_at/.test(sql) && /'profile_changed'/.test(sql) && /for update/.test(sql), 'version check on a locked row');
ok(/char_length\(v_bt\) > 120/.test(sql) && /char_length\(v_ba\) > 80/.test(sql) && /char_length\(v_st\) > 120/.test(sql) && /char_length\(v_sa\) > 80/.test(sql) && /between 12 and 500/.test(sql), 'limits: 120 / 80 / 120 / 80 / 500');
ok(/\^https:\/\/\(\[a-z0-9-\]\+\\\.\)\*\(spotify/.test(sql), 'server link rule: https + music hosts');
ok(/'recently', public\.v2_recently_public\(o\.user_id\)\)/.test(sql) && /public\.v2_can_view_public_profile\(auth\.uid\(\), p_user\)/.test(sql), 'get_profile_v2: + recently, visibility unchanged');
ok(/20261027120000_v2_profile_recently\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/profile_recently/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
module.exports = done('v2_profile_recently');
