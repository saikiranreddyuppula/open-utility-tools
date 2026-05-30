'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function nowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plusDaysLocal(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Calendar Y/M/D breakdown by borrowing across month lengths.
function ymdBreakdown(a: Date, b: Date): { y: number; m: number; d: number; hh: number; mm: number; ss: number } {
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  let hours = b.getHours() - a.getHours();
  let mins = b.getMinutes() - a.getMinutes();
  let secs = b.getSeconds() - a.getSeconds();

  if (secs < 0) { secs += 60; mins -= 1; }
  if (mins < 0) { mins += 60; hours -= 1; }
  if (hours < 0) { hours += 24; days -= 1; }
  if (days < 0) {
    // borrow days from the previous month (relative to b)
    const prevMonthDays = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    days += prevMonthDays;
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }
  return { y: years, m: months, d: days, hh: hours, mm: mins, ss: secs };
}

// Approx month count via calendar stepping.
function totalMonths(a: Date, b: Date): number {
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // fractional remainder
  const anchor = new Date(a.getTime());
  anchor.setMonth(anchor.getMonth() + whole);
  let frac = 0;
  if (b.getTime() >= anchor.getTime()) {
    const next = new Date(anchor.getTime());
    next.setMonth(next.getMonth() + 1);
    const span = next.getTime() - anchor.getTime();
    frac = span > 0 ? (b.getTime() - anchor.getTime()) / span : 0;
  } else {
    const prev = new Date(anchor.getTime());
    prev.setMonth(prev.getMonth() - 1);
    const span = anchor.getTime() - prev.getTime();
    frac = span > 0 ? (b.getTime() - anchor.getTime()) / span : 0;
  }
  return whole + frac;
}

function countDays(a: Date, b: Date): { weekend: number; business: number } {
  // iterate calendar days from start date (midnight) to end date (exclusive of partial)
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let weekend = 0;
  let business = 0;
  const cur = new Date(start.getTime());
  let guard = 0;
  while (cur.getTime() < end.getTime() && guard < 200000) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) weekend++;
    else business++;
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return { weekend, business };
}

interface Computed {
  totals: { label: string; value: string }[];
  human: string;
  weekend: number;
  business: number;
  ms: number;
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function compute(aStr: string, bStr: string): Computed | { error: string } {
  const aMs = Date.parse(aStr);
  const bMs = Date.parse(bStr);
  if (!Number.isFinite(aMs)) return { error: 'Enter a valid first datetime.' };
  if (!Number.isFinite(bMs)) return { error: 'Enter a valid second datetime.' };
  const lo = Math.min(aMs, bMs);
  const hi = Math.max(aMs, bMs);
  const a = new Date(lo);
  const b = new Date(hi);
  const ms = hi - lo;

  const totals = [
    { label: 'Years (365d)', value: fmt(ms / (365 * 86400000)) },
    { label: 'Months (cal.)', value: fmt(totalMonths(a, b)) },
    { label: 'Weeks', value: fmt(ms / 604800000) },
    { label: 'Days', value: fmt(ms / 86400000) },
    { label: 'Hours', value: fmt(ms / 3600000) },
    { label: 'Minutes', value: fmt(ms / 60000) },
    { label: 'Seconds', value: fmt(ms / 1000) },
  ];

  const br = ymdBreakdown(a, b);
  const humanParts: string[] = [];
  if (br.y) humanParts.push(`${br.y}y`);
  if (br.m) humanParts.push(`${br.m}mo`);
  if (br.d) humanParts.push(`${br.d}d`);
  if (br.hh) humanParts.push(`${br.hh}h`);
  if (br.mm) humanParts.push(`${br.mm}m`);
  if (br.ss || humanParts.length === 0) humanParts.push(`${br.ss}s`);

  const { weekend, business } = countDays(a, b);

  return { totals, human: humanParts.join(' '), weekend, business, ms };
}

export default function DaysBetweenUnits() {
  const [a, setA] = useState(nowLocal());
  const [b, setB] = useState(plusDaysLocal(100));

  const result = useMemo(() => compute(a, b), [a, b]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="From">
            <Input type="datetime-local" value={a} onChange={(e) => setA(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="datetime-local" value={b} onChange={(e) => setB(e.target.value)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Span in every unit">
            <CopyButton value={() => result.totals.map((t) => `${t.label}: ${t.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.totals.map((t) => (
              <div key={t.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{t.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm tabular">
                  <span>{t.value}</span>
                  <CopyButton value={t.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <div className="border-t px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Calendar breakdown</span>
              <span className="font-mono text-sm">{result.human}</span>
            </div>
          </div>
          <StatBar
            items={[
              `${result.business.toLocaleString()} business days`,
              `${result.weekend.toLocaleString()} weekend days`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
