---
"@open-utility-tools/core": minor
---

Extract the full **time** category — 62 additional tools (age, durations, cron, ISO-8601/week dates, timezones, timestamps, zodiac/astronomy, and more) — into typed, isomorphic per-tool modules under `@open-utility-tools/core/time/<tool>`, each with a golden test suite (466 tests). Adds export-map codegen + tsup/TypeDoc auto-discovery so per-tool subpaths scale without hand-maintenance.
