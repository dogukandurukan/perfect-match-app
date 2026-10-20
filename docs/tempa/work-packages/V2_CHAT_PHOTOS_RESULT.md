# V2 chat photos — first package (result)

Date 2026-10-20 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `aad879a` (clean, same as origin) · Author: Claude Code.
**Target:** tempa-local only. Shared DEV / production, other local projects, merge, deploy and DB reset are out of scope.

**Flow (V2 chat):**
1. + → **Add a photo** → one photo from the **library**.
2. **Preview** → explicit **Send photo**.
3. The photo appears as a **bubble**; tap it → **full screen**.

Not in this package: camera, video, multi-select, caption. V1 is unchanged (its Add a photo still shows "Coming soon").

## What existed

**`messages`:**
- Text only: `content` is NOT NULL, no media columns, no triggers.
- RLS select: sender or receiver.
- RLS insert: the sender, with an accepted match, not blocked and not suspended.
- Update: only `read_at`, by the receiver.

**Storage:**
- V1 / V2 profile buckets (`user-photos`, `profile-photos`, `profile-photos-private`, `verification-selfies`), each with its own policies. **Not touched.**
- There was no chat media bucket.

**Client:**
- `expo-image-picker` and `expo-image` are installed.
- **`expo-image-manipulator` is not**, and adding it means a new native module plus a dev-client rebuild.

## Server — `supabase/proposed/20261020090000_v2_chat_photos.sql` (LOCAL)

**`messages` columns:**
- New: `kind` (`text` | `photo`, default `text`), `media_path`, `media_width`, `media_height`, `client_request_id`.
- Shape check: text → no media; photo → path plus a 1–20000 px size.
- Unique: (sender, request id) and media path.

**Insert RLS:** the old rule word for word, **plus `kind = 'text' and media_path is null`**. A photo message can only come from the RPC.

**Bucket `chat-photos`:**
- Private, 10 MB, jpeg / png / heic / webp. Path: `<match>/<sender>/<request id>.<ext>`.

**Storage policies:**
- **upload:** you, into your own folder, in an **active** chat (`v2_chat_active`);
- **read:** participants while the history is readable (`v2_chat_state` active / unavailable), and only a file that a message points to (or your own upload);
- no update or delete for clients.

**`send_photo_message_v2(match, path, width, height, request_id)`** (SECURITY DEFINER, authenticated only). In order, it:
1. locks the match row, then looks up the request id, so parallel identical calls return one message;
2. checks the chat is active;
3. checks the path equals this match / this sender / this request id;
4. checks the size;
5. checks the object exists;
6. inserts with the text fallback **"📷 Photo"**, so Chats previews and older clients stay readable.

The request id is not returned to clients.

**Applied to tempa-local** in one transaction:
- Backup first: `~/tempa-backups/2026-10-20-before-chat-photos/`, `pg_dump -Fc`, readable by `pg_restore --list` (74 table-data entries).
- Fingerprint (row counts + a message-content hash) **identical** before and after; the 61 existing messages are now `kind = text`.
- Recorded as local migration `00000000000024`, added to `setup.mjs`; **not** in `apply-dev.mjs`.

## App

**`lib/chat/photo.ts` (pure):**
- **File check:** JPG / PNG / HEIC / WebP by MIME type, else by extension; GIF, video and other types get a clear message. Over 10 MB → "too large". No size → "couldn't be read".
- **Path builder** and **bubble size:** keeps the aspect ratio within 220 × 280, with a 96 pt minimum side.
- **Error texts** and **"already uploaded"** detection.

**`lib/chat/photoApi.ts`:**
- Upload: `upsert: false`; "already exists" on a retry counts as uploaded.
- Then the RPC.
- Signed URLs: 1 h, cached, cleared when a chat ends.

**`PhotoSendSheet`:**
- Full-screen ivory preview with the whole photo, "Send to {name}?" and **Send photo**.
- While sending, Cancel and Send are locked and the button shows "Sending…".
- On failure: the error shows and the button reads **Try again**.

**`PhotoBubble`:**
- Aspect-ratio bubble with a signed URL, a placeholder while loading and "Tap to retry" on a load failure.

**`PhotoViewer`:** full screen, black, whole photo, × to close (light status bar).

**`app/chat.tsx` (V2 only):**
- `handleAddPhoto` → `pickPhotoV2`. Settings: library, one image, no editing, quality 0.7, `Compatible` representation. HEIC becomes JPEG.
- **Picking only opens the preview.**
- **Cancel keeps the typed draft.**
- **Send:** a synchronous in-flight lock, released after success **and** failure. **One request id per picked photo**, kept across Try again. The sent row is added to the list at once and scrolled into view, as for text.
- Messages are now read with `select('*')`, so servers without the new columns still work. A named missing column would fail the whole select.
- Text messages, date suggestions, keyboard and scrolling are unchanged.
- **+ sheet:** subtitle "Choose one from your library" (no camera claim).

**Resizing (honest limit):**
- The picker re-encodes to JPEG at quality 0.7, which shrinks large photos and converts HEIC, but the **pixel size stays the same**. The bucket's 10 MB limit and the client check catch anything larger.
- True downscaling (for example to 2048 px) needs `expo-image-manipulator`, a new native module and a dev-client rebuild. Proposed as a follow-up.

## Checks

| Run | Result |
|---|---|
| `smoke_chat_photos_local.mjs` (new; fresh synthetic A / B / C, real local services) | **24/24** — see the list below |
| `smoke_activity_local` (after the policy change) | 44/45 on the first run (known Realtime delivery timeout), then **45/45 twice** |
| `smoke_matches_local` | 18/18 (incl. first message over Realtime) |
| `node scripts/onboarding-v2-checks/run.js` | all pass; new `v2_chat_photos` **28/28** |
| `p0-checks` · `tsc --noEmit` | all pass · clean |
| `npx expo export --platform ios` (LOCAL) | exit 0; bundle contains the new flow |

What `smoke_chat_photos_local` covers:
- **Upload:**
  - third account / wrong folder / malformed name / GIF refused;
  - a re-upload of the same path → "already exists".
- **Send:**
  - a direct photo insert is refused; text still works;
  - a wrong request path, a missing upload and a third account are refused;
  - **double tap + retry → one message, every call returns it**.
- **View:**
  - receiver and sender open it (same bytes);
  - **third account and signed-out / public URL refused**;
  - an unsent upload is invisible to the other person.
- **Other:** the Chats preview reads "📷 Photo"; after unmatch, no viewing and no new upload.

Test data: only the fresh synthetic accounts of each smoke run (`tempa-local-photo-<tag>-*`, `tempa-local-act-<tag>-*`, …) and their photos / messages. **The Mert / Defne phone accounts were not touched.**

## Open

- The intermittent Realtime timeout (still open): it showed again on the first Activity smoke after a pause. It is not caused by this package: Realtime authorises by the unchanged SELECT rule. That is not proven.
- **Orphans:** a photo uploaded but never sent (the user cancels after a failed send) stays in the bucket, invisible to the other person. A clean-up job is a follow-up.
- Pixel downscaling (see above).
- Push notifications for photo messages: no message push exists today.

## Phone verification (owner, 2026-10-20, LOCAL)

**Passed on the phone:**
- Mert sends a photo; Defne sees it.
- Full screen opens and closes.
- Cancelling the preview keeps the typed draft.
- With the connection cut, Send fails; Try again after reconnecting leaves **one** photo.

**Not reported:** HEIC and very-large-photo cases.

The original phone checklist is kept below for reference.

## Phone test checklist

1. Mert → Defne chat → **+ → Add a photo** → pick a photo.
   - The preview shows it whole and nothing is sent yet.
   - **Cancel** → back in the chat, with the typed draft intact.
2. Pick again → **Send photo**.
   - "Sending…", then a bubble with the right aspect ratio.
   - Tap it → full screen → ×.
3. Defne's phone: the photo bubble appears (Realtime, or on reopening) and opens full screen.
4. A HEIC photo from the iPhone camera roll sends; a very large photo either sends or shows "too large".
5. Airplane mode → Send → error + **Try again** → back online → Try again → **one** message.
6. Text messages, date suggestions, the keyboard and scrolling behave as before.
