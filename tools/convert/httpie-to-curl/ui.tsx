'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = `http POST :8000/api/users name=Ada admin:=true age:=36 X-Token:abc123 q==search`;

const HTTP_METHODS = new Set([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT',
]);

/** Tokenize honoring quotes and backslash line-continuations. */
function tokenize(src: string): string[] {
  const text = src.replace(/\\\r?\n/g, ' ').trim();
  const tokens: string[] = [];
  let cur = '';
  let started = false;
  let quote: '"' | "'" | null = null;
  let i = 0;
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
        if (next === '"' || next === '\\') {
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
      cur += text[i + 1] ?? '';
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

function expandUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  // ":8000/path" or ":/path" -> localhost; "/path" or "host/path"
  if (raw.startsWith(':')) {
    const rest = raw.slice(1);
    return `http://localhost${rest.startsWith('/') ? '' : rest === '' ? '' : ':'}${rest}`;
  }
  if (raw.startsWith('/')) return `http://localhost${raw}`;
  return `http://${raw}`;
}

interface Parsed {
  method: string | null;
  url: string | null;
  headers: [string, string][];
  jsonFields: [string, unknown][];
  queries: [string, string][];
  form: boolean;
  rawJsonError: boolean;
}

function classifyItem(item: string, p: Parsed): void {
  // query: key==value
  const qEq = item.indexOf('==');
  if (qEq > 0 && !item.slice(0, qEq).includes(':')) {
    p.queries.push([item.slice(0, qEq), item.slice(qEq + 2)]);
    return;
  }
  // raw json: key:=value
  const rawIdx = item.indexOf(':=');
  if (rawIdx > 0) {
    const key = item.slice(0, rawIdx);
    const rawVal = item.slice(rawIdx + 2);
    try {
      p.jsonFields.push([key, JSON.parse(rawVal)]);
    } catch {
      p.jsonFields.push([key, rawVal]);
      p.rawJsonError = true;
    }
    return;
  }
  // data field: key=value (string)
  const eqIdx = item.indexOf('=');
  const colonIdx = item.indexOf(':');
  if (eqIdx > 0 && (colonIdx === -1 || eqIdx < colonIdx)) {
    p.jsonFields.push([item.slice(0, eqIdx), item.slice(eqIdx + 1)]);
    return;
  }
  // header: Name:Value
  if (colonIdx > 0) {
    p.headers.push([item.slice(0, colonIdx), item.slice(colonIdx + 1)]);
    return;
  }
  // bare token after url with no operator: treat as header w/o value? ignore.
}

function parseHttpie(tokens: string[]): Parsed {
  const p: Parsed = {
    method: null,
    url: null,
    headers: [],
    jsonFields: [],
    queries: [],
    form: false,
    rawJsonError: false,
  };
  let i = 0;
  if ((tokens[0] ?? '').toLowerCase() === 'http' || (tokens[0] ?? '').toLowerCase() === 'https') {
    i = 1;
  }
  // optional explicit method
  const maybeMethod = (tokens[i] ?? '').toUpperCase();
  if (HTTP_METHODS.has(maybeMethod)) {
    p.method = maybeMethod;
    i += 1;
  }
  for (; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (tok === '--form' || tok === '-f') {
      p.form = true;
      continue;
    }
    if (tok === '--json' || tok === '-j') {
      continue;
    }
    if (tok.startsWith('--') && tok.includes('=')) {
      // flag with value we don't model; skip
      continue;
    }
    if (tok.startsWith('-') && tok.length > 1 && !p.url) {
      // an option flag before url; skip
      continue;
    }
    if (!p.url) {
      p.url = expandUrl(tok);
      continue;
    }
    classifyItem(tok, p);
  }
  return p;
}

function isPlainShellSafe(s: string): boolean {
  return /^[A-Za-z0-9_./:@%+=&?~-]*$/.test(s);
}

function shellQuote(s: string): string {
  if (s === '') return "''";
  if (isPlainShellSafe(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function buildCurl(p: Parsed, longFlags: boolean, multiline: boolean): string {
  if (!p.url) throw new Error('No URL found in HTTPie command.');

  const hasBody = p.jsonFields.length > 0;
  const method = p.method ?? (hasBody ? 'POST' : 'GET');

  let url = p.url;
  if (p.queries.length > 0) {
    const qs = p.queries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const F = {
    method: longFlags ? '--request' : '-X',
    header: longFlags ? '--header' : '-H',
  };

  const segs: string[] = ['curl'];
  if (method !== 'GET' || hasBody) segs.push(F.method, method);

  for (const [name, value] of p.headers) {
    segs.push(F.header, shellQuote(`${name}: ${value}`));
  }

  if (hasBody) {
    if (p.form) {
      // application/x-www-form-urlencoded via repeated --data-urlencode
      for (const [k, v] of p.jsonFields) {
        const sv = typeof v === 'string' ? v : JSON.stringify(v);
        segs.push('--data-urlencode', shellQuote(`${k}=${sv}`));
      }
    } else {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of p.jsonFields) obj[k] = v;
      segs.push(F.header, shellQuote('Content-Type: application/json'));
      segs.push(longFlags ? '--data' : '-d', shellQuote(JSON.stringify(obj)));
    }
  }

  segs.push(shellQuote(url));

  if (!multiline) return segs.join(' ');

  // multiline: break before each flag pair / url
  const lines: string[] = [];
  let buf = 'curl';
  let idx = 1;
  while (idx < segs.length) {
    const seg = segs[idx] ?? '';
    if (seg.startsWith('-')) {
      // flag possibly with a following value
      const val = segs[idx + 1];
      if (val !== undefined && !val.startsWith('-')) {
        lines.push(buf);
        buf = `  ${seg} ${val}`;
        idx += 2;
        continue;
      }
      lines.push(buf);
      buf = `  ${seg}`;
      idx += 1;
      continue;
    }
    // the url (last)
    lines.push(buf);
    buf = `  ${seg}`;
    idx += 1;
  }
  lines.push(buf);
  return lines.join(' \\\n');
}

export default function HttpieToCurlTool() {
  const [longFlags, setLongFlags] = useState(false);
  const [multiline, setMultiline] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const tokens = tokenize(input);
      if (tokens.length === 0) return '';
      const first = (tokens[0] ?? '').toLowerCase();
      if (first !== 'http' && first !== 'https') {
        throw new Error('Command should start with "http" or "https" (HTTPie).');
      }
      const parsed = parseHttpie(tokens);
      return buildCurl(parsed, longFlags, multiline);
    },
    [longFlags, multiline]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[longFlags, multiline]}
      inputLabel="HTTPie command"
      outputLabel="curl command"
      sample={SAMPLE}
      downloadName="request.sh"
      options={
        <>
          <Field label="Flag style">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={longFlags} onCheckedChange={setLongFlags} id="h2c-long" />
              <Label htmlFor="h2c-long" className="text-xs text-muted-foreground">
                {longFlags ? '--request --header' : '-X -H'}
              </Label>
            </div>
          </Field>
          <Field label="Layout">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={multiline} onCheckedChange={setMultiline} id="h2c-ml" />
              <Label htmlFor="h2c-ml" className="text-xs text-muted-foreground">
                {multiline ? 'multiline \\' : 'single line'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
