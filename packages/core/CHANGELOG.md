# @open-utility-tools/core

## 0.2.0

### Minor Changes

- 4481d2e: Extract the full **time** category — 62 additional tools (age, durations, cron, ISO-8601/week dates, timezones, timestamps, zodiac/astronomy, and more) — into typed, isomorphic per-tool modules under `@open-utility-tools/core/time/<tool>`, each with a golden test suite (466 tests). Adds export-map codegen + tsup/TypeDoc auto-discovery so per-tool subpaths scale without hand-maintenance.
- 215400e: Add per-tool deep subpath exports and the first WASM-backed, isomorphic raster image tools (`./image/convert`, `./image/probe`) that run identically in the browser, Node, and Bun. Adds the extracted `./time/add-business-days` tool. Wires cross-runtime E2E tests (Node + Bun) and TypeDoc API docs.
