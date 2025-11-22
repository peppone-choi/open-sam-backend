#!/usr/bin/env bash
set -euo pipefail

# Seeds a minimal QA session, user, nation, and general so that
# auth/login + command APIs return deterministic responses.
#
# Usage:
#   ./scripts/seed-qa.sh [session_id]
#
# Environment overrides:
#   QA_SESSION_ID        (default: sangokushi_default)
#   QA_USERNAME         (default: qa-admin)
#   QA_PASSWORD         (default: qa-pass)
#   QA_NATION_NAME      (default: QA Test Nation)
#   QA_GENERAL_NAME     (default: Commander QA)
#   QA_CITY_ID          (default: 1)
#   MONGODB_URI         (default: mongodb://localhost:27017/sangokushi)
#
# Prerequisites:
#   - MongoDB listening on $MONGODB_URI
#   - `npm install` (ts-node available locally)
#   - Session cities initialized only via this script (no manual DB edits)
#
# The script is idempotent: re-running will upsert the same user/nation/general.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

SESSION_ID="${1:-${QA_SESSION_ID:-sangokushi_default}}"
USERNAME="${QA_USERNAME:-qa-admin}"
PASSWORD="${QA_PASSWORD:-qa-pass}"
NATION_NAME="${QA_NATION_NAME:-QA Test Nation}"
GENERAL_NAME="${QA_GENERAL_NAME:-Commander QA}"
CITY_ID="${QA_CITY_ID:-1}"
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/sangokushi}"

printf '\n[seed-qa] Using Mongo: %s\n' "$MONGODB_URI"
printf '[seed-qa] Session: %s\n' "$SESSION_ID"
printf '[seed-qa] User: %s / %s\n' "$USERNAME" "$PASSWORD"
printf '[seed-qa] Nation: %s (city #%s)\n\n' "$NATION_NAME" "$CITY_ID"

# 1) Ensure the session + cities exist
npx ts-node --project tsconfig.json scripts/init-cities.ts "$SESSION_ID"

# 2) Create/refresh QA account, nation, and ruler general
npx ts-node --project tsconfig.json scripts/create-test-setup.ts \
  "$SESSION_ID" \
  "$USERNAME" \
  "$PASSWORD" \
  "$NATION_NAME" \
  "$CITY_ID"

cat <<EOF

[seed-qa] Done!
- Session ID: $SESSION_ID
- Username:   $USERNAME
- Password:   $PASSWORD
- Nation:     $NATION_NAME
- City ID:    $CITY_ID

Start the backend with: npm run dev:api
Then run ./test-endpoints.sh (BASE_URL=http://localhost:8080)
EOF
