'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface DirectiveDef {
  key: string;
  name: string;
  placeholder: string;
}

const DIRECTIVES: DirectiveDef[] = [
  { key: 'default-src', name: 'default-src', placeholder: "'self'" },
  { key: 'script-src', name: 'script-src', placeholder: "'self' https://cdn.example.com" },
  { key: 'style-src', name: 'style-src', placeholder: "'self' 'unsafe-inline'" },
  { key: 'img-src', name: 'img-src', placeholder: "'self' data: https:" },
  { key: 'connect-src', name: 'connect-src', placeholder: "'self' https://api.example.com" },
  { key: 'font-src', name: 'font-src', placeholder: "'self' https://fonts.gstatic.com" },
  { key: 'frame-src', name: 'frame-src', placeholder: "'self'" },
  { key: 'frame-ancestors', name: 'frame-ancestors', placeholder: "'none'" },
  { key: 'base-uri', name: 'base-uri', placeholder: "'self'" },
  { key: 'form-action', name: 'form-action', placeholder: "'self'" },
  { key: 'object-src', name: 'object-src', placeholder: "'none'" },
  { key: 'report-uri', name: 'report-uri', placeholder: '/csp-report' },
  { key: 'report-to', name: 'report-to', placeholder: 'csp-endpoint' },
];

const KEYWORDS = ['self', 'none', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic'] as const;

const KNOWN_QUOTED = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'strict-dynamic'",
  "'unsafe-hashes'",
  "'wasm-unsafe-eval'",
]);

// Normalize a single source token: auto-quote bare keywords and nonce-/sha-helpers.
function normalizeToken(tok: string): string {
  const t = tok.trim();
  if (!t) return '';
  // Already quoted
  if (t.startsWith("'") && t.endsWith("'")) return t;
  // Keyword?
  if ((KEYWORDS as readonly string[]).includes(t)) return `'${t}'`;
  if (t === 'unsafe-hashes' || t === 'wasm-unsafe-eval') return `'${t}'`;
  // Nonce / hash
  if (/^nonce-/i.test(t)) return `'${t}'`;
  if (/^(sha256|sha384|sha512)-/i.test(t)) return `'${t}'`;
  return t;
}

function normalizeSources(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => normalizeToken(s))
    .filter(Boolean);
}

export default function CspBuilderTool() {
  const [values, setValues] = useState<Record<string, string>>({
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data:",
    'connect-src': "'self'",
    'font-src': "'self'",
    'frame-src': '',
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'object-src': "'none'",
    'report-uri': '',
    'report-to': '',
  });

  const addKeyword = (key: string, kw: string) => {
    setValues((prev) => {
      const cur = prev[key] ?? '';
      const quoted = `'${kw}'`;
      if (normalizeSources(cur).includes(quoted)) return prev;
      const next = cur.trim() ? `${cur.trim()} ${quoted}` : quoted;
      return { ...prev, [key]: next };
    });
  };

  const result = useMemo(() => {
    const summary: Array<{ name: string; sources: string[] }> = [];
    const warnings: string[] = [];
    const parts: string[] = [];

    for (const d of DIRECTIVES) {
      const raw = values[d.key] ?? '';
      if (raw.trim() === '') continue;
      // report-uri/report-to take raw (no source-keyword quoting of endpoints)
      const isReport = d.key === 'report-uri' || d.key === 'report-to';
      const sources = isReport
        ? raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
        : normalizeSources(raw);
      if (sources.length === 0) continue;
      parts.push(`${d.name} ${sources.join(' ')}`);
      summary.push({ name: d.name, sources });
    }

    const hasDefault = (values['default-src'] ?? '').trim() !== '';
    if (!hasDefault) {
      warnings.push('No default-src set — directives you omit will not fall back to anything (most default to allowing all).');
    }

    // unsafe-inline negated by nonce/strict-dynamic
    for (const key of ['script-src', 'style-src']) {
      const sources = normalizeSources(values[key] ?? '');
      const hasInline = sources.includes("'unsafe-inline'");
      const hasNonceOrHash = sources.some(
        (s) => /^'nonce-/i.test(s) || /^'(sha256|sha384|sha512)-/i.test(s) || s === "'strict-dynamic'",
      );
      if (hasInline && hasNonceOrHash) {
        warnings.push(`${key}: 'unsafe-inline' is ignored by modern browsers when a nonce, hash, or 'strict-dynamic' is present.`);
      }
    }

    const objectSrc = normalizeSources(values['object-src'] ?? '');
    if (!values['object-src'] && !objectSrc.includes("'none'")) {
      // only when default-src missing
      if (!hasDefault) warnings.push("Consider object-src 'none' to block legacy plugins.");
    }

    if (parts.length === 0) {
      warnings.push('No directives set — the policy is empty.');
    }

    return { header: parts.join('; '), summary, warnings };
  }, [values]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Directives" />
        <div className="space-y-3 p-3">
          {DIRECTIVES.map((d) => (
            <Field key={d.key} label={d.name}>
              <div className="space-y-1">
                <Input
                  value={values[d.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [d.key]: e.target.value }))}
                  placeholder={d.placeholder}
                  className="font-mono text-xs"
                />
                {d.key !== 'report-uri' && d.key !== 'report-to' && (
                  <div className="flex flex-wrap gap-1">
                    {KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        className="rounded border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground hover:text-foreground"
                        onClick={() => addKeyword(d.key, kw)}
                      >
                        {`'${kw}'`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Content-Security-Policy header">
          <CopyButton value={() => `Content-Security-Policy: ${result.header}`} label="Copy header" disabled={!result.header} />
          <CopyButton value={() => result.header} size="icon-sm" disabled={!result.header} />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
          {result.header || '(no directives set)'}
        </pre>
        <StatBar items={[`${result.summary.length} directive(s)`, `${result.header.length} chars`]} />
      </Panel>

      {result.warnings.length > 0 && (
        <Panel>
          <PanelHeader title="Pitfalls" />
          <ul className="space-y-1 p-3 text-xs text-amber-600 dark:text-amber-500">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </Panel>
      )}

      {result.summary.length > 0 && (
        <Panel>
          <PanelHeader title="Directive summary" />
          <div className="divide-y">
            {result.summary.map((s) => (
              <div key={s.name} className="flex items-start gap-3 px-3 py-2">
                <code className="w-40 shrink-0 font-mono text-xs">{s.name}</code>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {s.sources.map((src, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
