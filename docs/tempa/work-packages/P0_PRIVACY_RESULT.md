# P0 privacy — result report (revision 2)

Date 2026-09-29 · Branch `tempa/p0-privacy` (from `e0dd960`) · Author: Claude Code.
Plan and design: `docs/tempa/P0_PRIVACY_REMEDIATION.md`.

**Nothing was applied to the live project.** No live migration, policy, grant
or bucket change; no merge. Live access was read-only catalog queries plus one
row **count** (2 auth users, 2 profiles, 0 photo objects, 0 matches). No other
user's data was read. The service-role credential inside the
`matches-push-notification` trigger was redacted at query time and never
printed or stored.

## 1. What was done

| Area | Result |
|---|---|
| Live catalog snapshot | `supabase/proposed/tests/live_snapshot_2026-09-29.json` — columns, constraints, indexes, triggers (webhook redacted), policies, table + column grants, **full function bodies** and ACLs. No row data, no secrets (scanned). |
| Isolated replica | `tests/replica.mjs` builds the live schema in PGlite from that snapshot; served by PostgREST 13.0.8 via pglite-socket; JWTs signed locally. |
| P0-A (revised) | visibility rule `can_view_profile` (+ caller-bound `can_view_profile_as_me`), `profile_cards` **without district**, write guards for profiles / matches / likes, column-restricted messages / notifications / reports / blocks / events, anon grants removed, photo listing closed, `get_discovery_cards` (no district), `get_my_liker_cards` (filters blocked/deleted likers), `get_date_venue_suggestions`. |
| P0-B | own-row-only `profiles`; client EXECUTE revoked on `get_top_matches` / `get_my_likers`. |
| Recovery files | P0-A exact revert (verified), P0-B **emergency_reopen** (clearly marked, not a rollback). Fix-forward table in the plan §5.3. |
| R-P0 client | 19 app files: every other-user read → `profile_cards` / RPCs; age from server; surname removed from the other user's profile; other people's district no longer read or shown; venue labels from the server; Vibe district strip removed; Map people layer disabled; new photo uploads get random, unguessable names. Own reads unchanged. |
| Plan additions | district private (list of required changes, all made); private bucket + signed URLs before closed beta (required changes, TTL, cache, no instant revocation); access table for hidden / deleted / blocking / blocked / old-match profiles; fix-forward recovery; webhook credential finding. |

### Findings new in revision 2 (beyond the first package)

1. **Forged consent on `matches`** — any user could accept their own invite, open a chat with any discoverable user, or confirm their own meetup proposal, and then message that person without consent. Closed by the P0-A guard (interim state machine).
2. **Hidden profiles readable via self-created candidate rows** — the old "any matches row" branch; clients could create such rows. Closed (P0-A + P0-B).
3. **`get_my_likers` premium branch returned people who blocked you and deleted accounts** (with full DOB). Closed by `get_my_liker_cards`.
4. **Messages/notifications/reports rewritable** by receiver/owner. Closed.
5. **Service-role credential embedded in the webhook trigger** definition. Needs an ops fix (rotate + Vault), not SQL in this package.
6. A function referenced by a view is EXECUTE-checked as the caller: exposing the 2-argument visibility rule would have been an oracle. Replaced by a caller-bound function (tested: the 2-argument form is not callable).
7. `get_top_matches` is already SECURITY DEFINER live (older notes said otherwise); it filters hidden / deleted / blocked / incomplete itself, so the discovery wrapper does not widen access (order-equality test).

## 2. Tests

Command (dependencies outside the app, e.g. in a scratch dir):
```
npm i --no-save --prefix <dir> @electric-sql/pglite @electric-sql/pglite-socket
PGLITE_DIR=<dir>/node_modules POSTGREST=<postgrest 13 binary> \
  node supabase/proposed/tests/http_p0.test.mjs
```

| Stage | Pass | Fail |
|---|---|---|
| LIVE (replica reproduces today's exposure) | 8 | 0 |
| P0-A (old client works, holes closed, new read paths, R-P0 shapes) | 154 | 0 |
| P0-B (only own row; R-P0 shapes still work) | 87 | 0 |
| REVERT (P0-A revert restores live policies, grants, functions, views, triggers exactly) | 7 | 0 |
| **Total** | **256** | **0** |

**Mutation check:** `MUTATE=skip` runs the same suite without applying P0-A/P0-B → **119 checks fail** (P0-A 72, P0-B 47). The suite detects the fixes; it does not pass vacuously.

Other checks on this branch: `npx tsc --noEmit` clean; onboarding V2 logic checks P06 45/45, P07 R1 69/69, P07 R2 56/56. The project has no lint config.

**Not verified here (honest limits):**
- Supabase Storage HTTP server (policies checked in SQL as each role; the public-URL path bypasses RLS by design and is covered by the private-bucket plan).
- PostgREST 14.4 (live) vs 13.0.8 (local): same query semantics for everything used here; re-check after applying.
- PGlite is Postgres 18.3; live is 17.6. No feature used differs.
- **The app has not been run on a phone with these changes.** The R-P0 query shapes were replayed over HTTP (20 shapes, all return data at P0-A and P0-B), but screens need a device pass.

Per-check list:

### LIVE
- ✅ replica reproduces: signed-in user reads another user's phone/DOB/district
- ✅ replica reproduces: hidden profile readable via a bare candidate row
- ✅ replica reproduces: INSERT sets is_premium/photo_verified
- ✅ replica reproduces: self-accept a candidate and message them without consent
- ✅ replica reproduces: receiver rewrites a received message
- ✅ replica reproduces: anon lists user-photos objects
- ✅ replica: get_my_likers callable
- ✅ replica reproduces: premium likers list includes a user who blocked me, with full DOB
### P0-A
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
- ✅ man inviting a woman cannot open the chat immediately
- ✅ invite (sendMatchInvite patch) works
- ✅ cannot write the other side's intro answers
- ✅ inviter cannot accept own invite
- ✅ cannot message before the invite is accepted
- ✅ invitee accept (acceptMatchInvite) works
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
- ✅ woman inviting a man may open the chat at invite time
- ✅ reviving an expired invite yields a clean candidate (no stale invite)
- ✅ cannot like a hidden, unrelated user
- ✅ cannot insert a like as matched
- ✅ recordLike upsert works
- ✅ recordLike upsert on an existing like works
- ✅ cannot re-point an existing like
- ✅ hidden user with a live like on me is visible (Liked you)
- ✅ hidden liker listed for premium
- ✅ liking back someone who liked me (Liked-you) opens the mutual chat
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
- ✅ P0-A: profile_cards shows K
- ✅ P0-A: profile_cards shows M
- ✅ P0-A: profile_cards shows F
- ✅ P0-A: profile_cards shows L
- ✅ P0-A: profile_cards shows P
- ✅ P0-A: profile_cards shows Q
- ✅ P0-A: profile_cards shows HI
- ✅ P0-A: profile_cards hides D
- ✅ P0-A: profile_cards hides D2
- ✅ P0-A: profile_cards hides E
- ✅ P0-A: profile_cards hides G
- ✅ P0-A: profile_cards hides I
- ✅ P0-A: profile_cards hides HX
- ✅ P0-A: profile_cards returns no private columns (incl. district, DOB)
- ✅ P0-A: profile_cards returns age
- ✅ P0-A: blocker sees the person they blocked (unblock list)
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
- ✅ P0-A: discovery never returns the caller
- ✅ P0-A: non-premium likers are anonymous
- ✅ P0-A: premium likers exclude someone who blocked me
- ✅ P0-A: premium likers exclude deleted users
- ✅ P0-A: premium likers return age, no DOB
- ✅ P0-A: liker count matches visible likers
- ✅ P0-A: venue suggestions work
- ✅ P0-A: venues: other district not revealed (no "both" across districts, own first)
- ✅ P0-A: venues: same district (diacritics-insensitive) → "both"
- ✅ P0-A: venues: invisible user contributes nothing
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
- ✅ P0-A: R-P0 client shape — Blocked users — profile_cards (blocked-users.tsx)
- ✅ P0-A: R-P0 client shape has no private data — Blocked users — profile_cards (blocked-users.tsx)
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
### P0-B
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
- ✅ P0-B: profile_cards shows K
- ✅ P0-B: profile_cards shows M
- ✅ P0-B: profile_cards shows F
- ✅ P0-B: profile_cards shows L
- ✅ P0-B: profile_cards shows P
- ✅ P0-B: profile_cards shows Q
- ✅ P0-B: profile_cards shows HI
- ✅ P0-B: profile_cards hides D
- ✅ P0-B: profile_cards hides D2
- ✅ P0-B: profile_cards hides E
- ✅ P0-B: profile_cards hides G
- ✅ P0-B: profile_cards hides I
- ✅ P0-B: profile_cards hides HX
- ✅ P0-B: profile_cards returns no private columns (incl. district, DOB)
- ✅ P0-B: profile_cards returns age
- ✅ P0-B: blocker sees the person they blocked (unblock list)
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
- ✅ P0-B: discovery never returns the caller
- ✅ P0-B: non-premium likers are anonymous
- ✅ P0-B: premium likers exclude someone who blocked me
- ✅ P0-B: premium likers exclude deleted users
- ✅ P0-B: premium likers return age, no DOB
- ✅ P0-B: liker count matches visible likers
- ✅ P0-B: venue suggestions work
- ✅ P0-B: venues: other district not revealed (no "both" across districts, own first)
- ✅ P0-B: venues: same district (diacritics-insensitive) → "both"
- ✅ P0-B: venues: invisible user contributes nothing
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
- ✅ P0-B: R-P0 client shape — Blocked users — profile_cards (blocked-users.tsx)
- ✅ P0-B: R-P0 client shape has no private data — Blocked users — profile_cards (blocked-users.tsx)
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
### REVERT
- ✅ P0-A changes the access state
- ✅ P0-A revert restores live policies exactly
- ✅ P0-A revert restores live tableGrants exactly
- ✅ P0-A revert restores live columnGrants exactly
- ✅ P0-A revert restores live functions exactly
- ✅ P0-A revert restores live views exactly
- ✅ P0-A revert restores live triggers exactly

## 3. Live package and order — for your review (nothing applied)

| Step | What | How | Verify with own test accounts only | If it goes wrong |
|---|---|---|---|---|
| 0 | Rotate the service-role key; recreate the push webhook with the secret in Vault / header (not in trigger text) | Dashboard (owner) | push still arrives on invite | re-enter secret; no data exposure |
| 1 | Re-snapshot the live catalog and diff against `live_snapshot_2026-09-29.json` (must be unchanged) | read-only query | diff empty | stop, re-run tests on a new snapshot |
| 2 | **P0-A** | `supabase db query --linked -f supabase/proposed/20260928130000_p0a_privacy_additive.sql`, then `NOTIFY pgrst, 'reload schema';` | current app: Home, Matches, invite → accept → meetup → chat → check-in, Activity, like, block/report, photo upload; anon REST list of `user-photos` empty; forged `status=accepted` PATCH rejected | fix-forward per plan §5.3 (drop only the failing guard) |
| 3 | **R-P0** client on every installed build (today: dev clients; later: forced minimum version) | merge after your phone test, reload / build | same screen list with the new build; other user's profile shows no surname / district | client hotfix |
| 4 | **P0-B** | `db query --linked -f …p0b_privacy_restrict.sql` + `NOTIFY pgrst` | account 1 cannot read account 2's `phone_number`/`date_of_birth` (0 rows); `get_top_matches` → permission denied; screens still render | client hotfix or disable the screen; `emergency_reopen` only with written owner acceptance |
| 5 | **P1-photos** private bucket + signed URLs (plan §3.2) — before closed beta | separate package | hidden/blocked user's photo can't be signed | — |

Live has 0 photo objects and 0 matches today, so step 5's data migration is
trivial now and gets harder with every real upload — doing it before the first
real users is cheapest.

## 4. Open items

- Owner decisions in plan §7 (order, `intent` on the card, photo TTL, hidden-user visibility to invite/chat partners).
- WP2: replace the `matches` trigger guard with SECURITY DEFINER RPCs; server-controlled onboarding/review state instead of `setup_completed`.
- Pre-existing, not changed here: re-liking after a match resets the like to `sent`; the other person's `intent` reads return nothing (own-row policy); "Leaked password protection" still off.
- Delete the empty public `profile-photos` bucket (with step 5).
