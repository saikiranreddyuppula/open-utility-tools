'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Mode = 'shuffle' | 'subset' | 'one';

const SAMPLE = `Alice
Bob
Carol
Dave
Eve`;

/** Returns an unbiased integer in [0, max) using rejection sampling. */
function randomInt(max: number): number {
  if (max <= 1) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    webcrypto.getRandomValues(buf);
    x = buf[0] ?? 0;
  } while (x >= limit);
  return x % max;
}

/** Fisher-Yates shuffle, in place, returning the same array. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}

export default function ShuffleLinesTool() {
  const [mode, setMode] = useState<Mode>('shuffle');
  const [subsetCount, setSubsetCount] = useState('3');
  const [skipBlank, setSkipBlank] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let lines = input.replace(/\r\n?/g, '\n').split('\n');
      if (skipBlank) lines = lines.filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';

      const shuffled = shuffle([...lines]);

      if (mode === 'one') {
        return shuffled[0] ?? '';
      }

      if (mode === 'subset') {
        const n = Number(subsetCount);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
          throw new Error('Subset size must be a whole number of at least 1.');
        }
        return shuffled.slice(0, n).join('\n');
      }

      return shuffled.join('\n');
    },
    // randomUUID changes nothing logically; deps drive re-runs on option change.
    [mode, subsetCount, skipBlank]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, subsetCount, skipBlank]}
      inputLabel="Lines"
      outputLabel="Shuffled"
      inputPlaceholder="One item per line…"
      sample={SAMPLE}
      downloadName="shuffled.txt"
      options={
        <div className="flex flex-col gap-4">
          <Field
            label="Mode"
            hint="Edit any option or the input to re-roll the randomness."
          >
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="shuffle">Shuffle all</TabsTrigger>
                <TabsTrigger value="subset">Random subset</TabsTrigger>
                <TabsTrigger value="one">Pick one</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'subset' && (
            <Field label="How many lines to keep">
              <Input
                type="number"
                min={1}
                value={subsetCount}
                onChange={(e) => setSubsetCount(e.target.value)}
                placeholder="3"
              />
            </Field>
          )}
          <Field label="Ignore blank lines">
            <div className="flex items-center gap-2">
              <Switch
                id="sl-skip"
                checked={skipBlank}
                onCheckedChange={setSkipBlank}
              />
              <Label htmlFor="sl-skip">Drop empty lines before shuffling</Label>
            </div>
          </Field>
        </div>
      }
    />
  );
}
