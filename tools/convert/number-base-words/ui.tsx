'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Spoken word for each digit value 0..35.
const DIGIT_WORDS: string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'twenty-one',
  'twenty-two',
  'twenty-three',
  'twenty-four',
  'twenty-five',
  'twenty-six',
  'twenty-seven',
  'twenty-eight',
  'twenty-nine',
  'thirty',
  'thirty-one',
  'thirty-two',
  'thirty-three',
  'thirty-four',
  'thirty-five',
];

type Sep = 'space' | 'hyphen';

/** Value 0..35 of a base digit char, or -1 if not a digit char at all. */
function digitValue(ch: string): number {
  const c = ch.toLowerCase();
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'a' && c <= 'z') return c.charCodeAt(0) - 97 + 10;
  return -1;
}

function groupSizeForBase(base: number): number {
  if (base === 2) return 4; // nibbles
  if (base === 16) return 2; // bytes
  if (base === 8) return 3;
  return 3; // decimal & others -> thousands-style triplets
}

function groupLabel(base: number): string {
  if (base === 2) return 'nibbles (4 bits)';
  if (base === 16) return 'bytes (2 hex digits)';
  if (base === 8) return 'groups of 3';
  return 'groups of 3';
}

/** Split a digit string from the right into groups of `size`. */
function groupFromRight(digits: string, size: number): string[] {
  const groups: string[] = [];
  let end = digits.length;
  while (end > 0) {
    const start = Math.max(0, end - size);
    groups.unshift(digits.slice(start, end));
    end = start;
  }
  return groups;
}

interface ParseResult {
  digits: string;
  base: number;
}

function spellDigits(digits: string, sep: string): string {
  const words: string[] = [];
  for (const ch of digits) {
    const v = digitValue(ch);
    const w = DIGIT_WORDS[v];
    words.push(w ?? ch);
  }
  return words.join(sep);
}

function process(raw: string, base: number, sep: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return '';
  if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36.');

  // allow an optional leading sign and a fractional part
  let body = cleaned;
  let signPrefix = '';
  if (body.startsWith('-')) {
    signPrefix = 'negative ';
    body = body.slice(1);
  } else if (body.startsWith('+')) {
    body = body.slice(1);
  }

  const dotCount = (body.match(/\./g) ?? []).length;
  if (dotCount > 1) throw new Error('Only one radix point "." is allowed.');

  const [intPart = '', fracPart = ''] = body.split('.');
  const allDigits = (intPart + fracPart);
  if (allDigits.length === 0) throw new Error('Enter at least one digit.');

  for (const ch of allDigits) {
    const v = digitValue(ch);
    if (v === -1) throw new Error(`Character "${ch}" is not a valid digit.`);
    if (v >= base) {
      throw new Error(`Digit "${ch}" (value ${v}) is not valid in base ${base}.`);
    }
  }

  const result: ParseResult = { digits: intPart, base };

  const lines: string[] = [];
  // digit-by-digit reading
  const intWords = signPrefix + spellDigits(intPart, sep);
  if (fracPart) {
    lines.push(`Spoken: ${intWords}${sep}point${sep}${spellDigits(fracPart, sep)}`);
  } else {
    lines.push(`Spoken: ${intWords}`);
  }

  // grouped reading (integer part only)
  const size = groupSizeForBase(base);
  if (result.digits.length > size) {
    const groups = groupFromRight(result.digits, size);
    const groupReadings = groups.map((g) => spellDigits(g, sep));
    lines.push(`Grouped (${groupLabel(base)}): ${groups.join(' ')}`);
    lines.push(`Grouped spoken: ${groupReadings.join(' | ')}`);
  }

  // decimal value (use BigInt for integer part to avoid precision loss)
  try {
    let intDec = 0n;
    const bigBase = BigInt(base);
    for (const ch of intPart) {
      intDec = intDec * bigBase + BigInt(digitValue(ch));
    }
    let decStr = (signPrefix ? '-' : '') + intDec.toString();
    if (fracPart) {
      // fractional part as a JS float fraction
      let frac = 0;
      let scale = 1;
      for (const ch of fracPart) {
        scale *= base;
        frac += digitValue(ch) / scale;
      }
      const fracStr = frac.toString().replace(/^0/, '');
      decStr += fracStr;
    }
    lines.push(`Decimal value: ${decStr}`);
  } catch {
    // ignore decimal conversion failure
  }

  lines.push(`Digit count: ${allDigits.length}`);
  return lines.join('\n');
}

export default function NumberBaseWordsTool() {
  const [base, setBase] = useState('2');
  const [sepMode, setSepMode] = useState<Sep>('space');

  const transform = useCallback(
    (input: string) => {
      const b = Number(base);
      if (!Number.isInteger(b)) throw new Error('Base must be a whole number.');
      const sep = sepMode === 'hyphen' ? '-' : ' ';
      return process(input, b, sep);
    },
    [base, sepMode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[base, sepMode]}
      inputLabel="Number (in chosen base)"
      outputLabel="Readings"
      inputPlaceholder="1011"
      sample="10110110"
      downloadName="reading.txt"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Source base (2-36)">
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              inputMode="numeric"
              className="w-24"
            />
          </Field>
          <Field label="Separator">
            <Tabs value={sepMode} onValueChange={(v) => setSepMode(v as Sep)}>
              <TabsList>
                <TabsTrigger value="space">Space</TabsTrigger>
                <TabsTrigger value="hyphen">Hyphen</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
