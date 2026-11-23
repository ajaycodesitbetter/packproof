#!/usr/bin/env bash
# PackProof local test runner. No network beyond localhost, no model calls.
# HTTP-level tests need a production build being served; this script starts
# `next start` on PACKPROOF_TEST_PORT (default 3100) if nothing is listening.
set -e
cd "$(dirname "$0")/.."
PORT="${PACKPROOF_TEST_PORT:-3100}"
STARTED=""
TEST_DB=""
if ! curl -sf -o /dev/null "http://localhost:$PORT/api/packs"; then
  # Local-only env for the isolation suite: synthetic JWT secret (never the
  # production secret), dummy GitHub app creds (OAuth is never exercised),
  # and a throwaway file-backed libSQL store with the library migration
  # applied. Production env is never read or modified.
  export AUTH_SECRET="${AUTH_SECRET:-packproof-local-test-secret}"
  export AUTH_GITHUB_ID="${AUTH_GITHUB_ID:-local-test-unused}"
  export AUTH_GITHUB_SECRET="${AUTH_GITHUB_SECRET:-local-test-unused}"
  # libSQL store vars are scoped to the migration + server processes only:
  # exporting them to the test children breaks the discovery suites, which
  # pin the in-memory path at module init and must not see a libsql env.
  TEST_DB="$(mktemp -u /tmp/packproof-test-library-XXXXXX.db)"
  TEST_DB_URL="file:$TEST_DB"
  PACKPROOF_STORE=libsql TURSO_DATABASE_URL="$TEST_DB_URL" node -e 'const{createClient}=require("@libsql/client");const{readFileSync}=require("fs");createClient({url:process.env.TURSO_DATABASE_URL}).execute(readFileSync("migrations/0001_library.sql","utf8")).then(()=>process.exit(0),e=>{console.error(e.message);process.exit(1)})'
  PACKPROOF_STORE=libsql TURSO_DATABASE_URL="$TEST_DB_URL" npx next start -p "$PORT" > /tmp/packproof-test-server.log 2>&1 &
  STARTED=$!
  for i in $(seq 1 30); do
    curl -sf -o /dev/null "http://localhost:$PORT/api/packs" && break
    sleep 1
  done
fi
cleanup() { [ -n "$STARTED" ] && kill "$STARTED" 2>/dev/null || true; [ -n "$TEST_DB" ] && rm -f "$TEST_DB"; }
trap cleanup EXIT

# 1. Plain JS suites (HTTP-level site integrity + route contracts)
node --test test/*.test.cjs test/*.test.mjs

# 2. TS suites: bundle with the repo's own esbuild (tsx-compatible runner
#    substitute), run from inside the repo so native modules resolve.
mkdir -p .test-build
for f in test/*.test.mts; do
  name=$(basename "$f" .test.mts)
  ./node_modules/.bin/esbuild "$f" --bundle --platform=node --format=esm \
    '--banner:js=import {createRequire} from "node:module"; const require = createRequire(import.meta.url);' \
    --outfile=".test-build/$name.mjs" --log-level=error
  node --test ".test-build/$name.mjs"
done
rm -rf .test-build
echo "ALL TEST SUITES PASSED"
