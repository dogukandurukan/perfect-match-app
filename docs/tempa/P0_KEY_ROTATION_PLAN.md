# Key rotation plan — service-role key in the push webhook (PROPOSED, NOTHING DONE)

2026-09-30 · Branch `tempa/p0-privacy-r3` · Author: Claude Code.
No key was changed, created, copied or printed. Everything below was
established with read-only catalog queries that returned **only** the key
type, never its value.

## 1. What is exposed

| Item | Finding (read-only, 2026-09-30) |
|---|---|
| Where | Trigger `matches-push-notification` on `public.matches` (AFTER INSERT OR UPDATE) — a Dashboard "Database Webhook" calling `supabase_functions.http_request` |
| Target | `POST /functions/v1/send-push-notification` on the live project |
| Key type | **Legacy JWT API key, `role = service_role`** (HS256, signed with the project's legacy JWT secret). Not a new `sb_secret_…` key |
| Who can see it | Anyone who can read the catalog: `pg_trigger` / `pg_get_triggerdef` — the `postgres` role, Dashboard users, the read-only MCP/`supabase_read_only_user`, any tool or person given DB read access, and any schema dump/backup |
| What it grants | Full bypass of RLS on every table and Storage bucket, Auth admin API (create/delete users), via REST from anywhere |
| Vault | Installed (`supabase_vault 0.3.1`), **0 secrets** today |
| Other key literals in SQL | None found (functions in `public`, `supabase_functions`; cron commands) |

### Every consumer of a service-level credential today

| Consumer | How it gets the credential | Affected by revoking the leaked key? |
|---|---|---|
| Push webhook (trigger text) | the leaked literal | **yes — this is what we replace** |
| Edge Function `send-push-notification` (verify_jwt **on**) | platform-injected `SUPABASE_SERVICE_ROLE_KEY` env; the gateway also *validates the caller's JWT* | yes (both its env and the gateway check) |
| Edge Function `send-meetup-reminders` (verify_jwt **off**) | injected `SUPABASE_SERVICE_ROLE_KEY` | yes (its env) |
| Edge Function `delete-account` (verify_jwt on) | injected `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | yes |
| pg_cron `daily-meetup-reminders` | **no credential at all** — calls `send-meetup-reminders` unauthenticated | no, but see finding below |
| App bundle | anon key only (public by design) — **but** the anon key is signed with the same legacy JWT secret | only if the JWT secret is rotated |
| Anything outside the repo (scripts, password manager, CI, other tools/assistants, `.env` files on other machines) | unknown — **owner to check** | yes |

**Extra finding:** `send-meetup-reminders` runs with `verify_jwt = false`
and its cron call sends no credential, so **anyone on the internet can
trigger it**. Its own time filters limit the damage (it only sends reminders
that are due), but it must be authenticated.

## 2. Target design (no key in any SQL text)

- A random **webhook secret** (≥ 32 chars; not a Supabase API key) is the
  only thing the database sends to Edge Functions.
  - Stored in **Vault** as `tempa_webhook_secret` (plus `tempa_project_url`), read at call time by `public.call_edge_function()` (SECURITY DEFINER, not callable by clients).
  - Stored as the Edge Function secret `TEMPA_WEBHOOK_SECRET`.
  - Sent as header `x-tempa-webhook-secret`; functions check it in constant time (`supabase/functions/_shared/webhookAuth.ts`).
- Trigger `matches_push_webhook` and the reminder cron job call
  `call_edge_function(...)`: their text contains **no value** (only the
  secret's *name*). Proposed file: `supabase/proposed/20260930100000_db_webhooks_vault.sql`.
- If this secret leaks, the blast radius is "can trigger two notification
  functions", not "full database + Auth admin".
- Functions keep using their platform-injected service credential
  internally; it never appears in SQL or in the repo.

Verified locally (stubbed Vault / pg_net / pg_cron): no key or project ref in
the SQL file or trigger text; the update fires the call with the Vault value
and the webhook payload; a missing Vault secret makes no call; clients can't
call the helper or read Vault (`http_p0.test.mjs`, stage WEBHOOK, 8/8).

## 3. Steps — rehearse all of them in the TEST project first

| # | Step | Who / how | Verify | If it fails |
|---|---|---|---|---|
| 0 | Inventory outside the repo: search password manager, local `.env*`, scripts, CI, any assistant/tool config for the service-role key; list every place it was pasted | owner | written list | — |
| 1 | Generate the webhook secret locally (e.g. `openssl rand -base64 48`), **without** putting it in shell history, the repo, chat or logs | owner | — | — |
| 2 | Store it: SQL Editor `select vault.create_secret('<value>', 'tempa_webhook_secret', '…')` and `select vault.create_secret('https://<ref>.supabase.co', 'tempa_project_url', '…')`; Edge Function secret `TEMPA_WEBHOOK_SECRET` via Dashboard → Edge Functions → Secrets (not a CLI argument) | owner | `select name from vault.secrets` shows both names (never select the value) | delete and recreate |
| 3 | Deploy both functions from this branch with the new check, **with** `TEMPA_ALLOW_LEGACY_WEBHOOK_AUTH=1` (transition), and `--no-verify-jwt` for `send-push-notification` | `npx supabase functions deploy send-push-notification --no-verify-jwt --project-ref <ref>` (same for reminders) | old webhook still delivers (legacy path) | redeploy previous version |
| 4 | Apply `20260930100000_db_webhooks_vault.sql` (drops the Dashboard webhook trigger, creates `matches_push_webhook`, re-creates the cron job) | `db query … -f` | invite between own test accounts → push arrives; `net._http_response` shows 200 for the call; `pg_get_triggerdef` of the new trigger contains no key | re-run the file (idempotent); the old trigger can be recreated from the Dashboard if needed |
| 5 | Remove the transition: unset `TEMPA_ALLOW_LEGACY_WEBHOOK_AUTH`, redeploy | owner | a call without the header gets 401; invites still push; reminders still run hourly | set the flag again temporarily |
| 6 | **Revoke the leaked key.** Preferred: Settings → API Keys → create publishable + secret keys, ship an app build using the **publishable** key, then **disable the legacy JWT-based API keys** (anon + service_role). Alternative: rotate the legacy JWT secret — revokes the key at once but also invalidates the anon key in every installed app and signs every user out | owner | the old service-role JWT gets 401 on REST (`curl` with it from a local shell, output not saved); app still works; all three functions still work (check that functions receive a working injected credential after the switch — confirm current Supabase behaviour in their docs **at execution time**) | legacy keys can be re-enabled from the same page while fixing |
| 7 | Clean up: delete every copy found in step 0; note the rotation date | owner | — | — |

Order constraints:
- Step 6 must come **after** steps 3–5; otherwise push stops.
- Step 6 must come **after** the app ships with the publishable key; otherwise the installed app breaks.
- Until step 6 is done, treat the leaked key as **compromised**. Anyone who has already read the catalog can use it, and nothing before step 6 changes that.

The TEST project has its own separate keys. The rehearsal never touches, copies or reuses a live key. The test project has no push webhook and no cron job unless you add them for the rehearsal, with the test project's own secret.
