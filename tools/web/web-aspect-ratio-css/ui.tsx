'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Preset = 'custom' | '16:9' | '4:3' | '1:1' | '21:9' | '3:2' | 'golden';

const PRESETS: Record<Exclude<Preset, 'custom'>, [number, number]> = {
  '16:9': [16, 9],
  '4:3': [4, 3],
  '1:1': [1, 1],
  '21:9': [21, 9],
  '3:2': [3, 2],
  golden: [1618, 1000],
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 ? 1 : x;
}

function trim(n: number): string {
  return Number.parseFloat(n.toFixed(4)).toString();
}

export default function AspectRatioCssTool() {
  const [preset, setPreset] = useState<Preset>('16:9');
  const [w, setW] = useState('16');
  const [h, setH] = useState('9');

  const onPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const pair = PRESETS[p];
      setW(String(pair[0]));
      setH(String(pair[1]));
    }
  };

  const result = useMemo(() => {
    const wn = Number(w);
    const hn = Number(h);
    if (!Number.isFinite(wn) || !Number.isFinite(hn)) return { error: 'Enter valid numbers for width and height.' };
    if (wn <= 0 || hn <= 0) return { error: 'Width and height must be greater than zero.' };

    const g = gcd(Math.round(wn), Math.round(hn));
    const rw = Number.isInteger(wn) && Number.isInteger(hn) ? wn / g : wn;
    const rh = Number.isInteger(wn) && Number.isInteger(hn) ? hn / g : hn;
    const decimal = wn / hn;
    const padPct = (hn / wn) * 100;

    const modern = `aspect-ratio: ${trim(rw)} / ${trim(rh)};`;
    const fallback =
      `.box {\n` +
      `  position: relative;\n` +
      `  width: 100%;\n` +
      `  padding-top: ${trim(padPct)}%; /* ${trim(rh)} / ${trim(rw)} */\n` +
      `}\n` +
      `.box > * {\n` +
      `  position: absolute;\n` +
      `  inset: 0;\n` +
      `}`;

    return {
      rw,
      rh,
      decimal,
      padPct,
      modern,
      fallback,
    };
  }, [w, h]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Preset">
            <Select value={preset} onValueChange={(v) => onPreset(v as Preset)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="21:9">21:9</SelectItem>
                <SelectItem value="3:2">3:2</SelectItem>
                <SelectItem value="golden">Golden</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Width">
            <Input
              value={w}
              onChange={(e) => { setW(e.target.value); setPreset('custom'); }}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Height">
            <Input
              value={h}
              onChange={(e) => { setH(e.target.value); setPreset('custom'); }}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Modern CSS">
              <CopyButton value={result.modern} />
            </PanelHeader>
            <div className="p-3">
              <code className="block font-mono text-sm">{result.modern}</code>
            </div>
            <StatBar
              items={[
                `Reduced: ${trim(result.rw)} : ${trim(result.rh)}`,
                `Decimal: ${result.decimal.toFixed(4)}`,
                `padding-top: ${trim(result.padPct)}%`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Padding-top fallback">
              <CopyButton value={result.fallback} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{result.fallback}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="Live preview" />
            <div className="flex justify-center p-4">
              <div
                className="flex max-h-[320px] max-w-full items-center justify-center rounded border bg-muted/40 text-xs text-muted-foreground"
                style={{ aspectRatio: `${result.rw} / ${result.rh}`, width: 'min(420px, 100%)' }}
              >
                {trim(result.rw)} : {trim(result.rh)}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
