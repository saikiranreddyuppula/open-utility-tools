'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'build' | 'parse';
type DispType = 'inline' | 'attachment' | 'form-data';

// Characters allowed unescaped in an RFC 5987 ext-value token.
const ATTR_CHAR = /^[A-Za-z0-9!#$&+.^_`|~-]$/;

function isAscii(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

/** Percent-encode per RFC 5987 (UTF-8, attr-char passthrough). */
function rfc5987Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = '';
  for (const b of bytes) {
    const ch = String.fromCharCode(b);
    if (b < 128 && ATTR_CHAR.test(ch)) {
      out += ch;
    } else {
      out += `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

/** Decode an RFC 5987 ext-value: charset'lang'percent-encoded. */
function rfc5987Decode(extValue: string): string {
  const firstQuote = extValue.indexOf("'");
  if (firstQuote === -1) return extValue;
  const secondQuote = extValue.indexOf("'", firstQuote + 1);
  if (secondQuote === -1) return extValue;
  const encoded = extValue.slice(secondQuote + 1);

  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i];
    if (c === undefined) break;
    if (c === '%' && i + 2 < encoded.length) {
      const hex = encoded.slice(i + 1, i + 3);
      const n = parseInt(hex, 16);
      if (!Number.isNaN(n)) {
        bytes.push(n);
        i += 2;
        continue;
      }
    }
    bytes.push(c.charCodeAt(0) & 0xff);
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return encoded;
  }
}

/** Escape a value for a quoted-string parameter (backslash + double-quote). */
function quoteEscape(value: string): string {
  return value.replace(/[\\"]/g, (m) => `\\${m}`);
}

function buildHeader(
  type: DispType,
  filename: string,
  fieldName: string,
): string {
  const parts: string[] = [type];

  if (type === 'form-data' && fieldName.trim()) {
    parts.push(`name="${quoteEscape(fieldName.trim())}"`);
  }

  const name = filename.trim();
  if (name) {
    if (isAscii(name)) {
      parts.push(`filename="${quoteEscape(name)}"`);
    } else {
      // Provide an ASCII fallback plus the encoded filename* per RFC 6266.
      const fallback = name.replace(/[^\x20-\x7E]/g, '_');
      parts.push(`filename="${quoteEscape(fallback)}"`);
      parts.push(`filename*=UTF-8''${rfc5987Encode(name)}`);
    }
  }

  return parts.join('; ');
}

/** Split a Content-Disposition header into its disposition type and params. */
function parseHeader(header: string): string {
  const value = header.trim().replace(/^content-disposition\s*:\s*/i, '');
  if (!value) return '';

  // Tokenize on ';' but respect quoted strings.
  const segments: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === undefined) break;
    if (c === '"') {
      inQuote = !inQuote;
      buf += c;
    } else if (c === ';' && !inQuote) {
      segments.push(buf);
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf) segments.push(buf);

  const first = segments[0]?.trim() ?? '';
  const rows: string[] = [`type        = ${first || '(missing)'}`];

  const seen: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]?.trim();
    if (!seg) continue;
    const eq = seg.indexOf('=');
    if (eq === -1) {
      rows.push(`(flag)      = ${seg}`);
      continue;
    }
    const key = seg.slice(0, eq).trim().toLowerCase();
    let raw = seg.slice(eq + 1).trim();
    // Strip surrounding quotes and unescape.
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      raw = raw.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    seen[key] = raw;
  }

  const name = seen['name'];
  const fn = seen['filename'];
  const fnStar = seen['filename*'];

  if (name !== undefined) rows.push(`name        = ${name}`);
  if (fn !== undefined) rows.push(`filename    = ${fn}`);
  if (fnStar !== undefined) {
    rows.push(`filename*   = ${fnStar}`);
    rows.push(`  decoded   = ${rfc5987Decode(fnStar)}`);
  }

  // Effective filename: prefer the RFC 5987 form when present.
  const effective =
    fnStar !== undefined ? rfc5987Decode(fnStar) : fn !== undefined ? fn : '';
  if (effective) rows.push(`\neffective filename → ${effective}`);

  return rows.join('\n');
}

const SAMPLE_PARSE =
  'attachment; filename="report.pdf"; filename*=UTF-8\'\'%E5%A0%B1%E5%91%8A.pdf';

export default function ContentDispositionBuilder() {
  const [mode, setMode] = useState<Mode>('build');
  const [dispType, setDispType] = useState<DispType>('attachment');
  const [filename, setFilename] = useState('résumé café.pdf');
  const [fieldName, setFieldName] = useState('upload');

  return (
    <TextToolLayout
      deps={[mode, dispType, filename, fieldName]}
      transform={(input) => {
        if (mode === 'build') {
          return buildHeader(dispType, filename, fieldName);
        }
        if (!input.trim()) return '';
        return parseHeader(input);
      }}
      inputLabel={mode === 'build' ? 'Builder (use options →)' : 'Header value'}
      outputLabel={mode === 'build' ? 'Content-Disposition header' : 'Parsed'}
      inputPlaceholder={
        mode === 'build'
          ? 'In Build mode, set the filename and type in the options above.'
          : SAMPLE_PARSE
      }
      sample={mode === 'parse' ? SAMPLE_PARSE : undefined}
      downloadName="content-disposition.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="build">Build</TabsTrigger>
                <TabsTrigger value="parse">Parse</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'build' && (
            <>
              <Field label="Disposition">
                <Select
                  value={dispType}
                  onValueChange={(v) => setDispType(v as DispType)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline">inline</SelectItem>
                    <SelectItem value="attachment">attachment</SelectItem>
                    <SelectItem value="form-data">form-data</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Filename" className="min-w-[200px] flex-1">
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  spellCheck={false}
                />
              </Field>
              {dispType === 'form-data' && (
                <Field label="Field name">
                  <Input
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="w-36"
                    spellCheck={false}
                  />
                </Field>
              )}
            </>
          )}
        </>
      }
    />
  );
}
