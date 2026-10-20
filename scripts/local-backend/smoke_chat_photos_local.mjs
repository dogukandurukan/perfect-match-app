// V2 chat photos on the LOCAL Supabase (real Postgres + Auth + Storage +
// PostgREST, real JWTs), synthetic accounts only:
//   node scripts/local-backend/smoke_chat_photos_local.mjs
// Needs: setup.mjs with 20261020090000_v2_chat_photos.sql. Every run creates
// FRESH synthetic people (tempa-local-photo-<tag>-*); the phone accounts are
// never touched.
//
//   A (woman) likes B's photo → B Match & chat → active chat
//   B (man)   sends a photo   (upload → send_photo_message_v2)
//   C (woman) unrelated third account — refused everywhere
import crypto from 'node:crypto';
import { renderPortraits } from '../dev-backend/portraits.mjs';
import { admin, env, ensureMember, LOOKS } from './_local.mjs';

let passed = 0;
let failed = 0;
const check = (c, n) => {
  if (c) { passed += 1; console.log('ok  ', n); }
  else { failed += 1; console.log('FAIL', n); }
};
const BUCKET = 'chat-photos';
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

async function main() {
  const tag = Date.now().toString(36);
  const mail = (k) => `tempa-local-photo-${tag}-${k}@tempa-test.example.com`;
  const woman = (k, first, i) => ({ email: mail(k), first, gender: 'woman', interested: ['men'], dob: `199${i}-05-1${i}`, city: 'İstanbul', district: 'Kadıköy', look: LOOKS[i] });
  const A = await ensureMember(woman('a', 'Defne', 1));
  const C = await ensureMember(woman('c', 'Third', 4));
  const B = await ensureMember({ email: mail('b'), first: 'Mert', gender: 'man', interested: ['women'], dob: '1994-02-02', city: 'İstanbul', district: 'Kadıköy', look: LOOKS[5] });

  // Match through the normal path (A likes B's photo, B accepts).
  const prof = (await A.c.rpc('get_profile_v2', { p_user: B.uid })).data;
  const lk = (await A.c.rpc('send_like_v2', { p_likee: B.uid, p_target_type: 'photo', p_target_id: prof.photos[0].id, p_note: null, p_request_id: crypto.randomUUID() })).data;
  const likeId = (await admin.from('likes').select('id').eq('liker_id', A.uid).eq('likee_id', B.uid).single()).data?.id;
  const acc = (await B.c.rpc('accept_like_v2', { p_like: likeId })).data;
  const matchId = acc?.match_id;
  check(lk?.ok && acc?.ok && !!matchId, 'setup: A likes B, B Match & chat → active chat');

  const img = renderPortraits(LOOKS[2])[0];
  const { w, h } = pngSize(img);
  const req = crypto.randomUUID();
  const path = `${matchId}/${B.uid}/${req}.png`;

  // Upload rules.
  const cUp = await C.c.storage.from(BUCKET).upload(`${matchId}/${C.uid}/${crypto.randomUUID()}.png`, img, { contentType: 'image/png' });
  check(!!cUp.error, 'third account cannot upload into the pair’s chat');
  const wrongFolder = await B.c.storage.from(BUCKET).upload(`${matchId}/${A.uid}/${crypto.randomUUID()}.png`, img, { contentType: 'image/png' });
  check(!!wrongFolder.error, 'B cannot upload into A’s folder');
  const badName = await B.c.storage.from(BUCKET).upload(`${matchId}/${B.uid}/not-a-uuid.png`, img, { contentType: 'image/png' });
  check(!!badName.error, 'malformed file name refused');
  const gif = await B.c.storage.from(BUCKET).upload(`${matchId}/${B.uid}/${crypto.randomUUID()}.png`, img, { contentType: 'image/gif' });
  check(!!gif.error, 'unsupported type (gif) refused by the bucket');
  const up = await B.c.storage.from(BUCKET).upload(path, img, { contentType: 'image/png', upsert: false });
  check(!up.error, 'B uploads the photo into his own folder of the active chat');
  const upAgain = await B.c.storage.from(BUCKET).upload(path, img, { contentType: 'image/png', upsert: false });
  check(!!upAgain.error && /exist|duplicate/i.test(upAgain.error.message), 'retrying the upload of the same path → "already exists" (the app treats it as uploaded)');

  // Send rules.
  const direct = await B.c.from('messages').insert({ sender_id: B.uid, receiver_id: A.uid, content: 'x', kind: 'photo', media_path: path, media_width: w, media_height: h });
  check(!!direct.error, 'a photo message cannot be inserted directly (RLS: text only)');
  const text = await B.c.from('messages').insert({ sender_id: B.uid, receiver_id: A.uid, content: 'Text still works' }).select('id, kind').single();
  check(!text.error && text.data.kind === 'text', 'text messages unchanged (kind text by default)');
  const otherReq = await B.c.rpc('send_photo_message_v2', { p_match: matchId, p_path: path, p_width: w, p_height: h, p_request_id: crypto.randomUUID() });
  check(!!otherReq.error && /invalid_photo_path/.test(otherReq.error.message), 'path must belong to this request id');
  const missing = crypto.randomUUID();
  const notUp = await B.c.rpc('send_photo_message_v2', { p_match: matchId, p_path: `${matchId}/${B.uid}/${missing}.png`, p_width: w, p_height: h, p_request_id: missing });
  check(!!notUp.error && /photo_not_uploaded/.test(notUp.error.message), 'nothing uploaded → refused');
  const cSend = await C.c.rpc('send_photo_message_v2', { p_match: matchId, p_path: path, p_width: w, p_height: h, p_request_id: req });
  check(!!cSend.error, 'third account cannot send into the chat');

  const taps = await Promise.all([0, 1].map(() => B.c.rpc('send_photo_message_v2', { p_match: matchId, p_path: path, p_width: w, p_height: h, p_request_id: req })));
  const retry = await B.c.rpc('send_photo_message_v2', { p_match: matchId, p_path: path, p_width: w, p_height: h, p_request_id: req });
  const rows = (await admin.from('messages').select('id, kind, media_path, media_width, media_height, content').eq('media_path', path)).data ?? [];
  check(taps.every((t) => !t.error) && taps.filter((t) => t.data.already === false).length === 1 && retry.data?.already === true && rows.length === 1,
    'double tap + retry (same request id) → one message; every call returns it, no error');
  check(rows[0]?.kind === 'photo' && rows[0].media_width === w && rows[0].media_height === h && rows[0].content === '📷 Photo', 'photo message: kind, size and text fallback stored');
  check(!('client_request_id' in (taps[0].data ?? {})), 'request id not returned to clients');

  // Viewing rules.
  const aMsg = (await A.c.from('messages').select('*').eq('media_path', path)).data ?? [];
  check(aMsg.length === 1 && aMsg[0].kind === 'photo', 'A (receiver) reads the photo message');
  const aUrl = await A.c.storage.from(BUCKET).createSignedUrl(path, 600);
  const aGet = aUrl.data?.signedUrl ? await fetch(aUrl.data.signedUrl) : null;
  check(!aUrl.error && aGet?.status === 200 && Number(aGet.headers.get('content-length') ?? img.length) === img.length, 'A opens the photo (signed URL, same bytes)');
  const bUrl = await B.c.storage.from(BUCKET).createSignedUrl(path, 600);
  check(!bUrl.error && !!bUrl.data?.signedUrl, 'B (sender) opens it');
  const cUrl = await C.c.storage.from(BUCKET).createSignedUrl(path, 600);
  const cDl = await C.c.storage.from(BUCKET).download(path);
  check(!!cUrl.error && !!cDl.error, 'third account cannot open it (no signed URL, no download)');
  const cMsg = (await C.c.from('messages').select('id').eq('media_path', path)).data ?? [];
  check(cMsg.length === 0, 'third account cannot read the message');
  const anon = await fetch(`${env.url}/storage/v1/object/${BUCKET}/${path}`, { headers: { apikey: env.anonKey } });
  const pub = await fetch(`${env.url}/storage/v1/object/public/${BUCKET}/${path}`);
  check(anon.status >= 400 && pub.status >= 400, 'signed-out / public URL refused (private bucket)');
  const unsent = crypto.randomUUID();
  await B.c.storage.from(BUCKET).upload(`${matchId}/${B.uid}/${unsent}.png`, img, { contentType: 'image/png' });
  const aUnsent = await A.c.storage.from(BUCKET).createSignedUrl(`${matchId}/${B.uid}/${unsent}.png`, 600);
  check(!!aUnsent.error, 'an uploaded but unsent photo is not visible to the other person');

  const preview = (await A.c.rpc('get_my_matches_v2')).data?.find((m) => m.match_id === matchId);
  check(preview?.last_message === '📷 Photo', 'Chats preview reads "📷 Photo"');

  // Ended chat: photos close for both.
  const un = await B.c.rpc('unmatch_v2', { p_match: matchId });
  const aAfter = await A.c.storage.from(BUCKET).createSignedUrl(path, 600);
  const bNew = await B.c.storage.from(BUCKET).upload(`${matchId}/${B.uid}/${crypto.randomUUID()}.png`, img, { contentType: 'image/png' });
  check(!un.error && !!aAfter.error && !!bNew.error, 'after unmatch: no viewing, no new upload');

  console.log(`smoke_chat_photos_local (local Supabase, real services): ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
