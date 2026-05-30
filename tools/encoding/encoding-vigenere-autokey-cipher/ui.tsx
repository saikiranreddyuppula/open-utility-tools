'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Mode = 'encrypt' | 'decrypt';

const A = 'a'.charCodeAt(0);
const Z = 'z'.charCodeAt(0);
const UA = 'A'.charCodeAt(0);
const UZ = 'Z'.charCodeAt(0);

function isLetter(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= A && c <= Z) || (c >= UA && c <= UZ);
}

// 0-25 index of a letter (case-insensitive). Returns -1 for non-letters.
function letterIndex(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= A && c <= Z) return c - A;
  if (c >= UA && c <= UZ) return c - UA;
  return -1;
}

function applyShift(ch: string, shift: number, preserveCase: boolean): string {
  const idx = letterIndex(ch);
  if (idx < 0) return ch;
  const result = (idx + shift + 26) % 26;
  const isUpper = ch.charCodeAt(0) >= UA && ch.charCodeAt(0) <= UZ;
  const upper = preserveCase ? isUpper : false;
  return String.fromCharCode((upper ? UA : A) + result);
}

// Build the cleaned keyword indices (letters only, regardless of stripNonLetters option,
// since the keyword itself only contributes its letters).
function keyIndices(keyword: string): number[] {
  const out: number[] = [];
  for (const ch of keyword) {
    const i = letterIndex(ch);
    if (i >= 0) out.push(i);
  }
  return out;
}

function autokeyEncrypt(
  text: string,
  keyword: string,
  preserveCase: boolean,
): string {
  const keyStream: number[] = keyIndices(keyword);
  let result = '';
  let pos = 0; // position in key stream consumed by letters

  for (const ch of text) {
    if (!isLetter(ch)) {
      result += ch;
      continue;
    }
    const k = keyStream[pos] ?? 0;
    result += applyShift(ch, k, preserveCase);
    // Autokey: append THIS plaintext letter to extend the key stream.
    keyStream.push(letterIndex(ch));
    pos += 1;
  }
  return result;
}

function autokeyDecrypt(
  text: string,
  keyword: string,
  preserveCase: boolean,
): string {
  const keyStream: number[] = keyIndices(keyword);
  let result = '';
  let pos = 0;

  for (const ch of text) {
    if (!isLetter(ch)) {
      result += ch;
      continue;
    }
    const k = keyStream[pos] ?? 0;
    const plainChar = applyShift(ch, -k, preserveCase);
    result += plainChar;
    // The recovered plaintext letter extends the key stream.
    keyStream.push(letterIndex(plainChar));
    pos += 1;
  }
  return result;
}

export default function VigenereAutokey() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [keyword, setKeyword] = useState('SECRET');
  const [preserveCase, setPreserveCase] = useState(true);

  return (
    <TextToolLayout
      deps={[mode, keyword, preserveCase]}
      transform={(input) => {
        if (!input) return '';
        if (keyIndices(keyword).length === 0) {
          throw new Error('Keyword must contain at least one letter (A-Z).');
        }
        return mode === 'encrypt'
          ? autokeyEncrypt(input, keyword, preserveCase)
          : autokeyDecrypt(input, keyword, preserveCase);
      }}
      inputLabel={mode === 'encrypt' ? 'Plaintext' : 'Ciphertext'}
      outputLabel={mode === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
      sample={mode === 'encrypt' ? 'Attack at dawn!' : 'Sxvrgd am wayx!'}
      downloadName="autokey.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
                <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Keyword">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-40 font-mono"
              placeholder="SECRET"
            />
          </Field>
          <Field label="Preserve case">
            <Switch checked={preserveCase} onCheckedChange={setPreserveCase} />
          </Field>
        </>
      }
    />
  );
}
