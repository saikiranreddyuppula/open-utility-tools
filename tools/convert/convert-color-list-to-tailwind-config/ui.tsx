'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Output = 'js' | 'json';

const SAMPLE = `brand-50 = #eff6ff
brand-100: #dbeafe
brand-500 = #3B82F6
brand-900 = #1e3a8a
accent = #F0A
surface: #fff
danger = #ef4444`;

function expandHex(hex: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1] ?? '';
    const g = hex[2] ?? '';
    const b = hex[3] ?? '';
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

type Tree = Record<string, string | Record<string, string>>;

function quoteKey(key: string): string {
  // Valid JS identifier? leave unquoted; otherwise quote it.
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

function renderJs(tree: Tree, indent: string): string {
  const entries = Object.entries(tree);
  const lines = entries.map(([key, val]) => {
    if (typeof val === 'string') {
      return `${indent}  ${quoteKey(key)}: '${val}',`;
    }
    const inner = Object.entries(val)
      .map(([k, v]) => `${indent}    ${quoteKey(k)}: '${v}',`)
      .join('\n');
    return `${indent}  ${quoteKey(key)}: {\n${inner}\n${indent}  },`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

export default function ColorListToTailwindConfig() {
  const [output, setOutput] = useState<Output>('js');
  const [expand, setExpand] = useState(true);
  const [lower, setLower] = useState(true);

  return (
    <TextToolLayout
      deps={[output, expand, lower]}
      sample={SAMPLE}
      inputLabel="name = #hex pairs"
      outputLabel={output === 'js' ? 'tailwind.config.js' : 'colors.json'}
      downloadName={output === 'js' ? 'tailwind-colors.js' : 'tailwind-colors.json'}
      transform={(input) => {
        if (!input.trim()) return '';
        const tree: Tree = {};
        const errors: string[] = [];
        const lines = input.split('\n');
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          // Skip blank lines and comment lines (a line starting with // or a lone #comment).
          if (!trimmed) return;
          if (trimmed.startsWith('//')) return;
          const m = /^(.+?)\s*[:=]\s*(#?[0-9a-fA-F]{3,8})\s*$/.exec(trimmed);
          if (!m) {
            errors.push(`Line ${idx + 1}: "${trimmed}" — expected name = #hex`);
            return;
          }
          const rawName = (m[1] ?? '').trim();
          let hex = (m[2] ?? '').trim();
          if (!hex.startsWith('#')) hex = `#${hex}`;
          if (expand) hex = expandHex(hex);
          if (lower) hex = hex.toLowerCase();

          // Group by base name with trailing numeric shade.
          const shadeMatch = /^(.*?)[-_]?(\d{2,3})$/.exec(rawName);
          if (shadeMatch && shadeMatch[1] && shadeMatch[2]) {
            const base = shadeMatch[1];
            const shade = shadeMatch[2];
            const existing = tree[base];
            if (existing === undefined) {
              tree[base] = { [shade]: hex };
            } else if (typeof existing === 'object') {
              existing[shade] = hex;
            } else {
              // Collision: a plain value already used this name. Promote to DEFAULT.
              tree[base] = { DEFAULT: existing, [shade]: hex };
            }
          } else {
            tree[rawName] = hex;
          }
        });

        if (errors.length > 0 && Object.keys(tree).length === 0) {
          throw new Error(errors.join('\n'));
        }

        let body: string;
        if (output === 'json') {
          body = JSON.stringify(tree, null, 2);
        } else {
          const colors = renderJs(tree, '      ');
          body =
            '/** @type {import("tailwindcss").Config} */\n' +
            'module.exports = {\n' +
            '  theme: {\n' +
            '    extend: {\n' +
            `      colors: ${colors},\n` +
            '    },\n' +
            '  },\n' +
            '};';
        }

        if (errors.length > 0) {
          return `// Skipped ${errors.length} unparsable line(s):\n` +
            errors.map((e) => `// ${e}`).join('\n') +
            '\n\n' +
            body;
        }
        return body;
      }}
      options={
        <>
          <Field label="Output">
            <Tabs value={output} onValueChange={(v) => setOutput(v as Output)}>
              <TabsList>
                <TabsTrigger value="js">JS config</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Expand 3-digit hex">
            <div className="flex h-9 items-center">
              <Switch checked={expand} onCheckedChange={setExpand} />
            </div>
          </Field>
          <Field label="Lowercase hex">
            <div className="flex h-9 items-center">
              <Switch checked={lower} onCheckedChange={setLower} />
            </div>
          </Field>
        </>
      }
    />
  );
}
