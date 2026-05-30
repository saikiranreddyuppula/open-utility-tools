'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Sign {
  name: string;
  symbol: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  planet: string;
  // Start month/day of the sign window (inclusive).
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

// Boundary table. Capricorn wraps across the new year and is handled specially.
const SIGNS: Sign[] = [
  { name: 'Aries', symbol: '♈', element: 'Fire', modality: 'Cardinal', planet: 'Mars', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { name: 'Taurus', symbol: '♉', element: 'Earth', modality: 'Fixed', planet: 'Venus', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { name: 'Gemini', symbol: '♊', element: 'Air', modality: 'Mutable', planet: 'Mercury', startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { name: 'Cancer', symbol: '♋', element: 'Water', modality: 'Cardinal', planet: 'Moon', startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { name: 'Leo', symbol: '♌', element: 'Fire', modality: 'Fixed', planet: 'Sun', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { name: 'Virgo', symbol: '♍', element: 'Earth', modality: 'Mutable', planet: 'Mercury', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { name: 'Libra', symbol: '♎', element: 'Air', modality: 'Cardinal', planet: 'Venus', startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { name: 'Scorpio', symbol: '♏', element: 'Water', modality: 'Fixed', planet: 'Pluto (Mars)', startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { name: 'Sagittarius', symbol: '♐', element: 'Fire', modality: 'Mutable', planet: 'Jupiter', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  { name: 'Capricorn', symbol: '♑', element: 'Earth', modality: 'Cardinal', planet: 'Saturn', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { name: 'Aquarius', symbol: '♒', element: 'Air', modality: 'Fixed', planet: 'Uranus (Saturn)', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { name: 'Pisces', symbol: '♓', element: 'Water', modality: 'Mutable', planet: 'Neptune (Jupiter)', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
];

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function findSign(month: number, day: number): Sign | null {
  for (const s of SIGNS) {
    if (s.name === 'Capricorn') {
      // Dec 22..Dec 31 or Jan 1..Jan 19
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return s;
      continue;
    }
    if (month === s.startMonth && day >= s.startDay) return s;
    if (month === s.endMonth && day <= s.endDay) return s;
  }
  return null;
}

function daysInMonth(month: number): number {
  // Use a leap year (29 Feb allowed) so Feb 29 is accepted.
  return new Date(2024, month, 0).getDate();
}

export default function WesternZodiacSignTool() {
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));

  const result = useMemo<{ error: string } | { sign: Sign; isBoundary: boolean; rows: { label: string; value: string }[] }>(() => {
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(m) || m < 1 || m > 12) return { error: 'Month must be 1-12.' };
    const maxD = daysInMonth(m);
    if (!Number.isInteger(d) || d < 1 || d > maxD) return { error: `Day must be 1-${maxD} for ${MONTH_NAMES[m] ?? 'that month'}.` };
    const sign = findSign(m, d);
    if (!sign) return { error: 'Could not determine a sign.' };

    const isBoundary = (m === sign.startMonth && d === sign.startDay) || (m === sign.endMonth && d === sign.endDay) || (sign.name === 'Capricorn' && ((m === 12 && d === 22) || (m === 1 && d === 19)));

    const range = `${MONTH_NAMES[sign.startMonth] ?? ''} ${sign.startDay} – ${MONTH_NAMES[sign.endMonth] ?? ''} ${sign.endDay}`;
    const rows = [
      { label: 'Sign', value: `${sign.symbol} ${sign.name}` },
      { label: 'Date range', value: range },
      { label: 'Element', value: sign.element },
      { label: 'Modality', value: sign.modality },
      { label: 'Ruling planet', value: sign.planet },
    ];
    return { sign, isBoundary, rows };
  }, [month, day]);

  const ok = 'sign' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Month (1-12)">
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Day">
            <Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} inputMode="numeric" />
          </Field>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Zodiac sign">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="flex items-center gap-3 px-3 pt-3">
            <span className="text-4xl leading-none">{result.sign.symbol}</span>
            <div>
              <p className="text-2xl font-semibold">{result.sign.name}</p>
              <p className="text-sm text-muted-foreground">
                {result.sign.element} · {result.sign.modality} · ruled by {result.sign.planet}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={
              result.isBoundary
                ? ['On a cusp: exact sign boundaries can shift a day by year and time of birth.', 'Tropical (Western) zodiac']
                : ['Tropical (Western) zodiac', 'Year is ignored for sun-sign lookup']
            }
          />
        </Panel>
      )}
    </div>
  );
}
