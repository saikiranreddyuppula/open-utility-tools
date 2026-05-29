'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Unit = 'chars' | 'words';

function truncateOne(text: string, unit: Unit, limit: number, suffix: string): string {
  if (unit === 'words') {
    const words = text.split(/(\s+)/);
    let count = 0;
    let result = '';
    let cut = false;
    for (const token of words) {
      const isWord = !/^\s+$/.test(token) && token.length > 0;
      if (isWord) {
        if (count >= limit) {
          cut = true;
          break;
        }
        count += 1;
      }
      result += token;
    }
    return cut ? result.replace(/\s+$/, '') + suffix : text;
  }
  // chars
  if (text.length <= limit) return text;
  if (limit <= 0) return suffix;
  return text.slice(0, limit) + suffix;
}

export default function TextTruncator() {
  const [unit, setUnit] = useState<Unit>('chars');
  const [limitStr, setLimitStr] = useState('80');
  const [suffix, setSuffix] = useState('…');
  const [perLine, setPerLine] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const limit = Number(limitStr);
      if (!Number.isFinite(limit) || limit < 0) {
        throw new Error('Length must be a non-negative number.');
      }
      const n = Math.floor(limit);
      if (perLine) {
        return input
          .split('\n')
          .map((line) => truncateOne(line, unit, n, suffix))
          .join('\n');
      }
      return truncateOne(input, unit, n, suffix);
    },
    [unit, limitStr, suffix, perLine],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[unit, limitStr, suffix, perLine]}
      inputLabel="Text"
      outputLabel="Truncated"
      inputPlaceholder="Paste text to truncate…"
      sample="The quick brown fox jumps over the lazy dog."
      downloadName="truncated.txt"
      options={
        <>
          <Field label="Unit">
            <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <TabsList>
                <TabsTrigger value="chars">Characters</TabsTrigger>
                <TabsTrigger value="words">Words</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Max length">
            <Input
              type="number"
              min={0}
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Suffix">
            <Input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="…"
              className="w-28"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="perline" checked={perLine} onCheckedChange={(v) => setPerLine(Boolean(v))} />
            <Label htmlFor="perline">Per line</Label>
          </div>
        </>
      }
    />
  );
}
