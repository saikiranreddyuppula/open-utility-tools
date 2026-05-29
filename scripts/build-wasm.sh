#!/usr/bin/env bash
# Build every Rust crate under rust/crates/* to WASM with wasm-pack and emit the
# --target web bindings into public/wasm/<crate>/. The worker lazy-imports these
# at runtime (bundler-ignored), and the service worker caches them for offline.
#
# Adding a heavy tool's backend = drop a new crate folder; this script finds it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "✗ wasm-pack not found. Install: cargo install wasm-pack (or see README)." >&2
  exit 1
fi

CRATES_DIR="$ROOT/rust/crates"
OUT_ROOT="$ROOT/public/wasm"
mkdir -p "$OUT_ROOT"

# Allow building a single crate: ./build-wasm.sh core
ONLY="${1:-}"
built=0

for dir in "$CRATES_DIR"/*/; do
  [ -d "$dir" ] || continue
  crate="$(basename "$dir")"
  if [ -n "$ONLY" ] && [ "$ONLY" != "$crate" ]; then
    continue
  fi
  echo "▶ wasm-pack build: $crate"
  wasm-pack build "$dir" \
    --target web \
    --out-dir "$OUT_ROOT/$crate" \
    --out-name "$crate" \
    --release
  # Drop wasm-pack's package.json/.gitignore/README — we only need js + wasm + d.ts.
  rm -f "$OUT_ROOT/$crate/package.json" "$OUT_ROOT/$crate/.gitignore" "$OUT_ROOT/$crate/README.md"
  built=$((built + 1))
done

if [ "$built" -eq 0 ]; then
  echo "✗ No crates built. (looked in $CRATES_DIR${ONLY:+ for '$ONLY'})" >&2
  exit 1
fi

echo "✓ Built $built wasm crate(s) into public/wasm/"
