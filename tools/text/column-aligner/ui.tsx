'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SepKind = 'tab' | 'comma' | 'spaces' | 'pipe' | 'regex';
type AlignMode = 'left' | 'right' | 'auto';
type OutSep = 'spaces' | 'pipe';

const SAMPLE = `Name, Role, Salary
Alice, Engineer, 95000
Bob, Designer, 72000
Charlie, Product Manager, 110000`;

// Count display width treating East Asian wide / fullwidth code points as 2.
function displayWidth(s: string, wide: boolean): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (
      wide &&
      ((cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
        (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals / Kangxi
        (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana .. CJK symbols
        (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
        (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
        (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
        (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
        (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
        (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
        (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x20000 && cp <= 0x3fffd)) // CJK Ext B+
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function isNumeric(s: string): boolean {
  const t = s.trim();
  if (t === '') return false;
  return Number.isFinite(Number(t.replace(/[,$%]/g, '')));
}

export default function ColumnAlignerTool() {
  const [sepKind, setSepKind] = useState<SepKind>('comma');
  const [customRegex, setCustomRegex] = useState('\\s*,\\s*');
  const [align, setAlign] = useState<AlignMode>('auto');
  const [gutter, setGutter] = useState('1');
  const [outSep, setOutSep] = useState<OutSep>('spaces');
  const [markdown, setMarkdown] = useState(false);
  const [wide, setWide] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lines = input.replace(/\r\n?/g, '\n').split('\n');

      let splitter: (line: string) => string[];
      if (sepKind === 'tab') splitter = (l) => l.split('\t');
      else if (sepKind === 'comma') splitter = (l) => l.split(',').map((c) => c.trim());
      else if (sepKind === 'pipe') splitter = (l) => l.split('|').map((c) => c.trim());
      else if (sepKind === 'spaces') splitter = (l) => l.trim().split(/\s+/);
      else {
        let re: RegExp;
        try {
          re = new RegExp(customRegex);
        } catch {
          throw new Error('Invalid custom split regex.');
        }
        splitter = (l) => l.split(re);
      }

      const rows: string[][] = lines.map((l) => splitter(l));
      const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
      if (cols === 0) return '';

      const widths: number[] = new Array<number>(cols).fill(0);
      for (const r of rows) {
        for (let c = 0; c < cols; c++) {
          const cell = r[c] ?? '';
          const w = displayWidth(cell, wide);
          if (w > (widths[c] ?? 0)) widths[c] = w;
        }
      }

      // Per-column alignment for auto mode: right if every non-empty cell is numeric.
      const colAlign: AlignMode[] = [];
      for (let c = 0; c < cols; c++) {
        if (align !== 'auto') {
          colAlign[c] = align;
          continue;
        }
        let allNum = true;
        let any = false;
        for (const r of rows) {
          const cell = (r[c] ?? '').trim();
          if (cell === '') continue;
          any = true;
          if (!isNumeric(cell)) {
            allNum = false;
            break;
          }
        }
        colAlign[c] = any && allNum ? 'right' : 'left';
      }

      const g = Math.max(0, Math.min(20, Math.floor(Number(gutter) || 0)));

      if (markdown) {
        const fmtRow = (r: string[]): string => {
          const cells: string[] = [];
          for (let c = 0; c < cols; c++) {
            const cell = (r[c] ?? '').trim();
            const target = widths[c] ?? 0;
            const pad = Math.max(0, target - displayWidth(cell, wide));
            const a = colAlign[c] ?? 'left';
            cells.push(a === 'right' ? ' '.repeat(pad) + cell + ' ' : ' ' + cell + ' '.repeat(pad) + ' ');
          }
          return '|' + cells.join('|') + '|';
        };
        const out: string[] = [];
        const first = rows[0] ?? [];
        out.push(fmtRow(first));
        const sepCells: string[] = [];
        for (let c = 0; c < cols; c++) {
          const w = (widths[c] ?? 0) + 2;
          const a = colAlign[c] ?? 'left';
          if (a === 'right') sepCells.push('-'.repeat(Math.max(2, w - 1)) + ':');
          else sepCells.push('-'.repeat(Math.max(3, w)));
        }
        out.push('|' + sepCells.join('|') + '|');
        for (let i = 1; i < rows.length; i++) out.push(fmtRow(rows[i] ?? []));
        return out.join('\n');
      }

      const between = outSep === 'pipe' ? ' | ' : ' '.repeat(Math.max(1, g));
      const out: string[] = rows.map((r) => {
        const cells: string[] = [];
        for (let c = 0; c < cols; c++) {
          const cell = r[c] ?? '';
          // skip trailing empty cells produced by shorter rows
          if (c >= r.length) {
            // pad to width to keep alignment when not last column
            if (c < cols - 1) cells.push(' '.repeat(widths[c] ?? 0));
            continue;
          }
          const pad = Math.max(0, (widths[c] ?? 0) - displayWidth(cell, wide));
          const a = colAlign[c] ?? 'left';
          const isLast = c === r.length - 1;
          if (a === 'right') cells.push(' '.repeat(pad) + cell);
          else cells.push(isLast ? cell : cell + ' '.repeat(pad));
        }
        return cells.join(between).replace(/\s+$/u, '');
      });
      return out.join('\n');
    },
    [sepKind, customRegex, align, gutter, outSep, markdown, wide]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sepKind, customRegex, align, gutter, outSep, markdown, wide]}
      inputLabel="Delimited text"
      outputLabel="Aligned"
      sample={SAMPLE}
      downloadName="aligned.txt"
      options={
        <>
          <Field label="Split on">
            <Select value={sepKind} onValueChange={(v) => setSepKind(v as SepKind)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="spaces">Whitespace run</SelectItem>
                <SelectItem value="pipe">Pipe |</SelectItem>
                <SelectItem value="regex">Custom regex</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {sepKind === 'regex' && (
            <Field label="Split regex" className="flex-1">
              <Input
                value={customRegex}
                onChange={(e) => setCustomRegex(e.target.value)}
                className="font-mono"
                spellCheck={false}
              />
            </Field>
          )}
          <Field label="Alignment">
            <Select value={align} onValueChange={(v) => setAlign(v as AlignMode)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (numbers right)</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Column separator">
            <Select value={outSep} onValueChange={(v) => setOutSep(v as OutSep)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spaces">Spaces</SelectItem>
                <SelectItem value="pipe">{' | '}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gutter spaces">
            <Input
              value={gutter}
              onChange={(e) => setGutter(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={markdown} onCheckedChange={(c) => setMarkdown(c === true)} /> Markdown
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={wide} onCheckedChange={(c) => setWide(c === true)} /> CJK width 2
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
