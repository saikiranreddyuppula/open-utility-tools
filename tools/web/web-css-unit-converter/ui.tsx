'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Unit = 'px' | 'rem' | 'em' | 'pt' | 'pc' | 'vw' | 'vh' | '%';

const UNITS: Unit[] = ['px', 'rem', 'em', 'pt', 'pc', 'vw', 'vh', '%'];

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  // Trim to at most 4 decimals, drop trailing zeros.
  const r = Math.round(n * 10000) / 10000;
  return r.toString();
}

export default function CssUnitConverterTool() {
  const [value, setValue] = useState('24');
  const [unit, setUnit] = useState<Unit>('px');
  const [root, setRoot] = useState('16');
  const [base, setBase] = useState('16');
  const [vpW, setVpW] = useState('1440');
  const [vpH, setVpH] = useState('900');

  const result = useMemo((): { error: string } | { px: number; rows: [Unit, number][] } => {
    const v = Number(value);
    const rootPx = Number(root);
    const basePx = Number(base);
    const w = Number(vpW);
    const h = Number(vpH);
    if (!Number.isFinite(v)) return { error: 'Enter a valid numeric value.' };
    if (!Number.isFinite(rootPx) || rootPx <= 0) return { error: 'Root font-size must be a positive number.' };
    if (!Number.isFinite(basePx) || basePx <= 0) return { error: 'Base (parent) font-size must be a positive number.' };
    if (!Number.isFinite(w) || w <= 0) return { error: 'Viewport width must be a positive number.' };
    if (!Number.isFinite(h) || h <= 0) return { error: 'Viewport height must be a positive number.' };

    // Convert the input to px first.
    let px: number;
    switch (unit) {
      case 'px': px = v; break;
      case 'rem': px = v * rootPx; break;
      case 'em': px = v * basePx; break;
      case 'pt': px = (v * 96) / 72; break;
      case 'pc': px = v * 16; break;
      case 'vw': px = (v / 100) * w; break;
      case 'vh': px = (v / 100) * h; break;
      case '%': px = (v / 100) * basePx; break;
      default: px = v; break;
    }

    // Express the px back in every unit.
    const rows: [Unit, number][] = [
      ['px', px],
      ['rem', px / rootPx],
      ['em', px / basePx],
      ['pt', (px * 72) / 96],
      ['pc', px / 16],
      ['vw', (px / w) * 100],
      ['vh', (px / h) * 100],
      ['%', (px / basePx) * 100],
    ];
    return { px, rows };
  }, [value, unit, root, base, vpW, vpH]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value" className="min-w-[140px]">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="24" />
          </Field>
          <Field label="Unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Root font-size (px)" className="min-w-[140px]" hint="for rem">
            <Input value={root} onChange={(e) => setRoot(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Base font-size (px)" className="min-w-[140px]" hint="for em / %">
            <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Viewport width (px)" className="min-w-[140px]" hint="for vw">
            <Input value={vpW} onChange={(e) => setVpW(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Viewport height (px)" className="min-w-[140px]" hint="for vh">
            <Input value={vpH} onChange={(e) => setVpH(e.target.value)} inputMode="decimal" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Conversions">
            <CopyButton value={() => result.rows.map(([u, n]) => `${fmt(n)}${u}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map(([u, n]) => (
              <div key={u} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{u}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{fmt(n)}{u}</span>
                  <CopyButton value={`${fmt(n)}${u}`} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`${value || '0'}${unit} = ${fmt(result.px)}px`, `root ${root}px`, `base ${base}px`]} />
        </Panel>
      )}
    </div>
  );
}
