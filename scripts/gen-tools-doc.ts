#!/usr/bin/env bun
/** Generate docs/BUILT-TOOLS.md from the live registry manifest. */
import { TOOL_META } from '../lib/registry/registry.generated';
import { CATEGORY_META, CATEGORIES } from '../lib/registry/types';

const byCat = new Map<string, typeof TOOL_META>();
for (const t of TOOL_META) {
  const arr = byCat.get(t.category) ?? [];
  arr.push(t);
  byCat.set(t.category, arr);
}

const wasmCount = TOOL_META.filter((t) => t.loadWasm).length;

let md = `# Built Tools\n\n`;
md += `Auto-generated from the live registry (\`bun run scripts/gen-tools-doc.ts\`). `;
md += `**${TOOL_META.length} tools** across ${byCat.size} categories — ${wasmCount} use Rust/WASM. All run 100% client-side.\n\n`;
md += `| Category | Count |\n|---|---|\n`;
for (const c of CATEGORIES) {
  const n = byCat.get(c)?.length ?? 0;
  if (n) md += `| ${CATEGORY_META[c].name} | ${n} |\n`;
}
md += `| **Total** | **${TOOL_META.length}** |\n\n`;

for (const c of CATEGORIES) {
  const list = byCat.get(c);
  if (!list?.length) continue;
  md += `\n## ${CATEGORY_META[c].name} (${list.length})\n\n`;
  for (const t of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
    const wasm = t.loadWasm ? ' 🦀' : '';
    md += `- **${t.name}**${wasm} — \`/tools/${t.slug}\` — ${t.description}\n`;
  }
}
md += `\n\n🦀 = uses Rust→WASM (runs in a Web Worker).\n`;

await Bun.write(new URL('../docs/BUILT-TOOLS.md', import.meta.url), md);
console.log(`wrote docs/BUILT-TOOLS.md (${TOOL_META.length} tools, ${wasmCount} wasm)`);
