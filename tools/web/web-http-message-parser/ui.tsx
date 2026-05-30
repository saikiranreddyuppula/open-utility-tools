'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE =
  'POST /api/login HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'Content-Type: application/json\r\n' +
  'Accept: application/json\r\n' +
  'Content-Length: 41\r\n' +
  'Cookie: a=1\r\n' +
  'Cookie: b=2\r\n' +
  '\r\n' +
  '{"username":"alice","password":"hunter2"}';

const METHODS = new Set([
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT',
]);

interface Parsed {
  kind: 'request' | 'response' | 'unknown';
  startLine: string;
  fields: Array<[string, string]>;
  headers: Array<[string, string]>;
  body: string;
}

function parseStartLine(line: string): Pick<Parsed, 'kind' | 'fields'> {
  const tokens = line.trim().split(/\s+/);
  const first = tokens[0] ?? '';

  if (/^HTTP\//i.test(first)) {
    // Status line: HTTP/1.1 200 OK
    const version = first;
    const status = tokens[1] ?? '';
    const reason = tokens.slice(2).join(' ');
    return {
      kind: 'response',
      fields: [
        ['Version', version],
        ['Status', status],
        ['Reason', reason || '(none)'],
      ],
    };
  }

  if (METHODS.has(first.toUpperCase()) || (tokens.length === 3 && /^HTTP\//i.test(tokens[2] ?? ''))) {
    const method = first;
    const target = tokens[1] ?? '';
    const version = tokens[2] ?? '(missing)';
    return {
      kind: 'request',
      fields: [
        ['Method', method.toUpperCase()],
        ['Target', target],
        ['Version', version],
      ],
    };
  }

  return { kind: 'unknown', fields: [['Start line', line.trim()]] };
}

function parse(raw: string): Parsed {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blankIdx = normalized.indexOf('\n\n');
  const headPart = blankIdx === -1 ? normalized : normalized.slice(0, blankIdx);
  const body = blankIdx === -1 ? '' : normalized.slice(blankIdx + 2);

  const headLines = headPart.split('\n');
  const startLine = headLines[0] ?? '';
  const { kind, fields } = parseStartLine(startLine);

  const headers: Array<[string, string]> = [];
  for (let i = 1; i < headLines.length; i++) {
    const line = headLines[i];
    if (line == null || line.trim() === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) {
      headers.push(['(malformed)', line.trim()]);
      continue;
    }
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    headers.push([name, value]);
  }

  return { kind, startLine, fields, headers, body };
}

function findHeader(headers: Array<[string, string]>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [k, v] of headers) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

function prettyBody(body: string, contentType: string | null): { label: string; text: string } {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('application/json') || /^[\s]*[[{]/.test(body)) {
    try {
      const obj: unknown = JSON.parse(body);
      return { label: 'Body (JSON, pretty-printed)', text: JSON.stringify(obj, null, 2) };
    } catch {
      /* fall through */
    }
  }
  if (ct.includes('application/x-www-form-urlencoded') || (body.includes('=') && body.includes('&') && !body.includes('\n'))) {
    try {
      const params = new URLSearchParams(body.trim());
      const lines: string[] = [];
      params.forEach((value, key) => lines.push(`${key} = ${value}`));
      if (lines.length > 0) return { label: 'Body (form-urlencoded)', text: lines.join('\n') };
    } catch {
      /* fall through */
    }
  }
  return { label: 'Body', text: body };
}

function format(raw: string): string {
  if (!raw.trim()) return '';
  const p = parse(raw);
  const out: string[] = [];

  out.push(`Type: ${p.kind === 'unknown' ? 'Could not classify (treating as request)' : p.kind}`);
  out.push('');
  out.push('Start line:');
  for (const [k, v] of p.fields) out.push(`  ${k}: ${v}`);
  out.push('');

  out.push(`Headers (${p.headers.length}):`);
  if (p.headers.length === 0) {
    out.push('  (none)');
  } else {
    const width = Math.min(28, p.headers.reduce((m, [k]) => Math.max(m, k.length), 0));
    for (const [k, v] of p.headers) {
      out.push(`  ${k.padEnd(width)}  ${v}`);
    }
  }
  out.push('');

  // Diagnostics.
  const cl = findHeader(p.headers, 'Content-Length');
  const te = findHeader(p.headers, 'Transfer-Encoding');
  const ct = findHeader(p.headers, 'Content-Type');
  const bodyBytes = new TextEncoder().encode(p.body).length;
  const notes: string[] = [];
  if (te && te.toLowerCase().includes('chunked')) {
    notes.push('Transfer-Encoding: chunked — body is chunk-encoded; decode chunks for the real payload.');
  }
  if (cl != null) {
    const declared = Number(cl);
    if (!Number.isFinite(declared)) {
      notes.push(`Content-Length "${cl}" is not a number.`);
    } else if (declared !== bodyBytes && !(te && te.toLowerCase().includes('chunked'))) {
      notes.push(`Content-Length mismatch: header says ${declared} bytes, body has ${bodyBytes} bytes.`);
    }
  }
  if (notes.length > 0) {
    out.push('Notes:');
    for (const n of notes) out.push(`  ! ${n}`);
    out.push('');
  }

  if (p.body.length > 0) {
    const pretty = prettyBody(p.body, ct);
    out.push(`${pretty.label} (${bodyBytes} bytes):`);
    out.push(pretty.text);
  } else {
    out.push('Body: (empty)');
  }

  return out.join('\n');
}

export default function HttpMessageParserTool() {
  const transform = useCallback((input: string) => format(input), []);
  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Raw HTTP message"
      outputLabel="Parsed"
      inputPlaceholder="Paste a raw HTTP request or response…"
      sample={SAMPLE}
      downloadName="http-parsed.txt"
    />
  );
}
