'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type VarValue = string | string[] | Array<[string, string]>;

interface VarMap {
  [key: string]: VarValue;
}

interface OpConfig {
  first: string; // prefix added before the whole expansion if any value present
  sep: string; // separator between values
  named: boolean; // emit name= for each value
  ifEmpty: string; // string appended when value is empty (for named)
  allow: 'U' | 'U+R'; // unreserved only, or unreserved + reserved
}

// RFC 6570 operator characters.
const OPERATORS: Record<string, OpConfig> = {
  '': { first: '', sep: ',', named: false, ifEmpty: '', allow: 'U' },
  '+': { first: '', sep: ',', named: false, ifEmpty: '', allow: 'U+R' },
  '#': { first: '#', sep: ',', named: false, ifEmpty: '', allow: 'U+R' },
  '.': { first: '.', sep: '.', named: false, ifEmpty: '', allow: 'U' },
  '/': { first: '/', sep: '/', named: false, ifEmpty: '', allow: 'U' },
  ';': { first: ';', sep: ';', named: true, ifEmpty: '', allow: 'U' },
  '?': { first: '?', sep: '&', named: true, ifEmpty: '=', allow: 'U' },
  '&': { first: '&', sep: '&', named: true, ifEmpty: '=', allow: 'U' },
};

function isUnreserved(ch: string): boolean {
  return /[A-Za-z0-9\-._~]/.test(ch);
}

// Reserved set per RFC 3986 (gen-delims + sub-delims), allowed unescaped for + and #.
function isReserved(ch: string): boolean {
  return /[:/?#[\]@!$&'()*+,;=]/.test(ch);
}

function pctEncodeChar(ch: string): string {
  const bytes = new TextEncoder().encode(ch);
  let out = '';
  for (const b of bytes) {
    out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

function encodeValue(value: string, allow: 'U' | 'U+R'): string {
  let out = '';
  for (const ch of value) {
    if (isUnreserved(ch)) {
      out += ch;
    } else if (allow === 'U+R' && isReserved(ch)) {
      out += ch;
    } else if (allow === 'U+R' && ch === '%') {
      // Leave already-percent-encoded triplets intact for reserved expansion.
      out += '%';
    } else {
      out += pctEncodeChar(ch);
    }
  }
  return out;
}

function encodeName(name: string): string {
  // Variable names are always encoded with unreserved-only set.
  return encodeValue(name, 'U');
}

function isEmptyValue(v: VarValue): boolean {
  if (typeof v === 'string') return false;
  return v.length === 0;
}

function parseVars(text: string): VarMap {
  const map: VarMap = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const rest = line.slice(eq + 1).trim();
    if (!key) continue;

    // Associative map syntax: key=k1:v1,k2:v2
    if (rest.includes(':') && rest.split(',').every((p) => p.includes(':'))) {
      const pairs: Array<[string, string]> = [];
      for (const part of rest.split(',')) {
        const colon = part.indexOf(':');
        const pk = part.slice(0, colon).trim();
        const pv = part.slice(colon + 1).trim();
        if (pk) pairs.push([pk, pv]);
      }
      map[key] = pairs;
      continue;
    }
    // List syntax: key=a,b,c
    if (rest.includes(',')) {
      map[key] = rest.split(',').map((p) => p.trim());
      continue;
    }
    // Scalar
    map[key] = rest;
  }
  return map;
}

interface VarSpec {
  name: string;
  prefix: number | null; // :n truncation
  explode: boolean; // *
}

function parseVarSpec(token: string): VarSpec {
  let name = token;
  let prefix: number | null = null;
  let explode = false;
  if (name.endsWith('*')) {
    explode = true;
    name = name.slice(0, -1);
  } else {
    const colon = name.indexOf(':');
    if (colon >= 0) {
      const n = Number(name.slice(colon + 1));
      if (Number.isFinite(n) && n >= 0) prefix = n;
      name = name.slice(0, colon);
    }
  }
  return { name: name.trim(), prefix, explode };
}

function applyPrefix(value: string, prefix: number | null): string {
  if (prefix === null) return value;
  return Array.from(value).slice(0, prefix).join('');
}

// Expand a single {...} expression. Returns the expanded string.
function expandExpression(expr: string, vars: VarMap, trace: string[]): string {
  const firstChar = expr[0] ?? '';
  const hasOp = '+#./;?&'.includes(firstChar);
  const op = hasOp ? firstChar : '';
  const cfg = OPERATORS[op] ?? OPERATORS[''];
  if (!cfg) return '';
  const body = hasOp ? expr.slice(1) : expr;

  const specs = body.split(',').map(parseVarSpec);
  const parts: string[] = [];

  for (const spec of specs) {
    const val = vars[spec.name];
    if (val === undefined || isEmptyValue(val)) {
      // Undefined / empty composite -> skipped entirely.
      if (val === undefined) continue;
    }

    if (typeof val === 'string') {
      const truncated = applyPrefix(val, spec.prefix);
      const encoded = encodeValue(truncated, cfg.allow);
      if (cfg.named) {
        const nm = encodeName(spec.name);
        parts.push(encoded === '' ? nm + cfg.ifEmpty : `${nm}=${encoded}`);
      } else {
        parts.push(encoded);
      }
      continue;
    }

    // List or associative array
    const isAssoc = Array.isArray(val) && val.length > 0 && Array.isArray(val[0]);

    if (isAssoc) {
      const pairs = val as Array<[string, string]>;
      if (spec.explode) {
        for (const pair of pairs) {
          const k = pair[0];
          const v = pair[1] ?? '';
          const ek = encodeValue(k, cfg.allow);
          const ev = encodeValue(v, cfg.allow);
          parts.push(`${ek}=${ev}`);
        }
      } else {
        const flat = pairs
          .map((pair) => `${encodeValue(pair[0], cfg.allow)},${encodeValue(pair[1] ?? '', cfg.allow)}`)
          .join(',');
        if (cfg.named) {
          parts.push(flat === '' ? encodeName(spec.name) + cfg.ifEmpty : `${encodeName(spec.name)}=${flat}`);
        } else {
          parts.push(flat);
        }
      }
      continue;
    }

    // Plain list
    const list = val as string[];
    if (spec.explode) {
      for (const item of list) {
        const encoded = encodeValue(item, cfg.allow);
        if (cfg.named) {
          parts.push(encoded === '' ? encodeName(spec.name) + cfg.ifEmpty : `${encodeName(spec.name)}=${encoded}`);
        } else {
          parts.push(encoded);
        }
      }
    } else {
      const flat = list.map((item) => encodeValue(item, cfg.allow)).join(',');
      if (cfg.named) {
        parts.push(flat === '' ? encodeName(spec.name) + cfg.ifEmpty : `${encodeName(spec.name)}=${flat}`);
      } else {
        parts.push(flat);
      }
    }
  }

  if (parts.length === 0) {
    trace.push(`{${expr}}  →  (empty, removed)`);
    return '';
  }

  const result = cfg.first + parts.join(cfg.sep);
  trace.push(`{${expr}}  →  ${result}`);
  return result;
}

function expandTemplate(
  template: string,
  vars: VarMap,
): { uri: string; trace: string[] } {
  const trace: string[] = [];
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i] ?? '';
    if (ch === '{') {
      const end = template.indexOf('}', i);
      if (end < 0) {
        throw new Error(`Unterminated expression starting at position ${i}.`);
      }
      const expr = template.slice(i + 1, end);
      if (expr.trim() === '') {
        throw new Error('Empty {} expression is not valid.');
      }
      out += expandExpression(expr, vars, trace);
      i = end + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return { uri: out, trace };
}

export default function UriTemplateExpander() {
  const [template, setTemplate] = useState(
    'https://api.example.com{/version}/users{?role,page}{#section}',
  );
  const [varText, setVarText] = useState(
    'version=v1\nrole=admin\npage=2\nsection=top',
  );

  const result = useMemo(() => {
    const tpl = template.trim();
    if (!tpl) return { error: 'Enter a URI template.' as const };
    try {
      const vars = parseVars(varText);
      const { uri, trace } = expandTemplate(tpl, vars);
      return { uri, trace };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Expansion failed.' };
    }
  }, [template, varText]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="URI template" className="min-w-[280px] flex-1">
            <Input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        </OptionsBar>
        <div className="p-3">
          <div className="mb-1 text-xs text-muted-foreground">
            Variables (one per line: <code>key=value</code>, lists as{' '}
            <code>key=a,b,c</code>, maps as <code>key=k:v,k2:v2</code>)
          </div>
          <Textarea
            value={varText}
            onChange={(e) => setVarText(e.target.value)}
            spellCheck={false}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Expanded URI">
              <CopyButton value={() => result.uri} />
            </PanelHeader>
            <div className="break-all p-3 font-mono text-sm">{result.uri}</div>
          </Panel>
          <Panel>
            <PanelHeader title="Step-by-step substitutions" />
            <div className="max-h-[320px] divide-y overflow-auto">
              {result.trace.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No expressions in template (literal URI).
                </div>
              ) : (
                result.trace.map((t, idx) => (
                  <div key={idx} className="px-3 py-2 font-mono text-xs">
                    {t}
                  </div>
                ))
              )}
            </div>
            <StatBar items={[`${result.trace.length} expression(s)`, `${result.uri.length} chars`]} />
          </Panel>
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTemplate('https://api.example.com{/version}/users{?role,page}{#section}');
                setVarText('version=v1\nrole=admin\npage=2\nsection=top');
              }}
            >
              Reset sample
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
