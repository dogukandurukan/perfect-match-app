# P0 privacy — result report (revision 3)

Date 2026-09-30 · Branch `tempa/p0-privacy-r3` (from `1a38707` on `tempa/p0-privacy`) · Author: Claude Code.
Plan: `docs/tempa/P0_PRIVACY_REMEDIATION.md` · Key plan: `docs/tempa/P0_KEY_ROTATION_PLAN.md` · Phone test: `docs/tempa/P0_PHONE_TEST.md`.

**Nothing was applied to the live project:** no migration, policy, grant,
bucket or key change, no deploy, no merge. Live access this round consisted
only of read-only catalog queries that returned key **types** and names,
never values. The accepted R2 onboarding is untouched on this branch (R2 checks: 56/56).

## 1. Summary

| Area | Result |
|---|---|
| Product decisions | All six implemented as proposals; effects in plan §2 |
| P0-A (rev 3) | Visibility rule = own OR (no block either way AND not deleted AND (discoverable OR accepted match)); `profile_cards` + `intent`; no "Nearby"; venue RPC ignores the other person's district; district filters normalised; chat opens only on acceptance; `get_my_blocked_users`; write guards as in rev 2 |
| P1 private photos | new private bucket, visibility-checked SELECT (= signing), own-folder upload/delete, no client moves; resumable migration runbook (plan §4.3) |
| Client (R-P0 + rev 3) | signed URLs (15 min, re-sign < 60 s left, forget on block); blocked list = first name only; hidden/blocked/deleted people's rows hidden in Chats, Activity, Plans; gender-neutral chat opening; district filters removed; explicit backend selection with a DEV badge |
| Test environment | separate Supabase project tooling: `scripts/test-backend/` (env guard that refuses live, `apply`, `seed`, `smoke`, `start-app.sh`); sanitized schema generator (no live ref, key, webhook, cron or data) |
| Key plan | key type and consumers identified; Vault-based webhook + reminder cron (proposed SQL + function check); rotation and revocation order |
| Fix-forward | guards are corrected in place (`create or replace`); a guard is never dropped; the affected action is paused instead |

## 2. What only you can do next

**Create the separate Supabase test project** and fill `~/tempa-p0/.env.test.local` (template: `scripts/test-backend/env.example`). Every other step is scripted: `P0_PHONE_TEST.md` §1.

## 3. Tests

| Suite | Result |
|---|---|
| `supabase/proposed/tests/http_p0.test.mjs` (PGlite + PostgREST 13.0.8, real function bodies/grants) | **325 / 325** |
| same, `MUTATE=skip` (proposed files not applied) | 136 fail → the checks detect the fixes |
| `scripts/p0-checks/photo_url_cache.check.mjs` (fake clock) | 14 / 14 |
| `scripts/p0-checks/backend_config.check.mjs` (no fallback to live) | 14 / 14 |
| test-env guard (live URL / live anon key / live DB URL / wrong key role refused) | 5 / 5, manual run |
| onboarding V2 checks (P06 / P07 R1 / P07 R2) | 45/45 · 69/69 · 56/56 |
| `npx tsc --noEmit` | clean |
| real Auth / Storage / Realtime (`smoke.mjs`) | **pending** — needs the test project |
| phone test | **pending** |

Limits:
- Storage HTTP, Auth and Realtime are not part of the local replica; `smoke.mjs` covers them on the test project.
- The replica runs PostgREST 13 on Postgres 18 (PGlite); live runs PostgREST 14 on Postgres 17.
- Vault, pg_net and pg_cron are stubbed locally.

### Per-check list (local suite)

<details><summary>LIVE — 8/8</summary>

- ✅ replica reproduces: signed-in user reads another user's phone/DOB/district
- ✅ replica reproduces: hidden profile readable via a bare candidate row
- ✅ replica reproduces: INSERT sets is_premium/photo_verified
- ✅ replica reproduces: self-accept a candidate and message them without consent
- ✅ replica reproduces: receiver rewrites a received message
- ✅ replica reproduces: anon lists user-photos objects
- ✅ replica: get_my_likers callable
- ✅ replica reproduces: premium likers list includes a user who blocked me, with full DOB

</details>

<details><summary>P0-A — 185/185</summary>

- ✅ old client: batch profile read of others still works
- ✅ old client: get_top_matches still works
- ✅ old client: embedded profile join on matches still works
- ✅ anon cannot read profiles
- ✅ anon cannot read matches
- ✅ anon cannot read messages
- ✅ anon cannot read likes
- ✅ anon cannot read notifications
- ✅ anon cannot read onboarding_answers
- ✅ anon cannot read profile_cards
- ✅ anon cannot insert profiles
- ✅ anon cannot call get_discovery_cards
- ✅ two-party visibility rule is not callable by clients (no oracle)
- ✅ anon cannot call upsert_match
- ✅ INSERT with is_premium rejected
- ✅ INSERT with photo_verified rejected
- ✅ INSERT with setup_completed but missing fields rejected
- ✅ register.tsx consent upsert (allowed columns) still works
- ✅ selfie path in another user's folder rejected
- ✅ selfie path in own folder allowed
- ✅ owner cannot update is_premium
- ✅ owner cannot update photo_verified
- ✅ owner cannot update deleted_at
- ✅ owner cannot update daily_views_count
- ✅ owner cannot update waitlist_boost
- ✅ setup_completed=true without core fields rejected
- ✅ upsert_match candidate towards a discoverable user works
- ✅ cannot self-accept a candidate
- ✅ cannot open chat on a candidate
- ✅ cannot set invited_by to the other person
- ✅ cannot set legacy accepted flags
- ✅ cannot change source
- ✅ cannot push expires_at far out
- ✅ matches.tsx candidate TTL refresh still works
- ✅ cannot create a matches row with a hidden user
- ✅ upsert_match towards a hidden user rejected
- ✅ upsert_match with someone who blocked me rejected
- ✅ cannot delete match history
- ✅ invite (sendMatchInvite patch) works
- ✅ an invite never opens the chat by itself (old client asking to open is ignored)
- ✅ cannot write the other side's intro answers
- ✅ inviter cannot accept own invite
- ✅ cannot message before the invite is accepted
- ✅ chat cannot be opened without accepting (mutual consent)
- ✅ invitee accept opens the chat for any gender pair
- ✅ accept with a custom time (pending proposal) works
- ✅ proposer cannot confirm own proposal
- ✅ other side confirms the proposal
- ✅ invitee picking one of the inviter's offered times works
- ✅ message after acceptance works
- ✅ cannot backdate a message (created_at not insertable)
- ✅ sender cannot mark own messages read
- ✅ receiver read receipt (chat.tsx) works
- ✅ receiver cannot rewrite message content
- ✅ cannot delete messages
- ✅ own check-in + rating works
- ✅ cannot check in for the other side
- ✅ checkin_confirmed needs both check-ins
- ✅ checkin_confirmed after both check-ins works
- ✅ a woman inviting a man no longer opens the chat (mutual consent)
- ✅ no message before the invitee accepts, whatever the genders
- ✅ reviving an expired invite yields a clean candidate (no stale invite)
- ✅ cannot like a hidden, unrelated user
- ✅ cannot insert a like as matched
- ✅ recordLike upsert works
- ✅ recordLike upsert on an existing like works
- ✅ cannot re-point an existing like
- ✅ a one-sided like from a hidden user grants no access
- ✅ hidden liker not listed, even for premium
- ✅ visible liker listed for premium
- ✅ cannot like a hidden liker back (no access)
- ✅ mutual like still opens the chat (kept)
- ✅ a pending invite from a hidden user grants no access
- ✅ stored same_district filter normalised to whole_city
- ✅ client cannot turn on same_district discovery
- ✅ unblock list: block id + first name only, no photo
- ✅ unblock list is per blocker
- ✅ cannot rewrite notification text
- ✅ mark notification read works
- ✅ cannot insert notifications
- ✅ report works
- ✅ cannot edit a report
- ✅ block + unblock work
- ✅ analytics event insert works
- ✅ P0-A: profile_cards readable when signed in
- ✅ P0-A: profile_cards shows A
- ✅ P0-A: profile_cards shows B
- ✅ P0-A: profile_cards shows C
- ✅ P0-A: profile_cards shows J
- ✅ P0-A: profile_cards shows M
- ✅ P0-A: profile_cards shows L
- ✅ P0-A: profile_cards shows P
- ✅ P0-A: profile_cards shows Q
- ✅ P0-A: profile_cards shows LV
- ✅ P0-A: profile_cards hides D
- ✅ P0-A: profile_cards hides D2
- ✅ P0-A: profile_cards hides E
- ✅ P0-A: profile_cards hides G
- ✅ P0-A: profile_cards hides I
- ✅ P0-A: profile_cards hides HX
- ✅ P0-A: profile_cards hides F
- ✅ P0-A: profile_cards hides K
- ✅ P0-A: profile_cards hides HI
- ✅ P0-A: profile_cards returns no private columns (incl. district, DOB)
- ✅ P0-A: profile_cards returns age
- ✅ P0-A: blocker does not see the blocked person's card either
- ✅ P0-A: "Looking for" (intent) on a card you may see
- ✅ P0-A: blocked person cannot see the blocker
- ✅ P0-A: get_discovery_cards works
- ✅ P0-A: get_discovery_cards returns no DOB / district
- ✅ P0-A: discovery returns untouched discoverable users
- ✅ P0-A: discovery excludes C
- ✅ P0-A: discovery excludes D
- ✅ P0-A: discovery excludes D2
- ✅ P0-A: discovery excludes E
- ✅ P0-A: discovery excludes F
- ✅ P0-A: discovery excludes G
- ✅ P0-A: discovery excludes I
- ✅ P0-A: get_discovery_cards order == get_top_matches order (scoring unchanged)
- ✅ P0-A: fixture has a same-district candidate ("Nearby" produced by get_top_matches)
- ✅ P0-A: discovery never says "Nearby"
- ✅ P0-A: discovery never returns the caller
- ✅ P0-A: non-premium likers are anonymous
- ✅ P0-A: premium likers exclude someone who blocked me
- ✅ P0-A: premium likers exclude deleted users
- ✅ P0-A: premium likers return age, no DOB
- ✅ P0-A: liker count matches visible likers
- ✅ P0-A: venue suggestions work
- ✅ P0-A: venues: near-you first
- ✅ P0-A: venues: identical for a same-district and an other-district person (their district unused)
- ✅ P0-A: venues: nothing for someone you may not see
- ✅ P0-A: R-P0 client shape — Home feed — get_discovery_cards (index.tsx loadFeed)
- ✅ P0-A: R-P0 client shape has no private data — Home feed — get_discovery_cards (index.tsx loadFeed)
- ✅ P0-A: R-P0 client shape — Home feed extras — profile_cards (index.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Home feed extras — profile_cards (index.tsx)
- ✅ P0-A: R-P0 client shape — Home active match name — profile_cards (index.tsx)
- ✅ P0-A: R-P0 client shape — Matches invites/chats — profile_cards (matches.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Matches invites/chats — profile_cards (matches.tsx)
- ✅ P0-A: R-P0 client shape — Matches backfill — get_discovery_cards (matches.tsx)
- ✅ P0-A: R-P0 client shape — Matches Ready cards — profile_cards (matches.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Matches Ready cards — profile_cards (matches.tsx)
- ✅ P0-A: R-P0 client shape — Chats list — profile_cards (messages.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Chats list — profile_cards (messages.tsx)
- ✅ P0-A: R-P0 client shape — Chat header photo — profile_cards (chat.tsx)
- ✅ P0-A: R-P0 client shape — Activity likers — get_my_liker_cards (notifications.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Activity likers — get_my_liker_cards (notifications.tsx)
- ✅ P0-A: R-P0 client shape — Activity waiting/related — profile_cards (notifications.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Activity waiting/related — profile_cards (notifications.tsx)
- ✅ P0-A: R-P0 client shape — Activity accept — own gender from profiles (notifications.tsx)
- ✅ P0-A: R-P0 client shape — Activity accept — other gender from profile_cards (notifications.tsx)
- ✅ P0-A: R-P0 client shape — Other user profile — profile_cards (user-profile.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Other user profile — profile_cards (user-profile.tsx)
- ✅ P0-A: R-P0 client shape — Candidate profile — profile_cards (candidate-profile.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Candidate profile — profile_cards (candidate-profile.tsx)
- ✅ P0-A: R-P0 client shape — Plan detail — profile_cards (plan-detail.tsx)
- ✅ P0-A: R-P0 client shape — Blocked users — get_my_blocked_users (blocked-users.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Blocked users — get_my_blocked_users (blocked-users.tsx)
- ✅ P0-A: R-P0 client shape — "Looking for" of a visible person — profile_cards.intent (index/matches/candidate/user-profile)
- ✅ P0-A: R-P0 client shape — Plan your date — other person (micro-intro.tsx)
- ✅ P0-A: R-P0 client shape — Plan your date — venues (micro-intro.tsx)
- ✅ P0-A: R-P0 client shape — Vibe strip — profile_cards (lib/vibeCategories.ts)
- ✅ P0-A: R-P0 client shape has no private data — Vibe strip — profile_cards (lib/vibeCategories.ts)
- ✅ P0-A: R-P0 client shape — Own profile — full row still readable (profile.tsx / settings.tsx)
- ✅ storage: anon cannot list user-photos
- ✅ storage: owner lists only own folder
- ✅ storage: upload to own folder works
- ✅ storage: upload to another folder rejected
- ✅ storage: nobody (not even owner) reads verification selfies
- ✅ P0-A: private photo signable — A
- ✅ P0-A: private photo signable — B
- ✅ P0-A: private photo signable — C
- ✅ P0-A: private photo signable — J
- ✅ P0-A: private photo NOT signable — D
- ✅ P0-A: private photo NOT signable — HI
- ✅ P0-A: private photo NOT signable — K
- ✅ P0-A: private photo NOT signable — E
- ✅ P0-A: private photo NOT signable — F
- ✅ P0-A: private photo NOT signable — G
- ✅ P0-A: anon cannot read the private bucket
- ✅ P0-A: upload into own private folder
- ✅ P0-A: upload into another folder rejected
- ✅ P0-A: malformed folder rejected
- ✅ P0-A: objects cannot be moved/overwritten by clients
- ✅ P0-A: cannot delete someone else's photo
- ✅ P0-A: bucket is private

</details>

<details><summary>P0-B — 110/110</summary>

- ✅ owner still reads own full row
- ✅ other user's profiles row not readable (B)
- ✅ other user's profiles row not readable (C)
- ✅ other user's profiles row not readable (J)
- ✅ other user's profiles row not readable (K)
- ✅ profiles table returns only own row
- ✅ embedded join no longer exposes other profiles
- ✅ get_top_matches (DOB + district) no longer callable
- ✅ get_my_likers (DOB) no longer callable
- ✅ P0-B: profile_cards readable when signed in
- ✅ P0-B: profile_cards shows A
- ✅ P0-B: profile_cards shows B
- ✅ P0-B: profile_cards shows C
- ✅ P0-B: profile_cards shows J
- ✅ P0-B: profile_cards shows M
- ✅ P0-B: profile_cards shows L
- ✅ P0-B: profile_cards shows P
- ✅ P0-B: profile_cards shows Q
- ✅ P0-B: profile_cards shows LV
- ✅ P0-B: profile_cards hides D
- ✅ P0-B: profile_cards hides D2
- ✅ P0-B: profile_cards hides E
- ✅ P0-B: profile_cards hides G
- ✅ P0-B: profile_cards hides I
- ✅ P0-B: profile_cards hides HX
- ✅ P0-B: profile_cards hides F
- ✅ P0-B: profile_cards hides K
- ✅ P0-B: profile_cards hides HI
- ✅ P0-B: profile_cards returns no private columns (incl. district, DOB)
- ✅ P0-B: profile_cards returns age
- ✅ P0-B: blocker does not see the blocked person's card either
- ✅ P0-B: "Looking for" (intent) on a card you may see
- ✅ P0-B: blocked person cannot see the blocker
- ✅ P0-B: get_discovery_cards works
- ✅ P0-B: get_discovery_cards returns no DOB / district
- ✅ P0-B: discovery returns untouched discoverable users
- ✅ P0-B: discovery excludes C
- ✅ P0-B: discovery excludes D
- ✅ P0-B: discovery excludes D2
- ✅ P0-B: discovery excludes E
- ✅ P0-B: discovery excludes F
- ✅ P0-B: discovery excludes G
- ✅ P0-B: discovery excludes I
- ✅ P0-B: discovery never says "Nearby"
- ✅ P0-B: discovery never returns the caller
- ✅ P0-B: non-premium likers are anonymous
- ✅ P0-B: premium likers exclude someone who blocked me
- ✅ P0-B: premium likers exclude deleted users
- ✅ P0-B: premium likers return age, no DOB
- ✅ P0-B: liker count matches visible likers
- ✅ P0-B: venue suggestions work
- ✅ P0-B: venues: near-you first
- ✅ P0-B: venues: identical for a same-district and an other-district person (their district unused)
- ✅ P0-B: venues: nothing for someone you may not see
- ✅ P0-B: R-P0 client shape — Home feed — get_discovery_cards (index.tsx loadFeed)
- ✅ P0-B: R-P0 client shape has no private data — Home feed — get_discovery_cards (index.tsx loadFeed)
- ✅ P0-B: R-P0 client shape — Home feed extras — profile_cards (index.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Home feed extras — profile_cards (index.tsx)
- ✅ P0-B: R-P0 client shape — Home active match name — profile_cards (index.tsx)
- ✅ P0-B: R-P0 client shape — Matches invites/chats — profile_cards (matches.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Matches invites/chats — profile_cards (matches.tsx)
- ✅ P0-B: R-P0 client shape — Matches backfill — get_discovery_cards (matches.tsx)
- ✅ P0-B: R-P0 client shape — Matches Ready cards — profile_cards (matches.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Matches Ready cards — profile_cards (matches.tsx)
- ✅ P0-B: R-P0 client shape — Chats list — profile_cards (messages.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Chats list — profile_cards (messages.tsx)
- ✅ P0-B: R-P0 client shape — Chat header photo — profile_cards (chat.tsx)
- ✅ P0-B: R-P0 client shape — Activity likers — get_my_liker_cards (notifications.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Activity likers — get_my_liker_cards (notifications.tsx)
- ✅ P0-B: R-P0 client shape — Activity waiting/related — profile_cards (notifications.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Activity waiting/related — profile_cards (notifications.tsx)
- ✅ P0-B: R-P0 client shape — Activity accept — own gender from profiles (notifications.tsx)
- ✅ P0-B: R-P0 client shape — Activity accept — other gender from profile_cards (notifications.tsx)
- ✅ P0-B: R-P0 client shape — Other user profile — profile_cards (user-profile.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Other user profile — profile_cards (user-profile.tsx)
- ✅ P0-B: R-P0 client shape — Candidate profile — profile_cards (candidate-profile.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Candidate profile — profile_cards (candidate-profile.tsx)
- ✅ P0-B: R-P0 client shape — Plan detail — profile_cards (plan-detail.tsx)
- ✅ P0-B: R-P0 client shape — Blocked users — get_my_blocked_users (blocked-users.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Blocked users — get_my_blocked_users (blocked-users.tsx)
- ✅ P0-B: R-P0 client shape — "Looking for" of a visible person — profile_cards.intent (index/matches/candidate/user-profile)
- ✅ P0-B: R-P0 client shape — Plan your date — other person (micro-intro.tsx)
- ✅ P0-B: R-P0 client shape — Plan your date — venues (micro-intro.tsx)
- ✅ P0-B: R-P0 client shape — Vibe strip — profile_cards (lib/vibeCategories.ts)
- ✅ P0-B: R-P0 client shape has no private data — Vibe strip — profile_cards (lib/vibeCategories.ts)
- ✅ P0-B: R-P0 client shape — Own profile — full row still readable (profile.tsx / settings.tsx)
- ✅ storage: anon cannot list user-photos
- ✅ storage: owner lists only own folder
- ✅ storage: upload to own folder works
- ✅ storage: upload to another folder rejected
- ✅ storage: nobody (not even owner) reads verification selfies
- ✅ P0-B: private photo signable — A
- ✅ P0-B: private photo signable — B
- ✅ P0-B: private photo signable — C
- ✅ P0-B: private photo signable — J
- ✅ P0-B: private photo NOT signable — D
- ✅ P0-B: private photo NOT signable — HI
- ✅ P0-B: private photo NOT signable — K
- ✅ P0-B: private photo NOT signable — E
- ✅ P0-B: private photo NOT signable — F
- ✅ P0-B: private photo NOT signable — G
- ✅ P0-B: anon cannot read the private bucket
- ✅ P0-B: upload into own private folder
- ✅ P0-B: upload into another folder rejected
- ✅ P0-B: malformed folder rejected
- ✅ P0-B: objects cannot be moved/overwritten by clients
- ✅ P0-B: cannot delete someone else's photo
- ✅ P0-B: bucket is private
- ✅ P0-B: after a block neither side can sign the other's photos
- ✅ P0-B: after a block the card disappears

</details>

<details><summary>REVERT — 7/7</summary>

- ✅ P0-A changes the access state
- ✅ P0-A revert restores live policies exactly
- ✅ P0-A revert restores live tableGrants exactly
- ✅ P0-A revert restores live columnGrants exactly
- ✅ P0-A revert restores live functions exactly
- ✅ P0-A revert restores live views exactly
- ✅ P0-A revert restores live triggers exactly

</details>

<details><summary>TEST-PROJECT SQL — 7/7</summary>

- ✅ applies cleanly: platform stand-in
- ✅ applies cleanly: sanitized base schema
- ✅ applies cleanly: P0-A
- ✅ applies cleanly: P1 private photos
- ✅ applies cleanly: P0-B
- ✅ no live project ref, key, webhook or HTTP call in the test-project schema
- ✅ realtime publishes public.messages (chat)

</details>

<details><summary>WEBHOOK — 8/8</summary>

- ✅ no key, secret or project ref in the SQL file
- ✅ trigger text holds no secret
- ✅ missing Vault secret → no call (warning only)
- ✅ update calls the push function with the Vault secret and webhook payload
- ✅ reminder cron re-created without a key in its command
- ✅ clients cannot call the helper
- ✅ clients cannot read Vault
- ✅ anon cannot call the helper

</details>

## 4. Live package — to assess after the phone test (nothing applied)

Order and verification: plan §5. Recovery: plan §6 (fix-forward). Key rotation: key plan §3.

## 5. Revision history
- **r2** (`1a38707`, branch `tempa/p0-privacy`): verified package, R-P0 client, district private, 256/256.
- **r3** (this branch): owner decisions of 2026-09-30, private photo bucket, test-project tooling, key plan, fix-forward wording, 325/325.
