#!/bin/sh
# Shared helpers for scripts/collab/*.sh (branding / design collaborator).
# Plain POSIX sh. Never prints keys, tokens or codes from env files.
REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SUPABASE_CLI="supabase@2.120.0"
LOCAL_PROJECT="tempa-local"
LOCAL_API_PORT=55421
ENV_FILE="$REPO_ROOT/.env.local-backend.local"

say()  { printf '%s\n' "$*"; }
ok()   { printf '  OK    %s\n' "$*"; }
warn() { printf '  WARN  %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; }
# stop "<what went wrong>" "<what to do next>"
stop() {
  printf '\nSTOPPED: %s\n' "$1" >&2
  [ -n "$2" ] && printf 'Next step: %s\n' "$2" >&2
  exit 2
}

# The checkout must be the Tempa repo (origin perfect-match-app) and the
# local backend config must be the Tempa project on its own ports.
assert_tempa_repo() {
  origin=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null | sed -E 's#://[^@/]+@#://#')
  case "$origin" in
    *dogukandurukan/perfect-match-app*) ;;
    *) stop "this folder is not the Tempa repo (origin: ${origin:-none})" "open the folder you cloned from github.com/dogukandurukan/perfect-match-app" ;;
  esac
  cfg="$REPO_ROOT/local-backend/supabase/config.toml"
  [ -f "$cfg" ] || stop "local-backend/supabase/config.toml is missing" "make sure you are on the delivered branch (git status)"
  grep -q '^project_id = "tempa-local"$' "$cfg" || stop "local backend config is not project tempa-local" "do not edit local-backend/supabase/config.toml; ask Dogukan"
  grep -q "^port = $LOCAL_API_PORT\$" "$cfg" || stop "local backend API port is not $LOCAL_API_PORT" "do not edit local-backend/supabase/config.toml; ask Dogukan"
}

docker_running() { docker info >/dev/null 2>&1; }

# Containers / volumes that belong to the Tempa local backend on this Mac.
tempa_containers() { docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E "_${LOCAL_PROJECT}\$" || true; }
tempa_running()    { docker ps --format '{{.Names}}' 2>/dev/null | grep -E "^supabase_kong_${LOCAL_PROJECT}\$" || true; }
tempa_volumes()    { docker volume ls --format '{{.Name}}' 2>/dev/null | grep -E "_${LOCAL_PROJECT}\$" || true; }

# Private Wi-Fi / LAN address of this Mac (never assumed; detected each run).
lan_ip() {
  ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  case "$ip" in
    10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) printf '%s' "$ip" ;;
    *) printf '' ;;
  esac
}

port_user() { lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1}'; }
