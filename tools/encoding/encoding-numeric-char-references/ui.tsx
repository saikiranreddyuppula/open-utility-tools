'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function encode(input: string, base: 'dec' | 'hex', asciiOnly: boolean): string {
  let out = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // Optionally leave printable ASCII (except the characters that must be
    // escaped in HTML) untouched.
    const mustEscape = cp === 38 || cp === 60 || cp === 62 || cp === 34 || cp === 39;
    if (asciiOnly && cp >= 0x20 && cp < 0x7f && !mustEscape) {
      out += ch;
      continue;
    }
    out += base === 'hex' ? `&#x${cp.toString(16)};` : `&#${cp};`;
  }
  return out;
}

function decode(input: string): string {
  return input.replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (_match, body: string) => {
    const isHex = body.startsWith('x') || body.startsWith('X');
    const num = isHex ? Number.parseInt(body.slice(1), 16) : Number.parseInt(body, 10);
    if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) {
      throw new Error(`Invalid numeric character reference: &#${body};`);
    }
    try {
      return String.fromCodePoint(num);
    } catch {
      throw new Error(`Code point out of range: &#${body};`);
    }
  });
}

export default function NumericCharRefsTool() {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [base, setBase] = useState<'dec' | 'hex'>('dec');
  const [asciiOnly, setAsciiOnly] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return direction === 'encode' ? encode(input, base, asciiOnly) : decode(input);
    },
    [direction, base, asciiOnly],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, base, asciiOnly]}
      inputLabel={direction === 'encode' ? 'Text' : 'HTML with references'}
      outputLabel={direction === 'encode' ? 'Character references' : 'Text'}
      inputPlaceholder={direction === 'encode' ? 'Café ☕' : '&#67;af&#xe9;'}
      sample={direction === 'encode' ? 'Café ☕ — déjà vu' : 'Caf&#xe9; &#9749;'}
      downloadName="char-references.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'encode' | 'decode')}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {direction === 'encode' && (
            <>
              <Field label="Base">
                <Tabs value={base} onValueChange={(v) => setBase(v as 'dec' | 'hex')}>
                  <TabsList>
                    <TabsTrigger value="dec">Decimal</TabsTrigger>
                    <TabsTrigger value="hex">Hex</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              <Field label="Scope">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ascii-only"
                    checked={asciiOnly}
                    onCheckedChange={(c) => setAsciiOnly(c === true)}
                  />
                  <Label htmlFor="ascii-only">Only non-ASCII / special characters</Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
