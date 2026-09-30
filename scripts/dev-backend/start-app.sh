#!/bin/sh
# Opens the app against perfect-match-dev as the V2 development backend
# (owner decision 2026-09-30), with the DEV test sign-in enabled:
#   1. prints a fresh REAL one-time sign-in code for the synthetic DEV test
#      account (tempa-dev-tester@tempa-test.example.com) — your terminal only;
#   2. starts Metro for the dev client with TEMPA_BACKEND=dev.
# On the phone: signed-out screen → "DEV · Test account sign-in" → enter the code.
# The admin key stays in .env.dev.local on this Mac; the app gets only the
# account's address. For a new code later: node scripts/dev-backend/test-login-code.mjs
set -e
cd "$(dirname "$0")/../.."
node scripts/dev-backend/test-login-code.mjs
export TEMPA_BACKEND=dev
export TEMPA_DEV_TEST_EMAIL=tempa-dev-tester@tempa-test.example.com
exec npx expo start --dev-client -c
