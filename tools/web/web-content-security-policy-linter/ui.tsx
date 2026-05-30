'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type View = 'lint' | 'normalized';

const SAMPLE =
  "default-src 'self'; script-src 'self' 'self' 'unsafe-inline' *; style-src 'unsafe-inline'; imgg-src data:; img-src 'self' data:";

const KNOWN_DIRECTIVES = new Set<string>([
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'img-src',
  'connect-src',
  'font-src',
  'media-src',
  'object-src',
  'frame-src',
  'worker-src',
  'manifest-src',
  'child-src',
  'prefetch-src',
  'frame-ancestors',
  'form-action',
  'base-uri',
  'sandbox',
  'report-uri',
  'report-to',
  'upgrade-insecure-requests',
  'block-all-mixed-content',
  'require-trusted-types-for',
  'trusted-types',
  'navigate-to',
]);

const FETCH_ORDER = new Set<string>([
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'connect-src',
  'font-src',
  'media-src',
  'object-src',
  'frame-src',
  'worker-src',
  'manifest-src',
  'child-src',
]);

interface Directive {
  name: string;
  sources: string[];
}

function parse(header: string): Directive[] {
  const out: Directive[] = [];
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const name = (tokens[0] ?? '').toLowerCase();
    if (!name) continue;
    out.push({ name, sources: tokens.slice(1) });
  }
  return out;
}

function lint(header: string): string {
  const directives = parse(header);
  if (directives.length === 0) throw new Error('No directives found.');

  const warnings: string[] = [];
  const directiveSeen = new Map<string, number>();

  for (const { name, sources } of directives) {
    // Duplicate directive declarations (only the first counts per spec).
    directiveSeen.set(name, (directiveSeen.get(name) ?? 0) + 1);

    if (!KNOWN_DIRECTIVES.has(name)) {
      warnings.push(`Unknown directive "${name}" — typo or unsupported; it will be ignored by browsers.`);
    }

    // Duplicate sources within a directive.
    const seenSrc = new Set<string>();
    const dupSrc = new Set<string>();
    for (const s of sources) {
      const key = s.toLowerCase();
      if (seenSrc.has(key)) dupSrc.add(s);
      seenSrc.add(key);
    }
    for (const d of dupSrc) {
      warnings.push(`Directive "${name}" lists "${d}" more than once (redundant).`);
    }

    // Risky tokens.
    for (const s of sources) {
      const low = s.toLowerCase();
      if (low === "'unsafe-inline'") {
        warnings.push(`"${name}" allows 'unsafe-inline' — weakens XSS protection.`);
      } else if (low === "'unsafe-eval'") {
        warnings.push(`"${name}" allows 'unsafe-eval' — permits eval().`);
      } else if (low === '*') {
        warnings.push(`"${name}" uses wildcard * — any origin is allowed.`);
      } else if (low === 'data:' && (name === 'script-src' || name === 'default-src')) {
        warnings.push(`"${name}" allows data: — executable inline payloads possible.`);
      }
    }

    // 'none' alongside other sources is contradictory.
    if (sources.some((s) => s.toLowerCase() === "'none'") && sources.length > 1) {
      warnings.push(`"${name}" mixes 'none' with other sources — 'none' must be the only value.`);
    }
  }

  for (const [name, count] of directiveSeen.entries()) {
    if (count > 1) {
      warnings.push(`Directive "${name}" declared ${count} times — browsers honor only the first.`);
    }
  }

  if (!directiveSeen.has('default-src')) {
    warnings.push(`Missing default-src — unset fetch directives allow all sources.`);
  }
  if (!directiveSeen.has('object-src') && !directiveSeen.has('default-src')) {
    warnings.push(`Missing object-src — consider object-src 'none'.`);
  }

  const lines: string[] = [];
  lines.push('=== Directives ===');
  for (const { name, sources } of directives) {
    const known = KNOWN_DIRECTIVES.has(name) ? '' : '  ⚠ unknown';
    lines.push(`${name}: ${sources.length ? sources.join(' ') : '(empty)'}${known}`);
  }
  lines.push('');
  lines.push('=== Warnings ===');
  if (warnings.length === 0) {
    lines.push('No issues found.');
  } else {
    warnings.forEach((w, i) => lines.push(`${i + 1}. ${w}`));
  }
  lines.push('');
  lines.push(`${warnings.length} warning(s) across ${directives.length} directive(s).`);
  return lines.join('\n');
}

function normalize(header: string): string {
  const directives = parse(header);
  if (directives.length === 0) throw new Error('No directives found.');

  // Keep only the first occurrence of each directive, dedupe sources.
  const merged = new Map<string, string[]>();
  for (const { name, sources } of directives) {
    if (merged.has(name)) continue;
    merged.set(name, [...new Set(sources)]);
  }

  const ordered = [...merged.entries()].sort((a, b) => {
    const rank = (n: string) =>
      n === 'default-src' ? 0 : FETCH_ORDER.has(n) ? 1 : 2;
    const r = rank(a[0]) - rank(b[0]);
    return r !== 0 ? r : a[0].localeCompare(b[0]);
  });

  return ordered
    .map(([name, sources]) => (sources.length ? `${name} ${sources.join(' ')}` : name))
    .join('; ');
}

export default function CspLinter() {
  const [view, setView] = useState<View>('lint');

  return (
    <TextToolLayout
      deps={[view]}
      transform={(input) => {
        if (!input.trim()) return '';
        return view === 'lint' ? lint(input) : normalize(input);
      }}
      inputLabel="CSP header value"
      outputLabel={view === 'lint' ? 'Lint report' : 'Normalized header'}
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName="csp-lint.txt"
      options={
        <Field label="Output">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="lint">Lint</TabsTrigger>
              <TabsTrigger value="normalized">Normalized</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
