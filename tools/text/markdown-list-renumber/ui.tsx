'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Op = 'renumber' | 'to-unordered' | 'to-ordered' | 'normalize-bullet';
type Bullet = '-' | '*' | '+';
type Indent = '2' | '4' | 'keep';

const SAMPLE = [
  '1. First item',
  '5. Second item (wrong number)',
  '    1. Nested a',
  '    1. Nested b',
  '3. Third item',
  '',
  '- a bullet',
  '* another bullet',
].join('\n');

const ORDERED = /^(\s*)(\d+)([.)])\s+(.*)$/;
const UNORDERED = /^(\s*)([-*+])\s+(.*)$/;

// Map a leading-whitespace string to a logical indent level (by visual columns).
function indentLevel(ws: string): number {
  let cols = 0;
  for (const ch of ws) cols += ch === '\t' ? 4 : 1;
  // group every ~2 columns into a level; robust to 2- or 4-space styles
  return Math.floor(cols / 2);
}

function normIndent(level: number, indent: Indent, original: string): string {
  if (indent === 'keep') return original;
  const unit = indent === '4' ? 4 : 2;
  return ' '.repeat(level * unit);
}

export default function MarkdownListRenumberTool() {
  const [op, setOp] = useState<Op>('renumber');
  const [bullet, setBullet] = useState<Bullet>('-');
  const [indent, setIndent] = useState<Indent>('keep');
  const [start, setStart] = useState('1');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const startN = Number(start);
      const startVal = Number.isFinite(startN) ? Math.floor(startN) : 1;

      const lines = input.split('\n');
      const out: string[] = [];
      // counters per logical level, for renumber/to-ordered
      const counters = new Map<number, number>();

      const resetDeeper = (level: number) => {
        for (const key of Array.from(counters.keys())) {
          if (key > level) counters.delete(key);
        }
      };

      for (const line of lines) {
        const om = line.match(ORDERED);
        const um = line.match(UNORDERED);

        if (om) {
          const ws = om[1] ?? '';
          const delim = om[3] ?? '.';
          const content = om[4] ?? '';
          const level = indentLevel(ws);
          const ind = normIndent(level, indent, ws);

          if (op === 'to-unordered') {
            out.push(`${ind}${bullet} ${content}`);
          } else {
            // renumber (and normalize-bullet keeps ordered as renumber)
            const next = (counters.get(level) ?? startVal - 1) + 1;
            counters.set(level, next);
            resetDeeper(level);
            const useDelim = op === 'normalize-bullet' ? '.' : delim;
            out.push(`${ind}${next}${useDelim} ${content}`);
          }
          continue;
        }

        if (um) {
          const ws = um[1] ?? '';
          const content = um[3] ?? '';
          const level = indentLevel(ws);
          const ind = normIndent(level, indent, ws);

          if (op === 'to-ordered') {
            const next = (counters.get(level) ?? startVal - 1) + 1;
            counters.set(level, next);
            resetDeeper(level);
            out.push(`${ind}${next}. ${content}`);
          } else if (op === 'to-unordered' || op === 'normalize-bullet') {
            out.push(`${ind}${bullet} ${content}`);
          } else {
            // renumber: leave the bullet marker untouched, normalize indent only
            const marker = um[2] ?? bullet;
            out.push(`${ind}${marker} ${content}`);
          }
          continue;
        }

        // Non-list line: a blank line ends a list run; reset counters.
        if (line.trim() === '') {
          counters.clear();
        }
        out.push(line);
      }

      return out.join('\n');
    },
    [op, bullet, indent, start]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[op, bullet, indent, start]}
      sample={SAMPLE}
      inputLabel="Markdown"
      outputLabel="Corrected Markdown"
      downloadName="list.md"
      options={
        <>
          <Field label="Operation">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="renumber">Renumber ordered</SelectItem>
                <SelectItem value="to-unordered">Ordered &rarr; bullets</SelectItem>
                <SelectItem value="to-ordered">Bullets &rarr; ordered</SelectItem>
                <SelectItem value="normalize-bullet">Normalize markers</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(op === 'to-unordered' || op === 'normalize-bullet') && (
            <Field label="Bullet">
              <Select value={bullet} onValueChange={(v) => setBullet(v as Bullet)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Dash -</SelectItem>
                  <SelectItem value="*">Star *</SelectItem>
                  <SelectItem value="+">Plus +</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {(op === 'renumber' || op === 'to-ordered') && (
            <Field label="Start at">
              <Input className="w-20" value={start} inputMode="numeric" onChange={(e) => setStart(e.target.value)} />
            </Field>
          )}
          <Field label="Indentation">
            <Select value={indent} onValueChange={(v) => setIndent(v as Indent)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep</SelectItem>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
