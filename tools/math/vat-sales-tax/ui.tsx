'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'add' | 'remove';

const PRESETS = [5, 7.5, 10, 15, 18, 20, 23];

export default function VatSalesTaxTool() {
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('100');
  const [rate, setRate] = useState('20');

  const result = useMemo(() => {
    const amt = Number(amount.trim());
    const r = Number(rate.trim());
    if (!Number.isFinite(amt)) return { error: 'Enter a valid amount.' as string };
    if (amt < 0) return { error: 'Amount cannot be negative.' };
    if (!Number.isFinite(r) || r < 0) return { error: 'Enter a valid tax rate (≥ 0).' };

    let net: number;
    let gross: number;
    let tax: number;
    if (mode === 'add') {
      net = amt;
      tax = (net * r) / 100;
      gross = net + tax;
    } else {
      gross = amt;
      net = gross / (1 + r / 100);
      tax = gross - net;
    }
    return {
      net,
      tax,
      gross,
      rate: r,
      inputLabel: mode === 'add' ? 'Net (entered)' : 'Gross (entered)',
    };
  }, [amount, rate, mode]);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode" className="min-w-[260px]">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="add">Add tax to net</TabsTrigger>
                <TabsTrigger value="remove">Remove tax from gross</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={mode === 'add' ? 'Net amount' : 'Gross amount'}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Tax rate %" hint="quick presets below">
            <Input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRate(String(p))}
              className="rounded border bg-muted/40 px-2 py-0.5 font-mono text-2xs hover:bg-muted"
            >
              {p}%
            </button>
          ))}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Breakdown at ${result.rate}%`}>
            <CopyButton
              value={() =>
                [
                  `Net: ${fmt(result.net)}`,
                  `Tax (${result.rate}%): ${fmt(result.tax)}`,
                  `Gross: ${fmt(result.gross)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Net (excl. tax)', value: result.net },
              { label: `Tax (${result.rate}%)`, value: result.tax },
              { label: 'Gross (incl. tax)', value: result.gross },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </span>
                <span className="flex items-center justify-between gap-2 font-mono text-lg">
                  <span>{fmt(row.value)}</span>
                  <CopyButton value={fmt(row.value)} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.inputLabel} = ${fmt(mode === 'add' ? result.net : result.gross)}`,
              `Rate = ${result.rate}%`,
              `Tax = ${fmt(result.tax)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
