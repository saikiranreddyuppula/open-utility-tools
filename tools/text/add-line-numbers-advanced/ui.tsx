'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `First line
Second line

After a blank
Last line`;

export default function AdvancedLineNumberingTool() {
  const [start, setStart] = useState('1');
  const [step, setStep] = useState('1');
  const [pad, setPad] = useState('0');
  const [template, setTemplate] = useState('{n}. ');
  const [skipBlank, setSkipBlank] = useState(false);
  const [restartOnBlank, setRestartOnBlank] = useState(false);
  const [suffix, setSuffix] = useState(false);

  return (
    <TextToolLayout
      deps={[start, step, pad, template, skipBlank, restartOnBlank, suffix]}
      transform={(input) => {
        if (!input) return '';
        const startN = Number(start);
        const stepN = Number(step);
        const padN = Number(pad);
        if (!Number.isFinite(startN) || !Number.isInteger(startN)) {
          throw new Error('Start must be an integer.');
        }
        if (!Number.isFinite(stepN) || !Number.isInteger(stepN) || stepN === 0) {
          throw new Error('Step must be a non-zero integer.');
        }
        if (!Number.isFinite(padN) || padN < 0 || padN > 20) {
          throw new Error('Pad width must be between 0 and 20.');
        }
        if (!template.includes('{n}')) {
          throw new Error('Template must contain the {n} placeholder.');
        }

        const lines = input.split('\n');
        let counter = startN;
        const out = lines.map((line) => {
          const isBlank = line.trim() === '';
          if (isBlank) {
            if (restartOnBlank) counter = startN;
            if (skipBlank) return line;
          }
          const numStr =
            padN > 0
              ? Math.abs(counter).toString().padStart(padN, '0')
              : Math.abs(counter).toString();
          const signed = counter < 0 ? `-${numStr}` : numStr;
          const prefix = template.replace(/\{n\}/g, signed).replace(/\{line\}/g, line);
          counter += stepN;
          // If template references {line}, treat it as the full output line.
          if (template.includes('{line}')) return prefix;
          return suffix ? `${line}${signed}` : `${prefix}${line}`;
        });
        return out.join('\n');
      }}
      inputLabel="Text"
      outputLabel="Numbered text"
      sample={SAMPLE}
      downloadName="numbered.txt"
      options={
        <>
          <Field label="Start">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Step">
            <Input
              value={step}
              onChange={(e) => setStep(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Zero-pad width">
            <Input
              value={pad}
              onChange={(e) => setPad(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Template ({n}, {line})">
            <Input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-40 font-mono"
            />
          </Field>
          <Field label="Skip blank lines (like cat -b)">
            <Switch checked={skipBlank} onCheckedChange={setSkipBlank} />
          </Field>
          <Field label="Restart at blank lines">
            <Switch checked={restartOnBlank} onCheckedChange={setRestartOnBlank} />
          </Field>
          <Field label="Append as suffix">
            <Switch checked={suffix} onCheckedChange={setSuffix} />
          </Field>
        </>
      }
    />
  );
}
