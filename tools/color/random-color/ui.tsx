'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { hslToRgb, toHex, toRgbString, toHslString, type RGB } from '@/lib/color/convert';

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(a: T): T;
}
const webcrypto = (globalThis as unknown as { crypto: RandomSource }).crypto;

function rand(max: number): number {
  const b = new Uint32Array(1);
  webcrypto.getRandomValues(b);
  return b[0]! % max;
}

export default function RandomColorTool() {
  const [count, setCount] = useState(8);
  const [colors, setColors] = useState<RGB[]>([]);

  const regen = useCallback(() => {
    const n = Math.max(1, Math.min(count, 64));
    const next: RGB[] = [];
    for (let i = 0; i < n; i++) {
      const { r, g, b } = hslToRgb(rand(360), 0.5 + rand(45) / 100, 0.4 + rand(30) / 100);
      next.push({ r, g, b, a: 1 });
    }
    setColors(next);
  }, [count]);

  useEffect(() => {
    regen();
  }, [regen]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input type="number" min={1} max={64} value={count} onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 8, 64)))} className="w-24 font-mono" />
        </Field>
        <div className="flex items-end">
          <Button size="sm" onClick={regen}><RefreshCw className="size-3.5" /> Regenerate</Button>
        </div>
      </OptionsBar>
      <Panel>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-px bg-border">
          {colors.map((c, i) => {
            const hex = toHex(c);
            return (
              <div key={i} className="bg-card">
                <div className="h-20" style={{ backgroundColor: hex }} />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="min-w-0">
                    <code className="block font-mono text-2xs">{hex}</code>
                    <code className="block truncate font-mono text-2xs text-muted-foreground">{toRgbString(c)}</code>
                  </div>
                  <CopyButton value={`${hex} ${toRgbString(c)} ${toHslString(c)}`} size="icon-sm" />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
