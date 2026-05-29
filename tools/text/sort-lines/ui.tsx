'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { splitLines, applyLineOptions, sortLines, dedupeLines, type SortMode } from '@/lib/text/lines';

const MODES: { id: SortMode; label: string }[] = [
  { id: 'asc', label: 'A → Z' },
  { id: 'desc', label: 'Z → A' },
  { id: 'numeric', label: 'Numeric' },
  { id: 'length', label: 'By length' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'shuffle', label: 'Shuffle' },
];

export default function SortLinesTool() {
  const [mode, setMode] = useState<SortMode>('asc');
  const [dedupe, setDedupe] = useState(false);
  const [ci, setCi] = useState(false);
  const [trim, setTrim] = useState(false);
  const [removeEmpty, setRemoveEmpty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let lines = applyLineOptions(splitLines(input), { trim, removeEmpty, caseInsensitive: ci });
      lines = sortLines(lines, mode, ci);
      if (dedupe) lines = dedupeLines(lines, ci);
      return lines.join('\n');
    },
    [mode, dedupe, ci, trim, removeEmpty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, dedupe, ci, trim, removeEmpty]}
      sample={'banana\napple\nCherry\napple\n42\n7'}
      downloadName="sorted.txt"
      options={
        <>
          <Field label="Order">
            <Select value={mode} onValueChange={(v) => setMode(v as SortMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Options">
            <div className="flex h-8 flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={dedupe} onCheckedChange={setDedupe} /> dedupe
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={ci} onCheckedChange={setCi} /> ignore case
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={trim} onCheckedChange={setTrim} /> trim
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={removeEmpty} onCheckedChange={setRemoveEmpty} /> drop empty
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
