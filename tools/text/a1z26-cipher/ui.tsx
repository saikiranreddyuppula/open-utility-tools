'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'encode' | 'decode';
type Sep = 'hyphen' | 'space' | 'comma';

const SEP_CHAR: Record<Sep, string> = { hyphen: '-', space: ' ', comma: ', ' };
// Words are kept distinct on encode so decode can restore spaces. Hyphen-
// separated numbers contain no whitespace, so a space safely marks word
// boundaries. Space and comma separators include whitespace, so words are
// delimited by a slash to stay unambiguous.
const WORD_SEP: Record<Sep, string> = { hyphen: ' ', space: ' / ', comma: ' / ' };

const A_CODE = 'a'.charCodeAt(0);

function isLetter(ch: string): boolean {
  const c = ch.toLowerCase().charCodeAt(0);
  return c >= A_CODE && c <= A_CODE + 25;
}

// position 0..25 within the alphabet for a letter
function letterIndex(ch: string): number {
  return ch.toLowerCase().charCodeAt(0) - A_CODE;
}

function encode(
  input: string,
  sep: Sep,
  zeroBased: boolean,
  reverse: boolean,
  keepNonLetters: boolean,
): string {
  const joiner = SEP_CHAR[sep];
  const wordSep = WORD_SEP[sep];
  const words = input.split(/\s+/).filter((w) => w.length > 0);
  const encoded: string[] = [];
  for (const word of words) {
    const parts: string[] = [];
    for (const ch of word) {
      if (isLetter(ch)) {
        let idx = letterIndex(ch); // 0..25
        if (reverse) idx = 25 - idx;
        parts.push(String(zeroBased ? idx : idx + 1));
      } else if (keepNonLetters) {
        parts.push(ch);
      }
      // else: strip silently
    }
    if (parts.length > 0) encoded.push(parts.join(joiner));
  }
  return encoded.join(wordSep);
}

function decode(input: string, zeroBased: boolean, reverse: boolean): string {
  const minV = zeroBased ? 0 : 1;
  const maxV = zeroBased ? 25 : 26;
  const trimmed = input.trim();
  // Two conventions:
  //  - If a slash is present, words are slash-delimited and numbers within a
  //    word may be space/comma/hyphen separated.
  //  - Otherwise words are whitespace-delimited and numbers within a word are
  //    separated by hyphen/comma.
  const hasSlash = trimmed.includes('/');
  const words = hasSlash
    ? trimmed.split('/').filter((w) => w.trim().length > 0)
    : trimmed.split(/\s+/).filter((w) => w.length > 0);
  const outWords: string[] = [];
  for (const word of words) {
    const tokens = word.split(/[^0-9]+/).filter((t) => t.length > 0);
    let decoded = '';
    for (const tok of tokens) {
      const v = Number(tok);
      if (!Number.isInteger(v) || v < minV || v > maxV) {
        throw new Error(
          `"${tok}" is out of range (expected ${minV}-${maxV}). Check the zero-based / reverse options.`,
        );
      }
      let idx = zeroBased ? v : v - 1; // 0..25
      if (reverse) idx = 25 - idx;
      decoded += String.fromCharCode(A_CODE + idx).toUpperCase();
    }
    if (decoded.length > 0) outWords.push(decoded);
  }
  return outWords.join(' ');
}

export default function A1Z26Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [sep, setSep] = useState<Sep>('hyphen');
  const [zeroBased, setZeroBased] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [keepNonLetters, setKeepNonLetters] = useState(false);

  return (
    <TextToolLayout
      deps={[mode, sep, zeroBased, reverse, keepNonLetters]}
      transform={(input) => {
        if (!input.trim()) return '';
        return mode === 'encode'
          ? encode(input, sep, zeroBased, reverse, keepNonLetters)
          : decode(input, zeroBased, reverse);
      }}
      inputLabel={mode === 'encode' ? 'Text' : 'Number sequence'}
      outputLabel={mode === 'encode' ? 'Numbers' : 'Text'}
      sample={mode === 'encode' ? 'Hello World' : '8-5-12-12-15 23-15-18-12-4'}
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
          {mode === 'encode' && (
            <Field label="Separator">
              <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hyphen">Hyphen -</SelectItem>
                  <SelectItem value="space">Space</SelectItem>
                  <SelectItem value="comma">Comma ,</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="A = 0 (zero-based)">
            <Switch checked={zeroBased} onCheckedChange={setZeroBased} />
          </Field>
          <Field label="Reverse (A = 26)">
            <Switch checked={reverse} onCheckedChange={setReverse} />
          </Field>
          {mode === 'encode' && (
            <Field label="Keep non-letters">
              <Switch checked={keepNonLetters} onCheckedChange={setKeepNonLetters} />
            </Field>
          )}
        </>
      }
    />
  );
}
