'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = `curl -X POST https://api.example.com/v1/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer abc123" \\
  -d '{"name":"Ada","age":36,"admin":true}'`;

/** Tokenize a shell-ish command, honoring quotes and backslash line-continuations. */
function tokenize(src: string): string[] {
  const text = src.replace(/\\\r?\n/g, ' ').trim();
  const tokens: string[] = [];
  let cur = '';
  let i = 0;
  let started = false;
  let quote: '"' | "'" | null = null;
  const n = text.length;
  while (i < n) {
    const ch = text[i] ?? '';
    if (quote) {
      if (ch === quote) {
        quote = null;
        i += 1;
        continue;
      }
      if (quote === '"' && ch === '\\') {
        const next = text[i + 1] ?? '';
        if (next === '"' || next === '\\' || next === '$' || next === '`') {
          cur += next;
          i += 2;
          continue;
        }
      }
      cur += ch;
      started = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      i += 1;
      continue;
    }
    if (ch === '\\') {
      const next = text[i + 1] ?? '';
      cur += next;
      started = true;
      i += 2;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (started) {
        tokens.push(cur);
        cur = '';
        started = false;
      }
      i += 1;
      continue;
    }
    cur += ch;
    started = true;
    i += 1;
  }
  if (started) tokens.push(cur);
  return tokens;
}

interface Parsed {
  method: string | null;
  headers: [string, string][];
  data: string[];
  forms: string[];
  user: string | null;
  url: string | null;
}

function parseCurl(tokens: string[]): Parsed {
  const p: Parsed = { method: null, headers: [], data: [], forms: [], user: null, url: null };
  let i = 0;
  // skip leading "curl"
  if ((tokens[0] ?? '').toLowerCase() === 'curl') i = 1;
  const splitHeader = (h: string): [string, string] => {
    const idx = h.indexOf(':');
    if (idx === -1) return [h.trim(), ''];
    return [h.slice(0, idx).trim(), h.slice(idx + 1).trim()];
  };
  while (i < tokens.length) {
    const tok = tokens[i] ?? '';
    if (tok === '-X' || tok === '--request') {
      p.method = (tokens[i + 1] ?? '').toUpperCase() || null;
      i += 2;
      continue;
    }
    if (tok === '-H' || tok === '--header') {
      const h = tokens[i + 1] ?? '';
      p.headers.push(splitHeader(h));
      i += 2;
      continue;
    }
    if (
      tok === '-d' ||
      tok === '--data' ||
      tok === '--data-raw' ||
      tok === '--data-ascii' ||
      tok === '--data-binary' ||
      tok === '--data-urlencode'
    ) {
      p.data.push(tokens[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (tok === '-F' || tok === '--form') {
      p.forms.push(tokens[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (tok === '-u' || tok === '--user') {
      p.user = tokens[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (tok === '-G' || tok === '--get') {
      p.method = p.method ?? 'GET';
      i += 1;
      continue;
    }
    // boolean flags we can safely skip
    if (
      tok === '-L' ||
      tok === '--location' ||
      tok === '-s' ||
      tok === '--silent' ||
      tok === '-k' ||
      tok === '--insecure' ||
      tok === '-i' ||
      tok === '--include' ||
      tok === '-v' ||
      tok === '--verbose' ||
      tok === '--compressed'
    ) {
      i += 1;
      continue;
    }
    // unknown flag with value-like next token: skip the flag only
    if (tok.startsWith('-') && tok.length > 1) {
      i += 1;
      continue;
    }
    if (!p.url && tok) {
      p.url = tok;
      i += 1;
      continue;
    }
    i += 1;
  }
  return p;
}

function isPlainShellSafe(s: string): boolean {
  return /^[A-Za-z0-9_./:@%+=-]*$/.test(s);
}

function shellQuote(s: string): string {
  if (s === '') return "''";
  if (isPlainShellSafe(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function buildHttpie(p: Parsed, explicitMethod: boolean, preferRaw: boolean): string {
  if (!p.url) throw new Error('No URL found in curl command.');
  const parts: string[] = ['http'];

  const hasBody = p.data.length > 0 || p.forms.length > 0;
  const method =
    p.method ?? (hasBody ? 'POST' : 'GET');
  if (explicitMethod || p.method) parts.push(method);

  if (p.forms.length > 0) parts.push('--form');

  parts.push(shellQuote(p.url));

  // auth
  if (p.user) parts.push('-a', shellQuote(p.user));

  // headers
  for (const [name, value] of p.headers) {
    if (!name) continue;
    if (name.toLowerCase() === 'content-type' && /json/i.test(value) && p.forms.length === 0) {
      // HTTPie sets JSON content-type implicitly for key=value bodies
      continue;
    }
    parts.push(shellQuote(`${name}:${value}`));
  }

  // form fields
  for (const f of p.forms) {
    const idx = f.indexOf('=');
    if (idx === -1) {
      parts.push(shellQuote(f));
      continue;
    }
    parts.push(shellQuote(`${f.slice(0, idx)}=${f.slice(idx + 1)}`));
  }

  // data body
  if (p.data.length > 0) {
    const joined = p.data.join('&');
    let asJson: unknown = null;
    let ok = false;
    try {
      asJson = JSON.parse(joined);
      ok = typeof asJson === 'object' && asJson !== null && !Array.isArray(asJson);
    } catch {
      ok = false;
    }
    if (ok && asJson && typeof asJson === 'object') {
      const obj = asJson as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          parts.push(shellQuote(`${k}=${v}`));
        } else if (preferRaw) {
          parts.push(shellQuote(`${k}:=${JSON.stringify(v)}`));
        } else {
          parts.push(shellQuote(`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`));
        }
      }
    } else {
      // raw / form-encoded body
      parts.push('--raw', shellQuote(joined));
    }
  }

  return parts.join(' ');
}

export default function CurlToHttpieTool() {
  const [explicitMethod, setExplicitMethod] = useState(true);
  const [preferRaw, setPreferRaw] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const tokens = tokenize(input);
      if (tokens.length === 0) return '';
      if ((tokens[0] ?? '').toLowerCase() !== 'curl') {
        throw new Error('Command must start with "curl".');
      }
      const parsed = parseCurl(tokens);
      return buildHttpie(parsed, explicitMethod, preferRaw);
    },
    [explicitMethod, preferRaw]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[explicitMethod, preferRaw]}
      inputLabel="curl command"
      outputLabel="HTTPie command"
      sample={SAMPLE}
      downloadName="httpie.sh"
      options={
        <>
          <Field label="Always show method">
            <div className="flex h-8 items-center gap-2">
              <Switch
                checked={explicitMethod}
                onCheckedChange={setExplicitMethod}
                id="c2h-method"
              />
              <Label htmlFor="c2h-method" className="text-xs text-muted-foreground">
                {explicitMethod ? 'http POST …' : 'omit GET/POST'}
              </Label>
            </div>
          </Field>
          <Field label="Raw for non-strings">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={preferRaw} onCheckedChange={setPreferRaw} id="c2h-raw" />
              <Label htmlFor="c2h-raw" className="text-xs text-muted-foreground">
                {preferRaw ? 'key:=value' : 'key=value'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
