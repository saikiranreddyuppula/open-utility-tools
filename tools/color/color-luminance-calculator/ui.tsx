'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

type RGB = { r: number; g: number; b: number };

function parseColor(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]); const g = Number(rgbMatch[2]); const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function LuminanceCalcTool() {
  const [input, setInput] = useState('#4ecdc4');

  const result = useMemo(() => {
    const c = parseColor(input);
    if (!c) return { error: 'Enter a valid color (#hex or rgb()).' };
    const lin = (ch: number) => { const cs = ch / 255; return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const rn = c.r / 255, gn = c.g / 255, bn = c.b / 255;
    const hsp = Math.sqrt(0.299 * rn ** 2 + 0.587 * gn ** 2 + 0.114 * bn ** 2);
    const luma601 = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    const verdict = L > 0.179 ? 'light' : 'dark';
    const textColor = L > 0.179 ? '#000000' : '#ffffff';
    return { c, L, hsp, luma601, verdict, textColor };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color" className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseColor(input) ? toHex(parseColor(input) as RGB) : '#4ecdc4'}
                onChange={(e) => setInput(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color"
              />
              <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <div
              className="flex h-28 items-center justify-center text-lg font-semibold"
              style={{ backgroundColor: toHex(result.c), color: result.textColor }}
            >
              This color is {result.verdict} — use {result.textColor === '#000000' ? 'black' : 'white'} text
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Metrics">
              <CopyButton
                value={() =>
                  `Relative luminance: ${result.L.toFixed(4)}\nPerceived brightness (HSP): ${result.hsp.toFixed(4)}\nLuma (ITU-R 601): ${result.luma601.toFixed(4)}\nVerdict: ${result.verdict}`
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {([
                ['Relative luminance', result.L, 'WCAG 2.x, 0–1'],
                ['Perceived brightness', result.hsp, 'HSP model, 0–1'],
                ['Luma (ITU-R 601)', result.luma601, '0–1'],
              ] as const).map(([label, val, hint]) => (
                <div key={label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-3">
                  <span className="text-2xs text-muted-foreground">{label}</span>
                  <span className="flex items-center gap-2 font-mono text-xl font-semibold tabular">
                    {val.toFixed(4)}
                    <CopyButton value={val.toFixed(4)} size="icon-sm" />
                  </span>
                  <span className="text-2xs text-muted-foreground">{hint}</span>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 text-sm">
              Verdict:{' '}
              <span className="font-semibold">{result.verdict === 'light' ? 'Light color' : 'Dark color'}</span>{' '}
              <span className="text-muted-foreground">
                (luminance {result.L > 0.179 ? '>' : '≤'} 0.179 threshold → prefer {result.textColor === '#000000' ? 'black' : 'white'} text)
              </span>
            </div>
          </Panel>

          <StatBar
            items={[
              `L = ${result.L.toFixed(4)}`,
              `HSP = ${result.hsp.toFixed(4)}`,
              `luma601 = ${result.luma601.toFixed(4)}`,
              result.verdict,
            ]}
          />
        </>
      )}
    </div>
  );
}
