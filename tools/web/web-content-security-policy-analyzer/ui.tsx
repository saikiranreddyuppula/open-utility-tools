'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type View = 'report' | 'normalized';

interface Finding {
  severity: 'high' | 'medium' | 'low';
  message: string;
}

const SAMPLE =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com *; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src *";

const FETCH_DIRECTIVES = new Set<string>([
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
  'prefetch-src',
  'script-src-elem',
  'script-src-attr',
  'style-src-elem',
  'style-src-attr',
]);

function parseDirectives(header: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const name = (tokens[0] ?? '').toLowerCase();
    if (!name) continue;
    map.set(name, tokens.slice(1));
  }
  return map;
}

function analyzeDirective(name: string, sources: string[]): Finding[] {
  const findings: Finding[] = [];
  const isScript = name === 'script-src' || name === 'default-src';

  for (const src of sources) {
    const s = src.toLowerCase();
    if (s === "'unsafe-inline'") {
      findings.push({
        severity: isScript ? 'high' : 'medium',
        message: `'unsafe-inline' allows inline ${isScript ? 'scripts' : 'styles'} — defeats much of CSP's XSS protection.`,
      });
    } else if (s === "'unsafe-eval'") {
      findings.push({
        severity: 'high',
        message: `'unsafe-eval' permits eval()/new Function() — a common XSS sink.`,
      });
    } else if (s === '*') {
      findings.push({
        severity: 'high',
        message: `Wildcard * allows loading from any origin.`,
      });
    } else if (s === 'data:' && (name === 'script-src' || name === 'default-src')) {
      findings.push({
        severity: 'high',
        message: `data: in ${name} lets attackers inline executable payloads.`,
      });
    } else if (s === "'unsafe-hashes'") {
      findings.push({
        severity: 'medium',
        message: `'unsafe-hashes' relaxes hash matching to inline event handlers.`,
      });
    } else if (s.startsWith('http://')) {
      findings.push({
        severity: 'medium',
        message: `Insecure http:// source "${src}" can be MITM'd.`,
      });
    }
  }
  return findings;
}

function severityLabel(s: Finding['severity']): string {
  if (s === 'high') return '[HIGH]  ';
  if (s === 'medium') return '[MEDIUM]';
  return '[LOW]   ';
}

function buildReport(header: string): string {
  const map = parseDirectives(header);
  if (map.size === 0) throw new Error('No directives found in the policy.');

  const lines: string[] = [];
  const allFindings: Finding[] = [];

  lines.push('=== Directives ===\n');
  for (const [name, sources] of map.entries()) {
    lines.push(`${name}: ${sources.length ? sources.join(' ') : '(empty)'}`);
    const findings = analyzeDirective(name, sources);
    for (const f of findings) {
      lines.push(`    ${severityLabel(f.severity)} ${f.message}`);
      allFindings.push(f);
    }
  }

  // Policy-wide checks.
  const missing: Finding[] = [];
  if (!map.has('default-src')) {
    missing.push({
      severity: 'medium',
      message: `No default-src — directives without an explicit value fall back to allowing everything.`,
    });
  }
  if (!map.has('object-src') && !map.has('default-src')) {
    missing.push({
      severity: 'medium',
      message: `No object-src — legacy plugins (Flash/PDF) can execute. Set object-src 'none'.`,
    });
  }
  if (!map.has('base-uri')) {
    missing.push({
      severity: 'low',
      message: `No base-uri — a <base> injection can redirect relative URLs. Set base-uri 'none' or 'self'.`,
    });
  }

  if (missing.length) {
    lines.push('\n=== Missing / weak hardening ===\n');
    for (const f of missing) {
      lines.push(`${severityLabel(f.severity)} ${f.message}`);
      allFindings.push(f);
    }
  }

  const high = allFindings.filter((f) => f.severity === 'high').length;
  const med = allFindings.filter((f) => f.severity === 'medium').length;
  const low = allFindings.filter((f) => f.severity === 'low').length;
  lines.push(
    `\n=== Summary ===\n${high} high · ${med} medium · ${low} low — ${allFindings.length} finding(s).`,
  );
  if (allFindings.length === 0) {
    lines.push('No risky directives detected.');
  }

  return lines.join('\n');
}

function normalize(header: string): string {
  const map = parseDirectives(header);
  if (map.size === 0) throw new Error('No directives found in the policy.');
  const ordered = [...map.entries()].sort((a, b) => {
    // default-src first, then fetch directives, then the rest, all alphabetical.
    const rank = (n: string) =>
      n === 'default-src' ? 0 : FETCH_DIRECTIVES.has(n) ? 1 : 2;
    const r = rank(a[0]) - rank(b[0]);
    return r !== 0 ? r : a[0].localeCompare(b[0]);
  });
  return ordered
    .map(([name, sources]) => {
      const uniq = [...new Set(sources)];
      return uniq.length ? `${name} ${uniq.join(' ')}` : name;
    })
    .join('; ');
}

export default function CspHeaderAnalyzer() {
  const [view, setView] = useState<View>('report');

  return (
    <TextToolLayout
      deps={[view]}
      transform={(input) => {
        if (!input.trim()) return '';
        return view === 'report' ? buildReport(input) : normalize(input);
      }}
      inputLabel="Content-Security-Policy value"
      outputLabel={view === 'report' ? 'Analysis' : 'Normalized policy'}
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName="csp-analysis.txt"
      options={
        <Field label="Output">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="report">Findings</TabsTrigger>
              <TabsTrigger value="normalized">Normalized</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
