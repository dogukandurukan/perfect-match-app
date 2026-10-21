#!/bin/sh
# Read-only setup check for the design collaborator's Mac. Changes nothing.
#   npm run collab:doctor
. "$(dirname "$0")/_common.sh"
fails=0
say "Tempa setup check (read-only)"
say ""
say "Tools"
mac=$(sw_vers -productVersion 2>/dev/null); [ -n "$mac" ] && ok "macOS $mac" || { bad "not macOS"; fails=$((fails+1)); }
free_gb=$(df -g "$HOME" | awk 'NR==2{print $4}')
[ "${free_gb:-0}" -ge 25 ] && ok "free disk ${free_gb} GB" || warn "free disk ${free_gb:-?} GB — 25 GB or more recommended (Docker images + node_modules)"
command -v git >/dev/null && ok "$(git --version)" || { bad "git missing — install Xcode Command Line Tools: xcode-select --install"; fails=$((fails+1)); }
if command -v node >/dev/null; then
  v=$(node -v | sed 's/^v//'); major=${v%%.*}; rest=${v#*.}; minor=${rest%%.*}
  if [ "$major" -gt 20 ] || { [ "$major" -eq 20 ] && [ "$minor" -ge 19 ]; }; then ok "Node $v"; else bad "Node $v is too old — install Node 22 LTS or newer (nodejs.org)"; fails=$((fails+1)); fi
else bad "Node missing — install Node 22 LTS or newer (nodejs.org)"; fails=$((fails+1)); fi
command -v npm >/dev/null && ok "npm $(npm -v)" || { bad "npm missing (comes with Node)"; fails=$((fails+1)); }
if command -v docker >/dev/null; then
  docker_running && ok "Docker running" || warn "Docker installed but not running — open Docker Desktop (needed for the local backend, not for the design preview)"
else warn "Docker Desktop missing — needed only for the local backend (docs/collab/SETUP_MAC_IPHONE.md)"; fi

say ""
say "Repository"
origin=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null | sed -E 's#://[^@/]+@#://#')
case "$origin" in *dogukandurukan/perfect-match-app*) ok "origin $origin" ;; *) bad "origin is '${origin:-none}', expected github.com/dogukandurukan/perfect-match-app"; fails=$((fails+1)) ;; esac
ok "branch $(git -C "$REPO_ROOT" branch --show-current) · commit $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
changes=$(git -C "$REPO_ROOT" status --porcelain | wc -l | tr -d ' ')
[ "$changes" = 0 ] && ok "no uncommitted changes" || warn "$changes uncommitted change(s) — see git status"
[ -d "$REPO_ROOT/node_modules" ] && ok "node_modules installed" || { bad "node_modules missing — run: npm ci"; fails=$((fails+1)); }

say ""
say "Local backend ($LOCAL_PROJECT, port $LOCAL_API_PORT)"
if docker_running; then
  if [ -n "$(tempa_running)" ]; then ok "running"
  elif [ -n "$(tempa_containers)$(tempa_volumes)" ]; then ok "set up, stopped — npm run collab:start starts it (data kept)"
  else warn "not set up yet — npm run collab:setup (once)"; fi
else warn "Docker not running — backend status unknown"; fi
[ -f "$ENV_FILE" ] && ok ".env.local-backend.local present (contents not shown)" || warn ".env.local-backend.local not created yet (collab:setup creates it)"
u=$(port_user $LOCAL_API_PORT); [ -z "$u" ] && ok "port $LOCAL_API_PORT free or backend stopped" || ok "port $LOCAL_API_PORT in use by $u"
u=$(port_user 8081); [ -z "$u" ] && ok "Metro port 8081 free" || warn "port 8081 already in use by $u (another Metro?)"

say ""
say "Network"
ip=$(lan_ip)
[ -n "$ip" ] && ok "Wi-Fi/LAN address $ip — iPhone must be on the same Wi-Fi" || warn "no private Wi-Fi address — connect this Mac to the same Wi-Fi as the iPhone"

say ""
if [ "$fails" -gt 0 ]; then say "Result: $fails problem(s) to fix first (FAIL lines above)."; exit 1; fi
say "Result: ready. Design preview: npm run collab:preview"
