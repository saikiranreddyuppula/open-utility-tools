'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

const ONES = [
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
];

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

// Short-scale names indexed by triple group (1 = thousand, 2 = million, ...).
const SCALES = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
];

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

// Convert a 1-3 digit group (0-999) to words. Returns '' for 0.
function tripleToWords(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds] ?? ''} hundred`);
  }
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest] ?? '');
    } else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      const tensWord = TENS[tens] ?? '';
      parts.push(ones > 0 ? `${tensWord}-${ONES[ones] ?? ''}` : tensWord);
    }
  }
  return parts.join(' ').trim();
}

// Convert a string of integer digits (no sign) to words.
function integerToWords(digits: string): string {
  const cleaned = digits.replace(/^0+(?=\d)/, '');
  if (cleaned === '0' || cleaned === '') return 'zero';

  // Split into triples from the right.
  const groups: number[] = [];
  let s = cleaned;
  while (s.length > 0) {
    const chunk = s.slice(Math.max(0, s.length - 3));
    groups.unshift(Number(chunk));
    s = s.slice(0, Math.max(0, s.length - 3));
  }

  if (groups.length > SCALES.length) {
    throw new Error('Number is too large to spell out.');
  }

  const parts: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const value = groups[i] ?? 0;
    if (value === 0) continue;
    const scaleIndex = groups.length - 1 - i;
    const scaleName = SCALES[scaleIndex] ?? '';
    const words = tripleToWords(value);
    parts.push(scaleName ? `${words} ${scaleName}` : words);
  }
  return parts.join(' ').trim();
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return (s[0] ?? '').toUpperCase() + s.slice(1);
}

function spellPlain(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error('Enter a valid number (digits, optional sign and decimal point).');
  }
  const sign = match[1] === '-' ? 'negative ' : '';
  const intPart = match[2] === '' ? '0' : (match[2] ?? '0');
  const decPart = match[3] ?? '';

  let words = integerToWords(intPart);
  if (decPart.length > 0) {
    // Drop trailing zeros for cleaner output, but keep at least the meaningful digits.
    const meaningful = decPart.replace(/0+$/, '');
    if (meaningful.length > 0) {
      const decWords = meaningful
        .split('')
        .map((d) => DIGIT_WORDS[d] ?? d)
        .join(' ');
      words += ` point ${decWords}`;
    }
  }
  return capitalize(`${sign}${words}`.trim());
}

function spellCurrency(raw: string, unit: string, cents: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error('Enter a valid amount (digits, optional sign and decimal point).');
  }
  const negative = match[1] === '-';
  const intPart = match[2] === '' ? '0' : (match[2] ?? '0');
  let decRaw = match[3] ?? '';
  // Normalize to exactly two cent digits (round half up at the third digit).
  let dollars = intPart;
  if (decRaw.length > 2) {
    const keep = decRaw.slice(0, 2);
    const next = decRaw[2] ?? '0';
    let centsNum = Number(keep);
    if (Number(next) >= 5) centsNum += 1;
    if (centsNum >= 100) {
      centsNum -= 100;
      dollars = (BigInt(dollars) + 1n).toString();
    }
    decRaw = centsNum.toString().padStart(2, '0');
  } else {
    decRaw = decRaw.padEnd(2, '0');
  }
  const centsValue = Number(decRaw);

  const dollarWords = integerToWords(dollars);
  const dollarLabel = dollarWords === 'one' ? unit : `${unit}s`;
  const parts = [`${dollarWords} ${dollarLabel}`];

  if (centsValue > 0) {
    const centWords = integerToWords(decRaw);
    const centLabel = centWords === 'one' ? cents : `${cents}s`;
    parts.push('and', `${centWords} ${centLabel}`);
  }

  const prefix = negative ? 'negative ' : '';
  return capitalize(`${prefix}${parts.join(' ')}`.trim());
}

export default function NumberToWordsTool() {
  const [mode, setMode] = useState<'plain' | 'currency'>('plain');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (mode === 'currency') {
        return spellCurrency(input, 'dollar', 'cent');
      }
      return spellPlain(input);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="Number"
      outputLabel="In words"
      inputPlaceholder="e.g. 1234.56"
      sample="1234567.89"
      downloadName="number-to-words.txt"
      options={
        <Field label="Mode" hint="Currency mode reads decimals as dollars and cents">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'plain' | 'currency')}>
            <TabsList>
              <TabsTrigger value="plain">Plain</TabsTrigger>
              <TabsTrigger value="currency">Currency</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
