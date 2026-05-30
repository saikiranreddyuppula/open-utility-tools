'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CurrencyRow {
  region: string;
  name: string;
  code: string;
  numeric: string;
  symbol: string;
  minorUnit: string;
  digits: number;
}

// ISO 4217 data (no exchange rates). digits = ISO 4217 minor-unit count.
const DATA: CurrencyRow[] = [
  { region: 'United States', name: 'US Dollar', code: 'USD', numeric: '840', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'Eurozone', name: 'Euro', code: 'EUR', numeric: '978', symbol: '€', minorUnit: 'cent', digits: 2 },
  { region: 'United Kingdom', name: 'Pound Sterling', code: 'GBP', numeric: '826', symbol: '£', minorUnit: 'penny', digits: 2 },
  { region: 'Japan', name: 'Yen', code: 'JPY', numeric: '392', symbol: '¥', minorUnit: '(none)', digits: 0 },
  { region: 'India', name: 'Indian Rupee', code: 'INR', numeric: '356', symbol: '₹', minorUnit: 'paisa', digits: 2 },
  { region: 'China', name: 'Renminbi (Yuan)', code: 'CNY', numeric: '156', symbol: '¥', minorUnit: 'fen', digits: 2 },
  { region: 'Switzerland', name: 'Swiss Franc', code: 'CHF', numeric: '756', symbol: 'CHF', minorUnit: 'rappen / centime', digits: 2 },
  { region: 'Canada', name: 'Canadian Dollar', code: 'CAD', numeric: '124', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'Australia', name: 'Australian Dollar', code: 'AUD', numeric: '036', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'New Zealand', name: 'New Zealand Dollar', code: 'NZD', numeric: '554', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'Russia', name: 'Russian Ruble', code: 'RUB', numeric: '643', symbol: '₽', minorUnit: 'kopeck', digits: 2 },
  { region: 'Brazil', name: 'Brazilian Real', code: 'BRL', numeric: '986', symbol: 'R$', minorUnit: 'centavo', digits: 2 },
  { region: 'Mexico', name: 'Mexican Peso', code: 'MXN', numeric: '484', symbol: '$', minorUnit: 'centavo', digits: 2 },
  { region: 'South Africa', name: 'South African Rand', code: 'ZAR', numeric: '710', symbol: 'R', minorUnit: 'cent', digits: 2 },
  { region: 'South Korea', name: 'South Korean Won', code: 'KRW', numeric: '410', symbol: '₩', minorUnit: '(none)', digits: 0 },
  { region: 'Sweden', name: 'Swedish Krona', code: 'SEK', numeric: '752', symbol: 'kr', minorUnit: 'öre', digits: 2 },
  { region: 'Norway', name: 'Norwegian Krone', code: 'NOK', numeric: '578', symbol: 'kr', minorUnit: 'øre', digits: 2 },
  { region: 'Denmark', name: 'Danish Krone', code: 'DKK', numeric: '208', symbol: 'kr', minorUnit: 'øre', digits: 2 },
  { region: 'Poland', name: 'Polish Złoty', code: 'PLN', numeric: '985', symbol: 'zł', minorUnit: 'grosz', digits: 2 },
  { region: 'Turkey', name: 'Turkish Lira', code: 'TRY', numeric: '949', symbol: '₺', minorUnit: 'kuruş', digits: 2 },
  { region: 'Singapore', name: 'Singapore Dollar', code: 'SGD', numeric: '702', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'Hong Kong', name: 'Hong Kong Dollar', code: 'HKD', numeric: '344', symbol: '$', minorUnit: 'cent', digits: 2 },
  { region: 'Saudi Arabia', name: 'Saudi Riyal', code: 'SAR', numeric: '682', symbol: '﷼', minorUnit: 'halala', digits: 2 },
  { region: 'United Arab Emirates', name: 'UAE Dirham', code: 'AED', numeric: '784', symbol: 'د.إ', minorUnit: 'fils', digits: 2 },
  { region: 'Kuwait', name: 'Kuwaiti Dinar', code: 'KWD', numeric: '414', symbol: 'د.ك', minorUnit: 'fils', digits: 3 },
  { region: 'Bahrain', name: 'Bahraini Dinar', code: 'BHD', numeric: '048', symbol: '.د.ب', minorUnit: 'fils', digits: 3 },
  { region: 'Jordan', name: 'Jordanian Dinar', code: 'JOD', numeric: '400', symbol: 'د.ا', minorUnit: 'fils', digits: 3 },
  { region: 'Tunisia', name: 'Tunisian Dinar', code: 'TND', numeric: '788', symbol: 'د.ت', minorUnit: 'millime', digits: 3 },
  { region: 'Thailand', name: 'Thai Baht', code: 'THB', numeric: '764', symbol: '฿', minorUnit: 'satang', digits: 2 },
  { region: 'Indonesia', name: 'Indonesian Rupiah', code: 'IDR', numeric: '360', symbol: 'Rp', minorUnit: 'sen', digits: 2 },
  { region: 'Malaysia', name: 'Malaysian Ringgit', code: 'MYR', numeric: '458', symbol: 'RM', minorUnit: 'sen', digits: 2 },
  { region: 'Philippines', name: 'Philippine Peso', code: 'PHP', numeric: '608', symbol: '₱', minorUnit: 'sentimo', digits: 2 },
  { region: 'Vietnam', name: 'Vietnamese Dong', code: 'VND', numeric: '704', symbol: '₫', minorUnit: 'hào / xu', digits: 0 },
  { region: 'Israel', name: 'Israeli New Shekel', code: 'ILS', numeric: '376', symbol: '₪', minorUnit: 'agora', digits: 2 },
  { region: 'Egypt', name: 'Egyptian Pound', code: 'EGP', numeric: '818', symbol: 'E£', minorUnit: 'piastre', digits: 2 },
  { region: 'Nigeria', name: 'Nigerian Naira', code: 'NGN', numeric: '566', symbol: '₦', minorUnit: 'kobo', digits: 2 },
];

type SortKey = 'code' | 'name';

export default function CurrencyUnitNamingTool() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('code');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = s
      ? DATA.filter((d) =>
          `${d.region} ${d.name} ${d.code} ${d.numeric} ${d.minorUnit}`.toLowerCase().includes(s)
        )
      : DATA;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'code') return a.code.localeCompare(b.code);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [q, sort]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Search" className="min-w-[14rem] flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code, name, country, or subunit…"
            />
          </Field>
          <Field label="Sort by" className="min-w-[10rem]">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">ISO code</SelectItem>
                <SelectItem value="name">Currency name</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="ISO 4217 currencies (no rates)">
          <CopyButton
            value={() =>
              rows
                .map(
                  (r) =>
                    `${r.code} (${r.numeric}) ${r.name} — ${r.symbol} — minor: ${r.minorUnit}, ${r.digits} digits — ${r.region}`
                )
                .join('\n')
            }
          />
        </PanelHeader>
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-[4rem_3rem_2.5rem_1.4fr_1.6fr_1fr_3rem] gap-x-3 border-b bg-muted/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Code</span>
            <span>Num</span>
            <span>Sym</span>
            <span>Currency</span>
            <span>Country / region</span>
            <span>Minor unit</span>
            <span>Dig.</span>
          </div>
          <div className="max-h-[480px] divide-y overflow-auto">
            {rows.map((r) => (
              <div
                key={r.code}
                className="grid min-w-[44rem] grid-cols-[4rem_3rem_2.5rem_1.4fr_1.6fr_1fr_3rem] items-center gap-x-3 px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs font-semibold">{r.code}</code>
                <span className="font-mono text-xs text-muted-foreground">{r.numeric}</span>
                <span className="text-sm">{r.symbol}</span>
                <span className="truncate">{r.name}</span>
                <span className="truncate text-xs text-muted-foreground">{r.region}</span>
                <span className="truncate text-xs">{r.minorUnit}</span>
                <span className="font-mono text-xs tabular">{r.digits}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No currencies match your search.
              </div>
            )}
          </div>
        </div>
        <StatBar items={[`${rows.length} of ${DATA.length}`, 'ISO 4217 · static, no exchange rates']} />
      </Panel>
    </div>
  );
}
