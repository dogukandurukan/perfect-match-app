# R-P0 phone test — separate TEST project

Branch `tempa/p0-privacy-r3`. It contains the accepted R2 onboarding
unchanged: it branches from `e0dd960`, after R2 `be78b0b`, and the R2 logic
checks still pass 56/56.

**Backend for this test: a SEPARATE Supabase test project, never live.**
- The app shows a green `TEST · <ref>` badge at the top of every screen.
- A red `LIVE · …` badge means you are on the wrong backend → stop.
- If the test settings are missing or wrong, the app refuses to start. It never falls back to live.

Only sanitized schema and synthetic people are used. Nothing is copied from live: no data, no webhook, no push target, no key.

## 1. One-time setup (only the first step needs you)

1. **You (Dashboard):** create a new project, e.g. `tempa-test`, any region, free plan. Then fill `~/tempa-p0/.env.test.local` from `scripts/test-backend/env.example`:
   - Settings → API: URL, `anon` key, `service_role` key.
   - Settings → Database → Connection string: URI, session pooler, with the password.

   This file is git-ignored. Its values are never printed by the scripts.
2. Then either of us runs, from `~/tempa-p0`:
   ```
   node scripts/test-backend/apply.mjs base      # sanitized live schema, no data
   node scripts/test-backend/apply.mjs p0a       # P0-A + private photo bucket
   node scripts/test-backend/seed.mjs            # synthetic people + 2 phone accounts
   node scripts/test-backend/smoke.mjs --stage p0a
   ```
   - Every script refuses a live URL, a live key or a live DB string.
   - `smoke.mjs` checks the real Auth, REST, Storage and Realtime:
     - visibility rules;
     - a 15-minute signed URL: it loads, fails after it expires, and works again after re-signing;
     - invite → accept → live message;
     - block.
3. Phone logins (Deniz = Tester A, man; Ada = Tester B, woman): `.test-backend/accounts.local.json`. The passwords exist only in that file.
4. Start Metro for the test project: `scripts/test-backend/start-app.sh`. Open the dev client as usual; no rebuild is needed because there are no new native modules.

## 2. Seeded people (what you should and should not see as Deniz)

| Person | Situation | Deniz should see |
|---|---|---|
| Ece, Selin | visible | in Home; photo loads |
| Ada | visible (the second phone account) | in Home |
| Zeynep | hidden, has an **accepted** chat with Deniz | in Chats with photo; not in Home |
| Melis | hidden, sent Deniz a **pending** invite | nowhere: not in Home, Matches/Plans, Activity or Chats |
| Buse | hidden, liked Deniz | nowhere: not in Liked-you, not in the count |
| Lara | visible, liked Deniz | in Liked-you (Deniz is premium) |
| Nil | blocked Deniz | nowhere |

## 3. Scenarios

One phone is enough: log out and in between Deniz and Ada. A second device works too. After each step, note ✅ or ❌ and a screenshot of anything wrong.

**A. Environment and profile viewing (Deniz)**
1. The badge reads `TEST · <ref>`.
2. Home: cards show **city only** ("Istanbul"). No district and no "Nearby" reason anywhere.
3. Open Ece's profile:
   - no surname, no district;
   - "Looking for" is shown;
   - photos load.
4. Activity:
   - Liked-you shows Lara only, count 1;
   - no card about Melis, Buse or Nil.
5. Chats: Zeynep's chat is there with her photo; the message thread loads.
6. Filters: there is no "Same district / Same neighbourhood" option any more.

**B. Hiding (Ada)**
1. Ada: Settings → hide profile.
2. Deniz: Home no longer shows Ada, after a pull-to-refresh or a relaunch.
3. Ada: un-hide. Deniz sees her again.

**C. Mutual invite, man accepts → chat opens (new rule)**
1. Ada: Matches → Deniz → Plan a date:
   - place list title is "Suggested places", labels only "Near you";
   - pick a time → send.
2. Ada's side: the chat does **not** open yet. Messaging is not possible.
3. Deniz: Activity → "Ada wants to meet" → pick a time → ✓.
   - Expected: the chat opens for Deniz (a man accepting). Before this change it stayed closed.
4. Ada: Chats shows Deniz; the chat is open.

**D. Chat and live messages**
1. Send messages both ways. With two devices they arrive live; with one phone they are there after switching accounts.
2. Meetup card: propose a time on one side, confirm on the other. Proposing and confirming on the same side is refused.

**E. Blocking (Deniz blocks Ada)**
1. From Ada's profile → Block.
2. Deniz: Ada disappears from Chats, Home, Matches and Activity. No photo of her anywhere.
3. Settings → Blocked users: "Ada" with an **initial only**, no photo. Unblock → she comes back.
4. Ada, while blocked: Deniz is not visible anywhere; a message can't be sent.

**F. Signed photos (15 min)**
1. Open Ece's profile, leave the app on it for ~16 minutes.
2. Go back and re-open it. The photos load again: a new URL is signed.
3. An image already on screen does not disappear when its URL expires. This is the known, accepted limit: already-issued URLs and the device cache can't be revoked instantly.

**G. R2 onboarding still intact**
- From the DEV entry point, open the onboarding V2 preview.
- Check photos (3×2 grid, drag) and prompts as accepted in R2.

## 4. After the phone test

- If everything passes: `node scripts/test-backend/apply.mjs p0b` → `smoke.mjs --stage p0b` → repeat **A** and **E** briefly.
- Then we assess the exact live package together. Nothing is applied to live before that.
