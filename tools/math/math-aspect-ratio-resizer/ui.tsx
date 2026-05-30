'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type Result =
  | { error: string }
  | {
      width: number;
      height: number;
      solved: 'width' | 'height';
      simplified: string;
      scale: number;
    };

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function parseRatio(s: string): { w: number; h: number } | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const sep = trimmed.includes(':')
    ? ':'
    : trimmed.includes('/')
      ? '/'
      : trimmed.includes('x')
        ? 'x'
        : null;
  if (!sep) return null;
  const parts = trimmed.split(sep);
  if (parts.length !== 2) return null;
  const w = Number((parts[0] ?? '').trim());
  const h = Number((parts[1] ?? '').trim());
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

function fmt(n: number, round: boolean): string {
  if (round) return String(Math.round(n));
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, '');
}

export default function AspectRatioResizer() {
  const [ratio, setRatio] = useState('16:9');
  const [newWidth, setNewWidth] = useState('1280');
  const [newHeight, setNewHeight] = useState('');
  const [roundPx, setRoundPx] = useState(true);

  const result = useMemo<Result>(() => {
    const r = parseRatio(ratio);
    if (!r) return { error: 'Enter a ratio like 16:9, 4/3, or 1920x1080.' };

    const wStr = newWidth.trim();
    const hStr = newHeight.trim();
    const w = wStr === '' ? null : Number(wStr);
    const h = hStr === '' ? null : Number(hStr);

    if (w !== null && (!Number.isFinite(w) || w <= 0)) return { error: 'Width must be a positive number.' };
    if (h !== null && (!Number.isFinite(h) || h <= 0)) return { error: 'Height must be a positive number.' };

    if (w !== null && h !== null) return { error: 'Leave exactly one of width or height empty to solve for it.' };
    if (w === null && h === null) return { error: 'Enter the new width OR height to solve for the other.' };

    const g = gcd(r.w, r.h);
    const simplified = `${Math.round(r.w) / g}:${Math.round(r.h) / g}`;

    if (w !== null) {
      const solvedH = (w * r.h) / r.w;
      const finalH = roundPx ? Math.round(solvedH) : solvedH;
      return { width: w, height: finalH, solved: 'height', simplified, scale: w / r.w };
    }
    const hh = h as number;
    const solvedW = (hh * r.w) / r.h;
    const finalW = roundPx ? Math.round(solvedW) : solvedW;
    return { width: finalW, height: hh, solved: 'width', simplified, scale: hh / r.h };
  }, [ratio, newWidth, newHeight, roundPx]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Aspect ratio" hint="16:9, 4/3, or 1920x1080">
            <Input value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="16:9" />
          </Field>
          <Field label="New width (px)" hint="leave empty to solve">
            <Input value={newWidth} onChange={(e) => setNewWidth(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="New height (px)" hint="leave empty to solve">
            <Input value={newHeight} onChange={(e) => setNewHeight(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Round to integer px">
            <Switch checked={roundPx} onCheckedChange={setRoundPx} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Solved ${result.solved}`}>
            <CopyButton value={() => `${fmt(result.width, roundPx)}x${fmt(result.height, roundPx)}`} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs text-muted-foreground">Width</span>
              <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                <span>{fmt(result.width, roundPx)}</span>
                <CopyButton value={fmt(result.width, roundPx)} size="icon-sm" />
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs text-muted-foreground">Height</span>
              <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                <span>{fmt(result.height, roundPx)}</span>
                <CopyButton value={fmt(result.height, roundPx)} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar
            items={[
              `Dimensions: ${fmt(result.width, roundPx)} x ${fmt(result.height, roundPx)}`,
              `Simplified ratio: ${result.simplified}`,
              `Scale factor: ${result.scale.toFixed(4)}x`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
