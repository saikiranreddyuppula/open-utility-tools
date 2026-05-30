'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

function phpSingleQuote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const SAMPLE =
  '{\n  "name": "Ada",\n  "active": true,\n  "score": 9.5,\n  "roles": ["admin", "dev"],\n  "meta": { "tier": 2, "note": null }\n}';

export default function JsonToPhpArrayTool() {
  const [shortSyntax, setShortSyntax] = useState(true);
  const [indentSize, setIndentSize] = useState(4);
  const [returnStmt, setReturnStmt] = useState(false);

  return (
    <TextToolLayout
      deps={[shortSyntax, indentSize, returnStmt]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }

        const open = shortSyntax ? '[' : 'array(';
        const close = shortSyntax ? ']' : ')';
        const unit = ' '.repeat(Math.max(0, indentSize));

        const render = (value: unknown, depth: number): string => {
          if (value === null || value === undefined) return 'null';
          if (typeof value === 'boolean') return value ? 'true' : 'false';
          if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
          if (typeof value === 'string') return phpSingleQuote(value);

          const pad = unit.repeat(depth + 1);
          const closePad = unit.repeat(depth);

          if (Array.isArray(value)) {
            if (value.length === 0) return `${open}${close}`;
            const items = value.map((el) => `${pad}${render(el, depth + 1)},`);
            return `${open}\n${items.join('\n')}\n${closePad}${close}`;
          }

          // Plain object → associative array with quoted keys.
          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length === 0) return `${open}${close}`;
          const items = entries.map(
            ([k, v]) => `${pad}${phpSingleQuote(k)} => ${render(v, depth + 1)},`
          );
          return `${open}\n${items.join('\n')}\n${closePad}${close}`;
        };

        const body = render(data, 0);
        return returnStmt ? `return ${body};` : body;
      }}
      inputLabel="JSON"
      outputLabel="PHP Array"
      sample={SAMPLE}
      downloadName="data.php"
      options={
        <>
          <Field label="Short [] syntax">
            <Switch checked={shortSyntax} onCheckedChange={setShortSyntax} />
          </Field>
          <Field label={`Indent: ${indentSize}`} className="min-w-[180px]">
            <Slider
              value={[indentSize]}
              min={2}
              max={8}
              step={1}
              onValueChange={(v) => setIndentSize(v[0] ?? 4)}
            />
          </Field>
          <Field label="return …;">
            <Switch checked={returnStmt} onCheckedChange={setReturnStmt} />
          </Field>
        </>
      }
    />
  );
}
