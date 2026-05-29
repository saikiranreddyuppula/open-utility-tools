'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

// Combining marks that render above the base character.
const ZALGO_UP = [
  0x0300, 0x0301, 0x0302, 0x0303, 0x0304, 0x0305, 0x0306, 0x0307, 0x0308, 0x0309, 0x030a, 0x030b,
  0x030c, 0x030d, 0x030e, 0x030f, 0x0310, 0x0311, 0x0312, 0x0313, 0x0314, 0x033d, 0x033e, 0x033f,
  0x0342, 0x0344, 0x0346, 0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357, 0x035b,
];
// Combining marks that render in the middle of the character.
const ZALGO_MID = [
  0x0315, 0x031b, 0x0340, 0x0341, 0x0358, 0x0321, 0x0322, 0x0327, 0x0328, 0x0334, 0x0335, 0x0336,
  0x034f, 0x035c, 0x035d, 0x035e, 0x035f, 0x0360, 0x0362, 0x0338, 0x0337,
];
// Combining marks that render below the character.
const ZALGO_DOWN = [
  0x0316, 0x0317, 0x0318, 0x0319, 0x031c, 0x031d, 0x031e, 0x031f, 0x0320, 0x0324, 0x0325, 0x0326,
  0x0329, 0x032a, 0x032b, 0x032c, 0x032d, 0x032e, 0x032f, 0x0330, 0x0331, 0x0332, 0x0333, 0x0339,
  0x033a, 0x033b, 0x033c, 0x0345, 0x0347, 0x0348, 0x0349, 0x034d, 0x034e, 0x0353, 0x0354, 0x0355,
  0x0356, 0x0359, 0x035a, 0x0323,
];

// Range of combining diacritical marks, used to strip Zalgo back out.
const COMBINING_RE = /[̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃿]/g;

function pick(pool: readonly number[], rnd: number): number {
  if (pool.length === 0) return 0x0300;
  const idx = Math.floor(rnd * pool.length) % pool.length;
  return pool[idx] ?? 0x0300;
}

export default function ZalgoTextTool() {
  const [mode, setMode] = useState<'zalgo' | 'clean'>('zalgo');
  const [intensity, setIntensity] = useState(6);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      if (mode === 'clean') {
        return input.normalize('NFC').replace(COMBINING_RE, '');
      }

      const chars = Array.from(input);
      // Random bytes: up to `intensity` marks per char, drawn from up/mid/down.
      const perChar = Math.max(1, Math.floor(intensity));
      const bytes = new Uint8Array(chars.length * perChar * 2 + 1);
      webcrypto.getRandomValues(bytes);

      let b = 0;
      const nextRnd = (): number => {
        const v = bytes[b % bytes.length] ?? 0;
        b += 1;
        return v / 256;
      };

      let out = '';
      for (const ch of chars) {
        out += ch;
        // Whitespace and newlines stay clean so layout survives.
        if (/\s/.test(ch)) continue;
        const count = 1 + Math.floor(nextRnd() * perChar);
        for (let i = 0; i < count; i += 1) {
          const bucket = nextRnd();
          const pool = bucket < 0.4 ? ZALGO_UP : bucket < 0.7 ? ZALGO_DOWN : ZALGO_MID;
          out += String.fromCharCode(pick(pool, nextRnd()));
        }
      }
      return out;
    },
    [mode, intensity],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, intensity]}
      inputLabel="Text"
      outputLabel={mode === 'clean' ? 'Cleaned' : 'Zalgo'}
      inputPlaceholder={mode === 'clean' ? 'Paste glitchy text to clean...' : 'Type some text...'}
      sample="To invoke the hive-mind"
      downloadName="zalgo.txt"
      options={
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'zalgo' | 'clean')}>
              <TabsList>
                <TabsTrigger value="zalgo">Zalgo-ify</TabsTrigger>
                <TabsTrigger value="clean">Clean</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'zalgo' && (
            <Field label={`Intensity: ${intensity}`} className="min-w-48">
              <Slider
                min={1}
                max={20}
                step={1}
                value={[intensity]}
                onValueChange={(v) => setIntensity(v[0] ?? 6)}
              />
            </Field>
          )}
        </div>
      }
    />
  );
}
