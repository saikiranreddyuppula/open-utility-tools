// Cross-runtime E2E: exercises the BUILT dist (the real published artifact) and
// runs identically under Node and Bun — `node test/cross-runtime.mjs` and
// `bun test/cross-runtime.mjs`. Asserts pure-TS extraction AND the WASM-backed
// isomorphic image path. Exits non-zero on any failure.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const runtime = typeof Bun !== 'undefined' ? 'bun' : 'node';
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ [${runtime}] ${name}`);
}

// --- pure extracted tool (no wasm) ---
const { addBusinessDays } = await import('../dist/time/add-business-days.js');
await check('addBusinessDays adds across weekends', () => {
  assert.equal(addBusinessDays('2026-06-01', 10).date, '2026-06-15');
});
await check('addBusinessDays skips holidays', () => {
  assert.equal(addBusinessDays('2026-06-01', 3, { holidays: ['2026-06-03'] }).date, '2026-06-05');
});

// --- WASM-backed isomorphic raster path ---
const { convert, probe } = await import('../dist/image/index.js');
const png = readFileSync(fileURLToPath(new URL('./fixtures/sample-1200x630.png', import.meta.url)));

await check('probe reads PNG dimensions', async () => {
  assert.deepEqual(await probe(png), { width: 1200, height: 630, format: 'PNG' });
});

await check('convert PNG → WebP produces a valid WEBP', async () => {
  const out = await convert(png, { format: 'webp', quality: 80 });
  assert.ok(out.length > 0, 'output is non-empty');
  const sig = Buffer.from(out.subarray(0, 4)).toString('ascii') +
    Buffer.from(out.subarray(8, 12)).toString('ascii');
  assert.equal(sig, 'RIFFWEBP');
  assert.equal((await probe(out)).format, 'WebP');
});

await check('convert resize preserves aspect ratio', async () => {
  const out = await convert(png, { format: 'png', maxWidth: 400 });
  const info = await probe(out);
  assert.equal(info.width, 400);
  assert.equal(info.height, 210); // 630 * 400/1200
});

// --- package tool catalog surface ---
const { TOOL_CATALOG, getToolBySlug } = await import('../dist/tools/index.js');
const { tool: jsonFormatterTool } = await import('../dist/tools/data/json-formatter.js');
const { runDeveloperTool, getDeveloperToolDefinition } = await import('../dist/developer-tools.js');

await check('tool catalog ships all browser tools', () => {
  assert.equal(TOOL_CATALOG.length, 982);
  assert.equal(
    getToolBySlug('json-formatter').packageImportPath,
    '@open-utility-tools/core/tools/data/json-formatter',
  );
  assert.equal(
    getToolBySlug('saml-request-decoder').packageImportPath,
    '@open-utility-tools/core/tools/web/saml-request-decoder',
  );
});

await check('per-tool catalog subpath exports metadata', () => {
  assert.equal(jsonFormatterTool.name, 'JSON Formatter');
  assert.equal(jsonFormatterTool.webPath, '/tools/json-formatter/');
});

await check('developer-tools direct API runs SAML decoder', async () => {
  assert.equal(getDeveloperToolDefinition('saml-request-decoder').name, 'SAML Request Decoder');
  const out = await runDeveloperTool('saml-request-decoder', {
    input: 'SAMLRequest=PHNhbWxwOkF1dGhuUmVxdWVzdCBJRD0iYWJjIiBWZXJzaW9uPSIyLjAiIC8+',
  });
  assert.match(out.output, /assertionId|issuer/);
});

console.log(`\n[${runtime}] ${passed} checks passed`);
