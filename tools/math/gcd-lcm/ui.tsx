'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { gcd, lcm } from '@/lib/math/numbers';

export default function GcdLcmTool() {
  const [input, setInput] = useState('12, 18, 24');

  const { nums, g, l } = useMemo(() => {
    const parsed = input
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && Number.isInteger(n));
    if (parsed.length < 2) return { nums: parsed, g: null, l: null };
    return {
      nums: parsed,
      g: parsed.reduce((a, b) => gcd(a, b)),
      l: parsed.reduce((a, b) => lcm(a, b)),
    };
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Numbers (comma or space separated)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="12, 18, 24"
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="font-mono text-2xl font-semibold tabular">{g ?? '—'}</div>
          <div className="text-2xs text-muted-foreground">GCD (greatest common divisor)</div>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <div className="font-mono text-2xl font-semibold tabular">{l ?? '—'}</div>
          <div className="text-2xs text-muted-foreground">LCM (least common multiple)</div>
        </div>
      </div>
      {nums.length < 2 && (
        <p className="px-1 text-2xs text-muted-foreground">Enter at least two integers.</p>
      )}
    </div>
  );
}
