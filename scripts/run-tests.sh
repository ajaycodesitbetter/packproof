#!/usr/bin/env bash
# PackProof local test runner. No network beyond localhost, no model calls.
# HTTP-level tests need a production build being served; this script starts
# `next start` on PACKPROOF_TEST_PORT (default 3100) if nothing is listening.
set -e
cd "$(dirname "$0")/.."
PORT="${PACKPROOF_TEST_PORT:-3100}"
STARTED=""
if ! curl -sf -o /dev/null "http://localhost:$PORT/api/packs"; then
  npx next start -p "$PORT" > /tmp/packproof-test-server.log 2>&1 &
  STARTED=$!
  for i in $(seq 1 30); do
    curl -sf -o /dev/null "http://localhost:$PORT/api/packs" && break
    sleep 1
  done
fi
cleanup() { [ -n "$STARTED" ] && kill "$STARTED" 2>/dev/null || true; }
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
