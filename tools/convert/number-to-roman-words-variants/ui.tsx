'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type CurrencyKey = 'USD' | 'EUR' | 'GBP' | 'INR';

interface CurrencyInfo {
  unit: string;
  unitPlural: string;
  sub: string;
  subPlural: string;
}

const CURRENCIES: Record<CurrencyKey, CurrencyInfo> = {
  USD: { unit: 'dollar', unitPlural: 'dollars', sub: 'cent', subPlural: 'cents' },
  EUR: { unit: 'euro', unitPlural: 'euros', sub: 'cent', subPlural: 'cents' },
  GBP: { unit: 'pound', unitPlural: 'pounds', sub: 'penny', subPlural: 'pence' },
  INR: { unit: 'rupee', unitPlural: 'rupees', sub: 'paisa', subPlural: 'paise' },
};

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const SCALES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion',
  'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion',
];

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
};

// Cardinal -> ordinal word replacements for the final word.
const ORDINAL_WORDS: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth',
  nine: 'ninth', twelve: 'twelfth',
};

function tripleToWords(n: number, useAnd: boolean): string {
  if (n === 0) return '';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds] ?? ''} hundred`);
  if (rest > 0) {
    if (useAnd && hundreds > 0) parts.push('and');
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

function integerToWords(digits: string, useAnd: boolean): string {
  const cleaned = digits.replace(/^0+(?=\d)/, '');
  if (cleaned === '0' || cleaned === '') return 'zero';

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
    // British "and" only applies to the final (units) group, e.g. "one hundred and five".
    const words = tripleToWords(value, useAnd && scaleIndex === 0);
    parts.push(scaleName ? `${words} ${scaleName}` : words);
  }
  return parts.join(' ').trim();
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return (s[0] ?? '').toUpperCase() + s.slice(1);
}

// Turn cardinal words into ordinal words by transforming the trailing word.
function toOrdinal(cardinal: string): string {
  const words = cardinal.split(' ');
  const lastIdx = words.length - 1;
  const last = words[lastIdx] ?? '';
  // Handle hyphenated tens-ones like "twenty-three" -> "twenty-third".
  if (last.includes('-')) {
    const segs = last.split('-');
    const head = segs[0] ?? '';
    const tail = segs[1] ?? '';
    const tailOrd = ORDINAL_WORDS[tail] ?? `${tail.replace(/y$/, 'ie')}th`;
    words[lastIdx] = `${head}-${tailOrd}`;
  } else if (ORDINAL_WORDS[last]) {
    words[lastIdx] = ORDINAL_WORDS[last] ?? last;
  } else if (last.endsWith('y')) {
    words[lastIdx] = `${last.slice(0, -1)}ieth`;
  } else {
    words[lastIdx] = `${last}th`;
  }
  return words.join(' ');
}

function parseNumber(raw: string): { sign: string; intPart: string; decPart: string } {
  const trimmed = raw.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error('Enter a valid number (digits, optional sign and decimal point).');
  }
  return {
    sign: match[1] === '-' ? 'negative ' : '',
    intPart: match[2] === '' ? '0' : (match[2] ?? '0'),
    decPart: match[3] ?? '',
  };
}

function decimalWords(decPart: string): string {
  const meaningful = decPart.replace(/0+$/, '');
  if (meaningful.length === 0) return '';
  const spoken = meaningful.split('').map((d) => DIGIT_WORDS[d] ?? d).join(' ');
  return ` point ${spoken}`;
}

function spellCurrency(intPart: string, decRaw: string, sign: string, info: CurrencyInfo): string {
  let dollars = intPart;
  let cents = decRaw;
  if (cents.length > 2) {
    const keep = cents.slice(0, 2);
    const next = cents[2] ?? '0';
    let centsNum = Number(keep);
    if (Number(next) >= 5) centsNum += 1;
    if (centsNum >= 100) {
      centsNum -= 100;
      dollars = (BigInt(dollars || '0') + 1n).toString();
    }
    cents = centsNum.toString().padStart(2, '0');
  } else {
    cents = cents.padEnd(2, '0');
  }
  const centsValue = Number(cents);

  const dollarWords = integerToWords(dollars, false);
  const unitLabel = dollarWords === 'one' ? info.unit : info.unitPlural;
  const parts = [`${dollarWords} ${unitLabel}`];

  if (centsValue > 0) {
    const centWords = integerToWords(cents, false);
    const subLabel = centWords === 'one' ? info.sub : info.subPlural;
    parts.push('and', `${centWords} ${subLabel}`);
  }
  return capitalize(`${sign}${parts.join(' ')}`.trim());
}

// Group tally marks in fives ("||||" with the fifth crossing through, shown as ////).
function tallyMarks(intPart: string): string {
  const n = Number(intPart);
  if (!Number.isFinite(n)) throw new Error('Number too large for a tally count.');
  if (n > 5000) throw new Error('Tally count is limited to 5000 marks.');
  if (n === 0) return '(zero)';
  const full = Math.floor(n / 5);
  const rem = n % 5;
  const groups: string[] = [];
  for (let i = 0; i < full; i++) groups.push('卌');
  if (rem > 0) groups.push('|'.repeat(rem));
  return groups.join(' ');
}

export default function NumberSpellingVariantsTool() {
  const [currency, setCurrency] = useState<CurrencyKey>('USD');
  const [useAnd, setUseAnd] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const { sign, intPart, decPart } = parseNumber(input);
      const info = CURRENCIES[currency];

      const cardinal = capitalize(`${sign}${integerToWords(intPart, useAnd)}${decimalWords(decPart)}`.trim());
      const cardinalNoDec = `${sign}${integerToWords(intPart, useAnd)}`.trim();
      const ordinal = capitalize(toOrdinal(cardinalNoDec));
      const cur = spellCurrency(intPart, decPart, sign, info);
      const tally = tallyMarks(intPart);

      const lines = [
        `Cardinal:  ${cardinal}`,
        `Ordinal:   ${ordinal}`,
        `Currency:  ${cur}  (${currency})`,
        `Tally:     ${tally}`,
      ];
      return lines.join('\n');
    },
    [currency, useAnd],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[currency, useAnd]}
      inputLabel="Number"
      outputLabel="Spellings"
      inputPlaceholder="e.g. 1234.56"
      sample="1234.56"
      downloadName="number-spellings.txt"
      options={
        <>
          <Field label="Currency" hint="Used for the currency phrasing line">
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyKey)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — dollars / cents</SelectItem>
                <SelectItem value="EUR">EUR — euros / cents</SelectItem>
                <SelectItem value="GBP">GBP — pounds / pence</SelectItem>
                <SelectItem value="INR">INR — rupees / paise</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="British 'and'" hint="e.g. one hundred and five">
            <Switch checked={useAnd} onCheckedChange={setUseAnd} />
          </Field>
        </>
      }
    />
  );
}
