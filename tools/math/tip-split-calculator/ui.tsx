'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RoundMode = 'none' | 'perPerson' | 'total';

const QUICK_TIPS = [10, 15, 18, 20, 25];

function parseMoney(text: string): number | null {
  const trimmed = text.trim().replace(/[$,]/g, '');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TipSplitCalculatorTool() {
  const [billText, setBillText] = useState('100');
  const [tipText, setTipText] = useState('18');
  const [peopleText, setPeopleText] = useState('2');
  const [round, setRound] = useState<RoundMode>('none');

  const result = useMemo(() => {
    const bill = parseMoney(billText);
    const tipPct = parseMoney(tipText);
    const peopleRaw = parseMoney(peopleText);

    if (bill === null || tipPct === null || peopleRaw === null) {
      return { error: 'Enter the bill, tip %, and number of people.' as string | null, data: null };
    }
    if (bill < 0) return { error: 'Bill cannot be negative.', data: null };
    if (tipPct < 0) return { error: 'Tip percentage cannot be negative.', data: null };
    const people = Math.floor(peopleRaw);
    if (people < 1) return { error: 'Number of people must be at least 1.', data: null };

    const tipAmount = bill * (tipPct / 100);
    let total = bill + tipAmount;
    let perPerson = total / people;

    if (round === 'total') {
      total = Math.ceil(total);
      perPerson = total / people;
    } else if (round === 'perPerson') {
      perPerson = Math.ceil(perPerson);
      total = perPerson * people;
    }

    return {
      error: null,
      data: {
        bill,
        tipPct,
        people,
        tipAmount,
        total,
        perPerson,
        // Effective tip after rounding (total - bill).
        effectiveTip: total - bill,
      },
    };
  }, [billText, tipText, peopleText, round]);

  const data = result.data;

  const copyText = useMemo(() => {
    if (!data) return '';
    return [
      `Bill: ${money(data.bill)}`,
      `Tip (${data.tipPct}%): ${money(data.effectiveTip)}`,
      `Total: ${money(data.total)}`,
      `People: ${data.people}`,
      `Per person: ${money(data.perPerson)}`,
    ].join('\n');
  }, [data]);

  return (
    <Panel>
      <PanelHeader title="Tip & Bill Splitter">
        {copyText !== '' && <CopyButton value={copyText} />}
      </PanelHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Bill amount">
          <Input
            inputMode="decimal"
            value={billText}
            onChange={(e) => setBillText(e.target.value)}
            placeholder="100.00"
          />
        </Field>
        <Field label="Tip %">
          <Input
            inputMode="decimal"
            value={tipText}
            onChange={(e) => setTipText(e.target.value)}
            placeholder="18"
          />
        </Field>
        <Field label="People">
          <Input
            inputMode="numeric"
            value={peopleText}
            onChange={(e) => setPeopleText(e.target.value)}
            placeholder="2"
          />
        </Field>
      </div>

      <Field label="Quick tip %">
        <div className="flex flex-wrap gap-2">
          {QUICK_TIPS.map((t) => (
            <Button
              key={t}
              type="button"
              variant={tipText.trim() === String(t) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipText(String(t))}
            >
              {t}%
            </Button>
          ))}
        </div>
      </Field>

      <OptionsBar>
        <Field label="Rounding">
          <Tabs value={round} onValueChange={(v) => setRound(v as RoundMode)}>
            <TabsList>
              <TabsTrigger value="none">None</TabsTrigger>
              <TabsTrigger value="perPerson">Round per person up</TabsTrigger>
              <TabsTrigger value="total">Round total up</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {data && (
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">Tip amount</div>
            <div className="mt-1 text-2xl font-semibold font-mono">{money(data.effectiveTip)}</div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">Grand total</div>
            <div className="mt-1 text-2xl font-semibold font-mono">{money(data.total)}</div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">Per person ({data.people})</div>
            <div className="mt-1 text-2xl font-semibold font-mono">{money(data.perPerson)}</div>
          </div>
        </div>
      )}

      <StatBar
        items={[
          data && `Bill ${money(data.bill)}`,
          data && `Tip ${data.tipPct}%`,
          data && `Split ${data.people} way${data.people === 1 ? '' : 's'}`,
        ]}
      />
    </Panel>
  );
}
