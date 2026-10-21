#!/bin/sh
# Stops ONLY the Tempa local backend containers. Data stays in the Docker
# volumes (no reset, nothing deleted). Metro: press Ctrl+C in its terminal.
#   npm run collab:stop
. "$(dirname "$0")/_common.sh"
assert_tempa_repo
docker_running || { say "Docker is not running — nothing to stop."; exit 0; }
[ -n "$(tempa_running)" ] || { say "Tempa local backend is not running — nothing to stop."; exit 0; }
node "$REPO_ROOT/scripts/local-backend/setup.mjs" --stop && say "Stopped tempa-local (data kept). Start again: npm run collab:start"
