'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Sep = 'newline' | 'space' | 'comma' | 'none' | 'custom';

const SEP_VALUE: Record<Exclude<Sep, 'custom'>, string> = {
  newline: '\n',
  space: ' ',
  comma: ', ',
  none: '',
};

const MAX_COUNT = 100000;

export default function TextRepeaterTool() {
  const [count, setCount] = useState('10');
  const [sep, setSep] = useState<Sep>('newline');
  const [customSep, setCustomSep] = useState(' | ');
  const [number, setNumber] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const n = Number(count);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        throw new Error('Count must be a whole number of at least 1.');
      }
      if (n > MAX_COUNT) {
        throw new Error(`Count is too large. Maximum is ${MAX_COUNT}.`);
      }
      const separator = sep === 'custom' ? customSep : SEP_VALUE[sep];
      const parts: string[] = new Array<string>(n);
      for (let i = 0; i < n; i++) {
        parts[i] = number ? `${i + 1}. ${input}` : input;
      }
      return parts.join(separator);
    },
    [count, sep, customSep, number]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[count, sep, customSep, number]}
      inputLabel="Text to repeat"
      outputLabel="Repeated"
      inputPlaceholder="Enter text to repeat…"
      sample="Hello, world!"
      downloadName="repeated.txt"
      options={
        <div className="flex flex-col gap-4">
          <Field label="Repeat count">
            <Input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="10"
            />
          </Field>
          <Field label="Separator">
            <Tabs value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <TabsList>
                <TabsTrigger value="newline">Newline</TabsTrigger>
                <TabsTrigger value="space">Space</TabsTrigger>
                <TabsTrigger value="comma">Comma</TabsTrigger>
                <TabsTrigger value="none">None</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {sep === 'custom' && (
            <Field label="Custom separator">
              <Input
                value={customSep}
                onChange={(e) => setCustomSep(e.target.value)}
                placeholder=" | "
              />
            </Field>
          )}
          <Field label="Number each copy">
            <div className="flex items-center gap-2">
              <Switch
                id="tr-number"
                checked={number}
                onCheckedChange={setNumber}
              />
              <Label htmlFor="tr-number">Prefix with 1., 2., 3.…</Label>
            </div>
          </Field>
        </div>
      }
    />
  );
}
