'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function NumberLinesTool() {
  const [start, setStart] = useState('1');
  const [step, setStep] = useState('1');
  const [pad, setPad] = useState('0');
  const [separator, setSeparator] = useState('. ');
  const [skipBlank, setSkipBlank] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      const startNum = Number(start);
      const stepNum = Number(step);
      const padNum = Number(pad);

      if (!Number.isFinite(startNum)) throw new Error('Start value must be a number.');
      if (!Number.isFinite(stepNum)) throw new Error('Step value must be a number.');
      if (!Number.isFinite(padNum) || padNum < 0)
        throw new Error('Padding width must be a non-negative number.');

      const padWidth = Math.floor(padNum);
      const lines = input.split('\n');
      let counter = startNum;

      const out = lines.map((line) => {
        if (skipBlank && line.trim() === '') return line;
        const label = String(Math.abs(counter)).padStart(padWidth, '0');
        const signed = counter < 0 ? `-${label}` : label;
        counter += stepNum;
        return `${signed}${separator}${line}`;
      });

      return out.join('\n');
    },
    [start, step, pad, separator, skipBlank],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[start, step, pad, separator, skipBlank]}
      inputLabel="Text"
      outputLabel="Numbered"
      inputPlaceholder="Paste lines to number..."
      sample={'First line\nSecond line\nThird line'}
      downloadName="numbered.txt"
      options={
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Start">
            <Input
              type="number"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Step">
            <Input
              type="number"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Zero-pad width">
            <Input
              type="number"
              min={0}
              value={pad}
              onChange={(e) => setPad(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Separator">
            <Input
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              className="w-24"
              placeholder=". "
            />
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="skip-blank" checked={skipBlank} onCheckedChange={setSkipBlank} />
            <Label htmlFor="skip-blank">Skip blank lines</Label>
          </div>
        </div>
      }
    />
  );
}
