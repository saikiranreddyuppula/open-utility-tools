#!/usr/bin/env bash
#
# Production build — fast, multi-core, and still type-safe.
#
# `next build` no longer runs `tsc` internally (next.config.mjs sets
# typescript.ignoreBuildErrors). Instead we run the compile and the TypeScript
# check CONCURRENTLY here, so type checking (~12s cold) overlaps the compile
# instead of adding to it serially. BOTH must pass for the build to succeed.
#
# Combined with Turbopack's on-disk build cache (turbopackFileSystemCacheForBuild)
# and `tsc --incremental`, a warm rebuild is ~8s instead of ~30s.
#
# `prebuild` (registry:gen + og:gen) has already run by the time bun invokes this.
set -uo pipefail

# tsc's incremental cache lives OUTSIDE .next — `next build` clears/manages
# .next at startup and would race with (and corrupt) a tsbuildinfo kept there.
BIN=node_modules/.bin
CACHE=node_modules/.cache/typecheck
mkdir -p "$CACHE"

# TypeScript check (app + scripts), incremental, in the background.
(
  "$BIN/tsc" -p tsconfig.typecheck.json --noEmit --incremental \
       --tsBuildInfoFile "$CACHE/app.tsbuildinfo" \
    && "$BIN/tsc" -p scripts/tsconfig.json --noEmit --incremental \
         --tsBuildInfoFile "$CACHE/scripts.tsbuildinfo"
) &
TC_PID=$!

# Next.js production build in the background. Try the configured default first
# (Turbopack in Next 16), then fall back to webpack if Turbopack hits an
# environment-specific internal panic.
(
  "$BIN/next" build || {
    STATUS=$?
    echo "next build failed with exit $STATUS; retrying with --webpack"
    "$BIN/next" build --webpack
  }
) &
NB_PID=$!

# Wait for each and capture its exit status independently.
wait "$NB_PID"; NB_STATUS=$?
wait "$TC_PID"; TC_STATUS=$?

[ "$NB_STATUS" -ne 0 ] && echo "✗ next build failed (exit $NB_STATUS)"
[ "$TC_STATUS" -ne 0 ] && echo "✗ typecheck failed (exit $TC_STATUS)"

[ "$NB_STATUS" -eq 0 ] && [ "$TC_STATUS" -eq 0 ]
