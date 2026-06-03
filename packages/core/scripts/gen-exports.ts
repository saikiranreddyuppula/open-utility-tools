#!/usr/bin/env bun
/**
 * Generates the package.json `exports` map from the src tree, so per-tool
 * subpaths don't have to be hand-maintained as the package grows to ~1000 tools.
 *
 * Rules (mirrors tsup entry discovery in tsup.config.ts):
 *   src/index.ts              → "."
 *   src/<name>.ts             → "./<name>"            (category barrel)
 *   src/<cat>/index.ts        → "./<cat>"             (category barrel)
 *   src/<cat>/<slug>.ts       → "./<cat>/<slug>"      (per-tool module)
 *   files/dirs starting "_", *.d.ts, *.test.ts        → ignored
 */
import { Glob } from 'bun';
import { join } from 'node:path';

const pkgDir = join(import.meta.dir, '..');
const srcDir = join(pkgDir, 'src');

function exportKey(base: string): string | null {
  const parts = base.split('/');
  const last = parts[parts.length - 1]!;
  if (parts.some((p) => p.startsWith('_'))) return null;
  if (base === 'index') return '.';
  if (last === 'index') return './' + parts.slice(0, -1).join('/');
  return './' + base;
}

const exportsMap: Record<string, { types: string; import: string }> = {};
const glob = new Glob('**/*.ts');
for await (const rel of glob.scan(srcDir)) {
  if (rel.endsWith('.d.ts') || rel.endsWith('.test.ts')) continue;
  const base = rel.replace(/\.ts$/, '');
  const key = exportKey(base);
  if (!key) continue;
  exportsMap[key] = { types: `./dist/${base}.d.ts`, import: `./dist/${base}.js` };
}

const ordered: Record<string, { types: string; import: string }> = {};
for (const key of Object.keys(exportsMap).sort((a, b) =>
  a === '.' ? -1 : b === '.' ? 1 : a.localeCompare(b),
)) {
  ordered[key] = exportsMap[key]!;
}

const pkgPath = join(pkgDir, 'package.json');
const pkg = JSON.parse(await Bun.file(pkgPath).text());
pkg.exports = ordered;
await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`gen-exports: wrote ${Object.keys(ordered).length} subpath exports`);
