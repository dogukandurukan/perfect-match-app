#!/bin/sh
# Opens the app against perfect-match-dev as the V2 development backend
# (owner decision 2026-09-30). The amber "DEV · fyqwjduzpnjuxqsloxih" badge
# shows on every screen; the V2 entry ("DEV · Join with new onboarding") is on
# the signed-out Home screen.
set -e
cd "$(dirname "$0")/../.."
export TEMPA_BACKEND=dev
exec npx expo start --dev-client -c
