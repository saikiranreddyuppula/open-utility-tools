'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Dir = 'b2g' | 'g2b';
const WIDTHS = [4, 8, 16, 32];

function bits(value: number, width: number): number[] {
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) out.push((value >>> i) & 1);
  return out;
}

export default function BinaryGrayCodeTool() {
  const [dir, setDir] = useState<Dir>('b2g');
  const [raw, setRaw] = useState('1011');
  const [width, setWidth] = useState(8);

  const result = useMemo(() => {
    const s = raw.trim();
    if (!s) return { empty: true as const };

    let input: number;
    if (/^[01]+$/.test(s)) {
      if (s.length > width) {
        return { error: `Bit string has ${s.length} bits but width is ${width}.` };
      }
      input = parseInt(s, 2);
    } else if (/^\d+$/.test(s)) {
      input = parseInt(s, 10);
    } else {
      return { error: 'Enter a binary bit string (0/1) or a decimal integer.' };
    }

    if (!Number.isFinite(input)) return { error: 'Could not parse the input value.' };
    const max = width >= 32 ? 0xffffffff : (1 << width) - 1;
    if (input > max) {
      return { error: `Value exceeds ${width}-bit range (max ${max}).` };
    }

    let binVal: number;
    let grayVal: number;
    if (dir === 'b2g') {
      binVal = input;
      grayVal = (input ^ (input >>> 1)) >>> 0;
    } else {
      grayVal = input;
      // Gray to binary: b_i = g_i XOR b_{i+1}
      let b = input;
      b ^= b >>> 16;
      b ^= b >>> 8;
      b ^= b >>> 4;
      b ^= b >>> 2;
      b ^= b >>> 1;
      binVal = b >>> 0;
    }

    const mask = width >= 32 ? 0xffffffff : (1 << width) - 1;
    binVal = (binVal & mask) >>> 0;
    grayVal = (grayVal & mask) >>> 0;

    const binBits = bits(binVal, width);
    const grayBits = bits(grayVal, width);

    return {
      binStr: binBits.join(''),
      grayStr: grayBits.join(''),
      binVal,
      grayVal,
      binBits,
      grayBits,
      converted: dir === 'b2g' ? grayBits.join('') : binBits.join(''),
    };
  }, [dir, raw, width]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="b2g">Binary → Gray</TabsTrigger>
                <TabsTrigger value="g2b">Gray → Binary</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Input (binary or decimal)" className="min-w-[180px] flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Width">
            <Select value={String(width)} onValueChange={(v) => setWidth(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDTHS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w}-bit
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : 'empty' in result ? (
        <p className="px-1 text-2xs text-muted-foreground">
          Enter a value to convert. Gray code changes exactly one bit between consecutive numbers.
        </p>
      ) : (
        <>
          <Panel>
            <PanelHeader title={dir === 'b2g' ? 'Gray code result' : 'Binary result'}>
              <CopyButton value={result.converted} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Binary</span>
                <span className="font-mono text-sm">{result.binStr}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Gray</span>
                <span className="font-mono text-sm">{result.grayStr}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Decimal</span>
                <span className="font-mono text-sm">{result.binVal}</span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Per-bit alignment" />
            <div className="overflow-auto p-3">
              <table className="w-full border-collapse font-mono text-sm">
                <thead>
                  <tr className="text-2xs uppercase text-muted-foreground">
                    <th className="px-2 py-1 text-left">Bit</th>
                    {result.binBits.map((_, i) => (
                      <th key={i} className="px-2 py-1 text-center">
                        {result.binBits.length - 1 - i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">Binary</td>
                    {result.binBits.map((b, i) => (
                      <td key={i} className="px-2 py-1 text-center">
                        {b}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">Gray</td>
                    {result.grayBits.map((g, i) => {
                      const bb = result.binBits[i] ?? 0;
                      const changed = g !== bb;
                      return (
                        <td
                          key={i}
                          className={
                            'px-2 py-1 text-center ' +
                            (changed ? 'font-bold text-primary' : '')
                          }
                        >
                          {g}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <StatBar items={[`${width}-bit`, `Decimal ${result.binVal}`, `Gray ${result.grayStr}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
