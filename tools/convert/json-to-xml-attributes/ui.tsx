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

type Mode = 'scalars-attrs' | 'convention';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

function sanitizeName(key: string): string {
  let name = key.replace(/[^A-Za-z0-9_.-]/g, '_');
  if (!/^[A-Za-z_]/.test(name)) name = `_${name}`;
  return name || 'item';
}

function isScalar(v: unknown): boolean {
  return v === null || (typeof v !== 'object');
}

function scalarText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

const SAMPLE =
  '{\n  "book": {\n    "id": 42,\n    "lang": "en",\n    "title": "Refactoring",\n    "authors": ["Fowler", "Beck"],\n    "publisher": { "name": "Addison-Wesley", "year": 1999 }\n  }\n}';

export default function JsonToXmlAttributesTool() {
  const [mode, setMode] = useState<Mode>('scalars-attrs');
  const [rootName, setRootName] = useState('root');
  const [indentSize, setIndentSize] = useState('2');
  const [declaration, setDeclaration] = useState(true);

  return (
    <TextToolLayout
      deps={[mode, rootName, indentSize, declaration]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }

        const n = Number(indentSize);
        const unit = ' '.repeat(Number.isFinite(n) && n >= 0 ? Math.min(8, n) : 2);

        // Build an element string for a named value at a given depth.
        const buildElement = (tag: string, value: unknown, depth: number): string => {
          const pad = unit.repeat(depth);
          const safe = sanitizeName(tag);

          // Arrays repeat the element.
          if (Array.isArray(value)) {
            return value.map((el) => buildElement(safe, el, depth)).join('\n');
          }

          if (isPlainObject(value)) {
            const attrs: string[] = [];
            const children: string[] = [];
            let textContent: string | null = null;

            for (const [k, v] of Object.entries(value)) {
              if (mode === 'convention') {
                if (k.startsWith('@')) {
                  attrs.push(`${sanitizeName(k.slice(1))}="${escapeAttr(scalarText(v))}"`);
                  continue;
                }
                if (k === '#text') {
                  textContent = scalarText(v);
                  continue;
                }
                children.push(buildElement(k, v, depth + 1));
                continue;
              }
              // scalars-attrs mode: scalar props become attributes.
              if (isScalar(v)) {
                attrs.push(`${sanitizeName(k)}="${escapeAttr(scalarText(v))}"`);
              } else {
                children.push(buildElement(k, v, depth + 1));
              }
            }

            const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';

            if (textContent !== null && children.length === 0) {
              return `${pad}<${safe}${attrStr}>${escapeText(textContent)}</${safe}>`;
            }
            if (children.length === 0 && textContent === null) {
              return `${pad}<${safe}${attrStr}/>`;
            }
            const inner = children.join('\n');
            const textLine =
              textContent !== null ? `${unit.repeat(depth + 1)}${escapeText(textContent)}\n` : '';
            return `${pad}<${safe}${attrStr}>\n${textLine}${inner}\n${pad}</${safe}>`;
          }

          // Scalar leaf as an element.
          if (value === null || value === undefined) return `${pad}<${safe}/>`;
          return `${pad}<${safe}>${escapeText(String(value))}</${safe}>`;
        };

        const root = sanitizeName(rootName.trim() || 'root');
        const body = buildElement(root, data, 0);
        const head = declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
        return `${head}${body}`;
      }}
      inputLabel="JSON"
      outputLabel="XML"
      sample={SAMPLE}
      downloadName="data.xml"
      downloadMime="application/xml"
      options={
        <>
          <Field label="Attribute rule">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scalars-attrs">Scalars as attributes</SelectItem>
                <SelectItem value="convention">@attr / #text convention</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Root element">
            <Input
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              className="w-32"
            />
          </Field>
          <Field label="Indent spaces">
            <Input
              value={indentSize}
              onChange={(e) => setIndentSize(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="XML declaration">
            <Switch checked={declaration} onCheckedChange={setDeclaration} />
          </Field>
        </>
      }
    />
  );
}
