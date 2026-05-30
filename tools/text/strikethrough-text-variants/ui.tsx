'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

interface MarkDef {
  key: string;
  label: string;
  code: string; // the combining code point
}

const MARKS: MarkDef[] = [
  { key: 'strike', label: 'Strikethrough', code: '̶' },
  { key: 'shortStrike', label: 'Short strikethrough', code: '̵' },
  { key: 'underline', label: 'Underline', code: '̲' },
  { key: 'doubleUnderline', label: 'Double underline', code: '̳' },
  { key: 'overline', label: 'Overline', code: '̅' },
  { key: 'slash', label: 'Slash overlay', code: '̸' },
];

const MARK_BY_KEY: Record<string, MarkDef> = Object.fromEntries(
  MARKS.map((m) => [m.key, m]),
);

export default function StrikethroughVariantsTool() {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    strike: true,
  });
  const [skipSpaces, setSkipSpaces] = useState(true);
  const [betweenMarkers, setBetweenMarkers] = useState(false);

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => ({ ...prev, [key]: on }));

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const combos = MARKS.filter((m) => selected[m.key] === true)
        .map((m) => MARK_BY_KEY[m.key]?.code ?? '')
        .join('');
      if (combos.length === 0) {
        throw new Error('Select at least one combining mark.');
      }

      const decorate = (segment: string): string => {
        let out = '';
        for (const ch of segment) {
          // Don't add combining marks to whitespace if skipping, and never
          // try to combine onto a newline.
          if (ch === '\n') {
            out += ch;
            continue;
          }
          if (skipSpaces && /\s/.test(ch)) {
            out += ch;
            continue;
          }
          out += ch + combos;
        }
        return out;
      };

      if (!betweenMarkers) return decorate(input);

      // Only decorate text inside *...* markers; leave everything else as-is.
      return input.replace(/\*([^*]+)\*/g, (_full, inner: string) => decorate(inner));
    },
    [selected, skipSpaces, betweenMarkers],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[selected, skipSpaces, betweenMarkers]}
      inputLabel="Text"
      outputLabel="Decorated"
      inputPlaceholder="Type text to decorate…"
      sample={'This text is decorated'}
      downloadName="decorated.txt"
      mono={false}
      options={
        <>
          <Field label="Combining marks" hint="Stack multiple for layered effects">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MARKS.map((m) => (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selected[m.key] === true}
                    onCheckedChange={(c) => toggle(m.key, c === true)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Skip spaces" hint="Leave whitespace undecorated">
            <Switch checked={skipSpaces} onCheckedChange={setSkipSpaces} />
          </Field>
          <Field label="Only between *markers*" hint="Decorate *...* spans only">
            <div className="flex items-center gap-2">
              <Switch checked={betweenMarkers} onCheckedChange={setBetweenMarkers} />
              <Label className="text-xs text-muted-foreground">e.g. *this*</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
