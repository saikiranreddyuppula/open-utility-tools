'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const A_UP = 65;
const A_LO = 97;

export default function GronsfeldCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [keyStr, setKeyStr] = useState('31415');
  const [passThrough, setPassThrough] = useState(true);

  const digits = useMemo(() => {
    const ds = (keyStr.match(/[0-9]/g) ?? []).map((d) => Number(d));
    return ds;
  }, [keyStr]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (digits.length === 0) {
        throw new Error('Key must contain at least one digit (0–9).');
      }
      let out = '';
      let keyPos = 0;
      for (const ch of input) {
        const code = ch.charCodeAt(0);
        let base = -1;
        if (code >= A_UP && code <= A_UP + 25) base = A_UP;
        else if (code >= A_LO && code <= A_LO + 25) base = A_LO;
        if (base === -1) {
          if (passThrough) out += ch;
          continue;
        }
        const shift = digits[keyPos % digits.length] ?? 0;
        const x = code - base;
        const y =
          mode === 'encode'
            ? (x + shift) % 26
            : ((x - shift) % 26 + 26) % 26;
        out += String.fromCharCode(base + y);
        keyPos++;
      }
      return out;
    },
    [mode, digits, passThrough],
  );

  // Build the per-letter shift sequence aligned to the letters of the input
  // is not feasible without the input here; show the repeating key pattern.
  const keyPreview = useMemo(() => {
    if (digits.length === 0) return null;
    const repeated: number[] = [];
    for (let i = 0; i < Math.min(20, Math.max(digits.length, 10)); i++) {
      repeated.push(digits[i % digits.length] ?? 0);
    }
    return repeated;
  }, [digits]);

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, keyStr, passThrough]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
        outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
        sample="ATTACK AT DAWN"
        downloadName="gronsfeld.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="encode">Encrypt</TabsTrigger>
                  <TabsTrigger value="decode">Decrypt</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Numeric key (digits 0–9)">
              <Input
                value={keyStr}
                onChange={(e) => setKeyStr(e.target.value)}
                inputMode="numeric"
                className="w-40"
                placeholder="e.g. 31415"
              />
            </Field>
            <Field label="Pass through non-letters">
              <Switch checked={passThrough} onCheckedChange={setPassThrough} />
            </Field>
          </>
        }
      />

      {keyPreview && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Repeating shift sequence (each digit shifts one letter; non-letters
            do not advance the key):
          </div>
          <div className="flex flex-wrap gap-1 font-mono text-xs">
            {keyPreview.map((d, i) => (
              <span
                key={i}
                className="rounded bg-background px-1.5 py-0.5"
              >
                {d}
              </span>
            ))}
            <span className="px-1.5 py-0.5 text-muted-foreground">…</span>
          </div>
        </div>
      )}
    </div>
  );
}
