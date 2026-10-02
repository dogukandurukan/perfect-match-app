# V2 backend + scoring audit (read-only)

Date 2026-10-02 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` at `0680d4b` (clean, same as origin) · Author: Claude Code.
Target: perfect-match-dev (`fyqwjduzpnjuxqsloxih`) only.

Scope of this round:
- **Read-only.** No product change, deploy, key change, deletion or reset; AI HQ not touched; no secrets in this file.
- Evidence comes from the running code on this branch, the live dev catalog (function definitions, triggers, counts) and the earlier test reports.
- Not to be confused with the planning document `docs/tempa/V2_BACKEND_SCORING_AUDIT.md` (2026-09-29, proposals). It is cited below as "planned".

The phone test data is untouched:
- the phone account `13adb65c-…` still has its accepted match with "Test" (chat open);
- 1 message (the icebreaker you sent) and 0 date suggestions;
- 3 likes, one of them on a pool member at 2026-10-01 20:22 UTC.

## 1. Data sources and server paths per screen (V2 backends = `TEMPA_BACKEND=dev|test`)

| Screen | V2 path (dev / test) | V1 / legacy dependencies still present |
|---|---|---|
| **Discover** (`app/(tabs)/index.tsx`) | V2 member → `get_discovery_candidates_v2` (eligibility only), card body = `PublicProfileView` → `get_profile_v2`; like = `likes` upsert (`target_type='profile'`); block → `blocks`, report → `reports`; quota → `increment_daily_views` / `profiles.daily_views_*` | a non-V2 account on the same backend still gets the V1 feed `get_discovery_cards` → `get_top_matches` (scored, §2) |
| **Matches** (`components/main/V2MatchesScreen.tsx`) | `get_my_matches_v2`, `get_my_date_plans_v2` → chat / `/v2/profile` | the legacy screen (`get_discovery_cards`, `upsert_match`, invites) is rendered **only** when `v2Enabled` is false (live build) |
| **Likes you** (Activity) | `get_my_liker_cards` (identity only when premium; visibility via `can_view_profile`), card tap → `/v2/profile` (`get_profile_v2`) | the liker photo / age come from the **`profiles` projection** (`photos[1]`, `date_of_birth`), not the V2 tables |
| **Activity** (`notifications.tsx`) | `notifications` (incl. `mutual_match`, `date_proposed`, `date_accepted`); legacy invite types hidden on V2 | names / photos via `profile_cards` (the P0 view over `profiles`); the old invite / featured-card code is still in the file (hidden on V2) |
| **Chats tab** (`messages.tsx`) | `matches` (`chat_opened = true`), `messages`, `profile_cards` | **not V2-aware:** it filters only `chat_opened`, so **unmatched (`passed`) and blocked chats stay listed**. Opening them shows "This conversation has ended" (the server refuses messages and suggestions), but the list disagrees with Matches |
| **Chat** (`app/chat.tsx`) | messages + realtime; `get_chat_v2` (active flag + suggestion cards); `propose_date_v2` / `respond_date_v2` / `unmatch_v2`; profile → `/v2/profile` | header / own photo and name via `profile_cards` / `profiles` (projection); icebreaker on `profiles.quick_icebreaker_answers` |
| **Suggest a date** (`components/chat/SuggestDateSheet.tsx`) | day / time / place chosen by the user; `propose_date_v2` / `respond_date_v2` | none on V2 (the V1 `suggestMeetingTimes` / availability path runs only in the live build) |
| **Own profile** (`V2ProfileHome`) | `get_my_onboarding_v2`, `/v2/profile` (`get_profile_v2`) | the V1 editor is unreachable for V2 members |

**The `profiles` projection is a one-off copy at acceptance.** `review_application_v2('accept')` writes `first_name`, `date_of_birth`, `city` and `photos` into `profiles`, and Chats / Activity / Likes you / chat header read those copies.
- Today this is consistent, because members cannot edit after approval.
- **If post-approval editing is opened, this copy goes stale** unless it is refreshed on every edit, or those screens move to V2 RPCs.

**Earlier open items:**
- **Likes you → profile link: closed.** On V2 the card opens `/v2/profile` with server-side field selection and visibility (`c0902cb`). The premium-unlocked tap itself was not run on real services, because all synthetic accounts are non-premium.
- **Date times' V1 dependency: closed.**
    - Since `0680d4b` the V2 sheet has no V1 availability input and no preference-derived ideas; the user picks day and time.
    - Past and too-near times are refused on the client (≥ 5 min) and the server refuses past times (`invalid_time`).
- **The old V1 profile screen `/user-profile`** is reached only from the legacy Map / Vibe screens (hidden from the tab bar) and from V1-only branches; no V2 path opens it.

## 2. Scoring

**Active scoring exists — but only on the V1 path.** `public.get_top_matches(p_user_id, p_limit)` (SECURITY DEFINER, live on dev) is called by `get_discovery_cards`. That serves the V1 Home feed (non-V2 accounts) and the legacy Matches screen (live build only).

**Fields** (V1 `profiles` columns + `onboarding_answers.intent`, all V1 data) and **weights:**

| Term | Points |
|---|---|
| location | same district 20 / same city 8 |
| age gap | ≤2 → 20, ≤4 → 10, ≤6 → 5, else −5 |
| intent | same 40; `not_sure_yet` 20; casual↔open 10; `just_friends` 5 |
| morning / night | 15 |
| recharge style | 15 |
| hobbies | 5 each, max 25 |
| availability overlap | ≥4 → 15, ≥2 → 8, ≥1 → 3 |
| drinking | same 10 … opposite −6 |
| smoking | same 10 … opposite −6 |
| education | 8 |
| languages | ≥1 → 5 |
| meeting environment | ≥2 → 12, ≥1 → 6 |
| zodiac | top-3 pair 5, same element group 2 |
| favourite spot | 5 |

How the terms combine:
- the lifestyle part (morning / night … favourite spot) is **capped at 65**;
- **adjusted** = raw × completeness multiplier (0.85 + 0.15 × filled / 9);
- **sort only** (not in the %): verified +15, "liked me" +40;
- **%** = round(adjusted / 140 × 100), floored at 20, capped at 99 (85 when the age term is negative);
- category: ≥80 / ≥60 / ≥40 / else.

**Exclusion rules:**
- same user; `setup_completed`; not hidden, not deleted; same city;
- `discovery_max_distance` (same district);
- verified-only, non-smokers-only, height, zodiac, pets, education and religion lists, active today;
- match-row cool-downs (pending / accepted, expired < 14 d, passed < 42 d);
- blocks both ways; mutual `meeting_preferences` ↔ `gender` (V1 values `Women` / `Man` …);
- the wrapper also requires `is_active_member` on both sides.

Who sees it:
- the "N% match", category and reasons are shown only on the V1 Home card and the legacy Matches cards;
- **V2 members never reach this function.** V2 projections don't set the V1 `gender` / `meeting_preferences`, so V2 members also don't appear in V1 feeds.

**V2 Discover is still unscored with a fixed order.** `get_discovery_candidates_v2` applies eligibility only:
- both active V2 members; not hidden, not deleted; no block;
- mutual `interested_in` ↔ `gender`; mutual age range; same city;
- since `b35196c`: no existing accepted / passed match; since `0680d4b`: not already liked by me;
- ordered by `user_id`; it returns no score, percentage or reason.

`get_profile_v2`, `get_my_matches_v2` and `get_my_date_plans_v2` produce no score either.

**Planned vs running:**
- The planning audit (2026-09-29) proposed `get_top_matches_v2` with V2 fields, soft points and real reasons, and listed open decisions: weights, intent partial credit, server height range. **None of it is implemented.**
- `match_pair_scores` (named in older notes) **does not exist** on dev.
- No scoring was opened or added in this round.

## 3. Photo / prompt likes with an optional note

**The database and API already support it** (`likes` table, applied 2026-08-16):
- `target_type in ('photo','prompt','profile')`, free `target_key`, `note` up to 240 chars, one row per liker → likee (`unique`);
- the client writes with an upsert under RLS + `guard_like_client_writes` (status `sent`, visibility via `can_like_internal`);
- `handle_mutual_like` turns notes into the first chat messages on a mutual like;
- `get_my_liker_cards` returns `target_type` / `target_key` / `note` to premium likees.

**What V2 actually does:** a profile-level like only.
- `PublicProfileView` has no per-photo / per-prompt like or note control, so V2 likes are always `target_type='profile'` with no note.
- On dev: 8 likes, all `profile`; 2 have a note, from V1 test data.

**Difference:** a profile like says "I like you"; a targeted like names *what* (a photo or a prompt) and can carry a note that becomes the opening message.

**Missing for V2:**
1. UI: like / note buttons on V2 photo and prompt blocks.
2. A stable V2 target key (e.g. a `profile_photos_v2.id` or a prompt slot / `prompt_id`) and **server validation that the key belongs to the likee** — `target_key` is unchecked free text today.
3. A product decision: one like per person (current unique) vs one per item; and whether notes stay free while seeing them stays premium.
4. "Likes you" showing what was liked (the target) for V2 items.
5. Moderation / report path for note text.

## 4. Test evidence (not re-run this round)

| Area | Real services (dev) | Local | Phone |
|---|---|---|---|
| Onboarding persistence (answers, resume, photos, selfie, failed save / upload, idempotent submit) | `smoke_v2.mjs` 83 / 83 (last 2026-10-01) | replica `http_v2` 210 / 210 (last run R3); UI logic 45 / 69 / 56 | **yes (server-side evidence):** the phone account saved all answers, 5 photos (DB ↔ Storage consistent), a selfie, one submission |
| Application / review loop | `smoke_v2.mjs` (changes → resubmit → accept) | replica | **yes:** phone events submitted → changes_requested → submitted → accepted (the 6th photo asked for was not added; persistence after an app restart not observed) |
| Profile access (fields, block / hide / delete / ended) | `smoke_v2.mjs`, `smoke_match_chat_v2.mjs` 51 / 51, `seed-dev-pool --verify` 18 / 18 | replica; public-profile UI 6 / 6 | design approved by you on the phone (own preview); the other side's full profile seen on Discover |
| Mutual like → one match + chat | `smoke_match_chat_v2.mjs`, `smoke.mjs` P0 38 / 38 | replica | **yes:** a real match with "Test", and you sent a message from the phone |
| Date suggestion / counter / accept / unmatch, server rules | `smoke_match_chat_v2.mjs` 51 / 51 | replica; suggest-a-date helpers 10 / 10 in 4 time zones | **not yet:** 0 suggestions exist for the phone account; the new sheet, the cards and `date-partner.mjs` are untried on the device |
| Discover pool + skip-liked | `seed-dev-pool.mjs` (+ re-run 0 created), `--verify` 18 / 18 | replica skip-liked checks | **partly:** a pool member was liked from the phone after seeding; the new theme and sheet are not yet seen |

## 5. Open items — current evidence (2026-10-02)

| Item | Status | Evidence |
|---|---|---|
| Post-approval profile editing | **open — product decision needed** | `v2_assert_editable` still allows edits only in `draft` / `changes_requested` (checked live); the app shows "Editing after approval isn't available yet". The decision also affects the `profiles` projection (§1) |
| Magic Link / real e-mail sign-in return | **open, not verified** | V2 sign-in uses the e-mail code (`signInWithOtp` → `verifyOtp`), with no `emailRedirectTo` and no deep-link handling of a magic link for V2. Dev issues **7-digit** codes (the UI accepts 6–10). Real e-mail delivery has never been tried on the phone (the DEV test sign-in was used). The project's e-mail template / SMTP can't be read with the tools used here; check it in the Dashboard |
| Push for new matches and date suggestions | **open** | no trigger on `notifications` or `date_proposals_v2`; the only push path is the `matches-push-notification` webhook → `send-push-notification` v6, reacting to invite fields / `chat_opened` on UPDATE. A fresh mutual-like match (INSERT) and date events get no push. `send-meetup-reminders` v6 + hourly cron does read `matches.meeting_at`, which accepted V2 suggestions write |
| Key rotation / legacy-key webhook | **open** | the `matches-push-notification` trigger still embeds a legacy JWT (1 match on the `eyJ…` pattern; not printed); 0 Vault webhook secrets |
| `delete-account` | **open** | deployed version 1, last updated 2026-09-15; the branch version (cleans all three buckets) is not deployed |
| Old public photo copy | **open** | `user-photos` is still public with 1 object |
| Artist / film images | **open — provider decision** | unchanged since the comparison in `V2_PROFILE_INTEGRATION_RESULT.md`: MusicBrainz / Wikidata store no image (books have Open Library covers) |
| Synthetic pool + images | **in place** | 18 `tempa-pool-NN` accounts, all accepted / active; 54 photo rows ↔ 54 private objects; generated "DEV · SYNTHETIC" portraits. **Also present:** 7 older synthetic V2 members ("Test", solid-colour PNGs from earlier smoke runs) that can still appear in Discover; 40 synthetic auth users in total |

**Accounts:** 6 non-synthetic auth users, all matching the owner's address pattern (4 created on 2026-09-30 during the sign-up hang); no unexpected real user. Cron jobs: `expire-matches` and `daily-meetup-reminders`, both hourly.

## 6. Decisions that affect the next work

1. **Post-approval editing:**
    - whether members may edit after approval, and which changes trigger re-review;
    - once decided, the `profiles` projection must be refreshed on edit, or Chats / Activity / Likes you must move to V2 reads.
2. **V2 scoring:**
    - V2 Discover is deliberately unscored;
    - any ranking needs the open weight decisions from the planning audit;
    - V1 `get_top_matches` stays V1-only.
3. **Targeted likes + notes for V2:** one like per person or per item; the key format and server validation; notes free and seeing them premium.
4. **Push:** which events notify (mutual match, suggestion, accept) — to be built on the new notification events only **after key rotation**.
5. **Chats tab:** align it with V2 Matches (hide ended / blocked chats, e.g. via `get_my_matches_v2`) — a small fix, needs only your go-ahead.
6. **Old smoke-test "Test" accounts:** keep, hide, or remove from the dev pool.
