'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel } from '@/components/tools/panel';
import { parseColor, toHex, toRgbString, type RGB } from '@/lib/color/convert';

// Brettel-style approximate CVD transform matrices (sRGB linear-ish, simplified).
const MATRICES: Record<string, number[][]> = {
  Protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  Deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  Tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
  Achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

function apply(c: RGB, m: number[][]): RGB {
  const r = c.r * m[0]![0]! + c.g * m[0]![1]! + c.b * m[0]![2]!;
  const g = c.r * m[1]![0]! + c.g * m[1]![1]! + c.b * m[1]![2]!;
  const b = c.r * m[2]![0]! + c.g * m[2]![1]! + c.b * m[2]![2]!;
  return { r, g, b, a: 1 };
}

export default function ColorBlindnessTool() {
  const [base, setBase] = useState('#e23b3b');
  const rgb = useMemo(() => parseColor(base), [base]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgb ? toHex(rgb) : '#000000'}
          onChange={(e) => setBase(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border p-1"
        />
        <Input value={base} onChange={(e) => setBase(e.target.value)} className="max-w-xs font-mono" />
      </div>

      {rgb && (
        <Panel>
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
            <Swatch label="Normal" color={toRgbString(rgb)} />
            {Object.entries(MATRICES).map(([name, m]) => (
              <Swatch key={name} label={name} color={toRgbString(apply(rgb, m))} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="bg-card">
      <div className="h-24" style={{ backgroundColor: color }} />
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium">{label}</p>
        <code className="font-mono text-2xs text-muted-foreground">{color}</code>
      </div>
    </div>
  );
}
