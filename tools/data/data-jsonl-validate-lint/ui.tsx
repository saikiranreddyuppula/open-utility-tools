'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `{"id": 1, "name": "Ada"}
{"id": 2, "name": "Grace"}

{"id": 3, "name": "Linus"
{"id": 4, "name": "Margaret",}
["array", "is", "valid", "json"]
42`;

function topLevelType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Best-effort column extraction from a SyntaxError message (browser-dependent). */
function columnFromError(msg: string): number | null {
  const posMatch = msg.match(/position (\d+)/i);
  if (posMatch && posMatch[1] !== undefined) {
    const pos = Number(posMatch[1]);
    if (Number.isFinite(pos)) return pos + 1;
  }
  const colMatch = msg.match(/column (\d+)/i);
  if (colMatch && colMatch[1] !== undefined) {
    const col = Number(colMatch[1]);
    if (Number.isFinite(col)) return col;
  }
  return null;
}

export default function JsonlValidatorTool() {
  const [skipBlank, setSkipBlank] = useState(true);
  const [objectsOnly, setObjectsOnly] = useState(false);

  return (
    <TextToolLayout
      deps={[skipBlank, objectsOnly]}
      sample={SAMPLE}
      inputLabel="JSONL / NDJSON"
      outputLabel="Report"
      downloadName="jsonl-report.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const lines = input.split('\n');
        let valid = 0;
        let invalid = 0;
        let checked = 0;
        const failures: string[] = [];
        const detail: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const raw = lines[i] ?? '';
          const lineNo = i + 1;
          const trimmed = raw.trim();

          if (trimmed === '') {
            if (skipBlank) continue;
            invalid++;
            checked++;
            failures.push(`Line ${lineNo}: empty line (blank lines not allowed)`);
            detail.push(`Line ${lineNo}: INVALID — empty line`);
            continue;
          }

          checked++;
          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch (e) {
            invalid++;
            const msg = e instanceof Error ? e.message : String(e);
            const col = columnFromError(msg);
            const where = col != null ? ` (col ${col})` : '';
            failures.push(`Line ${lineNo}: ${msg}${where}`);
            detail.push(`Line ${lineNo}: INVALID — ${msg}${where}`);
            continue;
          }

          const t = topLevelType(parsed);
          if (objectsOnly && t !== 'object') {
            invalid++;
            failures.push(`Line ${lineNo}: top-level ${t}, but objects are required`);
            detail.push(`Line ${lineNo}: INVALID — top-level ${t} (objects only)`);
            continue;
          }

          valid++;
          detail.push(`Line ${lineNo}: valid — ${t}`);
        }

        const out: string[] = [];
        out.push(`Summary: ${valid} valid, ${invalid} invalid (${checked} checked)`);
        out.push('');
        if (failures.length > 0) {
          out.push('Failures:');
          out.push(...failures.map((f) => `  • ${f}`));
          out.push('');
        } else if (checked > 0) {
          out.push('All checked lines are valid JSON.');
          out.push('');
        }
        out.push('Per-line:');
        out.push(...detail.map((d) => `  ${d}`));
        return out.join('\n');
      }}
      options={
        <>
          <Field label="Skip blank lines">
            <Switch checked={skipBlank} onCheckedChange={setSkipBlank} />
          </Field>
          <Field label="Require objects only">
            <Switch checked={objectsOnly} onCheckedChange={setObjectsOnly} />
          </Field>
        </>
      }
    />
  );
}
