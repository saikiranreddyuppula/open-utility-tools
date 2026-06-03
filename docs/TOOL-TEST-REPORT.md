# Tool Runtime Smoke Report

Generated: 2026-06-03T21:24:01.460Z

Total tools: 982
Passed: 982
Failed: 0
Pass rate: 100.00%
Mode: full run

## Method

The harness launched one system Chrome instance in headless mode and drove tool pages at `http://localhost:4321/tools/<slug>/` through the Chrome DevTools Protocol using Node's built-in WebSocket. It used six concurrent tabs, enabled Page/Runtime/Log domains, waited for page load, then polled up to 8 seconds for the lazy client component to replace the spinner with visible tool controls or panels. Each mounted tool received one generic interaction: textarea input when available, otherwise a generate/run/convert/calculate button click when present. Benign favicon, service worker, manifest, WASM, network 404, fetch, and hydration noise was filtered before marking runtime errors.

## Failures

No runtime failures remain.
Passed tools: 982.

