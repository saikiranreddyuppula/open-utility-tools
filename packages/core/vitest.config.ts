import { defineConfig } from 'vitest/config';

// Node-runtime unit/golden tests over src. The cross-runtime E2E (Node + Bun,
// against the built dist incl. the WASM image path) lives in test/cross-runtime.mjs
// and is run via `bun run test:cross`. Browser-mode E2E is wired in CI.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
