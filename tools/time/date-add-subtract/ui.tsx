'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, Field, OptionsBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Unit = 'days' | 'weeks' | 'months' | 'years';
type Op = 'add' | 'subtract';

const UNITS: { value: Unit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function applyOffset(base: Date, unit: Unit, amount: number): Date {
  const d = new Date(base.getTime());
  switch (unit) {
    case 'days':
      d.setDate(d.getDate() + amount);
      break;
    case 'weeks':
      d.setDate(d.getDate() + amount * 7);
      break;
    case 'months':
      d.setMonth(d.getMonth() + amount);
      break;
    case 'years':
      d.setFullYear(d.getFullYear() + amount);
      break;
  }
  return d;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DateAddSubtractTool() {
  const [baseDate, setBaseDate] = useState(todayISO());
  const [op, setOp] = useState<Op>('add');
  const [unit, setUnit] = useState<Unit>('days');
  const [amount, setAmount] = useState('7');

  const { result, error } = useMemo<{ result: Date | null; error: string | null }>(() => {
    if (!baseDate) return { result: null, error: null };
    const base = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(base.getTime())) {
      return { result: null, error: 'Enter a valid base date.' };
    }
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) {
      return { result: null, error: 'Enter a valid number to add or subtract.' };
    }
    const signed = op === 'subtract' ? -n : n;
    return { result: applyOffset(base, unit, signed), error: null };
  }, [baseDate, op, unit, amount]);

  const iso = result ? result.toISOString().slice(0, 10) : '';
  const locale = result
    ? result.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const weekday = result ? (WEEKDAYS[result.getDay()] ?? '') : '';

  return (
    <div className="space-y-4">
      <Panel title="Inputs">
        <OptionsBar>
          <Field label="Base date">
            <Input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
          </Field>
          <Field label="Operation">
            <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
              <TabsList>
                <TabsTrigger value="add">Add</TabsTrigger>
                <TabsTrigger value="subtract">Subtract</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Amount">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28"
            />
          </Field>
          <Field label="Unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {result ? (
        <Panel title="Result">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums">{iso}</p>
              <CopyButton value={iso} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="font-medium">Locale: </span>
                {locale}
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="font-medium">Weekday: </span>
                {weekday}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
