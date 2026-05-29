'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { parseColor, toHex, type RGB } from '@/lib/color/convert';

function mix(c: RGB, target: number, amount: number): RGB {
  return {
    r: c.r + (target - c.r) * amount,
    g: c.g + (target - c.g) * amount,
    b: c.b + (target - c.b) * amount,
    a: 1,
  };
}

export default function ColorShadesTool() {
  const [base, setBase] = useState('#5b5bd6');
  const rgb = useMemo(() => parseColor(base), [base]);

  const ramp = useMemo(() => {
    if (!rgb) return [];
    // 11-step scale like Tailwind 50..950
    const steps = [0.92, 0.8, 0.64, 0.46, 0.24, 0, -0.18, -0.34, -0.5, -0.64, -0.76];
    const labels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    return steps.map((amt, i) => {
      const c = amt > 0 ? mix(rgb, 255, amt) : amt < 0 ? mix(rgb, 0, -amt) : rgb;
      return { label: labels[i]!, hex: toHex(c) };
    });
  }, [rgb]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgb ? toHex(rgb) : '#000000'}
          onChange={(e) => setBase(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border p-1"
        />
        <Input value={base} onChange={(e) => setBase(e.target.value)} className="max-w-xs font-mono" />
      </div>

      {ramp.length > 0 && (
        <Panel>
          <PanelHeader title="Scale" />
          <div className="divide-y">
            {ramp.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-10 shrink-0 font-mono text-2xs text-muted-foreground tabular">{s.label}</span>
                <span className="h-7 w-16 shrink-0 rounded border" style={{ backgroundColor: s.hex }} />
                <code className="flex-1 font-mono text-xs">{s.hex}</code>
                <CopyButton value={s.hex} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
