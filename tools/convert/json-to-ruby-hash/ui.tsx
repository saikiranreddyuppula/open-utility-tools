'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

function rubyString(s: string): string {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SAMPLE =
  '{\n  "name": "Ada",\n  "active": true,\n  "score": 9.5,\n  "tags": ["admin", "dev"],\n  "meta": { "tier": 2, "note": null, "1invalid": "x" }\n}';

export default function JsonToRubyHashTool() {
  const [symbolKeys, setSymbolKeys] = useState(true);
  const [shorthand, setShorthand] = useState(true);
  const [indentSize, setIndentSize] = useState(2);

  return (
    <TextToolLayout
      deps={[symbolKeys, shorthand, indentSize]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }

        const unit = ' '.repeat(Math.max(0, indentSize));

        const renderKey = (key: string): string => {
          if (symbolKeys && IDENT.test(key)) {
            // valid identifier → symbol key
            return shorthand ? `${key}: ` : `:${key} => `;
          }
          // string key
          return `${rubyString(key)} => `;
        };

        const render = (value: unknown, depth: number): string => {
          if (value === null || value === undefined) return 'nil';
          if (typeof value === 'boolean') return value ? 'true' : 'false';
          if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil';
          if (typeof value === 'string') return rubyString(value);

          const pad = unit.repeat(depth + 1);
          const closePad = unit.repeat(depth);

          if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const items = value.map((el) => `${pad}${render(el, depth + 1)},`);
            return `[\n${items.join('\n')}\n${closePad}]`;
          }

          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length === 0) return '{}';
          const items = entries.map(
            ([k, v]) => `${pad}${renderKey(k)}${render(v, depth + 1)},`
          );
          return `{\n${items.join('\n')}\n${closePad}}`;
        };

        return render(data, 0);
      }}
      inputLabel="JSON"
      outputLabel="Ruby Hash"
      sample={SAMPLE}
      downloadName="data.rb"
      options={
        <>
          <Field label="Symbol keys">
            <Switch checked={symbolKeys} onCheckedChange={setSymbolKeys} />
          </Field>
          <Field label="1.9 shorthand (key:)">
            <Switch checked={shorthand} onCheckedChange={setShorthand} />
          </Field>
          <Field label={`Indent: ${indentSize}`} className="min-w-[180px]">
            <Slider
              value={[indentSize]}
              min={2}
              max={8}
              step={1}
              onValueChange={(v) => setIndentSize(v[0] ?? 2)}
            />
          </Field>
        </>
      }
    />
  );
}
