import { defineConfig } from 'tsup';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Auto-discover one entry per module so per-tool subpaths stay independently
// tree-shakeable, without hand-maintaining a list as the package grows. Mirrors
// the export-key rules in scripts/gen-exports.ts:
//   src/index.ts, src/<name>.ts, src/<cat>/index.ts, src/<cat>/<slug>.ts
// Ignores _-prefixed (e.g. _wasm), *.d.ts, and *.test.ts.
function discoverEntries(srcDir: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name.startsWith('_')) continue;
      const abs = join(dir, name.name);
      if (name.isDirectory()) {
        walk(abs, prefix ? `${prefix}/${name.name}` : name.name);
      } else if (name.name.endsWith('.ts') && !name.name.endsWith('.d.ts')) {
        const base = name.name.replace(/\.ts$/, '');
        const key = prefix ? `${prefix}/${base}` : base;
        entries[key] = abs;
      }
    }
  };
  walk(srcDir, '');
  return entries;
}

export default defineConfig({
  entry: discoverEntries(join(import.meta.dirname ?? __dirname, 'src')),
  format: ['esm'],
  target: 'es2022',
  dts: true,
  splitting: false,
  treeshake: true,
  clean: true,
  sourcemap: true,
});
