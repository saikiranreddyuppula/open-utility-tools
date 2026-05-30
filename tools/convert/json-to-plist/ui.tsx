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

type IndentStyle = 'tab' | 'spaces';
type NullMode = 'empty-string' | 'omit';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DOCTYPE =
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">';

const SAMPLE =
  '{\n  "Label": "com.example.job",\n  "KeepAlive": true,\n  "ThrottleInterval": 30,\n  "Ratio": 1.5,\n  "ProgramArguments": ["/bin/echo", "hi"],\n  "Env": { "PATH": "/usr/bin" }\n}';

export default function JsonToPlistTool() {
  const [indentStyle, setIndentStyle] = useState<IndentStyle>('tab');
  const [nullMode, setNullMode] = useState<NullMode>('empty-string');
  const [includeDoctype, setIncludeDoctype] = useState(true);

  return (
    <TextToolLayout
      deps={[indentStyle, nullMode, includeDoctype]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }

        const unit = indentStyle === 'tab' ? '\t' : '  ';

        const renderScalar = (value: unknown, pad: string): string | null => {
          if (value === null || value === undefined) {
            return nullMode === 'omit' ? null : `${pad}<string></string>`;
          }
          if (typeof value === 'boolean') return `${pad}${value ? '<true/>' : '<false/>'}`;
          if (typeof value === 'number') {
            if (!Number.isFinite(value)) return `${pad}<real>0</real>`;
            return Number.isInteger(value)
              ? `${pad}<integer>${value}</integer>`
              : `${pad}<real>${value}</real>`;
          }
          return `${pad}<string>${escapeXml(String(value))}</string>`;
        };

        const render = (value: unknown, depth: number): string | null => {
          const pad = unit.repeat(depth);
          if (Array.isArray(value)) {
            if (value.length === 0) return `${pad}<array/>`;
            const lines: string[] = [`${pad}<array>`];
            for (const el of value) {
              const r = render(el, depth + 1);
              if (r !== null) lines.push(r);
            }
            lines.push(`${pad}</array>`);
            return lines.join('\n');
          }
          if (isPlainObject(value)) {
            const entries = Object.entries(value);
            if (entries.length === 0) return `${pad}<dict/>`;
            const lines: string[] = [`${pad}<dict>`];
            for (const [k, v] of entries) {
              const r = render(v, depth + 1);
              if (r === null) continue; // omitted null
              lines.push(`${unit.repeat(depth + 1)}<key>${escapeXml(k)}</key>`);
              lines.push(r);
            }
            lines.push(`${pad}</dict>`);
            return lines.join('\n');
          }
          return renderScalar(value, pad);
        };

        const body = render(data, 1) ?? `${unit}<string></string>`;
        const head = ['<?xml version="1.0" encoding="UTF-8"?>'];
        if (includeDoctype) head.push(DOCTYPE);
        head.push('<plist version="1.0">');
        return `${head.join('\n')}\n${body}\n</plist>`;
      }}
      inputLabel="JSON"
      outputLabel="plist XML"
      sample={SAMPLE}
      downloadName="data.plist"
      downloadMime="application/xml"
      options={
        <>
          <Field label="Indent">
            <Select
              value={indentStyle}
              onValueChange={(v) => setIndentStyle(v as IndentStyle)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tab">Tabs</SelectItem>
                <SelectItem value="spaces">Spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="null →">
            <Select value={nullMode} onValueChange={(v) => setNullMode(v as NullMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty-string">Empty &lt;string&gt;</SelectItem>
                <SelectItem value="omit">Omit key</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="DOCTYPE">
            <Switch checked={includeDoctype} onCheckedChange={setIncludeDoctype} />
          </Field>
        </>
      }
    />
  );
}
