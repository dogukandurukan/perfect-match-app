# V2 — sign-up → application → approval → Home → the other side's full profile (result)

Date 2026-10-01 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` · Author: Claude Code.
Target: **perfect-match-dev (`fyqwjduzpnjuxqsloxih`) only**. AI HQ not touched. No merge, no key change, no account deletion, no file clean-up.

## 1. Starting point (checked, not redone)

- Branch at `5ed98a1`, clean work tree, same as origin.
- Since `a4423c7`:
  - `da92cb3`: sign-up timeouts;
  - `abf64e8`: DEV-only test sign-in with a real one-time code;
  - `9e7bd29`: 6–10 digit codes;
  - `5ed98a1`: **root cause of the phone sign-in hang** — `storageKey: undefined` made AsyncStorage store the session under an undefined key.
- Reports read: `V2_DEV_APPLY_RESULT.md`, `V2_PERSIST_R3_RESULT.md`. P0, P1 and V2 were already applied; only the new profile read was added this round.

## 2. Synthetic phone account (sign-in, saves, application)

Sign-in method (unchanged, approved 2026-09-30):
- one synthetic account, `tempa-dev-tester@tempa-test.example.com`, user `13adb65c-…`;
- a real email one-time code issued on the Mac (`scripts/dev-backend/test-login-code.mjs`), entered in the app;
- a real Supabase session with normal user rights;
- DEV builds + `dev` backend + `@tempa-test.example.com` only.

No `123456` bypass, no admin key or password in the app or repo.

**What the database shows the phone did** (after the `5ed98a1` fix, 2026-09-30 18:36–18:48). This is server evidence, not a visual check:

| Check | Server evidence |
|---|---|
| Answers + position saved | draft complete, `resume_section = yourProfile`, step 6 |
| Photos | 5 rows (positions 1–5) ↔ exactly 5 objects in the private folder, no orphan |
| Selfie | `selfie_path` set, object present in the private bucket |
| Submission not duplicated | one `submitted` event, one application row |

Not observed on the phone, only covered by the real-service tests below: resume after closing the app, reorder / delete, failed upload, rapid taps.

**Review loop on the phone account:** I requested changes as reviewer (`review.mjs changes … --items=yourProfile.photos`). The account is now `changes_requested`, with the note "Please add one more photo where your face is clearly visible." Your phone test continues from there (§7).

**E-mail / Magic Link:** not redesigned. Still open: the project's Magic Link template / SMTP for real users; the built-in mailer sends very few emails.

## 3. The other side's full V2 profile

**Server (`supabase/proposed/20261001090000_v2_public_profile.sql`, applied to dev via `apply-dev.mjs profile`):**

- `get_profile_v2(p_user)`: one SECURITY DEFINER read. Every returned field is selected explicitly; the raw `onboarding_v2` row stays owner-only (RLS unchanged).
- Returned: first name, age, zodiac, city, height, work status / job title, school, hometown, intent, values, interests, smoking, drinking, pets (+ kind), activity, artists, books, movies & series, date types, days / time, favorite spot, prompts in slot order, photo paths in the owner's order.
    - Age and zodiac are computed on the server; the date of birth is never sent.
    - This is exactly the D59 (3) list: "This is how others will see you".
- **Never returned:**
    - surname, date of birth, district, location id / label, coordinates;
    - email, phone, selfie;
    - gender / interested-in;
    - the six compatibility answers (not in the approved public preview — left closed, not opened automatically);
    - review / account state.
- **Access**, all of these must hold, otherwise `null` (the same answer as "doesn't exist"):
    - the caller is signed in;
    - the caller is the owner, **or** all of:
        - both sides are active V2 members;
        - `can_view_profile` holds — the same P0 rule that gates photo signing: no block either way, not deleted, not hidden;
        - the pair is mutually eligible (same rule as V2 discovery) **or** a `matches` row already links them.
    - Anon is denied.
- Helpers `v2_pair_eligible`, `v2_can_view_public_profile`, `v2_zodiac`: not callable by clients.
- No score, ranking or percentage. Home's fixed order (by id) is unchanged.

**App:**

- `lib/onboardingV2/yourProfile.ts`: the approved preview builder was split.
    - `buildProfilePreview` (own preview, unchanged output — P07 checks 69/69 and 56/56 still pass) now feeds `buildPublicProfileBlocks`.
    - Another member's profile uses the **same** blocks and the **same `ProfilePreview` component**.
- `serverMapping.publicProfileFromServer` + `remote.loadPublicProfile`:
    - photos are signed with the existing 15-minute URLs;
    - photos that can't be signed are dropped.
- `components/onboarding-v2/PublicProfileView.tsx`: loading / error + retry / "This profile isn't available."
- **Home:** when the candidate is a V2 member, the card body is that full profile. Like / Pass / Block / Report and swipe are unchanged. V1 candidates keep the old card.
- Empty fields and empty titles are hidden (checked).

## 4. Artist and movie images (diagnosis)

**Cause: the providers we use don't supply an image for these items.** It is not a save or render problem.

The phone account's stored items:

| Item | Source | Image stored? | Why |
|---|---|---|---|
| Book (Güvercinin Kanatları) | Open Library | yes — `imageUrl` stored and shown | Open Library supplies covers |
| Tarkan | MusicBrainz | no | MusicBrainz has no artist images (only links to other sites) |
| Esaretin Bedeli | Wikidata | no | Wikidata has no image for this film (checked: no P18) — film posters are copyrighted and usually absent |

The app keeps source + id and shows a neutral placeholder. A missing image never blocks the choice or the application.

Options for a new provider (no account, subscription or licence started; no scraping):

| Provider | Access | Terms / cost (to confirm before use) |
|---|---|---|
| Wikimedia Commons via Wikidata P18 (artists) | free, no key | each image has its own licence; attribution required; many artists have none; posters mostly missing |
| Spotify Web API (artists) | free developer app, client credentials | Developer Terms: show Spotify attribution / link back, no long-term storing of content. Extended quota for wider release reportedly needs an established organisation |
| TMDB (movies / series posters) | free API key | free for non-commercial use with attribution; **commercial use needs a TMDB commercial agreement** |

**Recommendation (your decision):**
- movies: TMDB, but only after the commercial terms are settled;
- artists: Commons via Wikidata (free, per-image attribution) or Spotify (if its terms fit);
- in both cases, match by the stored provider id, never by name.

Nothing changed this round.

## 5. Security items — current status (checked 2026-10-01, not changed)

| Item | Status | Evidence |
|---|---|---|
| Key rotation | **open** | `matches-push-notification` trigger still embeds a legacy JWT; no Vault webhook secret; `P0_KEY_ROTATION_PLAN.md` §3 still to do (owner) |
| `delete-account` redeploy | **open** | deployed function is still version 1, last updated 2026-09-15; the branch version (cleans all three buckets) is not deployed |
| Old public photo copy | **open** | `user-photos` bucket is still public and holds 1 object (the moved legacy photo) |

## 6. Tests

| Suite | Where | Result |
|---|---|---|
| `smoke_v2.mjs` (2 new synthetic accounts, run `c614c7`) | **real services** on perfect-match-dev | **83 / 83** |
| `smoke.mjs --stage p0b` | real services | 37 / 37 — first run 36/37: realtime timing (known intermittent, no relation to this change) |
| `http_v2.test.mjs` | local replica | **164 / 164** |
| Onboarding UI logic (P06 · P07 R1 · P07 R2 · new public profile) | local | 45/45 · 69/69 · 56/56 · **6/6** |
| V2 mapping · `tsc --noEmit` | local | 21/21 · clean |

`smoke_v2.mjs` (83/83) covered, beyond the previous 71 checks:
- A and B open each other's profile with exactly the allowed fields;
- no surname, DOB, district, location id, email, selfie, gender or compatibility answer in the response;
- photos come back in the owner's order and load;
- the raw draft stays owner-only; anon is denied;
- a pending applicant cannot open a member profile;
- block → neither side; unblock → open again; hidden → gone; deleted → gone (all restored afterwards).

The local replica (164/164) additionally checks:
- each ineligible reason one by one;
- that profile eligibility equals the discovery list;
- that a match row keeps the profile open, and that a block then closes it.

**Telefonda doğrulanmadı:** the V2 Home full-profile view and the review loop on the device. They are ready for your phone check.

Test data added for the phone check (synthetic only): member `67acc178-…` got a custom school, hometown, artist and series, plus an Open Library book, so that every profile section appears.

## 7. Phone

One command (stop any running Metro first):

```
~/tempa-p0/scripts/dev-backend/start-app.sh
```

On the signed-out screen, press **DEV · Test account sign-in** and type the code the command printed. If the code expired, get a new one with `node scripts/dev-backend/test-login-code.mjs`.

Checklist:
1. After sign-in you land in the flow with the note "Please add one more photo…". Earlier answers and the 5 photos are there.
2. Add a photo → close and reopen the app → 6 photos, same order. Then **Submit application** → "You're on the list!". Tell me, and I accept.
3. After acceptance: Home, with no percentage or "Why you match".
4. The card shows the full profile: name/age on the photo, prompts, About, Looking for / values / interests, Lifestyle, First dates, and for one of them Artists / Books / Movies. No surname, district or selfie.
5. Block that person → they're gone from Home.
