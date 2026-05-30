'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Variant = 'beaufort' | 'german';

const A = 65; // 'A'

function letterIndex(ch: string): number {
  const up = ch.toUpperCase();
  const code = up.charCodeAt(0);
  return code >= A && code <= A + 25 ? code - A : -1;
}

/**
 * Beaufort: C = (K - P) mod 26 (self-reciprocal — same op encrypts & decrypts).
 * German / variant Beaufort: C = (P - K) mod 26 (inverse of Vigenère).
 * Non-letters are skipped (the running key only advances on letters).
 */
function process(input: string, keyword: string, variant: Variant, preserveCase: boolean): string {
  const keyLetters = keyword.toUpperCase().replace(/[^A-Z]/g, '');
  if (keyLetters.length === 0) {
    throw new Error('Enter a keyword containing at least one letter (A–Z).');
  }
  let out = '';
  let ki = 0;
  for (const ch of input) {
    const p = letterIndex(ch);
    if (p < 0) {
      out += ch;
      continue;
    }
    const k = letterIndex(keyLetters[ki % keyLetters.length] ?? 'A');
    ki += 1;
    const c = variant === 'beaufort' ? (((k - p) % 26) + 26) % 26 : (((p - k) % 26) + 26) % 26;
    const isLower = preserveCase && ch >= 'a' && ch <= 'z';
    out += String.fromCharCode((isLower ? 97 : A) + c);
  }
  return out;
}

/** Builds the running-key alignment line under the message. */
function keyAlignment(input: string, keyword: string): string {
  const keyLetters = keyword.toUpperCase().replace(/[^A-Z]/g, '');
  if (keyLetters.length === 0) return '';
  let out = '';
  let ki = 0;
  for (const ch of input) {
    if (letterIndex(ch) < 0) {
      out += ch === '\n' ? '\n' : ' ';
    } else {
      out += keyLetters[ki % keyLetters.length] ?? '';
      ki += 1;
    }
  }
  return out;
}

export default function BeaufortCipherTool() {
  const [variant, setVariant] = useState<Variant>('beaufort');
  const [keyword, setKeyword] = useState('FORTIFICATION');
  const [preserveCase, setPreserveCase] = useState(true);
  const [showKey, setShowKey] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const result = process(input, keyword, variant, preserveCase);
      if (!showKey) return result;
      return `${result}\n\nKey alignment:\n${input}\n${keyAlignment(input, keyword)}`;
    },
    [keyword, variant, preserveCase, showKey],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keyword, variant, preserveCase, showKey]}
      inputLabel="Message"
      outputLabel={variant === 'beaufort' ? 'Result (encrypt = decrypt)' : 'Result'}
      inputPlaceholder="Type a message…"
      sample="DEFEND THE EAST WALL OF THE CASTLE"
      downloadName="beaufort.txt"
      options={
        <>
          <Field label="Variant">
            <Tabs value={variant} onValueChange={(v) => setVariant(v as Variant)}>
              <TabsList>
                <TabsTrigger value="beaufort">Beaufort (K−P)</TabsTrigger>
                <TabsTrigger value="german">German (P−K)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Keyword" className="min-w-[200px] flex-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Keyword (letters only)"
            />
          </Field>
          <Field label="Options">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bf-case"
                  checked={preserveCase}
                  onCheckedChange={(c) => setPreserveCase(c === true)}
                />
                <Label htmlFor="bf-case">Preserve case</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bf-key"
                  checked={showKey}
                  onCheckedChange={(c) => setShowKey(c === true)}
                />
                <Label htmlFor="bf-key">Show key alignment</Label>
              </div>
            </div>
          </Field>
        </>
      }
    />
  );
}
