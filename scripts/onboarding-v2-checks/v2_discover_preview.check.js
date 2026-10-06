// DEV Discover design preview (lib/dev/discoverPreview.ts + its screen):
// profile order, location rule, local like / pass / inline comment rules and
// that the preview can't reach the backend. Local logic check only — not a
// real-service or phone test.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const D = require(path.join(ROOT, 'lib/dev/discoverPreview.ts'));

const person = (id) => D.DISCOVER_PEOPLE.find((p) => p.id === id);
const sig = (items) =>
  items.map((i) =>
    i.type === 'photo' || i.type === 'hero' ? `${i.type === 'hero' ? 'hero' : 'photo'}${i.photoIndex + 1}`
    : i.type === 'prompt' ? 'prompt'
    : i.type === 'groups' ? `groups:${i.groups.map((g) => g.title).join('+')}`
    : i.type);

// Order: full profile (6 photos / 3 prompts).
const full = sig(D.buildDiscoverLayout(person('defne')));
ok(eq(full.slice(0, 8), ['hero1', 'prompt', 'details', 'photo2', 'groups:Looking for+What matters most', 'prompt', 'photo3', 'groups:Into+Lifestyle']), 'full: steps 1–8 in order');
ok(full[full.length - 1] === 'firstDate', 'full: First dates last');
ok(full.filter((x) => /^photo|^hero/.test(x)).length === 6 && full.filter((x) => x === 'prompt').length === 3, 'full: all 6 photos + 3 prompts placed');
ok(full.indexOf('taste') > full.indexOf('groups:Into+Lifestyle'), 'full: favourites after interests/lifestyle');
ok(full.every((x, i) => !(i > 0 && /^photo/.test(x) && /^photo|^hero/.test(full[i - 1]))), 'full: no two photos touch');
// Short profile (3 photos / 2 prompts) — nothing missing, empty sections hidden.
const short = sig(D.buildDiscoverLayout(person('mert')));
ok(eq(short, ['hero1', 'prompt', 'details', 'photo2', 'groups:Looking for', 'prompt', 'photo3', 'groups:Into+Lifestyle', 'firstDate']), 'short: compact order, no empty sections');
ok(!short.includes('taste'), 'short: no favourites section when empty');

// Location rule: district only when shared, else city; not repeated below.
ok(D.heroLocation(person('defne')) === 'Kadıköy' && D.heroLocation(person('ece')) === 'Şişli', 'hero shows shared district');
ok(D.heroLocation(person('mert')) === 'İzmir', 'hero falls back to city');
ok(D.heroLocation({ district: '  ', city: 'İzmir' }) === 'İzmir' && D.heroLocation({ district: null, city: null }) === null, 'blank district → city; none → nothing');
const det = D.personalDetails(person('defne'));
ok(eq(det.map((f) => `${f.label}=${f.value}`), ['Hometown=İzmir', 'Height=166 cm', 'Zodiac=Aries', 'Job=Product designer', 'School=Boğaziçi University']), 'details: English labels, mockup values');
ok(!det.some((f) => /Kadıköy|İstanbul/.test(f.value)), 'details: location not repeated');
ok(eq(D.personalDetails(person('mert')).map((f) => f.label), ['Height', 'Zodiac']), 'details: empty fields hidden');

// Reducer: likes, pass, comments.
const R = D.discoverReducer;
const I = D.INITIAL_DISCOVER_STATE;
ok(D.currentPersonId(I) === 'defne' && I.likesLeft === 3 && I.editor === null, 'start: full profile, 3 likes');
const liked = R(I, { type: 'like', personId: 'defne', target: 'photo:2' });
ok(D.currentPersonId(liked) === 'mert' && liked.likesLeft === 2, 'heart = like without comment → next profile');
ok(eq(liked.decisions[0], { kind: 'like', personId: 'defne', target: 'photo:2', comment: '' }), 'heart targets that content');
ok(R(liked, { type: 'like', personId: 'defne', target: 'photo:2' }) === liked, 'double tap on heart: one like, one step');
const passed = R(I, { type: 'pass', personId: 'defne' });
ok(D.currentPersonId(passed) === 'mert' && passed.likesLeft === 3, '× passes without using a like');
ok(R(passed, { type: 'pass', personId: 'defne' }) === passed, 'double tap on ×: one pass, one step');

const open = R(I, { type: 'open_comment', personId: 'defne', target: 'prompt:small_thing_i_love' });
ok(open.editor && open.editor.target === 'prompt:small_thing_i_love' && open.editor.draft === '', 'Add a comment opens the editor for that content');
const typed = R(open, { type: 'edit_comment', text: 'Which ferry route is your favourite?' });
const other = R(typed, { type: 'open_comment', personId: 'defne', target: 'photo:0' });
ok(other.editor.target === 'photo:0' && other.editor.draft === '', 'only one editor open at a time');
ok(R(typed, { type: 'open_comment', personId: 'defne', target: 'prompt:small_thing_i_love' }) === typed, 're-opening the same editor keeps the draft');
ok(R(open, { type: 'edit_comment', text: 'x'.repeat(300) }).editor.draft.length === 240, '240-character limit');
const cancelled = R(typed, { type: 'cancel_comment' });
ok(cancelled.editor === null && cancelled.decisions.length === 0 && D.currentPersonId(cancelled) === 'defne', 'Cancel closes without sending');
ok(R(R(open, { type: 'edit_comment', text: '   ' }), { type: 'send_comment', personId: 'defne' }).decisions.length === 0, 'blank comment cannot be sent');
const sent = R(typed, { type: 'send_comment', personId: 'defne' });
ok(eq(sent.decisions, [{ kind: 'like', personId: 'defne', target: 'prompt:small_thing_i_love', comment: 'Which ferry route is your favourite?' }]), 'Send = one like with the comment');
ok(sent.likesLeft === 2 && D.currentPersonId(sent) === 'mert' && sent.editor === null, 'Send moves on, no extra heart needed');
ok(R(sent, { type: 'send_comment', personId: 'defne' }) === sent, 'double tap on Send: one like');
ok(R(I, { type: 'open_comment', personId: 'mert', target: 'photo:0' }) === I, 'no editor for a profile that is not shown');

let s = I;
for (const id of ['defne', 'mert', 'ece']) s = R(s, { type: 'like', personId: id, target: 'photo:0' });
ok(s.likesLeft === 0 && D.currentPersonId(s) === null, 'three likes use the preview counter; end of list');
const out = { ...I, likesLeft: 0 };
ok(R(out, { type: 'like', personId: 'defne', target: 'photo:0' }) === out, 'no like at 0 left');
ok(eq(R(sent, { type: 'reset' }), I), 'reset → start');
ok(D.currentPersonId(R(I, { type: 'reset', shortFirst: true })) === 'mert', 'reset short profile first');
ok(D.likesLeftLabel(3) === '3 likes left' && D.likesLeftLabel(1) === '1 like left', 'likes-left text');
ok(D.describeDecision(sent.decisions[0]) === 'Liked Defne’s prompt with a comment', 'DEV panel decision text');

// Static: English copy, no backend, no swipe/animation/toast, DEV-only.
const files = ['lib/dev/discoverPreview.ts', 'components/dev/discover/DiscoverDesignPreview.tsx', 'components/dev/discover/DiscoverProfileItems.tsx', 'components/dev/discover/PreviewTabBar.tsx', 'app/dev/discover-preview.tsx'];
const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
ok(!/supabase|onboardingV2\/remote|matchChatV2|@\/lib\/(likes|dailyViews|matchInvite)/.test(src), 'no backend import');
ok(!/Memleket|Koç|Ürün tasarımcısı|Yorum|Vazgeç|Gönder/.test(src), 'no Turkish UI copy (place names only)');
// Code only (comments describe what is deliberately absent).
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/Gesture|PanResponder|Animated\.|Modal|BottomSheet|Like sent|Profile passed|NOPE/.test(code), 'no swipe, animation, modal, sheet or toast');
const pctStrings = (code.match(/['"`][^'"`\n]*%[^'"`\n]*['"`]/g) || []).filter((x) => !/^['"]\d+%['"]$/.test(x));
ok(pctStrings.length === 0, 'no compatibility percentage in any text');
ok(/returnKeyType="done"/.test(src) && /submitBehavior="blurAndSubmit"/.test(src) && !/onSubmitEditing/.test(src), 'Done closes the keyboard without sending');
ok(/!keyboardOpen \? <PreviewTabBar/.test(src), 'tab bar hidden while the keyboard is open');
ok(/if \(!__DEV__\) return <Redirect/.test(fs.readFileSync(path.join(ROOT, 'app/dev/discover-preview.tsx'), 'utf8')), 'route redirects in production');
ok(/__DEV__ \?[\s\S]{0,200}dev\/discover-preview/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8')), 'Profile entry is DEV-only');

module.exports = done('v2_discover_preview');
