#!/bin/sh
# Starts Metro for the dev client against the LOCAL Supabase on this Mac,
# reachable from the phone over the local Wi-Fi. Never the shared DEV/live
# project: TEMPA_BACKEND=local only, and the app refuses to start if the
# local URL / key are missing or not a private LAN / loopback address.
#   1. node scripts/local-backend/setup.mjs && node scripts/local-backend/seed.mjs   (once)
#   2. scripts/local-backend/start-app.sh
set -e
cd "$(dirname "$0")/../.."
ENVF=.env.local-backend.local
[ -f "$ENVF" ] || { echo "missing $ENVF — run node scripts/local-backend/setup.mjs"; exit 2; }
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
case "$IP" in
  10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) ;;
  *) echo "no private Wi-Fi/LAN address found (got '$IP') — connect the Mac to the same Wi-Fi as the phone"; exit 2 ;;
esac
ANON=$(grep '^LOCAL_SUPABASE_ANON_KEY=' "$ENVF" | cut -d= -f2-)
[ -n "$ANON" ] || { echo "local anon key missing — re-run setup"; exit 2; }
# The local API must answer on this Mac and on the LAN address the phone uses.
curl -fsS -o /dev/null -H "apikey: $ANON" "http://127.0.0.1:55421/auth/v1/health" || { echo "local Supabase is not running — run node scripts/local-backend/setup.mjs"; exit 2; }
curl -fsS -o /dev/null -H "apikey: $ANON" "http://$IP:55421/auth/v1/health" || { echo "local Supabase not reachable on $IP:55421 (firewall?)"; exit 2; }
node scripts/local-backend/login-code.mjs
unset TEMPA_TEST_SUPABASE_URL TEMPA_TEST_SUPABASE_ANON_KEY
export TEMPA_BACKEND=local
export TEMPA_LOCAL_SUPABASE_URL="http://$IP:55421"
export TEMPA_LOCAL_SUPABASE_ANON_KEY="$ANON"
export TEMPA_DEV_TEST_EMAIL=tempa-matches-tester@tempa-test.example.com
echo "App backend: LOCAL · $TEMPA_LOCAL_SUPABASE_URL (badge shows LOCAL · local:55421)"
exec npx expo start --dev-client -c
