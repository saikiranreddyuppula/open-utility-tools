'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type IndexStyle = 'bracket' | 'dot';
type KeySep = '=' | ':';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function escapeKey(s: string): string {
  // In keys, escape '=', ':', spaces and backslash.
  return s.replace(/([\\=:\s])/g, '\\$1');
}

function escapeValue(s: string, asciiOnly: boolean): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? '';
    const code = ch.charCodeAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '=' || ch === ':' || ch === '#' || ch === '!') out += `\\${ch}`;
    else if (i === 0 && ch === ' ') out += '\\ ';
    else if (asciiOnly && code > 0x7e) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return out;
}

const SAMPLE =
  '{\n  "app": {\n    "name": "Demo",\n    "port": 8080\n  },\n  "features": ["fast", "secure"],\n  "debug": true\n}';

export default function JsonToPropertiesTool() {
  const [indexStyle, setIndexStyle] = useState<IndexStyle>('bracket');
  const [keySep, setKeySep] = useState<KeySep>('=');
  const [asciiOnly, setAsciiOnly] = useState(true);
  const [sortKeys, setSortKeys] = useState(false);

  return (
    <TextToolLayout
      deps={[indexStyle, keySep, asciiOnly, sortKeys]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }
        if (!isPlainObject(data)) throw new Error('Top-level value must be a JSON object.');

        const pairs: Array<[string, string]> = [];

        const leaf = (v: unknown): string => {
          if (v === null) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        };

        const walk = (value: unknown, path: string): void => {
          if (Array.isArray(value)) {
            value.forEach((el, i) => {
              const seg = indexStyle === 'bracket' ? `${path}[${i}]` : `${path}.${i}`;
              walk(el, seg);
            });
          } else if (isPlainObject(value)) {
            for (const [k, v] of Object.entries(value)) {
              walk(v, path ? `${path}.${k}` : k);
            }
          } else {
            pairs.push([path, leaf(value)]);
          }
        };

        walk(data, '');

        const lines = pairs.map(
          ([k, v]) => `${escapeKey(k)}${keySep}${escapeValue(v, asciiOnly)}`
        );
        if (sortKeys) lines.sort((a, b) => a.localeCompare(b));
        return lines.join('\n');
      }}
      inputLabel="JSON"
      outputLabel=".properties"
      sample={SAMPLE}
      downloadName="application.properties"
      options={
        <>
          <Field label="Array index">
            <Select
              value={indexStyle}
              onValueChange={(v) => setIndexStyle(v as IndexStyle)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bracket">key[i]</SelectItem>
                <SelectItem value="dot">key.i</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Separator">
            <Select value={keySep} onValueChange={(v) => setKeySep(v as KeySep)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="=">key=value</SelectItem>
                <SelectItem value=":">key:value</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="ASCII-escape">
            <Switch checked={asciiOnly} onCheckedChange={setAsciiOnly} />
          </Field>
          <Field label="Sort keys">
            <Switch checked={sortKeys} onCheckedChange={setSortKeys} />
          </Field>
        </>
      }
    />
  );
}
