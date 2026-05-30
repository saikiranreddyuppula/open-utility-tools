'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Currency = 'USD' | 'GBP' | 'EUR' | 'INR';

interface CurrencyInfo {
  label: string;
  major: string;
  majorPlural: string;
  minor: string;
  minorPlural: string;
  indian: boolean;
}

const CURRENCIES: Record<Currency, CurrencyInfo> = {
  USD: { label: 'US Dollar', major: 'Dollar', majorPlural: 'Dollars', minor: 'Cent', minorPlural: 'Cents', indian: false },
  GBP: { label: 'British Pound', major: 'Pound', majorPlural: 'Pounds', minor: 'Penny', minorPlural: 'Pence', indian: false },
  EUR: { label: 'Euro', major: 'Euro', majorPlural: 'Euros', minor: 'Cent', minorPlural: 'Cents', indian: false },
  INR: { label: 'Indian Rupee', major: 'Rupee', majorPlural: 'Rupees', minor: 'Paisa', minorPlural: 'Paise', indian: true },
};

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

// 0..999 to words.
function threeDigits(n: number): string {
  if (n < 0 || n > 999) return '';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds] ?? ''} Hundred`);
  }
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest] ?? '');
    } else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      const tenWord = TENS[t] ?? '';
      parts.push(o > 0 ? `${tenWord} ${ONES[o] ?? ''}` : tenWord);
    }
  }
  return parts.join(' ').trim();
}

const WESTERN_SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion'];

function westernToWords(value: bigint): string {
  if (value === 0n) return 'Zero';
  const groups: number[] = [];
  let v = value;
  while (v > 0n) {
    groups.push(Number(v % 1000n));
    v = v / 1000n;
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === undefined || g === 0) continue;
    const scale = WESTERN_SCALES[i] ?? '';
    parts.push(scale ? `${threeDigits(g)} ${scale}` : threeDigits(g));
  }
  return parts.join(' ').trim();
}

// Indian numbering: ... Crore, Lakh, Thousand, Hundred groups (2-2-3 from right).
function indianToWords(value: bigint): string {
  if (value === 0n) return 'Zero';
  const last3 = Number(value % 1000n);
  let rest = value / 1000n;
  const parts: string[] = [];
  const indianScales = ['Thousand', 'Lakh', 'Crore', 'Arab', 'Kharab'];
  let scaleIdx = 0;
  while (rest > 0n) {
    const grp = Number(rest % 100n);
    rest = rest / 100n;
    if (grp > 0) {
      const scale = indianScales[scaleIdx] ?? '';
      parts.unshift(scale ? `${threeDigits(grp)} ${scale}` : threeDigits(grp));
    }
    scaleIdx += 1;
  }
  if (last3 > 0) parts.push(threeDigits(last3));
  return parts.join(' ').trim();
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return (s[0] ?? '').toUpperCase() + s.slice(1);
}

export default function CurrencyAmountToWordsTool() {
  const [amount, setAmount] = useState('1250.00');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [centsAsWords, setCentsAsWords] = useState(false);

  const result = useMemo(() => {
    const raw = amount.trim().replace(/,/g, '');
    if (!raw) return { error: 'Enter a monetary amount.' as string };
    if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
      return { error: 'Enter a non-negative amount with up to two decimal places (e.g. 1250.50).' };
    }
    const dotIdx = raw.indexOf('.');
    const wholeStr = dotIdx >= 0 ? raw.slice(0, dotIdx) : raw;
    let fracStr = dotIdx >= 0 ? raw.slice(dotIdx + 1) : '';
    fracStr = (fracStr + '00').slice(0, 2);
    let whole: bigint;
    try {
      whole = BigInt(wholeStr || '0');
    } catch {
      return { error: 'Could not parse the whole part.' };
    }
    if (whole > 10n ** 18n) return { error: 'Keep the amount below 10^18.' };
    const cents = Number(fracStr);
    if (!Number.isFinite(cents)) return { error: 'Invalid fractional part.' };

    const info = CURRENCIES[currency];
    const majorWords = info.indian ? indianToWords(whole) : westernToWords(whole);
    const majorUnit = whole === 1n ? info.major : info.majorPlural;

    let sentence = `${majorWords} ${majorUnit}`;

    if (centsAsWords) {
      if (cents > 0) {
        const centWords = threeDigits(cents) || 'Zero';
        const minorUnit = cents === 1 ? info.minor : info.minorPlural;
        sentence += ` and ${centWords} ${minorUnit}`;
      }
      sentence += ' Only';
    } else {
      sentence += ` and ${fracStr}/100`;
    }

    sentence = capitalizeFirst(sentence);
    return { sentence, majorWords, cents, fracStr, info, whole };
  }, [amount, currency, centsAsWords]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Amount" className="min-w-[160px] flex-1">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1250.00" />
          </Field>
          <Field label="Currency" className="min-w-[160px]">
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} — {CURRENCIES[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cents as words">
            <Switch checked={centsAsWords} onCheckedChange={setCentsAsWords} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Amount in words">
            <CopyButton value={() => result.sentence} />
          </PanelHeader>
          <div className="p-4">
            <p className="text-lg font-medium leading-relaxed">{result.sentence}</p>
          </div>
          <StatBar
            items={[
              `${result.info.majorPlural}: ${result.majorWords}`,
              `${result.info.minorPlural}: ${result.fracStr}/100`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
