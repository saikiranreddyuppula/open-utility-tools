'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const BASES: { base: number; label: string }[] = [
  { base: 2, label: 'Binary (2)' },
  { base: 8, label: 'Octal (8)' },
  { base: 10, label: 'Decimal (10)' },
  { base: 16, label: 'Hex (16)' },
];

export default function NumberBaseConverterTool() {
  const [value, setValue] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number>(10);
  const [customBase, setCustomBase] = useState(36);

  const parse = (raw: string, base: number) => {
    setActive(base);
    const s = raw.trim().toLowerCase().replace(/^0x|^0b|^0o/, '');
    if (!s) {
      setValue(null);
      setError(null);
      return;
    }
    try {
      let acc = 0n;
      const big = BigInt(base);
      for (const ch of s) {
        const digit = parseInt(ch, base);
        if (isNaN(digit) || digit >= base) throw new Error(`"${ch}" is not valid in base ${base}`);
        acc = acc * big + BigInt(digit);
      }
      setValue(acc);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid number');
    }
  };

  const out = (base: number) => (value == null ? '' : value.toString(base));

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Bases" />
        <div className="divide-y">
          {BASES.map(({ base, label }) => (
            <div key={base} className="flex items-center gap-3 px-3 py-2">
              <span className="w-28 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                {label}
              </span>
              <Input
                value={active === base ? undefined : out(base)}
                defaultValue={active === base ? out(base) : undefined}
                onChange={(e) => parse(e.target.value, base)}
                placeholder="0"
                spellCheck={false}
                className="h-8 flex-1 font-mono"
                key={`${base}-${active === base ? 'edit' : out(base)}`}
              />
              <CopyButton value={out(base)} size="icon-sm" disabled={!out(base)} />
            </div>
          ))}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex w-28 shrink-0 items-center gap-1">
              <span className="font-mono text-2xs font-medium text-muted-foreground">Base</span>
              <Input
                type="number"
                min={2}
                max={36}
                value={customBase}
                onChange={(e) => setCustomBase(Math.max(2, Math.min(Number(e.target.value) || 36, 36)))}
                className="h-7 w-14 font-mono"
              />
            </div>
            <Input
              value={out(customBase)}
              onChange={(e) => parse(e.target.value, customBase)}
              placeholder="0"
              spellCheck={false}
              className="h-8 flex-1 font-mono"
            />
            <CopyButton value={out(customBase)} size="icon-sm" disabled={!out(customBase)} />
          </div>
        </div>
      </Panel>

      {error && <ErrorBanner error={error} />}
      <p className="px-1 text-2xs text-muted-foreground">
        Arbitrary-precision via BigInt — handles very large integers exactly. Edit any field to convert.
      </p>
    </div>
  );
}
