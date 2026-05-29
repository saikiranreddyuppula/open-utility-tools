'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';
import { parseColor, toRgbString, contrastRatio, type RGB } from '@/lib/color/convert';
import { cn } from '@/lib/utils';

function Check({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
        pass
          ? 'border-success/30 bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      )}
    >
      <span>{label}</span>
      <span className="font-mono font-semibold">{pass ? 'PASS' : 'FAIL'}</span>
    </div>
  );
}

export default function ContrastCheckerTool() {
  const [fg, setFg] = useState('#1a1a2e');
  const [bg, setBg] = useState('#ffffff');

  const fgc = useMemo(() => parseColor(fg), [fg]);
  const bgc = useMemo(() => parseColor(bg), [bg]);
  const ratio = fgc && bgc ? contrastRatio(fgc, bgc) : null;

  const preview = (text: RGB | null, back: RGB | null) =>
    text && back ? { color: toRgbString(text), backgroundColor: toRgbString(back) } : {};

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fgc ? fg : '#000000'}
            onChange={(e) => setFg(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border p-1"
            aria-label="Foreground"
          />
          <Input value={fg} onChange={(e) => setFg(e.target.value)} className="font-mono" placeholder="Foreground" />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={bgc ? bg : '#ffffff'}
            onChange={(e) => setBg(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border p-1"
            aria-label="Background"
          />
          <Input value={bg} onChange={(e) => setBg(e.target.value)} className="font-mono" placeholder="Background" />
        </div>
      </div>

      <div className="rounded-lg border p-6 text-center" style={preview(fgc, bgc)}>
        <p className="text-2xl font-semibold">Large text sample</p>
        <p className="text-sm">The quick brown fox jumps over the lazy dog.</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-3xl font-semibold tabular">{ratio ?? '—'}</span>
        <span className="text-sm text-muted-foreground">: 1 contrast ratio</span>
      </div>

      {ratio != null && (
        <Panel>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            <Check pass={ratio >= 4.5} label="AA · normal text (≥ 4.5)" />
            <Check pass={ratio >= 3} label="AA · large text (≥ 3)" />
            <Check pass={ratio >= 7} label="AAA · normal text (≥ 7)" />
            <Check pass={ratio >= 4.5} label="AAA · large text (≥ 4.5)" />
          </div>
        </Panel>
      )}
    </div>
  );
}
