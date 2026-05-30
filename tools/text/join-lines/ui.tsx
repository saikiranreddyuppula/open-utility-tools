'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type SepKind = 'comma' | 'comma-space' | 'space' | 'pipe' | 'newline-escaped' | 'custom';
type Quote = 'none' | 'single' | 'double';

const SAMPLE = ['apple', 'banana', 'cherry', 'date', 'elderberry'].join('\n');

function resolveSep(kind: SepKind, custom: string): string {
  switch (kind) {
    case 'comma':
      return ',';
    case 'comma-space':
      return ', ';
    case 'space':
      return ' ';
    case 'pipe':
      return '|';
    case 'newline-escaped':
      return '\\n';
    case 'custom':
      return custom;
    default:
      return ', ';
  }
}

export default function JoinLinesTool() {
  const [sepKind, setSepKind] = useState<SepKind>('comma-space');
  const [custom, setCustom] = useState(' / ');
  const [quote, setQuote] = useState<Quote>('none');
  const [trim, setTrim] = useState(true);
  const [skipBlank, setSkipBlank] = useState(true);
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupSize, setGroupSize] = useState('5');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      let lines = input.split('\n');
      if (trim) lines = lines.map((l) => l.trim());
      if (skipBlank) lines = lines.filter((l) => l.length > 0);
      if (lines.length === 0) return '';

      const q = quote === 'single' ? "'" : quote === 'double' ? '"' : '';
      const items = q ? lines.map((l) => `${q}${l}${q}`) : lines;
      const sep = resolveSep(sepKind, custom);

      if (groupEnabled) {
        const n = Number(groupSize);
        const size = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
        const out: string[] = [];
        for (let i = 0; i < items.length; i += size) {
          out.push(items.slice(i, i + size).join(sep));
        }
        return out.join('\n');
      }

      return items.join(sep);
    },
    [sepKind, custom, quote, trim, skipBlank, groupEnabled, groupSize]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sepKind, custom, quote, trim, skipBlank, groupEnabled, groupSize]}
      sample={SAMPLE}
      inputLabel="Lines"
      outputLabel="Joined"
      downloadName="joined.txt"
      options={
        <>
          <Field label="Separator">
            <Select value={sepKind} onValueChange={(v) => setSepKind(v as SepKind)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma ,</SelectItem>
                <SelectItem value="comma-space">Comma + space ,&nbsp;</SelectItem>
                <SelectItem value="space">Space</SelectItem>
                <SelectItem value="pipe">Pipe |</SelectItem>
                <SelectItem value="newline-escaped">Escaped \n</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {sepKind === 'custom' && (
            <Field label="Custom separator">
              <Input className="w-28" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </Field>
          )}
          <Field label="Quote each item">
            <Select value={quote} onValueChange={(v) => setQuote(v as Quote)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="single">Single &apos;</SelectItem>
                <SelectItem value="double">Double &quot;</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Group every N">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={groupEnabled} onCheckedChange={setGroupEnabled} />
              <Input
                className="w-20"
                value={groupSize}
                inputMode="numeric"
                disabled={!groupEnabled}
                onChange={(e) => setGroupSize(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={trim} onCheckedChange={setTrim} /> trim
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={skipBlank} onCheckedChange={setSkipBlank} /> skip blank
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
