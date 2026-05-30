'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `# Spring application config
server.port=8080
server.host=localhost
spring.datasource.url=jdbc:mysql://db:3306/app
app.name=My \\u00c5pp
app.debug=true
app.max-retries=5
message=Hello, \\
World`;

function unescape(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] ?? '';
    if (ch === '\\') {
      const next = value[i + 1] ?? '';
      if (next === 'u') {
        const hex = value.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 5;
          continue;
        }
        out += 'u';
        i += 1;
        continue;
      }
      if (next === 't') out += '\t';
      else if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 'f') out += '\f';
      else if (next === '\\') out += '\\';
      else if (next === '=') out += '=';
      else if (next === ':') out += ':';
      else out += next;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

// Merge physical lines into logical lines respecting trailing backslash continuation.
function logicalLines(text: string): string[] {
  const physical = text.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  let buffer = '';
  let continuing = false;
  for (const raw of physical) {
    let line = continuing ? raw.replace(/^\s+/, '') : raw;
    // Count trailing backslashes to detect continuation (odd = continues).
    const match = /(\\*)$/.exec(line);
    const slashes = match && match[1] ? match[1].length : 0;
    if (slashes % 2 === 1) {
      buffer += line.slice(0, -1);
      continuing = true;
    } else {
      buffer += line;
      lines.push(buffer);
      buffer = '';
      continuing = false;
    }
  }
  if (buffer !== '') lines.push(buffer);
  return lines;
}

function coerce(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^[+-]?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^[+-]?(\d+\.\d+|\.\d+|\d+\.)([eE][+-]?\d+)?$/.test(value) || /^[+-]?\d+[eE][+-]?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

function setNested(root: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.').filter((p) => p.length > 0);
  if (parts.length === 0) {
    root[key] = value;
    return;
  }
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] ?? '';
    const existing = cur[part];
    if (existing === undefined || existing === null || typeof existing !== 'object' || Array.isArray(existing)) {
      const next: Record<string, unknown> = {};
      cur[part] = next;
      cur = next;
    } else {
      cur = existing as Record<string, unknown>;
    }
  }
  const last = parts[parts.length - 1] ?? key;
  cur[last] = value;
}

export default function PropertiesToJsonTool() {
  const [nest, setNest] = useState(true);
  const [coerceTypes, setCoerceTypes] = useState(true);
  const [trimValues, setTrimValues] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const result: Record<string, unknown> = {};
      for (const line of logicalLines(input)) {
        const trimmed = line.replace(/^\s+/, '');
        if (trimmed === '') continue;
        const firstChar = trimmed[0] ?? '';
        if (firstChar === '#' || firstChar === '!') continue;

        // Find first unescaped '=' or ':' (or whitespace) as separator.
        let sepIdx = -1;
        for (let i = 0; i < trimmed.length; i++) {
          const c = trimmed[i] ?? '';
          if (c === '\\') {
            i++;
            continue;
          }
          if (c === '=' || c === ':') {
            sepIdx = i;
            break;
          }
        }
        let rawKey: string;
        let rawVal: string;
        if (sepIdx === -1) {
          rawKey = trimmed;
          rawVal = '';
        } else {
          rawKey = trimmed.slice(0, sepIdx);
          rawVal = trimmed.slice(sepIdx + 1);
        }
        const key = unescape(rawKey.trim());
        // Properties always strip leading whitespace after the separator;
        // trailing whitespace is stripped only when "trim values" is on.
        const valSource = trimValues ? rawVal.trim() : rawVal.replace(/^[ \t]+/, '');
        const valStr = unescape(valSource);
        const value: unknown = coerceTypes ? coerce(valStr) : valStr;
        if (key === '') continue;
        if (nest) setNested(result, key, value);
        else result[key] = value;
      }
      return JSON.stringify(result, null, 2);
    },
    [nest, coerceTypes, trimValues],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[nest, coerceTypes, trimValues]}
      inputLabel=".properties"
      outputLabel="JSON"
      inputPlaceholder="server.port=8080"
      sample={SAMPLE}
      downloadName="properties.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Nest dotted keys">
            <Switch checked={nest} onCheckedChange={setNest} />
          </Field>
          <Field label="Coerce types" hint="numbers / booleans">
            <Switch checked={coerceTypes} onCheckedChange={setCoerceTypes} />
          </Field>
          <Field label="Trim values">
            <Switch checked={trimValues} onCheckedChange={setTrimValues} />
          </Field>
        </>
      }
    />
  );
}
