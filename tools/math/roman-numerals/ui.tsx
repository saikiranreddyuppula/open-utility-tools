'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { toRoman, fromRoman } from '@/lib/math/roman';

export default function RomanNumeralsTool() {
  const [num, setNum] = useState('2024');
  const [roman, setRoman] = useState('MMXXIV');
  const [error, setError] = useState<string | null>(null);

  const onNum = (v: string) => {
    setNum(v);
    if (!v.trim()) {
      setRoman('');
      setError(null);
      return;
    }
    try {
      setRoman(toRoman(Number(v)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid');
    }
  };

  const onRoman = (v: string) => {
    setRoman(v.toUpperCase());
    if (!v.trim()) {
      setNum('');
      setError(null);
      return;
    }
    try {
      setNum(String(fromRoman(v)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="divide-y">
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="w-24 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Integer
            </span>
            <Input
              value={num}
              onChange={(e) => onNum(e.target.value)}
              type="number"
              min={1}
              max={3999}
              className="flex-1 font-mono"
            />
            <CopyButton value={num} size="icon-sm" disabled={!num} />
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="w-24 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Roman
            </span>
            <Input
              value={roman}
              onChange={(e) => onRoman(e.target.value)}
              className="flex-1 font-mono text-base tracking-widest"
            />
            <CopyButton value={roman} size="icon-sm" disabled={!roman} />
          </div>
        </div>
      </Panel>
      {error && <ErrorBanner error={error} />}
    </div>
  );
}
