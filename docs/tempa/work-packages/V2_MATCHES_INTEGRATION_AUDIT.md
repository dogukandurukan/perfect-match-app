# V2 Matches — integration audit (read-only) and proposal

Date 2026-10-08 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` at `d4a17e4` (clean, same as origin) · Author: Claude Code.

**Read-only round.** No app code, backend, live data, merge or deploy changed; only this report was added. AI HQ and `~/tempa-p06` were not touched.

**Evidence:**
- current code on this branch;
- live definitions read from perfect-match-dev (`fyqwjduzpnjuxqsloxih`) with the linked CLI: functions, policies, cron jobs, counts;
- `DECISIONS.md` (D36–D39, D61–D66), `V2_MATCHES_DESIGN_PREVIEW_RESULT.md` (rounds 1–4), `work-packages/V2_BACKEND_SCORING_AUDIT.md`, `docs/tempa/V2_BACKEND_SCORING_AUDIT.md` (scoring proposal), `SCORING.md`, `V2_DISCOVER_INTEGRATION_RESULT.md`.

## 0. Doc claims vs. code — checked

| Claim | Checked against | Result |
|---|---|---|
| V2 Discover is unscored, fixed order | live `get_discovery_candidates_v2`: eligibility then `order by c.user_id` | ✅ true |
| V2 scoring is only a proposal (D37 🔵, D38 🔵, D36 direction ✅) | DECISIONS.md; no `get_top_matches_v2` in the DB | ✅ true — **no approved weights exist** |
| Matches preview: daily refresh simulated, no timer | `components/dev/MatchesDesignPreview.tsx` (no timer / clock code; DEV button) | ✅ true |
| `get_my_matches_v2` filters blocked / unmatched / deleted | live def: `v2_chat_active` = accepted + `chat_opened` + neither deleted + no block either way | ✅ true, but **`is_hidden` and membership state are NOT checked** (see §4) |
| A comment alone opens no chat; mutual like opens it immediately | `send_like_v2` + `handle_mutual_like` (AFTER trigger, same transaction) | ✅ true |
| No automatic messages | `handle_mutual_like` **inserts each like's note as a chat message** on the mutual match | ⚠️ **conflicts** with "no automatic message" and with "Conversation started" (§3) |
| Real Matches today = all matches + Plans | `components/main/V2MatchesScreen.tsx` (segments Matches / Plans) | ✅ true. The approved design has **no Plans** (§7 Q2) |
| DEV vs. live | `lib/backendConfig.ts` + `lib/supabaseClient.ts` + `app.config.js` | ✅ same project for both. EAS production → `live` → `v2Enabled=false` → legacy screens |

## 1. Picked for you

### What exists

- **V2 data** (`onboarding_v2`), all mutual-relevant:
    - gender, interested_in, DOB (age), city (+ district, not public);
    - intent and the five compatibility answers, values, interests;
    - smoking / drinking / pets / activity, work / school / hometown;
    - artists / books / screen, date types, days / time, favourite spot;
    - prompts and photos.
- **Preferences actually applied on V2:**
    - `discovery_age_min/max` (both directions) and same city;
    - plus gender ↔ interested_in both ways (`v2_wants`), active membership, not hidden / deleted, no block either way.
    - `v2_pair_eligible` / `get_discovery_candidates_v2` hold this mutual eligibility.
    - The V1 "advanced filters" (verified-only, non-smokers, height, zodiac, pets, active-today) are **not** applied on V2.
- **Discover's own exclusions:** existing accepted / passed match, already liked by me.
- **Ranking available:** none on V2. V1 `get_top_matches` reads V1 columns and must not be reused (D36/D37 path → a future `get_top_matches_v2`).
- **Signals that exist but would be unapproved weights:**
    - "liked me" (V1 gave +40);
    - recency (`last_active_at` is a V1 heartbeat);
    - shared intent / interests.

### Proposed first rule (no scoring)

**Eligibility** (hard, mutual — same as Discover, server-side):
- `v2_pair_eligible(me, c)`: both active V2 members, both preferences match both ways, age ranges both ways, same city, not hidden / deleted, no block;
- no `matches` row with me (pending / accepted / passed);
- no like from me to c;
- never featured to me as a pick before (D66);
- not my current featured mutual (D65).

**Order:** a **deterministic random draw per user and period**, e.g. `md5(viewer || candidate || period)`.
- Stable for the whole period and reproducible in tests.
- Shown as **"Picked for you"**, **never as compatibility** (no %, no "best match").

**Direction:** the pick is **one-way** (I am shown c; c is not necessarily shown me), on **mutual eligibility**.

**Why:**
- uses only approved rules (D36 eligibility direction, D61–D66);
- invents no weights;
- stays fair (no "liked me" boost);
- replaceable later by `get_top_matches_v2` ranking without changing storage or UI.

**Overlap with Discover** — the pick can also appear in Discover: decision Q4.

## 2. Daily period (server-owned)

**Period key** (server clock, Istanbul):

```
period = ((now() at time zone 'Europe/Istanbul') - interval '12 hours')::date
```

- It flips at 12:00 Istanbul.
- `next_refresh_at = ((period + 1) + time '12:00') at time zone 'Europe/Istanbul'` (DB `TimeZone` is UTC; computed explicitly).
- The device clock is never used.

**Storage:**

```
daily_picks_v2 (
  user_id uuid references profiles on delete cascade,
  period date,
  pick_user_id uuid null,
  mutual_user_id uuid null,
  created_at timestamptz default now(),
  primary key (user_id, period))
```

- RLS on, **no client access**.
- History rows are kept: they give "never re-offered" (D66) and "don't re-feature after a conversation started" (D64).

**Read path:** `get_daily_picks_v2()` (SECURITY DEFINER, authenticated):
1. computes the period;
2. on first call in a period, selects and `insert … on conflict do nothing` (concurrent first opens can't create two different picks), then reads the row;
3. returns the two people, each with **live status** (see §3/§4) and `next_refresh_at`.

App restarts and device-clock changes can't create a new pick. **No cron needed** (lazy creation). The existing cron jobs are only `expire-matches` and `daily-meetup-reminders`.

**Mid-period changes:**
- the stored person never changes inside a period;
- if they become unavailable (block, hide, delete, unmatch), the card shows the section's empty state — **no replacement until 12:00**, keeping D63's "the day's picks".

## 3. Real like → match → chat

| Step | Existing | Missing |
|---|---|---|
| Like / comment on pick content | `send_like_v2` (targets, ownership, one per person, quota, idempotent) | a **source** marker (§5); the pick profile wiring in the app |
| Like sent state | the likes row (status `sent`) | read it into the card (live status in `get_daily_picks_v2`) |
| Mutual match | `handle_mutual_like` → match `accepted`, `chat_opened`, immediately (no wait for refresh) ✅ | — |
| Say hello | `/chat` route with `match_id` (`get_my_matches_v2` returns it); `get_chat_v2`; messages RLS (accepted match, no block) | the match id on the card (live status) |
| First message → Conversation started | `messages` | definition: **any message in the pair** (either side) — proposed |
| Chats | `get_my_matches_v2` lists the match (empty or not) ✅ | — |

**Conflict to decide (Q1):** `handle_mutual_like` copies each like's note into `messages` when the match forms.
- The chat would open with an automatic message.
- The card would jump straight to "Conversation started" without Say hello.
- Proposal: stop seeding notes as messages and show the note as context at the top of the chat ("Liked your photo: …"). The data stays in `likes`.

**Unchanged on purpose:** quota and premium rules, pass not recorded, a like never opens a chat by itself.

## 4. Featured mutual match

**Selection** (at period creation, server-side):
- the caller's matches with `v2_chat_active` **and** `v2_can_view_public_profile(me, other)` (adds hidden / membership);
- **no message in the pair**;
- `other ≠ pick`;
- order: **earliest match first** (oldest waiting).

Whether a match that wasn't messaged yesterday may be featured again today: proposed **yes** (D64 forbids it only after a conversation) — Q3.

**Pick → mutual mid-period (D65):** the pick card's live status becomes `matched` (Say hello + match id). The mutual section keeps its own stored person; nobody is copied. At the next period that person can be the featured mutual if no conversation started.

**Conversation started:**
- live, from `messages` for the stored mutual / pick person;
- the stored row keeps the person for the whole period, so the state stays until 12:00;
- the next period's selection excludes people with any message (D64).

**Exclusions on every path:**
- **Pick and mutual selection:** use `v2_pair_eligible` / `v2_can_view_public_profile`, `v2_chat_active`, blocks either way, `deleted_at`, `is_hidden`, membership.
- **Card read time:** re-check the same rules, so a stored person who became unavailable is hidden.
- **Profile open:** `get_profile_v2` already applies `v2_can_view_public_profile`.
- **Likes:** `send_like_v2` already applies it.
- **Gap found:** `v2_chat_active` / `get_my_matches_v2` don't check `is_hidden` or membership. Decide whether a hidden / suspended member's existing chats stay visible (Q6). The featured card will use the stricter rule either way.

## 5. Like source for the future Activity

- **Add** `likes.source text check (source in ('discover','daily_pick'))` (null = unknown) and `likes.pick_period date`.
- **Validation in `send_like_v2`:**
    - new parameter `p_source`;
    - the server accepts `'daily_pick'` **only if** `daily_picks_v2` has a row with `user_id = me` and `pick_user_id = likee`, and stores that row's `period`;
    - this tolerates a like sent just after 12:00 on yesterday's pick without trusting the client;
    - otherwise it refuses `invalid_source`;
    - `'discover'` is the default for the Discover screen.
- **Old rows stay `NULL`** — no backfill, no guessing.
- Activity (later) reads `source` / `pick_period` through `get_my_liker_cards`. Premium visibility unchanged. No Activity UI this round.

## 6. DEV → live

- **Today:**
    - `lib/backendConfig.ts`: `live` and `dev` both point at `fyqwjduzpnjuxqsloxih`;
    - `app.config.js` pins EAS production to `live`;
    - `lib/supabaseClient.ts`: `v2Enabled` is false there, so production shows the legacy Matches (`get_top_matches`, invites).
  Every server change applied "to dev" is live for every build.
- **Migration** (one additive file in `supabase/proposed`, applied via `apply-dev.mjs`):
    - `daily_picks_v2` + RLS (no client policies);
    - `v2_daily_period()`;
    - an internal `v2_daily_picks_for(p_user, p_at timestamptz)` (service-role only, for tests);
    - public `get_daily_picks_v2()`;
    - `likes.source` / `pick_period`;
    - `send_like_v2` gains `p_source` (backward-compatible default `'discover'`);
    - optionally the note-seeding change (Q1);
    - grants: authenticated → `get_daily_picks_v2`; nothing on the table.
- **Verification without real accounts:**
    - a new `smoke_matches_v2.mjs` on synthetic accounts only (the existing pair + pool members);
    - it calls the internal function with `p_at` to simulate 11:59 / 12:01 / next day — **no device-clock change, no phone account**;
    - covers:
        - same pick on repeated calls and concurrent first calls;
        - flips at 12:00 Istanbul;
        - never re-offered;
        - no pick when none is eligible;
        - pick ≠ mutual;
        - pick liked back → card `matched`, mutual unchanged;
        - first message → `conversation_started` kept for the period and excluded next period;
        - block / hide / delete / unmatch → card hidden;
        - `daily_pick` source accepted only for my own pick;
        - quota and the one-like rule unchanged.
- **Phone:**
    - the DEV test account (`start-app.sh`'s DEV sign-in) or the synthetic phone account;
    - opening the real Matches **creates that account's `daily_picks_v2` row** (a new table only — no likes, matches or messages);
    - owner to confirm which account (Q5).
- **Release order:**
    1. migration on dev;
    2. smoke tests;
    3. client: real `V2MatchesScreen` with the approved cards (shared with the preview), pick profile on the shared Discover components + `send_like_v2(source='daily_pick')`, Say hello → `/chat`;
    4. local checks + phone;
    5. Activity work;
    6. production only after the existing blockers (V1/V2 build switch, same-project backend, key rotation, `delete-account`, public bucket, advisor items).

## Ready vs. missing

| Ready | Missing |
|---|---|
| Mutual eligibility (`v2_pair_eligible`), profile visibility, `get_profile_v2` with ids | Daily period storage + `get_daily_picks_v2` |
| Targeted likes + comments (`send_like_v2`), quota, one-per-person, idempotency | Like `source` / `pick_period` |
| Mutual match on like (immediate), Chats list (`get_my_matches_v2`), chat RLS, `/chat` | Live card status (like sent / matched / started) |
| Approved Matches + profile UI (preview, shared Discover components) | Real `V2MatchesScreen` wiring; decision on Plans |
| Exclusions for matches / profiles | `is_hidden` / membership on chat paths (Q6) |

## 7. Questions that need a decision

1. **Note → message on mutual match:** keep it (Hinge-style, but it's an automatic message and skips Say hello) or show the note as chat context only (proposed)?
2. **Plans:** the current real Matches has a Plans segment (date suggestions). Where do Plans live in the approved two-card design (Chats header, a Matches section below the cards, or Activity)?
3. **Featured mutual rotation:** may the same unmessaged match be featured on consecutive days (proposed yes), and is "earliest match first" acceptable?
4. **Pick vs. Discover:** should today's pick be hidden from Discover for that day (avoid double exposure), or may it appear in both?
5. **Phone verification account:** DEV test account or the synthetic phone account (a `daily_picks_v2` row would be created for it)?
6. **Hidden / suspended members:** should their existing chats stay in Chats (today: yes), or be hidden like their profile?

Not asked (has an approved answer or a safe default):
- refresh 12:00 Istanbul (D63);
- no re-offer (D66);
- no copy across sections (D65);
- random order shown as random (no weights, D37 not approved);
- server-owned period;
- like source validated server-side, no backfill.
