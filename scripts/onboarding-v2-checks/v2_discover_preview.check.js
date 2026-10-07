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
ok(eq(det.map((f) => `${f.label}=${f.value}`), ['Height=166 cm', 'Zodiac=Aries', 'Hometown=İzmir', 'Job=Product designer', 'School=Boğaziçi University']), 'details: English labels, mockup values');
ok(!det.some((f) => /Kadıköy|İstanbul/.test(f.value)), 'details: location not repeated');
ok(eq(det.filter((f) => f.wide).map((f) => f.label), ['Hometown', 'Job', 'School']) && eq(det.filter((f) => !f.wide).map((f) => f.label), ['Height', 'Zodiac']), 'About: Height + Zodiac side by side, Hometown / Job / School full-width rows');
const itemsSrc = fs.readFileSync(path.join(ROOT, 'components/discover/DiscoverProfileItems.tsx'), 'utf8');
ok(/detailWide: \{ flexDirection: 'row'/.test(itemsSrc) && !/detailWide:[^}]*width/.test(itemsSrc), 'details: wide rows use the full width');
ok(/detailValue: \{ fontFamily: obFonts\.bodyMedium, fontSize: 17/.test(itemsSrc) && !/detailValue[^\n]*numberOfLines/.test(itemsSrc), 'details: same 17 pt medium value, no truncation');
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
// Round 2: Send keeps the profile; the note replaces the editor in place.
ok(sent.likesLeft === 2 && sent.editor === null, 'Send counts one like, no extra heart needed');
ok(D.currentPersonId(sent) === 'defne' && D.likedCurrent(sent), 'Send keeps the same profile on screen');
ok(eq(sent.sent, { personId: 'defne', target: 'prompt:small_thing_i_love', comment: 'Which ferry route is your favourite?' }), 'sent note kept for that content');
ok(R(sent, { type: 'send_comment', personId: 'defne' }) === sent, 'double tap on Send: one like');
ok(R(sent, { type: 'like', personId: 'defne', target: 'photo:0' }) === sent, 'no second heart on a liked profile');
ok(R(sent, { type: 'open_comment', personId: 'defne', target: 'photo:1' }) === sent, 'no second comment on a liked profile');
ok(R(sent, { type: 'pass', personId: 'defne' }) === sent, '× (pass) not available on a liked profile');
const nexted = R(sent, { type: 'next', personId: 'defne' });
ok(D.currentPersonId(nexted) === 'mert' && nexted.likesLeft === 2 && nexted.sent === null, 'Next profile: next person, no like used');
ok(nexted.decisions.length === 1 && !nexted.decisions.some((d) => d.kind === 'pass'), 'Next profile records no pass / dislike');
ok(R(nexted, { type: 'next', personId: 'defne' }) === nexted, 'double tap on Next profile: one step');
ok(R(I, { type: 'next', personId: 'defne' }) === I, 'Next profile only after a like was sent');
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
const screenSrc = fs.readFileSync(path.join(ROOT, 'components/dev/discover/DiscoverDesignPreview.tsx'), 'utf8');
ok(/type: 'next', personId: person\.id/.test(screenSrc) && /accessibilityLabel="Next profile"/.test(screenSrc), 'liked profile shows Next profile instead of ×');
ok(!/scrollTo\(\{ y: 0/.test(screenSrc), 'Send never scrolls to the top');
ok(/Comment sent/.test(fs.readFileSync(path.join(ROOT, 'components/discover/DiscoverProfileItems.tsx'), 'utf8')), 'Comment sent line in place of the editor');

// Static: English copy, no backend, no swipe/animation/toast, DEV-only.
const files = ['lib/dev/discoverPreview.ts', 'lib/discover/profileLayout.ts', 'components/dev/discover/DiscoverDesignPreview.tsx', 'components/discover/DiscoverProfileItems.tsx', 'components/dev/discover/PreviewTabBar.tsx', 'components/dev/discover/previewPhotos.ts', 'app/dev/discover-preview.tsx'];
const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
ok(!/supabase|onboardingV2\/remote|matchChatV2|@\/lib\/(likes|dailyViews|matchInvite)/.test(src), 'no backend import');
ok(!/Memleket|Koç|Ürün tasarımcısı|Yorum|Vazgeç|Gönder/.test(src), 'no Turkish UI copy (place names only)');
// Code only (comments describe what is deliberately absent).
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/Gesture|PanResponder|Animated\.|Modal|BottomSheet|Like sent|Profile passed|NOPE/.test(code), 'no swipe, animation, modal, sheet or toast');
const pctStrings = (code.match(/['"`][^'"`\n]*%[^'"`\n]*['"`]/g) || []).filter((x) => !/^['"]\d+%['"]$/.test(x));
ok(pctStrings.length === 0, 'no compatibility percentage in any text');
ok(/returnKeyType="done"/.test(src) && /submitBehavior="blurAndSubmit"/.test(src) && !/onSubmitEditing/.test(src), 'Done closes the keyboard without sending');
ok(/chrome\.tabBar \? <PreviewTabBar/.test(src) && D.chromeVisibility({ kind: 'profile', keyboardOpen: true, editorOpen: true, liked: false, outOfLikes: false }).tabBar === false, 'tab bar hidden while typing in the comment field');
ok(/if \(!__DEV__\) return <Redirect/.test(fs.readFileSync(path.join(ROOT, 'app/dev/discover-preview.tsx'), 'utf8')), 'route redirects in production');
ok(/__DEV__ \?[\s\S]{0,200}dev\/discover-preview/.test(fs.readFileSync(path.join(ROOT, 'components/main/V2ProfileHome.tsx'), 'utf8')), 'Profile entry is DEV-only');

// Round 3: out of likes, no one left, load error.
const out0 = R(I, { type: 'dev_use_up_likes' });
ok(out0.likesLeft === 0 && D.screenKind(out0) === 'profile', 'out of likes: profile still shown');
ok(R(out0, { type: 'like', personId: 'defne', target: 'photo:0' }) === out0, 'out of likes: heart refused');
ok(R(out0, { type: 'open_comment', personId: 'defne', target: 'photo:0' }) === out0, 'out of likes: no comment editor (a comment is a like)');
const out0p = R(out0, { type: 'pass', personId: 'defne' });
ok(D.currentPersonId(out0p) === 'mert' && out0p.likesLeft === 0, 'out of likes: can keep browsing (pass)');
ok(R(typed, { type: 'dev_use_up_likes' }).editor === null, 'out of likes closes an open editor');
ok(!/\d|tomorrow|renew|reset|premium|upgrade|buy/i.test(D.STATE_COPY.outOfLikes), 'out-of-likes text: no refresh time, no purchase');
const empty = R(I, { type: 'dev_empty' });
ok(D.screenKind(empty) === 'empty', 'no one left → empty screen');
const err = R(empty, { type: 'dev_load_error' });
ok(D.screenKind(err) === 'error', 'load error wins over empty');
ok(D.screenKind(R(I, { type: 'dev_load_error' })) === 'error', 'load error with people queued → error, not empty');
ok(!/everyone|no new|no one|left/i.test(D.STATE_COPY.errorTitle + D.STATE_COPY.errorText), 'error copy never says nobody is left');
ok(D.screenKind(R(R(I, { type: 'dev_load_error' }), { type: 'retry' })) === 'profile', 'retry → profiles again');
ok(!/\d|tomorrow/i.test(D.STATE_COPY.emptyTitle + D.STATE_COPY.emptyText), 'empty copy: no invented refresh time');
const scr = fs.readFileSync(path.join(ROOT, 'components/dev/discover/DiscoverDesignPreview.tsx'), 'utf8');
const nextStyle = (scr.match(/ {2}next: \{[\s\S]*?\n {2}\},/) || [''])[0];
ok(!/position: 'absolute'/.test(nextStyle) && /<View style=\{styles\.actionBar\}>/.test(scr), 'Next profile sits in its own bar, not over the photo');
ok(/numberOfLines=\{3\}/.test(fs.readFileSync(path.join(ROOT, 'components/discover/DiscoverProfileItems.tsx'), 'utf8')), 'sent note compact (max 3 lines)');

// Round 5: compact prompt / neutral heart / secondary links, About order, Next profile stall.
const V = D.chromeVisibility;
const base = { kind: 'profile', keyboardOpen: false, editorOpen: false, liked: false, outOfLikes: false };
ok(V({ ...base, liked: true, keyboardOpen: true }).nextProfile === true, 'stale keyboard flag after Send never hides Next profile');
ok(V({ ...base, liked: true, keyboardOpen: true }).tabBar === true, 'stale keyboard flag never hides the tab bar');
ok(V({ ...base, liked: true }).pass === false && V({ ...base, liked: true }).nextProfile === true, 'liked: Next profile instead of ×');
const typingV = V({ ...base, keyboardOpen: true, editorOpen: true });
ok(!typingV.tabBar && !typingV.pass && !typingV.nextProfile, 'while typing: tab bar, × and bar hidden');
ok(V({ ...base, outOfLikes: true }).outOfLikesNote && V({ ...base, outOfLikes: true }).pass, 'out of likes: note + × still there');
ok(V({ ...base, liked: true, outOfLikes: true }).nextProfile && !V({ ...base, liked: true, outOfLikes: true }).outOfLikesNote, 'liked with last like: Next profile takes the bar');
ok(!V({ ...base, kind: 'empty' }).pass && !V({ ...base, kind: 'error' }).nextProfile, 'no profile controls on empty / error');
const scr5 = fs.readFileSync(path.join(ROOT, 'components/dev/discover/DiscoverDesignPreview.tsx'), 'utf8');
const sendHandler = (scr5.match(/onSendComment: \(\) => \{[\s\S]*?\n {8}\},/) || [''])[0];
ok(/setKeyboardOpen\(false\)/.test(sendHandler) && /Keyboard\.dismiss\(\)/.test(sendHandler), 'Send resets the keyboard state itself');
const it5 = fs.readFileSync(path.join(ROOT, 'components/discover/DiscoverProfileItems.tsx'), 'utf8');
const style5 = (name) => (it5.match(new RegExp(`\\n  ${name}: \\{[^}]*\\}`)) || [''])[0];
ok(/fontFamily: obFonts\.heading, fontSize: 21/.test(style5('promptAnswer')), 'prompt answer: serif, compact 21 pt');
ok(!/backgroundColor: obColors\.cta/.test(style5('heartOnCard')) && /borderWidth/.test(style5('heartOnCard')), 'card heart: neutral outline, no dark-green disc');
ok(/hitSlop=\{onPhoto \? 6 : 8\}/.test(it5), 'heart keeps a large touch area');
ok(!/backgroundColor/.test(style5('commentChip')) && /fontSize: 14/.test(style5('commentLinkText')) && /textSecondary/.test(style5('commentLinkText')), 'Add a comment: small secondary link, no dark capsule');
ok(/<Section title="About">/.test(it5) && /fontFamily: obFonts\.bodyMedium, fontSize: 17/.test(style5('detailValue')), 'About title; values keep DM Sans Medium 17');

module.exports = done('v2_discover_preview');
