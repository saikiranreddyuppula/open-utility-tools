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

type DelimKind = 'comma' | 'tab' | 'pipe' | 'semicolon';
type ColType = 'text' | 'number' | 'date';
type Dir = 'asc' | 'desc';

const SAMPLE = `name,age,joined
Charlie,30,2021-03-15
Alice,30,2020-11-02
Bob,25,2022-01-09
alice,42,2019-06-30`;

const DELIMS: Record<DelimKind, string> = {
  comma: ',',
  tab: '\t',
  pipe: '|',
  semicolon: ';',
};

function compareCells(a: string, b: string, type: ColType): number {
  if (type === 'number') {
    const na = Number(a.replace(/[,$%\s]/g, ''));
    const nb = Number(b.replace(/[,$%\s]/g, ''));
    const aok = Number.isFinite(na);
    const bok = Number.isFinite(nb);
    if (aok && bok) return na - nb;
    if (aok) return -1;
    if (bok) return 1;
    return a.localeCompare(b);
  }
  if (type === 'date') {
    const da = Date.parse(a.trim());
    const db = Date.parse(b.trim());
    const aok = Number.isFinite(da);
    const bok = Number.isFinite(db);
    if (aok && bok) return da - db;
    if (aok) return -1;
    if (bok) return 1;
    return a.localeCompare(b);
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export default function MultiKeyColumnSort() {
  const [delim, setDelim] = useState<DelimKind>('comma');
  const [hasHeader, setHasHeader] = useState(true);

  const [col1, setCol1] = useState('2');
  const [type1, setType1] = useState<ColType>('number');
  const [dir1, setDir1] = useState<Dir>('asc');

  const [col2, setCol2] = useState('1');
  const [type2, setType2] = useState<ColType>('text');
  const [dir2, setDir2] = useState<Dir>('asc');

  const [useSecond, setUseSecond] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const d = DELIMS[delim];
      const rawLines = input.split(/\r\n?|\n/u);

      const header = hasHeader ? rawLines[0] : undefined;
      const bodyLines = hasHeader ? rawLines.slice(1) : rawLines;

      // Keep trailing blank line out of the sort, re-attach nothing extra.
      const rows = bodyLines
        .filter((l) => l !== '' || bodyLines.length === 1)
        .map((l) => ({ raw: l, cells: l.split(d) }));

      const c1 = Math.trunc(Number(col1)) - 1;
      const c2 = Math.trunc(Number(col2)) - 1;
      if (!Number.isFinite(c1) || c1 < 0) {
        throw new Error('Primary column must be a positive number (1-based).');
      }
      if (useSecond && (!Number.isFinite(c2) || c2 < 0)) {
        throw new Error('Secondary column must be a positive number (1-based).');
      }

      const keys: Array<{ idx: number; type: ColType; dir: Dir }> = [
        { idx: c1, type: type1, dir: dir1 },
      ];
      if (useSecond) keys.push({ idx: c2, type: type2, dir: dir2 });

      // Stable multi-key sort: decorate with original index as tie-breaker.
      const decorated = rows.map((r, i) => ({ r, i }));
      decorated.sort((x, y) => {
        for (const key of keys) {
          const xv = x.r.cells[key.idx] ?? '';
          const yv = y.r.cells[key.idx] ?? '';
          let cmp = compareCells(xv, yv, key.type);
          if (key.dir === 'desc') cmp = -cmp;
          if (cmp !== 0) return cmp;
        }
        return x.i - y.i;
      });

      const out: string[] = [];
      if (header !== undefined) out.push(header);
      for (const { r } of decorated) out.push(r.raw);
      return out.join('\n');
    },
    [delim, hasHeader, col1, type1, dir1, col2, type2, dir2, useSecond]
  );

  const typeSelect = (
    val: ColType,
    set: (v: ColType) => void,
    label: string
  ) => (
    <Field label={label}>
      <Select value={val} onValueChange={(v) => set(v as ColType)}>
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text</SelectItem>
          <SelectItem value="number">Number</SelectItem>
          <SelectItem value="date">Date</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );

  const dirSelect = (val: Dir, set: (v: Dir) => void, label: string) => (
    <Field label={label}>
      <Select value={val} onValueChange={(v) => set(v as Dir)}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">Ascending</SelectItem>
          <SelectItem value="desc">Descending</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, hasHeader, col1, type1, dir1, col2, type2, dir2, useSecond]}
      inputLabel="Delimited rows"
      outputLabel="Sorted rows"
      sample={SAMPLE}
      downloadName="sorted.txt"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as DelimKind)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma (CSV)</SelectItem>
                <SelectItem value="tab">Tab (TSV)</SelectItem>
                <SelectItem value="pipe">Pipe |</SelectItem>
                <SelectItem value="semicolon">Semicolon ;</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Header">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Checkbox
                checked={hasHeader}
                onCheckedChange={(v) => setHasHeader(v === true)}
              />
              First row is header
            </label>
          </Field>
          <Field label="Sort key 1 column">
            <Input
              value={col1}
              onChange={(e) => setCol1(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          {typeSelect(type1, setType1, 'Key 1 type')}
          {dirSelect(dir1, setDir1, 'Key 1 dir')}
          <Field label="2nd key">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Checkbox
                checked={useSecond}
                onCheckedChange={(v) => setUseSecond(v === true)}
              />
              Enable
            </label>
          </Field>
          {useSecond && (
            <>
              <Field label="Sort key 2 column">
                <Input
                  value={col2}
                  onChange={(e) => setCol2(e.target.value)}
                  inputMode="numeric"
                  className="w-20"
                />
              </Field>
              {typeSelect(type2, setType2, 'Key 2 type')}
              {dirSelect(dir2, setDir2, 'Key 2 dir')}
            </>
          )}
        </>
      }
    />
  );
}
