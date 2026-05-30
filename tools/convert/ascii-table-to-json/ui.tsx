'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `+----+------------+-------+--------+
| id | name       | score | active |
+----+------------+-------+--------+
|  1 | Ada        |  98.5 | true   |
|  2 | Linus      |    77 | false  |
| 10 | Grace      | 100   | true   |
+----+------------+-------+--------+`;

/** A line made only of border characters (- = + | space) is a separator. */
function isBorderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^[+\-=|:\s]+$/.test(t) && /[-=]/.test(t);
}

function stripBorders(line: string): string {
  // Drop a leading and trailing pipe if present (box style).
  let s = line;
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s;
}

function splitPipeRow(line: string): string[] {
  return stripBorders(line)
    .split('|')
    .map((c) => c.trim());
}

/** Determine column slice boundaries from a space-aligned header. */
function spaceColumnBounds(header: string): Array<[number, number]> {
  // A column starts at a non-space that follows >=2 spaces (or start of line).
  const bounds: Array<[number, number]> = [];
  let i = 0;
  const n = header.length;
  while (i < n) {
    // skip leading spaces
    while (i < n && header[i] === ' ') i++;
    if (i >= n) break;
    const start = i;
    // advance until we hit a run of 2+ spaces
    while (i < n) {
      if (header[i] === ' ' && header[i + 1] === ' ') break;
      i++;
    }
    bounds.push([start, i]);
  }
  return bounds;
}

function coerce(raw: string): string | number | boolean | null {
  const t = raw.trim();
  if (t === '') return null;
  const low = t.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  if (low === 'null') return null;
  // Number: avoid leading-zero ids like "007" being mangled, but allow normal ints/floats.
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) {
    const num = Number(t);
    if (Number.isFinite(num) && String(num) === t) return num;
    if (Number.isFinite(num)) return num;
  }
  return t;
}

type Cell = string | number | boolean | null;

export default function AsciiTableToJson() {
  const [coerceTypes, setCoerceTypes] = useState(true);
  const [asArrays, setAsArrays] = useState(false);

  return (
    <TextToolLayout
      deps={[coerceTypes, asArrays]}
      sample={SAMPLE}
      inputLabel="ASCII table"
      outputLabel="JSON"
      downloadName="table.json"
      transform={(input) => {
        if (!input.trim()) return '';
        const rawLines = input.replace(/\r\n?/g, '\n').split('\n');
        // Keep only lines with content; remember which are borders.
        const lines = rawLines.filter((l) => l.trim().length > 0);
        if (lines.length === 0) throw new Error('No table content found.');

        const hasPipes = lines.some((l) => l.includes('|'));

        let header: string[] = [];
        let dataRows: string[][] = [];

        if (hasPipes) {
          // Box / psql / MySQL style.
          const contentLines = lines.filter((l) => !isBorderLine(l));
          const headerLine = contentLines[0];
          if (headerLine === undefined) throw new Error('Could not find a header row.');
          header = splitPipeRow(headerLine);
          if (header.length === 0) throw new Error('Header row has no columns.');
          dataRows = contentLines.slice(1).map((l) => splitPipeRow(l));
        } else {
          // Pure space-aligned columns.
          const headerLine = lines.find((l) => !isBorderLine(l));
          if (headerLine === undefined) throw new Error('Could not find a header row.');
          const bounds = spaceColumnBounds(headerLine);
          if (bounds.length === 0) throw new Error('Could not detect columns.');
          header = bounds.map(([s, e]) => headerLine.slice(s, e).trim());
          const headerIdx = lines.indexOf(headerLine);
          dataRows = lines
            .slice(headerIdx + 1)
            .filter((l) => !isBorderLine(l))
            .map((l) =>
              bounds.map(([s], bi) => {
                const end = bounds[bi + 1]?.[0] ?? l.length;
                return l.slice(s, Math.max(s, end)).trim();
              })
            );
        }

        if (asArrays) {
          const out: Cell[][] = [header.map((h) => h)];
          for (const row of dataRows) {
            const cells: Cell[] = header.map((_, i) =>
              coerceTypes ? coerce(row[i] ?? '') : (row[i] ?? '')
            );
            out.push(cells);
          }
          return JSON.stringify(out, null, 2);
        }

        const objects: Array<Record<string, Cell>> = dataRows.map((row) => {
          const obj: Record<string, Cell> = {};
          header.forEach((key, i) => {
            const cell = row[i] ?? '';
            obj[key || `column_${i + 1}`] = coerceTypes ? coerce(cell) : cell;
          });
          return obj;
        });
        return JSON.stringify(objects, null, 2);
      }}
      options={
        <>
          <Field label="Coerce types">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={coerceTypes} onCheckedChange={setCoerceTypes} />
              <span className="text-sm text-muted-foreground">
                {coerceTypes ? 'numbers / booleans / null' : 'all strings'}
              </span>
            </div>
          </Field>
          <Field label="Output shape">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={asArrays} onCheckedChange={setAsArrays} />
              <span className="text-sm text-muted-foreground">
                {asArrays ? 'array of arrays' : 'array of objects'}
              </span>
            </div>
          </Field>
        </>
      }
    />
  );
}
