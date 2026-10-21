#!/bin/sh
# Daily start: the Tempa local backend (data kept) + Metro for the iPhone dev
# build over Wi-Fi. Prints a one-time sign-in code for the synthetic tester.
#   npm run collab:start            (Ctrl+C stops Metro; npm run collab:stop stops the backend)
. "$(dirname "$0")/_common.sh"
assert_tempa_repo
docker_running || stop "Docker is not running" "open Docker Desktop, wait until it says Running, then re-run"
[ -n "$(tempa_containers)$(tempa_volumes)" ] || stop "no Tempa local backend on this Mac yet" "run once: npm run collab:setup"
[ -f "$ENV_FILE" ] || stop ".env.local-backend.local is missing" "run once: npm run collab:setup (or ask Dogukan if the backend already exists)"
if [ -z "$(tempa_running)" ]; then
  say "Starting the Tempa local backend (data kept)…"
  npx --yes "$SUPABASE_CLI" start --workdir "$REPO_ROOT/local-backend" >/dev/null || stop "the local backend did not start" "npm run collab:doctor, then send its output to Dogukan"
fi
u=$(port_user 8081); [ -z "$u" ] || stop "port 8081 is already used by $u (another Metro is running)" "close the other terminal running Metro (Ctrl+C there), then re-run"
[ -n "$(lan_ip)" ] || stop "no private Wi-Fi address" "connect this Mac to the same Wi-Fi as the iPhone"
exec sh "$REPO_ROOT/scripts/local-backend/start-app.sh" "${1:-tempa-matches-tester@tempa-test.example.com}"
