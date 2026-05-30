'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// A few memorable words per digit; one is chosen at random for each occurrence.
const WORD_BANK: Record<string, string[]> = {
  '0': ['zero', 'hero', 'arrow', 'igloo'],
  '1': ['one', 'sun', 'bun', 'gun'],
  '2': ['two', 'shoe', 'zoo', 'glue'],
  '3': ['three', 'tree', 'bee', 'key'],
  '4': ['four', 'door', 'shore', 'core'],
  '5': ['five', 'hive', 'dive', 'drive'],
  '6': ['six', 'sticks', 'bricks', 'fix'],
  '7': ['seven', 'heaven', 'raven', 'eleven'],
  '8': ['eight', 'gate', 'plate', 'skate'],
  '9': ['nine', 'wine', 'line', 'pine'],
};

/** Unbiased integer in [0, max). */
function randInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % max;
}

const TRIVIAL = new Set<string>([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '0123', '4321', '2580', '1212', '6969', '1004', '2000',
]);

function isMonotonic(pin: string): boolean {
  if (pin.length < 3) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < pin.length; i++) {
    const a = pin.charCodeAt(i - 1);
    const b = pin.charCodeAt(i);
    if (b !== a + 1) up = false;
    if (b !== a - 1) down = false;
  }
  return up || down;
}

function makePin(length: number, noRepeat: boolean, noTrivial: boolean): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let pin = '';
    let prev = '';
    let ok = true;
    for (let i = 0; i < length; i++) {
      let d = randInt(10).toString();
      if (noRepeat) {
        let tries = 0;
        while (d === prev && tries < 20) {
          d = randInt(10).toString();
          tries++;
        }
        if (d === prev) { ok = false; break; }
      }
      pin += d;
      prev = d;
    }
    if (!ok) continue;
    if (noTrivial && (TRIVIAL.has(pin) || isMonotonic(pin))) continue;
    return pin;
  }
  // Fallback: just return a fresh random pin.
  return Array.from({ length }, () => randInt(10).toString()).join('');
}

function mnemonic(pin: string): string {
  const words: string[] = [];
  for (const ch of pin) {
    const bank = WORD_BANK[ch] ?? [ch];
    const w = bank[randInt(bank.length)] ?? ch;
    words.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return words.join(' ');
}

export default function MnemonicPinGeneratorTool() {
  const [length, setLength] = useState(4);
  const [noRepeat, setNoRepeat] = useState(false);
  const [noTrivial, setNoTrivial] = useState(true);

  const generate = useCallback(() => {
    const pin = makePin(length, noRepeat, noTrivial);
    return `${pin}  —  ${mnemonic(pin)}`;
  }, [length, noRepeat, noTrivial]);

  return (
    <GeneratorList
      generate={generate}
      deps={[length, noRepeat, noTrivial]}
      defaultCount={6}
      maxCount={50}
      downloadName="mnemonic-pins.txt"
      label="PINs with mnemonics"
      options={
        <>
          <Field label="PIN length">
            <Input
              type="number" min={4} max={12}
              value={length}
              onChange={(e) => setLength(Math.max(4, Math.min(Number(e.target.value) || 4, 12)))}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="No adjacent repeats">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={noRepeat} onCheckedChange={setNoRepeat} id="norep" />
              <Label htmlFor="norep" className="text-xs text-muted-foreground">e.g. avoid 1123</Label>
            </div>
          </Field>
          <Field label="Avoid sequences">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={noTrivial} onCheckedChange={setNoTrivial} id="notriv" />
              <Label htmlFor="notriv" className="text-xs text-muted-foreground">1234, 0000…</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
