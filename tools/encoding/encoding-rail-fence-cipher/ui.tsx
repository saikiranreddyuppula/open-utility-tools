'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

/**
 * Compute the rail index (0-based) for each character position of a message
 * of the given length, starting at `offset` steps into the zigzag.
 */
function railPattern(length: number, rails: number, offset: number): number[] {
  const out: number[] = [];
  if (rails <= 1) {
    for (let i = 0; i < length; i++) out.push(0);
    return out;
  }
  const cycle = 2 * (rails - 1);
  for (let i = 0; i < length; i++) {
    const pos = ((i + offset) % cycle + cycle) % cycle;
    const rail = pos < rails ? pos : cycle - pos;
    out.push(rail);
  }
  return out;
}

export default function RailFenceCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [railsStr, setRailsStr] = useState('3');
  const [offsetStr, setOffsetStr] = useState('0');
  const [stripNonAlpha, setStripNonAlpha] = useState(false);

  const cfg = useMemo(() => {
    const rails = Number(railsStr);
    const offset = Number(offsetStr);
    if (!Number.isInteger(rails) || rails < 2) {
      return { error: 'Rails must be an integer ≥ 2.' as const };
    }
    if (rails > 1000) {
      return { error: 'Rails capped at 1000.' as const };
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return { error: 'Offset must be a non-negative integer.' as const };
    }
    return { rails, offset };
  }, [railsStr, offsetStr]);

  const prepare = useCallback(
    (input: string) => (stripNonAlpha ? input.replace(/[^A-Za-z0-9]/g, '') : input),
    [stripNonAlpha],
  );

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if ('error' in cfg) throw new Error(cfg.error);
      const { rails, offset } = cfg;
      const text = prepare(input);
      if (!text) return '';
      const pattern = railPattern(text.length, rails, offset);

      if (mode === 'encode') {
        const buckets: string[][] = Array.from({ length: rails }, () => []);
        for (let i = 0; i < text.length; i++) {
          const rail = pattern[i] ?? 0;
          const ch = text[i] ?? '';
          (buckets[rail] ?? []).push(ch);
        }
        return buckets.map((b) => b.join('')).join('');
      }

      // Decode: count chars per rail, slice the cipher, then re-emit in zigzag order.
      const counts: number[] = Array.from({ length: rails }, () => 0);
      for (const rail of pattern) counts[rail] = (counts[rail] ?? 0) + 1;
      const slices: string[] = [];
      let cursor = 0;
      for (let r = 0; r < rails; r++) {
        const n = counts[r] ?? 0;
        slices.push(text.slice(cursor, cursor + n));
        cursor += n;
      }
      const idx: number[] = Array.from({ length: rails }, () => 0);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const rail = pattern[i] ?? 0;
        const slice = slices[rail] ?? '';
        const pos = idx[rail] ?? 0;
        out += slice[pos] ?? '';
        idx[rail] = pos + 1;
      }
      return out;
    },
    [mode, cfg, prepare],
  );

  // ASCII grid visualization (capped to keep it readable).
  const viz = useMemo(() => {
    if ('error' in cfg) return null;
    return (sample: string): string => {
      const text = prepare(sample);
      if (!text) return '';
      const capped = text.slice(0, 120);
      const { rails, offset } = cfg;
      const pattern = railPattern(capped.length, rails, offset);
      const grid: string[][] = Array.from({ length: rails }, () =>
        Array.from({ length: capped.length }, () => '·'),
      );
      for (let i = 0; i < capped.length; i++) {
        const rail = pattern[i] ?? 0;
        const row = grid[rail];
        if (row) row[i] = capped[i] ?? '·';
      }
      return grid.map((row) => row.join('')).join('\n');
    };
  }, [cfg, prepare]);

  const sampleText = mode === 'encode' ? 'WE ARE DISCOVERED FLEE AT ONCE' : 'WECRLTEERDSOEEFEAOCAIVDEN';
  const vizText = viz ? viz(sampleText) : '';

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, railsStr, offsetStr, stripNonAlpha]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
        outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
        sample={sampleText}
        downloadName="railfence.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="encode">Encrypt</TabsTrigger>
                  <TabsTrigger value="decode">Decrypt</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Rails (≥ 2)">
              <Input
                value={railsStr}
                onChange={(e) => setRailsStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Field label="Start offset">
              <Input
                value={offsetStr}
                onChange={(e) => setOffsetStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Field label="Strip spaces/punctuation">
              <Switch checked={stripNonAlpha} onCheckedChange={setStripNonAlpha} />
            </Field>
          </>
        }
      />

      {vizText && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Zigzag layout (for the sample text, capped at 120 chars)
          </div>
          <pre className="overflow-auto font-mono text-xs leading-tight">{vizText}</pre>
        </div>
      )}
    </div>
  );
}
