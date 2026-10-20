// V2 chat photos (first package): pure rules + static wiring. Real-service
// check: scripts/local-backend/smoke_chat_photos_local.mjs.
const fs = require('fs');
const path = require('path');
const { ok, eq, done, ROOT } = require('./_setup');
const P = require(path.join(ROOT, 'lib/chat/photo.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const base = { uri: 'file:///x/IMG_1.JPG', width: 4032, height: 3024 };
ok(P.checkPickedPhoto({ ...base, mimeType: 'image/jpeg', fileSize: 2e6 }).ok, 'jpeg ok');
ok(P.checkPickedPhoto({ ...base, mimeType: 'image/heic' }).photo.contentType === 'image/heic', 'heic ok');
ok(P.checkPickedPhoto({ ...base, mimeType: null, fileName: 'a.png' }).photo.ext === 'png', 'no MIME → extension');
ok(P.checkPickedPhoto({ ...base, mimeType: 'image/gif' }).message === P.UNSUPPORTED_MESSAGE, 'gif refused with a clear message');
ok(P.checkPickedPhoto({ ...base, mimeType: 'video/mp4' }).ok === false, 'video refused');
ok(P.checkPickedPhoto({ ...base, mimeType: 'image/jpeg', fileSize: 11 * 1024 * 1024 }).message === P.TOO_LARGE_MESSAGE, 'over 10 MB refused');
ok(P.checkPickedPhoto({ ...base, width: 0, mimeType: 'image/jpeg' }).message === P.UNREADABLE_MESSAGE, 'no size → unreadable');
const M = '6A4C2E10-0000-4000-8000-000000000001';
ok(P.chatPhotoPath(M, 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'jpg')
  === '6a4c2e10-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000002/c0000000-0000-4000-8000-000000000003.jpg', 'path: match / sender / request.ext, lower-case (server shape)');
ok(eq(P.photoBubbleSize(4032, 3024), { width: 220, height: 165 }) && eq(P.photoBubbleSize(3024, 4032), { width: 210, height: 280 }), 'bubble keeps the aspect ratio inside 220 × 280');
ok(eq(P.photoBubbleSize(4000, 100), { width: 220, height: 96 }) && eq(P.photoBubbleSize(null, null), { width: 220, height: 165 }), 'very thin → minimum side; unknown size → 4:3');
ok(P.isAlreadyUploaded('The resource already exists') && !P.isAlreadyUploaded('Bucket not found'), 'retry: "already exists" counts as uploaded');
ok(P.photoSendError('chat_not_active') === 'This chat is no longer active.' && /available/.test(P.photoSendError('Bucket not found')) && /connection/.test(P.photoSendError('fetch failed')), 'errors mapped to short text');

const chat = code('app/chat.tsx');
ok(/if \(v2Enabled\) \{\s*void pickPhotoV2\(\);\s*return;\s*\}/.test(chat) && /Alert\.alert\('Coming soon', 'Photo sharing is on the way\.'\)/.test(chat), 'V2 → library pick; V1 keeps "Coming soon"');
ok(/mediaTypes: \['images'\],\s*allowsMultipleSelection: false,\s*allowsEditing: false,\s*quality: PICK_QUALITY/.test(chat) && !/launchCameraAsync[\s\S]{0,40}pickPhotoV2/.test(chat), 'one photo from the library, re-encoded (no camera / multi-select)');
ok(/setPhotoDraft\(checked\.photo\)/.test(chat) && !/pickPhotoV2[\s\S]{0,900}sendChatPhoto/.test(chat.slice(chat.indexOf('async function pickPhotoV2'), chat.indexOf('async function sendPhotoV2'))), 'picking only opens the preview (no send)');
ok(/function cancelPhotoV2\(\) \{[\s\S]{0,200}setPhotoDraft\(null\);\s*\}/.test(chat) && !/function cancelPhotoV2\(\) \{[\s\S]{0,200}setText/.test(chat), 'cancel keeps the message draft');
ok(/if \(!photoDraft \|\| !matchId \|\| !currentUserId \|\| photoInFlightRef\.current\) return;/.test(chat) && /finally \{\s*photoInFlightRef\.current = false;/.test(chat), 'synchronous send lock, released after success and failure');
ok(/const requestId = photoRequestRef\.current \?\? newRequestId\(\);/.test(chat) && /photoRequestRef\.current = newRequestId\(\);\s*setPhotoError\(null\);\s*setPhotoDraft/.test(chat), 'one request id per picked photo, kept for Try again');
ok((code('lib/chat/sync.ts').match(/\.select\('\*'\)\s*\.or\(/g) || []).length === 2 && /from '@\/lib\/chat\/sync'/.test(read('app/chat.tsx')), 'messages read with * in lib/chat/sync (works with and without the photo columns)');
ok(/item\.kind === 'photo' && item\.media_path \? \(\s*<PhotoBubble/.test(chat) && /onOpen=\{setViewerUrl\}/.test(chat), 'photo bubble in the V2 list, tap → viewer');
ok(/forgetChatPhotoUrls\(\);/.test(chat), 'ended chat drops cached photo URLs');
const api = code('lib/chat/photoApi.ts');
ok(/upload\(path, bytes, \{ contentType: photo\.contentType, upsert: false \}\)/.test(api) && /isAlreadyUploaded\(up\.error\.message\)/.test(api) && /rpc\('send_photo_message_v2'/.test(api) && /createSignedUrl\(path, URL_TTL_S\)/.test(api), 'upload (no upsert) → RPC → signed URLs');
ok(!/service_role|serviceKey|SERVICE_ROLE/i.test(api + chat + read('components/chat/PhotoSendSheet.tsx')), 'no privileged key in the client');
const sheet = code('components/chat/PhotoSendSheet.tsx');
ok(/disabled=\{sending\}/.test(sheet) && /error \? 'Try again' : 'Send photo'/.test(sheet) && /contentFit="contain"/.test(sheet), 'preview: explicit Send photo, locked while sending, Try again on error, whole photo shown');
const viewer = code('components/chat/PhotoViewer.tsx');
ok(/contentFit="contain"/.test(viewer) && /accessibilityLabel="Close"/.test(viewer), 'viewer: whole photo, close button');
const sql = read('supabase/proposed/20261020090000_v2_chat_photos.sql');
ok(/and kind = 'text' and media_path is null\s*\);/.test(sql) && /'chat-photos', 'chat-photos', false/.test(sql) && /perform 1 from matches where id = p_match for update;\s*select \* into v_row from messages where sender_id = v_me and client_request_id = p_request_id;/.test(sql), 'server: text-only direct insert, private bucket, lock-then-check idempotency');
ok(!/profile-photos-private|user-photos/.test(sql.replace(/^--.*$/gm, '')), 'V1 photo rules untouched by the package');
ok(/20261020090000_v2_chat_photos\.sql/.test(read('scripts/local-backend/setup.mjs')) && !/chat_photos/.test(read('scripts/dev-backend/apply-dev.mjs')), 'package in the LOCAL setup, not in apply-dev');

module.exports = done('v2_chat_photos');
