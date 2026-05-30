'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type View = 'declared' | 'usages' | 'audit';

const SAMPLE = `:root {
  --brand: #4f46e5;
  --radius: 8px;
  --gap: 12px;
  --legacy: red;
}

.card {
  color: var(--brand);
  border-radius: var(--radius);
  gap: var(--gap, 16px);
  background: var(--surface, #fff);
}`;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

interface Decl {
  name: string;
  value: string;
  scope: string;
}

interface Usage {
  name: string;
  fallback: string | null;
}

function parse(css: string): { decls: Decl[]; usages: Usage[] } {
  const clean = stripComments(css);
  const decls: Decl[] = [];
  const usages: Usage[] = [];

  // Declarations within selector blocks (capture scope).
  const blockRe = /([^{}]*)\{([^{}]*)\}/g;
  const declRe = /(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(clean)) !== null) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ') || '(unknown)';
    const body = m[2] ?? '';
    declRe.lastIndex = 0;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(body)) !== null) {
      const name = d[1];
      const value = d[2];
      if (name === undefined || value === undefined) continue;
      decls.push({ name, value: value.trim(), scope: selector });
    }
  }

  // var(--name) and var(--name, fallback) usages across the whole text.
  const varRe = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g;
  let u: RegExpExecArray | null;
  while ((u = varRe.exec(clean)) !== null) {
    const name = u[1];
    if (name === undefined) continue;
    const fb = u[2];
    usages.push({ name, fallback: fb !== undefined ? fb.trim() : null });
  }

  return { decls, usages };
}

function declaredView(decls: Decl[]): string {
  if (decls.length === 0) return 'No custom property declarations found.';
  const nameW = Math.max(...decls.map((d) => d.name.length), 4);
  const valW = Math.max(...decls.map((d) => d.value.length), 5);
  const lines: string[] = [];
  lines.push(`${'NAME'.padEnd(nameW)}  ${'VALUE'.padEnd(valW)}  SCOPE`);
  lines.push('-'.repeat(nameW + valW + 12));
  for (const d of decls) {
    lines.push(`${d.name.padEnd(nameW)}  ${d.value.padEnd(valW)}  ${d.scope}`);
  }
  lines.push('');
  lines.push(`${decls.length} declaration(s).`);
  return lines.join('\n');
}

function usagesView(usages: Usage[]): string {
  if (usages.length === 0) return 'No var() usages found.';
  // Count per-name with fallbacks noted.
  const counts = new Map<string, number>();
  for (const u of usages) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
  const lines: string[] = [];
  lines.push('var() usages:');
  for (const u of usages) {
    lines.push(
      `  ${u.name}${u.fallback !== null ? `  (fallback: ${u.fallback})` : ''}`,
    );
  }
  lines.push('');
  lines.push('Count by name:');
  for (const [name, c] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${name}: ${c}`);
  }
  return lines.join('\n');
}

function auditView(decls: Decl[], usages: Usage[]): string {
  const declared = new Set(decls.map((d) => d.name));
  const used = new Set(usages.map((u) => u.name));

  const usedNotDeclared = [...used].filter((n) => !declared.has(n)).sort();
  const declaredNotUsed = [...declared].filter((n) => !used.has(n)).sort();

  const lines: string[] = [];
  lines.push('=== Used but never declared ===');
  if (usedNotDeclared.length === 0) {
    lines.push('  (none — every var() resolves to a declaration)');
  } else {
    for (const n of usedNotDeclared) {
      const hasFb = usages.some((u) => u.name === n && u.fallback !== null);
      lines.push(`  ${n}${hasFb ? '  (relies on fallback)' : '  ⚠ no fallback — resolves to nothing'}`);
    }
  }
  lines.push('');
  lines.push('=== Declared but never used ===');
  if (declaredNotUsed.length === 0) {
    lines.push('  (none — every declared variable is referenced)');
  } else {
    for (const n of declaredNotUsed) lines.push(`  ${n}`);
  }
  lines.push('');
  lines.push(
    `${declared.size} declared · ${used.size} referenced · ${usedNotDeclared.length} undeclared · ${declaredNotUsed.length} unused.`,
  );
  return lines.join('\n');
}

export default function CssVariablesExtractor() {
  const [view, setView] = useState<View>('declared');

  return (
    <TextToolLayout
      deps={[view]}
      transform={(input) => {
        if (!input.trim()) return '';
        const { decls, usages } = parse(input);
        if (decls.length === 0 && usages.length === 0) {
          throw new Error('No CSS custom properties or var() usages found.');
        }
        if (view === 'declared') return declaredView(decls);
        if (view === 'usages') return usagesView(usages);
        return auditView(decls, usages);
      }}
      inputLabel="CSS source"
      outputLabel="Report"
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName="css-variables-report.txt"
      options={
        <Field label="View">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="declared">Declared</TabsTrigger>
              <TabsTrigger value="usages">Usages</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
