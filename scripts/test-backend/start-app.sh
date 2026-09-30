#!/bin/sh
# Starts Metro for the dev client against the SEPARATE test project.
# The app refuses to start if the test settings are missing or point at live.
set -e
cd "$(dirname "$0")/../.."
[ -f .env.test.local ] || { echo "missing .env.test.local"; exit 2; }
TEMPA_TEST_SUPABASE_URL=$(grep '^TEST_SUPABASE_URL=' .env.test.local | cut -d= -f2-)
TEMPA_TEST_SUPABASE_ANON_KEY=$(grep '^TEST_SUPABASE_ANON_KEY=' .env.test.local | cut -d= -f2-)
export TEMPA_BACKEND=test TEMPA_TEST_SUPABASE_URL TEMPA_TEST_SUPABASE_ANON_KEY
exec npx expo start --dev-client -c
