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

type Mode = 'field' | 'char';
type SepKind = 'tab' | 'comma' | 'space' | 'pipe' | 'regex';

const SAMPLE = `id,first,last,email,age
1,Ada,Lovelace,ada@math.org,36
2,Alan,Turing,alan@compute.uk,41
3,Grace,Hopper,grace@navy.mil,85`;

interface RangeSpec {
  start: number; // 1-based, can be negative
  end: number; // 1-based inclusive, can be negative; Infinity for open
}

// Parse a spec like "1,3,5-7,-1" into ordered range entries.
function parseSpec(spec: string): RangeSpec[] {
  const out: RangeSpec[] = [];
  for (const partRaw of spec.split(',')) {
    const part = partRaw.trim();
    if (part === '') continue;
    const dash = part.indexOf('-', part.startsWith('-') ? 1 : 0);
    if (dash === -1) {
      const n = Number(part);
      if (!Number.isInteger(n) || n === 0) throw new Error(`Invalid index: "${part}"`);
      out.push({ start: n, end: n });
    } else {
      const a = part.slice(0, dash).trim();
      const b = part.slice(dash + 1).trim();
      const start = a === '' ? 1 : Number(a);
      const end = b === '' ? Infinity : Number(b);
      if (a !== '' && (!Number.isInteger(start) || start === 0))
        throw new Error(`Invalid range start: "${part}"`);
      if (b !== '' && (!Number.isInteger(end) || end === 0))
        throw new Error(`Invalid range end: "${part}"`);
      out.push({ start, end });
    }
  }
  if (out.length === 0) throw new Error('Enter at least one field/range.');
  return out;
}

// Resolve a (possibly negative) 1-based index against a length to a 0-based index.
function resolve(idx: number, len: number): number {
  return idx < 0 ? len + idx : idx - 1;
}

export default function ColumnExtractorTool() {
  const [mode, setMode] = useState<Mode>('field');
  const [sepKind, setSepKind] = useState<SepKind>('comma');
  const [customRegex, setCustomRegex] = useState(',');
  const [spec, setSpec] = useState('1,3-4');
  const [outDelim, setOutDelim] = useState('');
  const [reorder, setReorder] = useState(true);
  const [keepShort, setKeepShort] = useState(false);
  const [collapse, setCollapse] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const ranges = parseSpec(spec);
      const lines = input.replace(/\r\n?/g, '\n').split('\n');

      if (mode === 'char') {
        const out: string[] = [];
        for (const line of lines) {
          const chars = Array.from(line);
          const len = chars.length;
          const picked: string[] = [];
          for (const r of ranges) {
            const s = resolve(r.start, len);
            const e = r.end === Infinity ? len - 1 : resolve(r.end, len);
            for (let i = Math.max(0, s); i <= Math.min(len - 1, e); i++) {
              const c = chars[i];
              if (c !== undefined) picked.push(c);
            }
          }
          out.push(picked.join(''));
        }
        return out.join('\n');
      }

      let split: (line: string) => string[];
      let defaultDelim: string;
      if (sepKind === 'tab') {
        split = (l) => l.split('\t');
        defaultDelim = '\t';
      } else if (sepKind === 'comma') {
        split = (l) => l.split(',');
        defaultDelim = ',';
      } else if (sepKind === 'pipe') {
        split = (l) => l.split('|');
        defaultDelim = '|';
      } else if (sepKind === 'space') {
        split = (l) => (collapse ? l.split(/\s+/) : l.split(' '));
        defaultDelim = ' ';
      } else {
        let re: RegExp;
        try {
          re = new RegExp(customRegex);
        } catch {
          throw new Error('Invalid custom split regex.');
        }
        split = (l) => l.split(re);
        defaultDelim = ' ';
      }

      const joiner = outDelim === '' ? defaultDelim : outDelim.replace(/\\t/g, '\t');

      const out: string[] = [];
      for (const line of lines) {
        let fields = split(line);
        if (collapse && (sepKind === 'comma' || sepKind === 'pipe' || sepKind === 'tab')) {
          fields = fields.filter((_, i) => i === 0 || fields[i] !== '' || i === fields.length - 1);
        }
        const len = fields.length;

        // Build list of 0-based indices to pick, in order if reordering.
        const idxList: number[] = [];
        for (const r of ranges) {
          const s = resolve(r.start, len);
          const e = r.end === Infinity ? len - 1 : resolve(r.end, len);
          if (s <= e) {
            for (let i = s; i <= e; i++) idxList.push(i);
          } else {
            for (let i = s; i >= e; i--) idxList.push(i);
          }
        }

        const validIdx = idxList.filter((i) => i >= 0 && i < len);
        const hadAll = validIdx.length === idxList.length;
        if (!hadAll && !keepShort && !reorder) {
          // line lacks some requested fields and user wants to skip
          if (validIdx.length === 0) continue;
        }
        if (validIdx.length === 0 && !keepShort) continue;

        let chosen: number[];
        if (reorder) {
          chosen = validIdx;
        } else {
          // cut-style: output in ascending order, unique
          chosen = Array.from(new Set(validIdx)).sort((x, y) => x - y);
        }

        const cells: string[] = [];
        for (const i of chosen) {
          cells.push(fields[i] ?? '');
        }
        out.push(cells.join(joiner));
      }
      return out.join('\n');
    },
    [mode, sepKind, customRegex, spec, outDelim, reorder, keepShort, collapse]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, sepKind, customRegex, spec, outDelim, reorder, keepShort, collapse]}
      inputLabel="Delimited text"
      outputLabel="Extracted"
      sample={SAMPLE}
      downloadName="extracted.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="field">Fields</SelectItem>
                <SelectItem value="char">Characters</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'field' && (
            <Field label="Split on">
              <Select value={sepKind} onValueChange={(v) => setSepKind(v as SepKind)}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comma">Comma</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                  <SelectItem value="space">Space</SelectItem>
                  <SelectItem value="pipe">Pipe |</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {mode === 'field' && sepKind === 'regex' && (
            <Field label="Split regex" className="flex-1">
              <Input
                value={customRegex}
                onChange={(e) => setCustomRegex(e.target.value)}
                className="font-mono"
                spellCheck={false}
              />
            </Field>
          )}
          <Field label={mode === 'field' ? 'Fields (e.g. 1,3,5-7,-1)' : 'Chars (e.g. 1-10)'} className="flex-1">
            <Input
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </Field>
          {mode === 'field' && (
            <Field label="Output delimiter">
              <Input
                value={outDelim}
                onChange={(e) => setOutDelim(e.target.value)}
                className="w-24 font-mono"
                placeholder="same"
                spellCheck={false}
              />
            </Field>
          )}
          {mode === 'field' && (
            <Field label="Options">
              <div className="flex h-8 flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={reorder} onCheckedChange={(c) => setReorder(c === true)} /> reorder
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={keepShort} onCheckedChange={(c) => setKeepShort(c === true)} /> keep short lines
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={collapse} onCheckedChange={(c) => setCollapse(c === true)} /> collapse delims
                </label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
