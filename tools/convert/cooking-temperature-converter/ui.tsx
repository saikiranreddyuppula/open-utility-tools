'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Scale = 'c' | 'f' | 'gas';

// Standard UK gas-mark table: gas 1 = 140C, +14C per mark up to gas 9 = 248C.
// Plus low marks "S" (slow, ~130C) and 1/4, 1/2 below gas 1.
interface GasRow {
  mark: string;
  c: number;
}
const GAS_TABLE: GasRow[] = [
  { mark: '1/4', c: 110 },
  { mark: '1/2', c: 120 },
  { mark: '1', c: 140 },
  { mark: '2', c: 150 },
  { mark: '3', c: 165 },
  { mark: '4', c: 180 },
  { mark: '5', c: 190 },
  { mark: '6', c: 200 },
  { mark: '7', c: 220 },
  { mark: '8', c: 230 },
  { mark: '9', c: 240 },
];

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

// Nearest gas mark for a Celsius value.
function nearestGas(c: number): { mark: string; exact: boolean } {
  let best = GAS_TABLE[0];
  if (!best) return { mark: '—', exact: false };
  let bestDiff = Math.abs(c - best.c);
  for (const row of GAS_TABLE) {
    const d = Math.abs(c - row.c);
    if (d < bestDiff) {
      best = row;
      bestDiff = d;
    }
  }
  return { mark: best.mark, exact: bestDiff < 0.5 };
}

function gasToC(mark: string): number | null {
  const row = GAS_TABLE.find((g) => g.mark === mark);
  return row ? row.c : null;
}

function label(c: number): string {
  if (c < 135) return 'Very cool / slow';
  if (c < 160) return 'Cool';
  if (c < 180) return 'Moderate';
  if (c < 200) return 'Moderately hot';
  if (c < 230) return 'Hot';
  return 'Very hot';
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export default function CookingTemperatureConverterTool() {
  const [scale, setScale] = useState<Scale>('c');
  const [raw, setRaw] = useState('180');
  const [gasMark, setGasMark] = useState<string>('4');
  const [fan, setFan] = useState(false);

  const result = useMemo(() => {
    let celsius: number;
    if (scale === 'gas') {
      const c = gasToC(gasMark);
      if (c === null) return { error: 'Select a valid gas mark.' };
      celsius = c;
    } else {
      const v = Number(raw.trim());
      if (raw.trim() === '' || !Number.isFinite(v)) return { error: 'Enter a valid temperature.' };
      celsius = scale === 'c' ? v : fToC(v);
    }
    const gas = nearestGas(celsius);
    const fanC = celsius - 20;
    return {
      celsius,
      fahrenheit: cToF(celsius),
      gas,
      fanC,
      fanF: cToF(fanC),
      desc: label(celsius),
    };
  }, [scale, raw, gasMark, fan]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Input scale" className="min-w-[10rem]">
            <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="c">Celsius (°C)</SelectItem>
                <SelectItem value="f">Fahrenheit (°F)</SelectItem>
                <SelectItem value="gas">Gas mark</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {scale === 'gas' ? (
            <Field label="Gas mark" className="min-w-[10rem]">
              <Select value={gasMark} onValueChange={(v) => setGasMark(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAS_TABLE.map((g) => (
                    <SelectItem key={g.mark} value={g.mark}>
                      Gas {g.mark}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Temperature" className="min-w-[10rem] flex-1">
              <Input
                type="text"
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="e.g. 180"
              />
            </Field>
          )}
          <Field label="Fan / convection" hint="Subtracts 20 °C">
            <Switch checked={fan} onCheckedChange={setFan} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Converted temperatures">
            <CopyButton
              value={() =>
                `${round1(result.celsius)} °C / ${round1(result.fahrenheit)} °F / Gas ${result.gas.mark}`
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Celsius</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{round1(result.celsius)} °C</span>
                <CopyButton value={`${round1(result.celsius)} °C`} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Fahrenheit</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{round1(result.fahrenheit)} °F</span>
                <CopyButton value={`${round1(result.fahrenheit)} °F`} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Gas mark</span>
              <span className="font-mono text-sm">
                {result.gas.exact ? `Gas ${result.gas.mark}` : `≈ Gas ${result.gas.mark}`}
              </span>
            </div>
          </div>
          {fan ? (
            <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Fan oven (°C)</span>
                <span className="font-mono text-sm">{round1(result.fanC)} °C</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Fan oven (°F)</span>
                <span className="font-mono text-sm">{round1(result.fanF)} °F</span>
              </div>
            </div>
          ) : null}
          <StatBar items={[`Heat level: ${result.desc}`, fan ? 'Fan setting reduces by 20 °C' : 'Conventional oven']} />
        </Panel>
      )}
    </div>
  );
}
