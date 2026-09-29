// P07 R2 logic checks: photo management (add / replace / reorder / remove /
// dedupe / stale-update safety / grid geometry / drag target) and the prompt
// catalog + slot model. Pure modules only — not a device test.
const { ok, eq, lib, done } = require('./_setup');
const P = lib('yourProfile.ts');
const G = lib('photoGrid.ts');
const K = lib('promptCatalog.ts');
const B = lib('basics.ts');
const C = lib('compatibility.ts');
const L = lib('yourLife.ts');
const W = lib('yourWorld.ts');
const D = lib('yourDates.ts');

let seq = 0;
const ph = (asset = null) => ({ id: `t${++seq}`, uri: `file:///cache/${seq}.jpg`, assetId: asset });
const ids = (l) => l.map((p) => p.id);
const E = P.EMPTY_PROFILE_DRAFT;

// ─── Photos ────────────────────────────────────────────────────────────────
{
  // 0 → one at a time to 6, then a 7th is refused
  let l = [];
  for (let i = 0; i < 6; i++) l = P.addPhotos(l, [ph()]);
  ok(l.length === 6, '0 → 6 one at a time');
  const r7 = P.addPhotosDetailed(l, [ph()]);
  ok(r7.list.length === 6 && r7.overflow === 1 && r7.added === 0, '7th refused (overflow counted)');
}
{
  // batch 3, then batch 3 more — existing photos kept, order = pick order
  const a = [ph('A'), ph('B'), ph('C')];
  const b = [ph('D'), ph('E'), ph('F')];
  let l = P.addPhotos([], a);
  l = P.addPhotos(l, b);
  ok(eq(ids(l), ids([...a, ...b])), '3 + 3 keeps the first three and appends in order');
  ok(l[1].id === a[1].id, 'second slot shows the second picked photo');
  // a batch larger than the free capacity keeps only what fits
  const c = P.addPhotosDetailed(P.addPhotos([], [ph(), ph(), ph(), ph()]), [ph(), ph(), ph()]);
  ok(c.list.length === 6 && c.overflow === 1, 'batch over capacity: 2 added, 1 overflow');
}
{
  // replace only the 2nd
  const l = P.addPhotos([], [ph('A'), ph('B'), ph('C')]);
  const n = { ...ph('Z'), id: l[1].id };
  const r = P.replacePhoto(l, l[1].id, n);
  ok(r[0] === l[0] && r[2] === l[2] && r[1].uri === n.uri && r[1].id === l[1].id, 'replace changes only the 2nd photo');
  ok(eq(P.replacePhoto(l, l[1].id, { ...ph('A'), id: l[1].id }), l), 'replacement already used by another photo is refused');
  ok(eq(P.replacePhoto(l, 'missing', ph('Q')), l), 'replace of an unknown id does nothing');
}
{
  // 6th to 1st by drag, middle delete and re-add, make main, move earlier/later
  const l = P.addPhotos([], [ph(), ph(), ph(), ph(), ph(), ph()]);
  const m = P.movePhotoTo(l, l[5].id, 0);
  ok(eq(ids(m), [l[5], l[0], l[1], l[2], l[3], l[4]].map((p) => p.id)), 'drag 6th → 1st shifts the others, nobody lost');
  ok(eq(ids(P.movePhotoTo(l, l[0].id, 99)), ids([...l.slice(1), l[0]])), 'drag beyond the end clamps');
  const d = P.removePhoto(l, l[2].id);
  ok(d.length === 5 && !ids(d).includes(l[2].id), 'delete the middle photo only');
  const re = P.addPhotos(d, [ph()]);
  ok(re.length === 6 && eq(ids(re).slice(0, 5), ids(d)), 're-add appends without disturbing the rest');
  ok(P.makeMainPhoto(l, l[3].id)[0].id === l[3].id, 'make main moves it to slot 1');
  ok(eq(ids(P.movePhoto(l, l[2].id, -1)).slice(1, 3), [l[2].id, l[1].id]), 'move earlier (accessible)');
}
{
  // picker cancel = no pick → nothing changes
  const l = P.addPhotos([], [ph(), ph()]);
  ok(eq(P.addPhotos(l, []), l), 'cancel / empty pick changes nothing');
}
{
  // duplicates by asset id only; null ids never considered equal
  const l = P.addPhotos([], [ph('A'), ph(null)]);
  const r = P.addPhotosDetailed(l, [ph('A'), ph(null), ph(null)]);
  ok(r.duplicates === 1 && r.added === 2, 'same non-null assetId skipped; null assetIds added');
  const same = P.addPhotosDetailed([], [ph('X'), ph('X')]);
  ok(same.added === 1 && same.duplicates === 1, 'duplicate inside one batch skipped');
}
{
  // validity: only usable photos count; broken / 2 photos keep Continue off
  const l = P.addPhotos([], [ph(), ph()]);
  ok(!P.photosValid(l), 'only 2 photos → Continue off');
  const l3 = P.addPhotos(l, [ph()]);
  ok(P.photosValid(l3), '3 photos → valid');
  const broken = P.markPhotoBroken(l3, l3[0].id);
  ok(!P.photosValid(broken), 'a photo that failed to load does not count');
  ok(P.photosValid(P.clearPhotoBroken(broken, l3[0].id)), 'retry clears the error flag');
}
{
  // stale-update race (R2 root cause #2): old patch style vs functional updater
  const l = P.addPhotos([], [ph(), ph(), ph()]);
  const renderTime = l; // what a callback captured at render
  let state = P.removePhoto(l, l[1].id); // user removed photo 2 meanwhile
  const oldStyle = P.markPhotoBroken(renderTime, l[0].id); // late onError, old code path
  ok(oldStyle.length === 3, 'old patch style resurrects the removed photo (bug reproduced)');
  state = ((fn) => fn(state))((cur) => P.markPhotoBroken(cur, l[0].id)); // R2 functional update
  ok(state.length === 2 && state[0].broken && !ids(state).includes(l[1].id), 'functional update keeps the removal');
}
{
  // grid geometry and drag target
  const g = G.gridGeometry(390, 1);
  ok(g.cols === 3 && g.tileW === 107 && g.tileH === 134, '390 pt: 3 columns, 107 × 134 tiles');
  const last = G.slotXY(5, g);
  ok(last.x + g.tileW <= 342 && G.gridHeight(6, g) === 2 * 134 + 10, '3 × 2 fits the 342 pt content width');
  ok(G.gridGeometry(320, 1).cols === 2 && G.gridGeometry(390, 1.4).cols === 2, 'narrow phone / large text → 2 columns');
  ok(G.gridGeometry(375, 1).cols === 3, '375 pt stays 3 columns');
  const boxes = Array.from({ length: 6 }, (_, i) => G.slotXY(i, g));
  ok(boxes.every((a, i) => boxes.every((b, j) => i === j || Math.abs(a.x - b.x) >= g.tileW || Math.abs(a.y - b.y) >= g.tileH)), 'slots never overlap');
  const to0 = G.dragTargetIndex(5, -(2 * (g.tileW + 10)), -(g.tileH + 10), g, 6);
  ok(to0 === 0, 'dragging slot 6 onto slot 1 targets index 0');
  ok(G.dragTargetIndex(0, 2000, 2000, g, 4) === 3, 'drag target clamps to the last filled photo');
  ok(G.dragTargetIndex(2, 0, 0, g, 6) === 2, 'no movement → same slot');
}
{
  // preview mirrors the editor's photo order
  const l = P.addPhotos([], [ph(), ph(), ph(), ph()]);
  const moved = P.movePhotoTo(l, l[3].id, 0);
  const pr = P.saveSlot(P.saveSlot(E.prompts, 0, 'dont_judge_me', 'a'), 1, 'ask_me_about', 'b');
  const bl = P.buildProfilePreview({ ...B.EMPTY_BASICS_DRAFT, firstName: 'Ada' }, C.EMPTY_COMPAT_DRAFT, L.EMPTY_LIFE_DRAFT, W.EMPTY_WORLD_DRAFT, D.EMPTY_DATES_DRAFT, { ...E, photos: moved, prompts: pr });
  const order = bl.filter((b) => b.type === 'hero' || b.type === 'photo').map((b) => b.photo.id);
  ok(eq(order, ids(moved)), 'preview photo order = editor order after reorder');
}

// ─── Prompt catalog ────────────────────────────────────────────────────────
{
  ok(K.PROMPT_CATALOG.length === 20, '20 prompts');
  ok(new Set(K.PROMPT_CATALOG.map((e) => e.id)).size === 20, 'stable unique ids');
  const cats = ['about_me', 'just_for_fun', 'you_and_me', 'my_everyday'];
  ok(cats.every((c) => K.promptsInCategory(c).length === 5) && K.promptsInCategory('all').length === 20, '5 per category + All');
  ok(eq(K.PROMPT_CATEGORIES.map((c) => c.label), ['All', 'About me', 'Just for fun', 'You & me', 'My everyday']), 'category labels');
  ok(K.PROMPT_CATALOG.every((e) => e.tr && e.examples.en.length === 2 && e.examples.tr.length === 2 && [...e.examples.en, ...e.examples.tr].every((x) => x.trim().length > 3)), 'TR meaning + 2 EN + 2 TR examples each');
  ok(K.PROMPT_CATALOG.every((e) => e.en.length <= 34), 'short titles (≤ 34 chars → ≤ 2 lines at normal size)');
  const required = ['A small thing I love…', "Don't judge me, but…", 'Together, we could…', "You pick the place, I'll…", "A plan I'll always say yes to…"];
  ok(required.every((t) => K.PROMPT_CATALOG.some((e) => e.en === t)), 'approved titles present');
  ok(K.promptById('funny_little_habit').examples.tr[1] === 'Menüye on dakika bakıp hep aynı şeyi söylemek.', 'owner tone example kept (TR)');
}

// ─── Prompt slots ──────────────────────────────────────────────────────────
{
  ok(eq(E.prompts.map((a) => a.promptId), [null, null, null]), 'starts with three empty "Choose a prompt" slots');
  ok(P.PROFILE_SCREENS[1].title === 'A little more you' && P.PROFILE_SCREENS[1].helper === 'Pick 2 prompts. Add a third if you like.', 'prompts screen copy');
  ok(!P.promptsValid(E.prompts) && !JSON.stringify(E).includes('tiramisu'), 'examples never stored or counted');
  const tr = 'Şarkıyı ilk iki saniyesinden tanımak. İyi günler 😊\nİkinci satır: çğıöşü';
  let pr = P.saveSlot(E.prompts, 0, 'oddly_good_at', tr);
  ok(pr[0].answer === tr, 'Turkish characters, emoji and new lines stored exactly as typed');
  ok(!P.promptsValid(pr), 'one answer is not enough');
  pr = P.saveSlot(pr, 1, 'together_we_could', "İstanbul'un en iyi tiramisusunu bulabiliriz.");
  ok(P.promptsValid(pr), 'two real answers → valid');
  ok(eq(P.saveSlot(pr, 2, 'oddly_good_at', 'again'), pr), 'the same prompt cannot be chosen twice');
  ok(eq(P.saveSlot(pr, 2, 'ask_me_about', '   '), pr), 'whitespace-only answer refused');
  ok(eq(P.saveSlot(pr, 2, 'ask_me_about', 'x'.repeat(201)), pr), 'over 200 characters refused');
  ok(P.saveSlot(pr, 2, 'ask_me_about', 'x'.repeat(200))[2].answer.length === 200, 'exactly 200 accepted');
  ok(eq(P.saveSlot(pr, 2, 'not_a_prompt', 'hi'), pr), 'unknown prompt id refused');
  const three = P.saveSlot(pr, 2, 'ask_me_about', 'Maps');
  ok(P.publicAnswers(three).length === 3 && P.publicAnswers(P.clearSlot(three, 2)).length === 2, 'optional third can be added and removed');
  // changing slot 1 to another prompt with the same text is an explicit save, never automatic
  const changed = P.saveSlot(pr, 1, 'first_date_needs', pr[1].answer);
  ok(changed[1].promptId === 'first_date_needs' && changed[1].answer === pr[1].answer && changed[0] === pr[0], 'explicit change keeps the other slots untouched');
  ok(P.firstMissingStep({ ...E, prompts: P.saveSlot(E.prompts, 0, 'ask_me_about', 'x') }) === 1, 'missing photos reported first');
  const bl = P.buildProfilePreview({ ...B.EMPTY_BASICS_DRAFT, firstName: 'Ada' }, C.EMPTY_COMPAT_DRAFT, L.EMPTY_LIFE_DRAFT, W.EMPTY_WORLD_DRAFT, D.EMPTY_DATES_DRAFT, { ...E, photos: P.addPhotos([], [ph(), ph(), ph()]), prompts: pr });
  const shown = bl.filter((b) => b.type === 'prompt');
  ok(shown.length === 2 && shown[0].label === "I'm oddly good at…" && shown[0].answer === tr.trim() && shown[1].label === 'Together, we could…', 'preview shows the real answers with catalog titles, in slot order');
  ok(!JSON.stringify(bl).includes(K.promptById('oddly_good_at').examples.en[0]), 'examples never appear on the profile');
}

module.exports = done('P07 R2 photos & prompts');
