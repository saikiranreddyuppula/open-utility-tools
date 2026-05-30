'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Unit = 'px' | 'rem' | 'em' | 'vw' | 'vh';

const UNITS: Unit[] = ['px', 'rem', 'em', 'vw', 'vh'];

export default function CssRelativeUnitCalculatorTool() {
  const [value, setValue] = useState('24');
  const [unit, setUnit] = useState<Unit>('px');
  const [root, setRoot] = useState('16');
  const [parent, setParent] = useState('16');
  const [vpW, setVpW] = useState('1920');
  const [vpH, setVpH] = useState('1080');
  const [decimals, setDecimals] = useState('4');

  const result = useMemo(() => {
    const v = Number(value);
    const r = Number(root);
    const p = Number(parent);
    const w = Number(vpW);
    const h = Number(vpH);
    let d = Number(decimals);

    if (!Number.isFinite(v)) return { error: 'Enter a valid value.' };
    if (!Number.isFinite(r) || r <= 0) return { error: 'Root font-size must be a positive number.' };
    if (!Number.isFinite(p) || p <= 0) return { error: 'Parent font-size must be a positive number.' };
    if (!Number.isFinite(w) || w <= 0) return { error: 'Viewport width must be positive.' };
    if (!Number.isFinite(h) || h <= 0) return { error: 'Viewport height must be positive.' };
    if (!Number.isFinite(d) || d < 0) d = 4;
    d = Math.min(10, Math.round(d));

    // Convert source value to px first.
    let px: number;
    switch (unit) {
      case 'px': px = v; break;
      case 'rem': px = v * r; break;
      case 'em': px = v * p; break;
      case 'vw': px = (v / 100) * w; break;
      case 'vh': px = (v / 100) * h; break;
      default: px = v; break;
    }

    const fmt = (n: number): string => Number.parseFloat(n.toFixed(d)).toString();

    const rows: Array<{ unit: Unit; value: string }> = [
      { unit: 'px', value: `${fmt(px)}px` },
      { unit: 'rem', value: `${fmt(px / r)}rem` },
      { unit: 'em', value: `${fmt(px / p)}em` },
      { unit: 'vw', value: `${fmt((px / w) * 100)}vw` },
      { unit: 'vh', value: `${fmt((px / h) * 100)}vh` },
    ];
    return { rows, px: fmt(px) };
  }, [value, unit, root, parent, vpW, vpH, decimals]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Root (px)">
            <Input value={root} onChange={(e) => setRoot(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
          </Field>
          <Field label="Parent (px)">
            <Input value={parent} onChange={(e) => setParent(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
          </Field>
          <Field label="Viewport W">
            <Input value={vpW} onChange={(e) => setVpW(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Viewport H">
            <Input value={vpH} onChange={(e) => setVpH(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Decimals">
            <Input value={decimals} onChange={(e) => setDecimals(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error || null} />
      ) : (
        <Panel>
          <PanelHeader title="Equivalents">
            <CopyButton value={() => result.rows.map((r) => `${r.unit}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.unit} className="flex items-center gap-3 px-3 py-2">
                <span className="w-16 shrink-0 font-mono text-xs uppercase text-muted-foreground">{r.unit}</span>
                <code className="min-w-0 flex-1 font-mono text-sm">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`Base = ${result.px}px`, `${value}${unit}`]} />
        </Panel>
      )}
    </div>
  );
}
