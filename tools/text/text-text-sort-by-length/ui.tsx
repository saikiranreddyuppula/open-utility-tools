'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'asc' | 'desc';
type Measure = 'units' | 'points';

// Count Unicode code points (so astral chars count as one).
function codePointLength(s: string): number {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

export default function SortLinesByLengthTool() {
  const [dir, setDir] = useState<Direction>('asc');
  const [measure, setMeasure] = useState<Measure>('units');
  const [trim, setTrim] = useState(false);
  const [dropBlank, setDropBlank] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let lines = input.split('\n');
      if (dropBlank) lines = lines.filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';

      const lengthOf = (line: string): number => {
        const target = trim ? line.trim() : line;
        return measure === 'points' ? codePointLength(target) : target.length;
      };

      // Stable sort: primary by length (per direction), ties broken alphabetically.
      const indexed = lines.map((line, i) => ({ line, i, len: lengthOf(line) }));
      indexed.sort((a, b) => {
        const byLen = dir === 'asc' ? a.len - b.len : b.len - a.len;
        if (byLen !== 0) return byLen;
        const byAlpha = a.line.localeCompare(b.line);
        if (byAlpha !== 0) return byAlpha;
        return a.i - b.i; // keep original order for full ties (stable)
      });

      const lens = indexed.map((r) => r.len);
      const min = Math.min(...lens);
      const max = Math.max(...lens);
      const avg = lens.reduce((s, n) => s + n, 0) / lens.length;
      const body = indexed.map((r) => r.line).join('\n');
      const statsLine = `# ${indexed.length} lines · min ${min} · max ${max} · avg ${avg.toFixed(1)}`;
      return `${statsLine}\n${body}`;
    },
    [dir, measure, trim, dropBlank]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, measure, trim, dropBlank]}
      inputLabel="Lines"
      outputLabel="Sorted"
      sample={'apple\nfig\nbanana\nkiwi\nwatermelon\nplum\n\norange'}
      downloadName="sorted-by-length.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Direction)}>
              <TabsList>
                <TabsTrigger value="asc">Shortest first</TabsTrigger>
                <TabsTrigger value="desc">Longest first</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Measure">
            <Tabs value={measure} onValueChange={(v) => setMeasure(v as Measure)}>
              <TabsList>
                <TabsTrigger value="units">Characters</TabsTrigger>
                <TabsTrigger value="points">Code points</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Trim whitespace">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={trim} onCheckedChange={setTrim} id="sbl-trim" />
              <Label htmlFor="sbl-trim" className="text-xs text-muted-foreground">
                Ignore edge spaces
              </Label>
            </div>
          </Field>
          <Field label="Blank lines">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={dropBlank} onCheckedChange={setDropBlank} id="sbl-blank" />
              <Label htmlFor="sbl-blank" className="text-xs text-muted-foreground">
                Drop empty
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
