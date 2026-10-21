#!/bin/sh
# ONE-TIME creation of a NEW, EMPTY Tempa local backend on this Mac, then
# synthetic test people only. Refuses if a Tempa local backend (containers or
# data volumes) already exists here, so running it again can never wipe data.
#   npm run collab:setup
. "$(dirname "$0")/_common.sh"
assert_tempa_repo
command -v docker >/dev/null || stop "Docker Desktop is not installed" "install Docker Desktop, open it, then re-run"
docker_running || stop "Docker is not running" "open Docker Desktop, wait until it says Running, then re-run"

# 1. Never touch an existing backend (setup.mjs resets the database).
existing="$(tempa_containers)$(tempa_volumes)"
[ -z "$existing" ] || stop "a Tempa local backend already exists on this Mac — nothing was changed" "use npm run collab:start (keeps data). A deliberate reset is Dogukan's call."

# 2. Its ports must be free (no other project on 55420–55429).
for p in 55420 55421 55422 55424 55429; do
  u=$(port_user $p); [ -z "$u" ] || stop "port $p is already used by $u" "close that program (or ask Dogukan) — another project must not share Tempa's ports"
done
[ -d "$REPO_ROOT/node_modules" ] || stop "node_modules missing" "run: npm ci"

say "Creating the Tempa local backend (first run downloads Docker images — can take 10–30 min)…"
node "$REPO_ROOT/scripts/local-backend/setup.mjs" || stop "local backend setup failed (see messages above)" "re-run npm run collab:doctor and send its output to Dogukan"

# 3. Verify it is the new, empty Tempa database before writing anything.
db="supabase_db_${LOCAL_PROJECT}"
users=$(docker exec "$db" psql -U postgres -d postgres -tAc 'select count(*) from auth.users' 2>/dev/null | tr -d ' ')
[ "$users" = 0 ] || stop "the new database is not empty (auth.users = ${users:-unknown}) — not seeding" "send this message to Dogukan"
grep -q '^LOCAL_SUPABASE_URL=http://127.0.0.1:55421$' "$ENV_FILE" || stop "local env file does not point at http://127.0.0.1:55421" "send this message to Dogukan"

say "Adding synthetic test people (no real data)…"
node "$REPO_ROOT/scripts/local-backend/seed.mjs" || stop "seeding failed (see above)" "send the output to Dogukan"
nonsynthetic=$(docker exec "$db" psql -U postgres -d postgres -tAc "select count(*) from auth.users where email not like '%@tempa-test.example.com'" 2>/dev/null | tr -d ' ')
[ "$nonsynthetic" = 0 ] || stop "found $nonsynthetic non-synthetic account(s) — unexpected" "send this message to Dogukan"
say ""
say "Done: new local backend with synthetic accounts only. Daily start: npm run collab:start"
