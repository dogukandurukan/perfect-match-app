# Archived: `migrate-verification-selfies` (2026-09-20)

**Status: historical record only. Not deployable, not deployed.** The real
Edge Function was deployed once (`--no-verify-jwt`), invoked once, its
result verified (see `docs/phase-0-security-report.md` §3.3), and then
deleted from the live Supabase project (`npx supabase functions delete
migrate-verification-selfies`). It no longer exists under
`supabase/functions/` — keeping a deployable copy there served no purpose
once its one-time job was done, and (per Phase 0.1 review) there is no
reason for the real user uuids it touched to sit in git history in a
runnable file indefinitely.

This file exists only so a future reader can see exactly what the
migration did without needing to dig through this session's conversation
log. **User ids below are placeholders, not the real values** — the real
ids are recorded in `docs/phase-0-security-report.md` §3.2 (that report
already only shows their first 8 characters truncated, not full uuids).

## What it did

For each of exactly 3 known, pre-verified source objects
(`user-photos/{userId}/verification_selfie.jpg`):

1. Downloaded the file with a service-role client.
2. Uploaded it to `verification-selfies/{userId}/{random-token}.jpg` (new
   private bucket, created by
   `supabase/migrations/20260920091500_verification_selfies_private_bucket.sql`).
3. Re-downloaded the new copy and compared byte length against the
   original — only proceeded past this check on an exact match.
4. Updated `profiles.verification_selfie_path` to the new path.
5. Only then deleted the old object from the public `user-photos` bucket.

Every step's result was logged and checked before the next one ran; the
old file was never deleted before its replacement was confirmed present
and byte-identical.

## Reconstructing it (if ever needed again)

The original source (with the 3 real hardcoded uuids) was **never
committed to git** — it existed only as an untracked file, deployed
straight from disk, then deleted from disk once its one-time job was
confirmed done. There is no git history to recover it from, which is
intentional: this note plus §3.3 of `docs/phase-0-security-report.md`
already say everything a future reader needs (mechanism, order of
operations, verification steps) without the real ids needing to persist
anywhere. If an equivalent migration is ever needed again, rewrite it from
this description with that run's own real object list — the shape (safe
copy → verify → update pointer → only then delete original) is the part
worth reusing, not the specific ids.
