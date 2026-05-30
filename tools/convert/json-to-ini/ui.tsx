'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ArrayMode = 'repeat' | 'comma';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function needsQuote(s: string): boolean {
  return /[=;#]/.test(s) || s !== s.trim();
}

function scalarStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

const SAMPLE =
  '{\n  "appName": "Demo",\n  "debug": true,\n  "server": {\n    "host": "localhost",\n    "port": 8080,\n    "tags": ["web", "api"]\n  },\n  "server.tls": {\n    "enabled": false\n  }\n}';

export default function JsonToIniTool() {
  const [separator, setSeparator] = useState<'=' | ' = '>('=');
  const [arrayMode, setArrayMode] = useState<ArrayMode>('repeat');
  const [commentChar, setCommentChar] = useState(';');

  return (
    <TextToolLayout
      deps={[separator, arrayMode, commentChar]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }
        if (!isPlainObject(data)) throw new Error('Top-level value must be a JSON object.');

        const renderValue = (val: unknown): string => {
          const s = scalarStr(val);
          return needsQuote(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
        };

        const renderKvLines = (obj: Record<string, unknown>): string[] => {
          const lines: string[] = [];
          for (const [k, v] of Object.entries(obj)) {
            if (isPlainObject(v)) continue; // handled as a section
            if (Array.isArray(v)) {
              if (arrayMode === 'comma') {
                lines.push(`${k}${separator}${v.map(renderValue).join(',')}`);
              } else {
                for (const el of v) lines.push(`${k}${separator}${renderValue(el)}`);
              }
            } else {
              lines.push(`${k}${separator}${renderValue(v)}`);
            }
          }
          return lines;
        };

        const out: string[] = [];
        if (commentChar.trim()) out.push(`${commentChar} Generated from JSON`, '');

        // Root-level scalars / arrays first.
        const rootLines = renderKvLines(data);
        if (rootLines.length) out.push(...rootLines, '');

        // Each object-valued property becomes a [section]; nested objects
        // recurse into dotted [parent.child] sections.
        const emitSection = (name: string, obj: Record<string, unknown>): void => {
          out.push(`[${name}]`);
          out.push(...renderKvLines(obj));
          out.push('');
          for (const [k, v] of Object.entries(obj)) {
            if (isPlainObject(v)) emitSection(`${name}.${k}`, v);
          }
        };

        for (const [k, v] of Object.entries(data)) {
          if (isPlainObject(v)) emitSection(k, v);
        }

        return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
      }}
      inputLabel="JSON"
      outputLabel="INI"
      sample={SAMPLE}
      downloadName="config.ini"
      options={
        <>
          <Field label="Separator">
            <Select value={separator} onValueChange={(v) => setSeparator(v as '=' | ' = ')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="=">key=value</SelectItem>
                <SelectItem value=" = ">key = value</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Arrays">
            <Select value={arrayMode} onValueChange={(v) => setArrayMode(v as ArrayMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repeat">Repeated keys</SelectItem>
                <SelectItem value="comma">Comma-joined</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Comment char">
            <Input
              value={commentChar}
              onChange={(e) => setCommentChar(e.target.value)}
              placeholder="; or #"
              className="w-20"
            />
          </Field>
        </>
      }
    />
  );
}
