#!/bin/sh
# Design preview WITHOUT any backend: Metro for the iPhone dev build only.
# The app needs a backend setting to start, so it gets an OFFLINE local
# address (http://127.0.0.1:59999, nothing listens there) and a placeholder
# publishable key — every network call fails, nothing can be read or written.
# Use the signed-out screen → "DEV · Design preview". Sign-in will not work in
# this mode (that needs npm run collab:start).
#   npm run collab:preview
. "$(dirname "$0")/_common.sh"
assert_tempa_repo
[ -d "$REPO_ROOT/node_modules" ] || stop "node_modules missing" "run: npm ci"
[ -z "$(port_user 59999)" ] || stop "port 59999 is in use — the offline address must stay unused" "ask Dogukan"
PORT=${1:-8081}
u=$(port_user "$PORT"); [ -z "$u" ] || stop "port $PORT is already used by $u (another Metro?)" "close it (Ctrl+C in that terminal) or run: npm run collab:preview -- 8090"
[ -n "$(lan_ip)" ] || warn "no private Wi-Fi address — the iPhone will not reach Metro"
cd "$REPO_ROOT" || exit 2
unset TEMPA_TEST_SUPABASE_URL TEMPA_TEST_SUPABASE_ANON_KEY TEMPA_DEV_TEST_EMAIL
export TEMPA_BACKEND=local
export TEMPA_LOCAL_SUPABASE_URL="http://127.0.0.1:59999"
export TEMPA_LOCAL_SUPABASE_ANON_KEY="sb_publishable_offline-design-preview"
say "Design preview (no backend). Badge shows LOCAL · local:59999 = offline."
say "iPhone: open the Tempa dev build → this Mac's Metro → signed-out screen → DEV · Design preview"
exec npx expo start --dev-client -c --port "$PORT"
