'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Mode = 'humanize' | 'parse';

const SI_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
const IEC_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];

function trimNum(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

function humanize(bytes: number, base: 1000 | 1024, units: string[], decimals: number, bits: boolean): string {
  const amount = bits ? bytes * 8 : bytes;
  const unitNames = bits ? units.map((u) => (u === 'B' ? 'bit' : u.replace('B', 'b'))) : units;
  if (amount === 0) return `0 ${unitNames[0] ?? 'B'}`;
  let i = 0;
  let value = amount;
  while (value >= base && i < unitNames.length - 1) {
    value /= base;
    i++;
  }
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${trimNum(rounded.toFixed(decimals))} ${unitNames[i] ?? '?'}`;
}

// Parse a human size string back to exact bytes.
// A lowercase trailing 'b' (e.g. Mb, Kb) means bits; uppercase 'B' or 'byte(s)' means bytes.
function parseToBytes(input: string): number | null {
  const m = input.trim().match(/^([\d.,]+)\s*([a-zA-Z]+)?$/);
  if (!m) return null;
  const numStr = (m[1] ?? '').replace(/,/g, '');
  const num = Number(numStr);
  if (!Number.isFinite(num)) return null;
  const unitRaw = (m[2] ?? 'B').trim();
  if (unitRaw === '') return num; // bare number = bytes
  const u = unitRaw.toLowerCase();

  // Word forms.
  if (u === 'byte' || u === 'bytes') return num;
  if (u === 'bit' || u === 'bits') return num / 8;

  // Symbol forms: [prefix?][i?][b|B].
  const sym = unitRaw.match(/^([kmgtpe])?(i)?(b)$/i);
  if (!sym) return null;
  const prefix = (sym[1] ?? '').toLowerCase();
  const isIec = sym[2] !== undefined;
  // Bits when the trailing unit char is a lowercase 'b'.
  const isBit = sym[3] === 'b';
  const base = isIec ? 1024 : 1000;
  const expMap: Record<string, number> = { '': 0, k: 1, m: 2, g: 3, t: 4, p: 5, e: 6 };
  const exp = expMap[prefix];
  if (exp === undefined) return null;
  const value = num * base ** exp;
  return isBit ? value / 8 : value;
}

export default function BytesToHumanConverterTool() {
  const [mode, setMode] = useState<Mode>('humanize');

  const [bytesRaw, setBytesRaw] = useState('1500000');
  const [decimals, setDecimals] = useState(2);
  const [bits, setBits] = useState(false);

  const [humanRaw, setHumanRaw] = useState('2.5 GiB');

  const humanizeResult = useMemo(() => {
    const trimmed = bytesRaw.trim().replace(/[, _]/g, '');
    if (trimmed === '') return null;
    const bytes = Number(trimmed);
    if (!Number.isFinite(bytes)) return { error: 'Enter a valid byte count (integer or expression like 1500000).' };
    if (bytes < 0) return { error: 'Byte count cannot be negative.' };
    return {
      si: humanize(bytes, 1000, SI_UNITS, decimals, bits),
      iec: humanize(bytes, 1024, IEC_UNITS, decimals, bits),
      bytes,
    };
  }, [bytesRaw, decimals, bits]);

  const parseResult = useMemo(() => {
    if (humanRaw.trim() === '') return null;
    const b = parseToBytes(humanRaw);
    if (b === null) return { error: "Could not parse. Try formats like '2.5 GiB', '500MB', '1024'." };
    if (b < 0) return { error: 'Size cannot be negative.' };
    return { bytes: b };
  }, [humanRaw]);

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="humanize">Bytes → Human</TabsTrigger>
          <TabsTrigger value="parse">Human → Bytes</TabsTrigger>
        </TabsList>

        <TabsContent value="humanize" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="Bytes" className="min-w-[14rem] flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={bytesRaw}
                  onChange={(e) => setBytesRaw(e.target.value)}
                  placeholder="e.g. 1500000"
                />
              </Field>
              <Field label={`Decimals: ${decimals}`} className="min-w-[10rem]">
                <Slider
                  min={0}
                  max={3}
                  step={1}
                  value={[decimals]}
                  onValueChange={(v) => setDecimals(v[0] ?? 2)}
                />
              </Field>
              <Field label="Bits mode" hint="Kb vs KB">
                <Switch checked={bits} onCheckedChange={setBits} />
              </Field>
            </OptionsBar>
          </Panel>

          {humanizeResult && 'error' in humanizeResult ? (
            <ErrorBanner error={humanizeResult.error} />
          ) : humanizeResult ? (
            <Panel>
              <PanelHeader title="Human-readable">
                <CopyButton
                  value={() => `SI: ${humanizeResult.si}\nIEC: ${humanizeResult.iec}`}
                />
              </PanelHeader>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Decimal (SI, ÷1000)</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{humanizeResult.si}</span>
                    <CopyButton value={humanizeResult.si} size="icon-sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Binary (IEC, ÷1024)</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{humanizeResult.iec}</span>
                    <CopyButton value={humanizeResult.iec} size="icon-sm" />
                  </span>
                </div>
              </div>
              <StatBar items={[`${humanizeResult.bytes.toLocaleString()} bytes`]} />
            </Panel>
          ) : null}
        </TabsContent>

        <TabsContent value="parse" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="Human size" className="min-w-[14rem] flex-1">
                <Input
                  type="text"
                  value={humanRaw}
                  onChange={(e) => setHumanRaw(e.target.value)}
                  placeholder="e.g. 2.5 GiB, 500MB"
                />
              </Field>
            </OptionsBar>
          </Panel>

          {parseResult && 'error' in parseResult ? (
            <ErrorBanner error={parseResult.error} />
          ) : parseResult ? (
            <Panel>
              <PanelHeader title="Exact bytes">
                <CopyButton value={String(parseResult.bytes)} />
              </PanelHeader>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Bytes</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{parseResult.bytes.toLocaleString()}</span>
                    <CopyButton value={String(parseResult.bytes)} size="icon-sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Bits</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{(parseResult.bytes * 8).toLocaleString()}</span>
                    <CopyButton value={String(parseResult.bytes * 8)} size="icon-sm" />
                  </span>
                </div>
              </div>
            </Panel>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
