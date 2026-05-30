'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Sep = ' ' | '-' | ',';

const SEP_LABELS: Record<Sep, string> = { ' ': 'Space', '-': 'Dash', ',': 'Comma' };

const SAMPLE = 'Hello World';

function mod26(n: number): number {
  return ((n % 26) + 26) % 26;
}

function encode(input: string, sep: Sep, wordSep: string, reverse: boolean, shift: number): string {
  const words = input.split(/\s+/).filter((w) => w !== '');
  const encodedWords = words.map((word) => {
    const nums: string[] = [];
    for (const ch of word) {
      const code = ch.toLowerCase().charCodeAt(0);
      if (code >= 97 && code <= 122) {
        let pos = code - 97; // 0..25
        if (reverse) pos = 25 - pos;
        pos = mod26(pos + shift);
        nums.push(String(pos + 1)); // back to 1..26
      } else {
        // non-letter: keep verbatim as its own token so it round-trips visibly
        nums.push(ch);
      }
    }
    return nums.join(sep);
  });
  return encodedWords.join(` ${wordSep} `);
}

function decode(input: string, sep: Sep, wordSep: string, reverse: boolean, shift: number): string {
  const wordChunks = wordSep
    ? input.split(new RegExp(`\\s*${wordSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`))
    : [input];
  const decodedWords = wordChunks.map((chunk) => {
    const tokens = chunk
      .split(sep === ' ' ? /\s+/ : sep)
      .map((t) => t.trim())
      .filter((t) => t !== '');
    let out = '';
    for (const tok of tokens) {
      if (/^\d+$/.test(tok)) {
        const n = parseInt(tok, 10);
        if (n < 1 || n > 26) throw new Error(`Number out of range (1–26): ${n}`);
        let pos = n - 1; // 0..25
        pos = mod26(pos - shift);
        if (reverse) pos = 25 - pos;
        out += String.fromCharCode(97 + pos);
      } else {
        out += tok; // pass through non-numeric token
      }
    }
    return out;
  });
  return decodedWords.join(' ');
}

export default function A1z26CipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [sep, setSep] = useState<Sep>(' ');
  const [wordSep, setWordSep] = useState('/');
  const [reverse, setReverse] = useState(false);
  const [shift, setShift] = useState('0');

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      const shiftNum = Number.isFinite(parseInt(shift, 10)) ? parseInt(shift, 10) : 0;
      const ws = wordSep.trim();
      return mode === 'encode'
        ? encode(input, sep, ws || '/', reverse, shiftNum)
        : decode(input, sep, ws || '/', reverse, shiftNum);
    },
    [mode, sep, wordSep, reverse, shift],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, sep, wordSep, reverse, shift]}
      inputLabel={mode === 'encode' ? 'Text' : 'Numbers'}
      outputLabel={mode === 'encode' ? 'Numbers' : 'Text'}
      inputPlaceholder={mode === 'encode' ? 'Hello World' : '8 5 12 12 15 / 23 15 18 12 4'}
      sample={mode === 'encode' ? SAMPLE : '8 5 12 12 15 / 23 15 18 12 4'}
      downloadName="a1z26.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SEP_LABELS) as Sep[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEP_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Word marker" className="w-24">
            <Input value={wordSep} onChange={(e) => setWordSep(e.target.value)} placeholder="/" />
          </Field>
          <Field label="Shift (Caesar)" className="w-24">
            <Input value={shift} onChange={(e) => setShift(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Reverse (A=26)">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Switch checked={reverse} onCheckedChange={setReverse} /> Z…A order
            </label>
          </Field>
        </>
      }
    />
  );
}
