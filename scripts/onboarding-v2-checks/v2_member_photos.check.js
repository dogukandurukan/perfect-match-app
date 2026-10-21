// Approved member photo order (2026-10-21, narrow D90 exception). Pure order
// helpers + static wiring + SQL shape. Real local services:
// scripts/local-backend/smoke_member_photos_local.mjs. The screen needs the phone.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const P = require(path.join(ROOT, 'lib/profile/photoOrder.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ids = ['a', 'b', 'c', 'd'];
ok(eq(P.makeMain(ids, 'c'), ['c', 'a', 'b', 'd']) && P.makeMain(ids, 'a') === ids && P.makeMain(ids, 'x') === ids, 'make main: moves to the front, keeps the rest in order');
ok(eq(P.moveUp(ids, 'c'), ['a', 'c', 'b', 'd']) && P.moveUp(ids, 'a') === ids, 'move up; first stays');
ok(eq(P.moveDown(ids, 'b'), ['a', 'c', 'b', 'd']) && P.moveDown(ids, 'd') === ids, 'move down; last stays');
ok(P.sameOrder(ids, ['a', 'b', 'c', 'd']) && !P.sameOrder(ids, ['b', 'a', 'c', 'd']), 'dirty = order differs from the saved one');
ok(eq(P.sortByPosition([{ id: 'x', path: '', position: 2 }, { id: 'y', path: '', position: 1 }]).map((p) => p.id), ['y', 'x']), 'loaded in saved position order');
ok(P.photoOrderError('photos_changed').changed && P.photoOrderError('photo_set_mismatch').changed && !P.photoOrderError('fetch failed').changed, 'changed-elsewhere errors offer Reload; others a retry');

const scr = code('app/v2/edit-photos.tsx');
ok(/if \(busy\.current \|\| !dirty\) return;/.test(scr) && /disabled=\{saving \|\| !dirty\}/.test(scr), 'save: one request at a time, only when changed');
ok(/saveMemberPhotoOrder\(order, saved\)/.test(scr), 'save sends the new order and the order the screen loaded');
ok(/setBanner\(\{ kind: 'error', text: r\.text, changed: r\.changed \}\);/.test(scr) && !/setDraft\(saved\)/.test(scr), 'failure keeps the edited order (retry possible)');
ok(/addListener\('beforeRemove'/.test(scr) && /if \(!dirty \|\| busy\.current\) return;/.test(scr) && /Discard changes\?/.test(scr), 'leaving with unsaved changes asks first');
ok(/Main photo/.test(scr) && /Make main photo/.test(scr) && /Move photo \$\{n\} up/.test(scr) && /Move photo \$\{n\} down/.test(scr), 'main photo marked; make-main and up / down controls with labels');
ok(!/add_profile_photo|delete_profile_photo|upload\(|ImagePicker/.test(scr + code('lib/profile/memberPhotos.ts')), 'no add / delete / upload in this package');
ok(/label="Photos" variant="outline" onPress=\{\(\) => router\.push\('\/v2\/edit-photos'/.test(code('components/main/V2ProfileHome.tsx')), 'Profile tab: Photos entry');
ok(/rpc\('reorder_member_photos_v2', \{ p_ids: ids, p_expected: expected \}\)/.test(code('lib/profile/memberPhotos.ts')), 'client calls the narrow member function');

const sql = read('supabase/proposed/20261021090000_v2_member_photo_order.sql').replace(/^--.*$/gm, '');
ok(/v_uid uuid := public\.v2_assert_member_profile_edit\(\);/.test(sql) && !/v2_assert_editable/.test(sql), 'server: active members only; the application lock is not touched');
ok(!/insert into|delete from|storage_path\s*=/.test(sql) && /update profile_photos_v2 f set position = x\.ord/.test(sql), 'server: only positions change (no insert / delete / path change)');
ok(/perform 1 from account_state_v2 where user_id = v_uid for update;/.test(sql) && /raise exception 'photos_changed'/.test(sql) && /raise exception 'photo_set_mismatch'/.test(sql), 'server: locked, stale order refused, exact id set required');
ok(/update profiles set photos =/.test(sql), 'server: profiles.photos copy follows the new order');
ok(/20261021090000_v2_member_photo_order\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/member_photo_order/.test(read('scripts/dev-backend/apply-dev.mjs')), 'LOCAL setup only, not apply-dev');
module.exports = done('v2_member_photos');
