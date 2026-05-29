'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type Mode = 'encode' | 'decode';

function shiftText(input: string, amount: number): string {
  // Normalize amount into 0..25
  const norm = ((amount % 26) + 26) % 26;
  return input.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + norm) % 26) + base);
  });
}

export default function CaesarCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [shift, setShift] = useState(3);
  const [brute, setBrute] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (brute) {
        const lines: string[] = [];
        for (let s = 1; s <= 25; s += 1) {
          const label = String(s).padStart(2, ' ');
          lines.push(`[shift ${label}] ${shiftText(input, s)}`);
        }
        return lines.join('\n');
      }
      const effective = mode === 'encode' ? shift : -shift;
      return shiftText(input, effective);
    },
    [mode, shift, brute]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, shift, brute]}
      inputLabel="Text"
      outputLabel={brute ? 'All 25 shifts' : mode === 'encode' ? 'Ciphertext' : 'Plaintext'}
      sample="The quick brown fox jumps over the lazy dog."
      downloadName="caesar.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode" disabled={brute}>
                  Encode
                </TabsTrigger>
                <TabsTrigger value="decode" disabled={brute}>
                  Decode
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`Shift (${shift})`} className="min-w-[200px]">
            <Slider
              value={[shift]}
              onValueChange={(v) => setShift(v[0] ?? 0)}
              min={0}
              max={25}
              step={1}
              disabled={brute}
            />
          </Field>
          <Field label="Brute force">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="brute"
                checked={brute}
                onCheckedChange={(v) => setBrute(v === true)}
              />
              <Label htmlFor="brute" className="text-xs font-normal">
                Show all 25 shifts
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
