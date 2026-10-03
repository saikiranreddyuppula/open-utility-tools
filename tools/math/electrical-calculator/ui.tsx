'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AWG_GAUGES,
  COLOR_HEX,
  CONDUCTORS,
  DIGIT_COLORS,
  E_SERIES,
  E_SERIES_TOLERANCE,
  FEET_TO_M,
  METRIC_SIZES_MM2,
  MULTIPLIER_COLORS,
  PASSIVE_UNIT,
  TEMPCO_COLORS,
  TEMPCO_PPM,
  TOLERANCE_COLORS,
  TOLERANCE_PCT,
  acPower,
  awgAreaMm2,
  awgDiameterMm,
  awgLabel,
  combine,
  decodeBands,
  decodeSmd,
  digitOf,
  divider,
  encodeBands,
  encodeSmd,
  formatPlain,
  formatSI,
  ledResistor,
  minAwgForDrop,
  minMetricForDrop,
  multiplierExponent,
  nearestStandard,
  parseSI,
  parseValueList,
  pfCorrectionKvar,
  powerFactorFrom,
  resistancePerMetre,
  resistivityAt,
  solveOhm,
  solveR1,
  solveR2,
  voltageDrop,
  type BandColor,
  type BandCount,
  type Conductor,
  type ESeriesName,
  type OhmKey,
  type PassiveKind,
  type UnitKind,
} from './logic';

type TabId = 'ohm' | 'color' | 'combine' | 'divider' | 'led' | 'ac' | 'wire';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function TextBox({
  value,
  onChange,
  className,
  placeholder,
  label,
  onFocus,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  label?: string;
  onFocus?: (el: HTMLInputElement) => void;
  readOnly?: boolean;
}) {
  return (
    <Input
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => onFocus?.(e.currentTarget)}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      spellCheck={false}
      className={cn('font-mono', className)}
    />
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad';
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'break-words font-mono font-semibold tabular-nums',
          compact ? 'text-base' : 'text-xl',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-warning',
          tone === 'bad' && 'text-destructive'
        )}
      >
        {value}
      </div>
      {sub && <div className="text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Note({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        tone === 'warn' ? 'border-warning/40 bg-warning/10' : 'bg-muted/30 text-muted-foreground'
      )}
    >
      {children}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full', className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ================================================================== Ohm's law

const OHM_META: Record<OhmKey, { name: string; unit: string; kind: UnitKind; hint: string }> = {
  V: { name: 'Voltage', unit: 'V', kind: 'V', hint: 'e.g. 12, 3.3, 500m' },
  I: { name: 'Current', unit: 'A', kind: 'A', hint: 'e.g. 20m, 150µ, 2' },
  R: { name: 'Resistance', unit: 'Ω', kind: 'ohm', hint: 'e.g. 470, 4.7k, 1M' },
  P: { name: 'Power', unit: 'W', kind: 'W', hint: 'e.g. 0.25, 500m, 2k' },
};

const OHM_FORMS: Record<OhmKey, string[]> = {
  V: ['I × R', 'P / I', '√(P × R)'],
  I: ['V / R', 'P / V', '√(P / R)'],
  R: ['V / I', 'V² / P', 'P / I²'],
  P: ['V × I', 'I² × R', 'V² / R'],
};

function OhmTab() {
  const [raw, setRaw] = useState<Record<OhmKey, string>>({ V: '12', I: '', R: '470', P: '' });
  const [order, setOrder] = useState<OhmKey[]>(['V', 'R']);

  const calc = useMemo(() => {
    try {
      const known: Partial<Record<OhmKey, number>> = {};
      for (const k of order) {
        const meta = OHM_META[k];
        if (raw[k].trim() === '') throw new Error(`Enter a value for ${meta.name.toLowerCase()} (or type in another field).`);
        const v = parseSI(raw[k], meta.kind);
        if (Number.isNaN(v)) throw new Error(`Could not read "${raw[k]}" as ${meta.name.toLowerCase()} in ${meta.unit}.`);
        known[k] = v;
      }
      return { res: solveOhm(known), error: null as string | null };
    } catch (e) {
      return { res: null, error: errMsg(e) };
    }
  }, [raw, order]);

  const onChange = (k: OhmKey, v: string) => {
    setRaw({ ...raw, [k]: v });
    if (!order.includes(k)) setOrder([order[1] as OhmKey, k]);
  };

  const keys: OhmKey[] = ['V', 'I', 'R', 'P'];
  const res = calc.res;
  const summary = res ? keys.map((k) => `${OHM_META[k].name}: ${formatSI(res[k], OHM_META[k].unit, 5)}`).join('\n') : '';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Enter any two values">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRaw({ V: '', I: '20m', R: '', P: '0.5' });
              setOrder(['I', 'P']);
            }}
          >
            Example: 20 mA, 0.5 W
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRaw({ V: '12', I: '', R: '470', P: '' });
              setOrder(['V', 'R']);
            }}
          >
            Reset
          </Button>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {keys.map((k) => {
            const meta = OHM_META[k];
            const active = order.includes(k);
            const shown = active ? raw[k] : res ? formatSI(res[k], meta.unit, 5) : '';
            return (
              <Field key={k} label={`${meta.name} (${k})`} hint={active ? meta.hint : 'calculated, type to override'}>
                <TextBox
                  value={shown}
                  onChange={(v) => onChange(k, v)}
                  onFocus={(el) => {
                    if (!active) el.select();
                  }}
                  label={meta.name}
                  className={cn(!active && 'border-primary/40 bg-primary/10')}
                />
              </Field>
            );
          })}
        </div>
        <div className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Type values with prefixes: <span className="font-mono">m</span> milli, <span className="font-mono">k</span> kilo,{' '}
          <span className="font-mono">M</span> mega, <span className="font-mono">µ</span> or <span className="font-mono">u</span> micro,
          for example <span className="font-mono">4.7k</span>, <span className="font-mono">20mA</span>, <span className="font-mono">150µ</span>. The
          two most recently edited fields are the inputs.
        </div>
      </Panel>
      <ErrorBanner error={calc.error} />
      {res && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {keys.map((k) => (
              <BigStat
                key={k}
                label={`${OHM_META[k].name} (${k})`}
                value={formatSI(res[k], OHM_META[k].unit, 5)}
                sub={order.includes(k) ? 'given' : 'calculated'}
              />
            ))}
          </div>
          <Panel>
            <PanelHeader title="Formulas used">
              <CopyButton value={summary} label="Copy results" />
            </PanelHeader>
            <div className="space-y-1 p-3 font-mono text-sm">
              {res.formulas.map((f) => (
                <div key={f.target}>{f.text}</div>
              ))}
            </div>
          </Panel>
        </>
      )}
      <Panel>
        <PanelHeader title="Power wheel (all 12 formulas)" />
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {keys.map((k) => (
            <div key={k} className="bg-card p-3">
              <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {OHM_META[k].name} ({k}) =
              </div>
              <ul className="space-y-0.5 font-mono text-sm">
                {OHM_FORMS[k].map((f) => {
                  const used = res?.formulas.some((u) => u.target === k && u.text.endsWith(f));
                  return (
                    <li key={f} className={cn(used && 'font-semibold text-primary')}>
                      {f}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ================================================================== colour code

const BAND_X: Record<BandCount, number[]> = {
  4: [96, 126, 156, 236],
  5: [86, 112, 138, 164, 238],
  6: [82, 106, 130, 154, 212, 240],
};

function ResistorSvg({ bands, count }: { bands: BandColor[]; count: BandCount }) {
  const xs = BAND_X[count];
  return (
    <svg viewBox="0 0 340 110" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Resistor with colour bands">
      <line x1="6" y1="55" x2="72" y2="55" stroke="#9aa0a6" strokeWidth="5" strokeLinecap="round" />
      <line x1="268" y1="55" x2="334" y2="55" stroke="#9aa0a6" strokeWidth="5" strokeLinecap="round" />
      <defs>
        <clipPath id="resistor-body-clip">
          <path d="M70 30 Q58 30 58 42 Q58 55 70 55 Q58 55 58 68 Q58 80 70 80 L270 80 Q282 80 282 68 Q282 55 270 55 Q282 55 282 42 Q282 30 270 30 Z" />
        </clipPath>
      </defs>
      <path
        d="M70 30 Q58 30 58 42 Q58 55 70 55 Q58 55 58 68 Q58 80 70 80 L270 80 Q282 80 282 68 Q282 55 270 55 Q282 55 282 42 Q282 30 270 30 Z"
        fill="#d9c7a1"
        stroke="#8a7a58"
        strokeWidth="1.5"
      />
      <g clipPath="url(#resistor-body-clip)">
        {xs.map((x, k) => {
          const c = bands[k] ?? 'black';
          if (c === 'none') return null;
          return (
            <rect
              key={k}
              x={x - 7}
              y={26}
              width={14}
              height={58}
              fill={COLOR_HEX[c]}
              stroke={c === 'white' || c === 'yellow' ? '#8a7a58' : 'none'}
              strokeWidth="0.8"
            />
          );
        })}
      </g>
      <path
        d="M70 30 Q58 30 58 42 Q58 55 70 55 Q58 55 58 68 Q58 80 70 80 L270 80 Q282 80 282 68 Q282 55 270 55 Q282 55 282 42 Q282 30 270 30 Z"
        fill="none"
        stroke="#8a7a58"
        strokeWidth="1.5"
      />
      {xs.map((x, k) => (
        <text key={k} x={x} y={100} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
          {k + 1}
        </text>
      ))}
    </svg>
  );
}

function bandRoles(count: BandCount): { label: string; colors: BandColor[]; kind: 'digit' | 'mult' | 'tol' | 'tempco' }[] {
  const digits = count === 4 ? 2 : 3;
  const out: { label: string; colors: BandColor[]; kind: 'digit' | 'mult' | 'tol' | 'tempco' }[] = [];
  for (let k = 0; k < digits; k++) {
    out.push({ label: `${['1st', '2nd', '3rd'][k]} digit`, colors: DIGIT_COLORS, kind: 'digit' });
  }
  out.push({ label: 'Multiplier', colors: MULTIPLIER_COLORS, kind: 'mult' });
  out.push({ label: 'Tolerance', colors: TOLERANCE_COLORS, kind: 'tol' });
  if (count === 6) out.push({ label: 'Temp. coefficient', colors: TEMPCO_COLORS, kind: 'tempco' });
  return out;
}

function swatchTitle(c: BandColor, kind: 'digit' | 'mult' | 'tol' | 'tempco'): string {
  if (kind === 'digit') return `${c} = ${digitOf(c)}`;
  if (kind === 'mult') {
    const e = multiplierExponent(c);
    return `${c} = ×${e >= 0 ? `10^${e}` : e === -1 ? '0.1' : '0.01'}`;
  }
  if (kind === 'tol') return `${c} = ±${TOLERANCE_PCT[c]}%`;
  return `${c} = ${TEMPCO_PPM[c]} ppm/K`;
}

function Swatch({
  color,
  selected,
  title,
  onClick,
}: {
  color: BandColor;
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative size-6 shrink-0 rounded-full border border-black/30 transition-transform dark:border-white/40 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-105',
        color === 'none' && 'border-dashed bg-transparent'
      )}
      style={color === 'none' ? undefined : { backgroundColor: COLOR_HEX[color] }}
    >
      {color === 'none' && <span className="text-2xs text-muted-foreground">–</span>}
    </button>
  );
}

const TOL_OPTIONS = TOLERANCE_COLORS.map((c) => ({ value: String(TOLERANCE_PCT[c]), label: `±${TOLERANCE_PCT[c]} % (${c})` }));

function defaultBands(count: BandCount): BandColor[] {
  if (count === 4) return ['yellow', 'violet', 'red', 'gold'];
  if (count === 5) return ['brown', 'black', 'black', 'red', 'brown'];
  return ['brown', 'black', 'black', 'red', 'brown', 'red'];
}

function ohmsText(ohms: number): string {
  return formatPlain(ohms, 6);
}

function ColorTab() {
  const [count, setCount] = useState<BandCount>(4);
  const [bands, setBands] = useState<BandColor[]>(defaultBands(4));
  const [valueText, setValueText] = useState('4.7k');
  const [valueNote, setValueNote] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);
  const [series, setSeries] = useState<ESeriesName>('E24');
  const [smdText, setSmdText] = useState('472');

  const decoded = useMemo(() => {
    try {
      return { d: decodeBands(bands, count), error: null as string | null };
    } catch (e) {
      return { d: null, error: errMsg(e) };
    }
  }, [bands, count]);

  const d = decoded.d;
  const tolBandIndex = count === 4 ? 3 : 4;
  const tolPct = TOLERANCE_PCT[bands[tolBandIndex] ?? 'gold'] ?? 5;
  const tempco = count === 6 ? (TEMPCO_PPM[bands[5] ?? 'brown'] ?? 100) : undefined;

  const setBand = (idx: number, color: BandColor) => {
    const next = bands.slice();
    next[idx] = color;
    setBands(next);
    try {
      const dd = decodeBands(next, count);
      setValueText(ohmsText(dd.ohms));
    } catch {
      /* keep text */
    }
    setValueNote(null);
    setValueError(null);
  };

  const applyOhms = (ohms: number, n: BandCount, tol: number, tc?: number) => {
    const enc = encodeBands(ohms, n, tol, tc);
    setBands(enc.bands);
    setValueNote(
      enc.exact
        ? null
        : `${formatSI(ohms, 'Ω', 5)} cannot be shown exactly with ${n} bands. The closest is ${formatSI(enc.ohms, 'Ω', 5)} (${enc.errorPct > 0 ? '+' : ''}${enc.errorPct.toFixed(2)} %).${n === 4 ? ' Try 5 bands for three significant digits.' : ''}`
    );
  };

  const onValueText = (t: string) => {
    setValueText(t);
    setValueError(null);
    setValueNote(null);
    if (t.trim() === '') return;
    const v = parseSI(t, 'ohm');
    if (Number.isNaN(v) || v < 0) {
      setValueError(`Could not read "${t}" as a resistance. Try 4.7k, 4k7, 470R or 2M2.`);
      return;
    }
    try {
      applyOhms(v, count, tolPct, tempco);
    } catch (e) {
      setValueError(errMsg(e));
    }
  };

  const changeCount = (n: BandCount) => {
    if (n === count) return;
    const typed = parseSI(valueText, 'ohm');
    const ohms = !Number.isNaN(typed) && typed >= 0 && valueText.trim() !== '' ? typed : d ? d.ohms : 4700;
    try {
      const enc = encodeBands(ohms, n, tolPct, tempco ?? 100);
      setBands(enc.bands);
      setValueNote(
        enc.exact
          ? null
          : `${formatSI(ohms, 'Ω', 5)} is not exactly representable with ${n} bands; showing ${formatSI(enc.ohms, 'Ω', 5)} (${enc.errorPct > 0 ? '+' : ''}${enc.errorPct.toFixed(2)} %).`
      );
    } catch {
      setBands(defaultBands(n));
    }
    setCount(n);
  };

  const roles = bandRoles(count);
  const ohmsForStd = d && d.ohms > 0 ? d.ohms : null;
  const std = useMemo(() => {
    if (ohmsForStd === null) return null;
    try {
      return nearestStandard(ohmsForStd, series);
    } catch {
      return null;
    }
  }, [ohmsForStd, series]);

  const applyValue = (v: number) => {
    setValueText(ohmsText(v));
    setValueError(null);
    try {
      applyOhms(v, count, tolPct, tempco);
    } catch (e) {
      setValueError(errMsg(e));
    }
  };

  const smd = useMemo(() => {
    if (smdText.trim() === '') return { r: null, error: null as string | null };
    try {
      return { r: decodeSmd(smdText), error: null as string | null };
    } catch (e) {
      return { r: null, error: errMsg(e) };
    }
  }, [smdText]);

  const smdCodes = useMemo(() => {
    if (!d) return [];
    try {
      return encodeSmd(d.ohms);
    } catch {
      return [];
    }
  }, [d]);

  const bandNames = bands.slice(0, count).join(', ');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Colour bands">
            <Tabs value={String(count)} onValueChange={(v) => changeCount(Number(v) as BandCount)}>
              <TabsList className="h-7">
                <TabsTrigger value="4">4-band</TabsTrigger>
                <TabsTrigger value="5">5-band</TabsTrigger>
                <TabsTrigger value="6">6-band</TabsTrigger>
              </TabsList>
            </Tabs>
          </PanelHeader>
          <div className="space-y-3 p-3">
            <ResistorSvg bands={bands} count={count} />
            {roles.map((role, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {idx + 1}. {role.label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {role.colors.map((c) => (
                    <Swatch
                      key={c}
                      color={c}
                      selected={bands[idx] === c}
                      title={swatchTitle(c, role.kind)}
                      onClick={() => setBand(idx, c)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Value" />
            <div className="space-y-3 p-3">
              <ErrorBanner error={decoded.error} />
              {d && (
                <div className="grid grid-cols-2 gap-3">
                  <BigStat label="Resistance" value={formatSI(d.ohms, 'Ω', 5)} sub={`${formatPlain(d.ohms, 8)} Ω`} />
                  <BigStat
                    label="Tolerance"
                    value={`±${d.tolerancePct} %`}
                    sub={`${formatSI(d.min, 'Ω', 4)} to ${formatSI(d.max, 'Ω', 4)}`}
                  />
                  {d.tempcoPpm !== null && <BigStat label="Temp. coefficient" value={`${d.tempcoPpm} ppm/K`} />}
                </div>
              )}
              {d && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate font-mono">{bandNames}</span>
                  <CopyButton
                    value={`${formatSI(d.ohms, 'Ω', 5)} ±${d.tolerancePct}%${d.tempcoPpm !== null ? `, ${d.tempcoPpm} ppm/K` : ''} (${bandNames})`}
                  />
                </div>
              )}
              <Field label="Or type a value to get the bands" hint="4.7k, 4k7, 470R, 2M2, 0.22, 100">
                <TextBox value={valueText} onChange={onValueText} label="Resistance value" placeholder="4.7k" />
              </Field>
              <ErrorBanner error={valueError} />
              {valueNote && <Note tone="warn">{valueNote}</Note>}
              <Field label="Tolerance for the bands" className="max-w-xs">
                <SimpleSelect
                  value={String(tolPct)}
                  onChange={(v) => {
                    const c = TOLERANCE_COLORS.find((x) => String(TOLERANCE_PCT[x]) === v);
                    if (c) setBand(tolBandIndex, c);
                  }}
                  options={TOL_OPTIONS}
                  label="Tolerance"
                />
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Nearest standard value">
              <SimpleSelect
                value={series}
                onChange={(v) => setSeries(v as ESeriesName)}
                options={(Object.keys(E_SERIES) as ESeriesName[]).map((s) => ({ value: s, label: `${s} (${E_SERIES[s].length} per decade)` }))}
                className="h-7 w-44"
                label="E-series"
              />
            </PanelHeader>
            <div className="space-y-2 p-3 text-sm">
              {std && ohmsForStd !== null ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Nearest {series}:{' '}
                      <span className="font-mono font-semibold">{formatSI(std.value, 'Ω', 4)}</span>{' '}
                      <span className={cn('font-mono text-xs', Math.abs(std.errorPct) < 1e-9 ? 'text-success' : 'text-muted-foreground')}>
                        {Math.abs(std.errorPct) < 1e-9
                          ? 'exact match'
                          : `error ${std.errorPct > 0 ? '+' : ''}${std.errorPct.toFixed(2)} %`}
                      </span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => applyValue(std.value)}>
                      Use this value
                    </Button>
                  </div>
                  {std.lower !== std.upper && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <button type="button" className="rounded border px-2 py-1 font-mono hover:bg-muted" onClick={() => applyValue(std.lower)}>
                        below: {formatSI(std.lower, 'Ω', 4)}
                      </button>
                      <button type="button" className="rounded border px-2 py-1 font-mono hover:bg-muted" onClick={() => applyValue(std.upper)}>
                        above: {formatSI(std.upper, 'Ω', 4)}
                      </button>
                    </div>
                  )}
                  <div className="text-2xs text-muted-foreground">
                    {series} parts are usually sold at {E_SERIES_TOLERANCE[series]} tolerance.
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Pick a non-zero resistance first.</span>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader title="SMD resistor code decoder" />
        <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Marking on the part" hint="472, 1002, 4R7, R47, 01C (EIA-96), 000">
              <TextBox value={smdText} onChange={setSmdText} label="SMD code" placeholder="472" />
            </Field>
            <ErrorBanner error={smd.error} />
            {smd.r && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <BigStat label="Resistance" value={formatSI(smd.r.ohms, 'Ω', 5)} sub={`${formatPlain(smd.r.ohms, 8)} Ω`} />
                  <BigStat label={smd.r.scheme} value={smd.r.tolerance} sub="typical tolerance" compact />
                </div>
                <p className="text-xs text-muted-foreground">{smd.r.explanation}</p>
                {smd.r.alternative && <Note tone="warn">{smd.r.alternative}</Note>}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marking codes for the resistor above ({d ? formatSI(d.ohms, 'Ω', 4) : '-'})
            </div>
            {smdCodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No exact marking exists for this value.</p>
            ) : (
              <div className="divide-y rounded-md border">
                {smdCodes.map((c) => (
                  <div key={c.scheme} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{c.scheme}</span>
                    <button
                      type="button"
                      className="font-mono font-semibold hover:underline"
                      onClick={() => setSmdText(c.code)}
                      title="Decode this code"
                    >
                      {c.code}
                    </button>
                    {c.note && <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{c.note}</span>}
                    <CopyButton value={c.code} size="icon-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <StatBar className="h-auto min-h-7 py-1" items={['3-digit: 2 digits + power of ten', '4-digit: 3 digits + power of ten', 'EIA-96: 2-digit E96 index + letter multiplier (1 %)', 'R marks the decimal point']} />
      </Panel>
    </div>
  );
}

// ================================================================== series / parallel

function CombineTab() {
  const [kind, setKind] = useState<PassiveKind>('R');
  const [text, setText] = useState('100\n220\n330\n4.7k');
  const meta = PASSIVE_UNIT[kind];

  const calc = useMemo(() => {
    try {
      const values = parseValueList(text, meta.kind);
      if (values.length === 0) throw new Error(`Enter at least one value (for example 100, 4.7k, 1M).`);
      if (values.length > 500) throw new Error('Too many values (limit 500).');
      return { values, res: combine(values, kind), error: null as string | null };
    } catch (e) {
      return { values: [], res: null, error: errMsg(e) };
    }
  }, [text, kind, meta.kind]);

  const res = calc.res;
  const sym = kind;
  const seriesF = kind === 'C' ? `1 / (1/${sym}1 + 1/${sym}2 + ...)` : `${sym}1 + ${sym}2 + ...`;
  const parF = kind === 'C' ? `${sym}1 + ${sym}2 + ...` : `1 / (1/${sym}1 + 1/${sym}2 + ...)`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Components">
            <Tabs value={kind} onValueChange={(v) => setKind(v as PassiveKind)}>
              <TabsList className="h-7">
                <TabsTrigger value="R">Resistors</TabsTrigger>
                <TabsTrigger value="C">Capacitors</TabsTrigger>
                <TabsTrigger value="L">Inductors</TabsTrigger>
              </TabsList>
            </Tabs>
          </PanelHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="Component values"
            className="min-h-[180px] rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
            placeholder={kind === 'R' ? '100\n4.7k\n1M' : kind === 'C' ? '100n\n2.2µ\n10pF' : '10µ\n100m\n1mH'}
          />
          <div className="flex flex-wrap gap-2 border-t bg-muted/20 px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => setText(kind === 'R' ? '100\n220\n330\n4.7k' : kind === 'C' ? '100n\n220n\n2.2µ' : '10µ\n22µ\n100µ')}>
              Sample
            </Button>
            <span className="self-center text-xs text-muted-foreground">One value per line, or separated by commas or spaces. Prefixes: p n µ m k M.</span>
          </div>
        </Panel>
        <div className="space-y-3">
          <ErrorBanner error={calc.error} />
          {res && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BigStat label="In series" value={formatSI(res.series, meta.unit, 5)} sub={seriesF} />
                <BigStat label="In parallel" value={formatSI(res.parallel, meta.unit, 5)} sub={parF} />
              </div>
              <Panel>
                <PanelHeader title="Details">
                  <CopyButton
                    value={`${meta.name} (${calc.values.length}): ${calc.values.map((v) => formatSI(v, meta.unit, 4)).join(', ')}\nSeries: ${formatSI(res.series, meta.unit, 6)}\nParallel: ${formatSI(res.parallel, meta.unit, 6)}`}
                  />
                </PanelHeader>
                <div className="space-y-1 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Count</span><span className="font-mono">{calc.values.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Series (exact)</span><span className="font-mono">{formatPlain(res.series, 8)} {meta.unit}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Parallel (exact)</span><span className="font-mono">{formatPlain(res.parallel, 8)} {meta.unit}</span></div>
                </div>
              </Panel>
              {kind === 'L' && <Note>Ideal inductors without mutual coupling; coupled coils add or subtract mutual inductance.</Note>}
              {kind === 'C' && <Note>Capacitors in parallel add; in series the reciprocals add, so the total is smaller than the smallest part.</Note>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================== voltage divider

type DividerMode = 'vout' | 'r2' | 'r1';

function DividerSvg({ r1, r2, vout, load }: { r1: string; r2: string; vout: string; load: boolean }) {
  return (
    <svg viewBox="0 0 280 230" className="mx-auto h-auto w-full max-w-xs" role="img" aria-label="Voltage divider schematic">
      <g className="stroke-foreground" fill="none" strokeWidth="1.6" strokeLinecap="round">
        <line x1="90" y1="14" x2="90" y2="36" />
        <rect x="76" y="36" width="28" height="56" />
        <line x1="90" y1="92" x2="90" y2="112" />
        <line x1="90" y1="112" x2="90" y2="122" />
        <rect x="76" y="122" width="28" height="56" />
        <line x1="90" y1="178" x2="90" y2="204" />
        <line x1="76" y1="204" x2="104" y2="204" />
        <line x1="82" y1="210" x2="98" y2="210" />
        <line x1="86" y1="216" x2="94" y2="216" />
        <line x1="90" y1="112" x2="170" y2="112" />
        {load && (
          <>
            <line x1="170" y1="112" x2="170" y2="130" />
            <rect x="156" y="130" width="28" height="48" />
            <line x1="170" y1="178" x2="170" y2="204" />
            <line x1="90" y1="204" x2="170" y2="204" />
          </>
        )}
      </g>
      <circle cx="90" cy="112" r="3" className="fill-foreground" />
      <circle cx="170" cy="112" r="3" className="fill-foreground" />
      <g className="fill-foreground" fontSize="11" fontFamily="ui-monospace, monospace">
        <text x="96" y="12">Vin</text>
        <text x="40" y="68" textAnchor="end">R1</text>
        <text x="40" y="154" textAnchor="end">R2</text>
        <text x="176" y="106">Vout</text>
        {load && <text x="196" y="158">RL</text>}
      </g>
      <g className="fill-muted-foreground" fontSize="10" fontFamily="ui-monospace, monospace">
        <text x="40" y="80" textAnchor="end">{r1}</text>
        <text x="40" y="166" textAnchor="end">{r2}</text>
        <text x="176" y="94">{vout}</text>
      </g>
    </svg>
  );
}

function DividerTab() {
  const [mode, setMode] = useState<DividerMode>('vout');
  const [vin, setVin] = useState('5');
  const [r1, setR1] = useState('10k');
  const [r2, setR2] = useState('4.7k');
  const [vtarget, setVtarget] = useState('3.3');
  const [load, setLoad] = useState('');

  const calc = useMemo(() => {
    try {
      const vi = parseSI(vin, 'V');
      if (Number.isNaN(vi)) throw new Error('Enter a valid input voltage.');
      const rl = load.trim() === '' ? undefined : parseSI(load, 'ohm');
      if (rl !== undefined && (Number.isNaN(rl) || rl <= 0)) throw new Error('Load resistance must be a positive value (or leave it empty).');
      if (mode === 'vout') {
        const a = parseSI(r1, 'ohm');
        const b = parseSI(r2, 'ohm');
        if (Number.isNaN(a) || Number.isNaN(b)) throw new Error('Enter valid values for R1 and R2.');
        const d = divider(vi, a, b, rl);
        const unloaded = rl === undefined ? null : divider(vi, a, b).vout;
        return { mode, r1: a, r2: b, d, unloaded, solved: null as number | null, std: null as null | { e24: number; e96: number; v24: number; v96: number }, error: null as string | null };
      }
      const vt = parseSI(vtarget, 'V');
      if (Number.isNaN(vt)) throw new Error('Enter a valid target output voltage.');
      if (mode === 'r2') {
        const a = parseSI(r1, 'ohm');
        if (Number.isNaN(a)) throw new Error('Enter a valid value for R1.');
        const solved = solveR2(vi, a, vt, rl);
        const e24 = nearestStandard(solved, 'E24').value;
        const e96 = nearestStandard(solved, 'E96').value;
        return {
          mode,
          r1: a,
          r2: solved,
          d: divider(vi, a, solved, rl),
          unloaded: null,
          solved,
          std: { e24, e96, v24: divider(vi, a, e24, rl).vout, v96: divider(vi, a, e96, rl).vout },
          error: null as string | null,
        };
      }
      const b = parseSI(r2, 'ohm');
      if (Number.isNaN(b)) throw new Error('Enter a valid value for R2.');
      const solved = solveR1(vi, b, vt, rl);
      const e24 = nearestStandard(solved, 'E24').value;
      const e96 = nearestStandard(solved, 'E96').value;
      return {
        mode,
        r1: solved,
        r2: b,
        d: divider(vi, solved, b, rl),
        unloaded: null,
        solved,
        std: { e24, e96, v24: divider(vi, e24, b, rl).vout, v96: divider(vi, e96, b, rl).vout },
        error: null as string | null,
      };
    } catch (e) {
      return { mode, r1: 0, r2: 0, d: null, unloaded: null, solved: null, std: null, error: errMsg(e) };
    }
  }, [mode, vin, r1, r2, vtarget, load]);

  const d = calc.d;
  const solvedLabel = mode === 'r2' ? 'R2' : 'R1';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <OptionsBar>
            <Field label="Solve for">
              <Tabs value={mode} onValueChange={(v) => setMode(v as DividerMode)}>
                <TabsList>
                  <TabsTrigger value="vout">Vout</TabsTrigger>
                  <TabsTrigger value="r2">R2</TabsTrigger>
                  <TabsTrigger value="r1">R1</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Vin">
              <TextBox value={vin} onChange={setVin} className="w-24" label="Input voltage" />
            </Field>
            <Field label="R1 (top)">
              <TextBox
                value={mode === 'r1' ? (d ? formatSI(calc.r1, '', 5) : '') : r1}
                onChange={setR1}
                readOnly={mode === 'r1'}
                className={cn('w-28', mode === 'r1' && 'border-primary/40 bg-primary/10')}
                label="R1"
              />
            </Field>
            <Field label="R2 (bottom)">
              <TextBox
                value={mode === 'r2' ? (d ? formatSI(calc.r2, '', 5) : '') : r2}
                onChange={setR2}
                readOnly={mode === 'r2'}
                className={cn('w-28', mode === 'r2' && 'border-primary/40 bg-primary/10')}
                label="R2"
              />
            </Field>
            {mode !== 'vout' && (
              <Field label="Target Vout">
                <TextBox value={vtarget} onChange={setVtarget} className="w-24" label="Target output voltage" />
              </Field>
            )}
            <Field label="Load RL (optional)" hint="across R2">
              <TextBox value={load} onChange={setLoad} className="w-28" placeholder="none" label="Load resistance" />
            </Field>
          </OptionsBar>
          <ErrorBanner error={calc.error} />
          {d && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {mode === 'vout' ? (
                  <BigStat label="Vout" value={formatSI(d.vout, 'V', 5)} sub={calc.unloaded !== null ? `unloaded ${formatSI(calc.unloaded, 'V', 5)}` : `${(d.ratio * 100).toPrecision(4)} % of Vin`} />
                ) : (
                  <BigStat label={`Required ${solvedLabel}`} value={formatSI(calc.solved ?? 0, 'Ω', 5)} sub={`Vout = ${formatSI(d.vout, 'V', 5)}`} />
                )}
                <BigStat label="Divider current" value={formatSI(d.current, 'A', 4)} sub={`R2 in parallel with load: ${formatSI(d.r2Effective, 'Ω', 4)}`} />
                <BigStat label="Power" value={formatSI(d.powerR1 + d.powerR2 + d.powerLoad, 'W', 4)} sub={`R1 ${formatSI(d.powerR1, 'W', 3)}, R2 ${formatSI(d.powerR2, 'W', 3)}${d.powerLoad > 0 ? `, load ${formatSI(d.powerLoad, 'W', 3)}` : ''}`} />
              </div>
              {calc.std && (
                <Panel>
                  <PanelHeader title={`Nearest standard values for ${solvedLabel}`} />
                  <div className="divide-y text-sm">
                    {[
                      { s: 'E24', v: calc.std.e24, vo: calc.std.v24 },
                      { s: 'E96', v: calc.std.e96, vo: calc.std.v96 },
                    ].map((row) => (
                      <div key={row.s} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                        <span className="w-12 text-xs text-muted-foreground">{row.s}</span>
                        <span className="font-mono font-semibold">{formatSI(row.v, 'Ω', 4)}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          gives Vout = {formatSI(row.vo, 'V', 4)} ({(((row.vo - Number(parseSI(vtarget, 'V'))) / Number(parseSI(vtarget, 'V'))) * 100).toFixed(2)} % off)
                        </span>
                        <CopyButton value={formatPlain(row.v, 5)} size="icon-sm" />
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
              <Note>
                Vout = Vin × R2 / (R1 + R2). With a load, R2 is replaced by R2 ∥ RL. Pick resistors well below the load impedance, and
                check the power ratings above.
              </Note>
            </>
          )}
        </div>
        <Panel className="self-start">
          <PanelHeader title="Schematic" />
          <div className="p-3">
            <DividerSvg
              r1={d ? formatSI(calc.r1, 'Ω', 3) : ''}
              r2={d ? formatSI(calc.r2, 'Ω', 3) : ''}
              vout={d ? formatSI(d.vout, 'V', 3) : ''}
              load={load.trim() !== ''}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ================================================================== LED resistor

const LED_PRESETS: { value: string; label: string; vf: number }[] = [
  { value: 'ir', label: 'Infrared (1.2 V)', vf: 1.2 },
  { value: 'red', label: 'Red (2.0 V)', vf: 2.0 },
  { value: 'orange', label: 'Orange (2.0 V)', vf: 2.0 },
  { value: 'yellow', label: 'Yellow (2.1 V)', vf: 2.1 },
  { value: 'green', label: 'Green (2.2 V)', vf: 2.2 },
  { value: 'bgreen', label: 'Bright green (3.2 V)', vf: 3.2 },
  { value: 'blue', label: 'Blue (3.2 V)', vf: 3.2 },
  { value: 'white', label: 'White (3.2 V)', vf: 3.2 },
  { value: 'uv', label: 'UV (3.4 V)', vf: 3.4 },
  { value: 'custom', label: 'Custom', vf: 0 },
];

function LedTab() {
  const [vs, setVs] = useState('5');
  const [vf, setVf] = useState('2');
  const [preset, setPreset] = useState('red');
  const [ma, setMa] = useState('20');
  const [n, setN] = useState('1');
  const [series, setSeries] = useState<'E12' | 'E24' | 'exact'>('E12');

  const calc = useMemo(() => {
    try {
      const vsV = parseSI(vs, 'V');
      const vfV = parseSI(vf, 'V');
      const i = parseSI(ma.trim() === '' ? '' : /[a-zA-Zµ]/.test(ma) ? ma : `${ma}m`, 'A');
      const nn = Number(n);
      if ([vsV, vfV, i].some(Number.isNaN)) throw new Error('Enter valid numbers for the supply voltage, LED voltage and current.');
      return { r: ledResistor(vsV, vfV, nn, i, series), error: null as string | null };
    } catch (e) {
      return { r: null, error: errMsg(e) };
    }
  }, [vs, vf, ma, n, series]);

  const r = calc.r;
  const nn = Number(n);

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Supply voltage">
          <TextBox value={vs} onChange={setVs} className="w-24" label="Supply voltage" />
        </Field>
        <Field label="LED type" className="w-48">
          <SimpleSelect
            value={preset}
            onChange={(v) => {
              setPreset(v);
              const p = LED_PRESETS.find((x) => x.value === v);
              if (p && p.vf > 0) setVf(String(p.vf));
            }}
            options={LED_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            label="LED colour preset"
          />
        </Field>
        <Field label="Forward voltage Vf">
          <TextBox
            value={vf}
            onChange={(v) => {
              setVf(v);
              setPreset('custom');
            }}
            className="w-24"
            label="LED forward voltage"
          />
        </Field>
        <Field label="Current (mA)">
          <TextBox value={ma} onChange={setMa} className="w-24" label="LED current in milliamps" />
        </Field>
        <Field label="LEDs in series">
          <TextBox value={n} onChange={setN} className="w-20" label="Number of LEDs in series" />
        </Field>
        <Field label="Use value from" className="w-36">
          <SimpleSelect
            value={series}
            onChange={(v) => setSeries(v as 'E12' | 'E24' | 'exact')}
            options={[
              { value: 'E12', label: 'E12 series' },
              { value: 'E24', label: 'E24 series' },
              { value: 'exact', label: 'Exact value' },
            ]}
            label="Resistor series"
          />
        </Field>
      </OptionsBar>
      <ErrorBanner error={calc.error} />
      {r && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BigStat label="Exact resistor" value={formatSI(r.rExact, 'Ω', 5)} sub={`(${vs} V - ${formatPlain(r.totalLedVf, 4)} V) / ${ma} mA`} />
            <BigStat
              label="Next standard value up"
              value={formatSI(series === 'E24' ? r.rE24 : r.rE12, 'Ω', 4)}
              sub={`${series === 'E24' ? 'E24' : 'E12'}; the other series gives ${formatSI(series === 'E24' ? r.rE12 : r.rE24, 'Ω', 4)}`}
            />
            <BigStat label="Actual LED current" value={formatSI(r.currentActual, 'A', 4)} sub={`with ${formatSI(r.rUsed, 'Ω', 4)}`} />
            <BigStat
              label="Resistor power"
              value={formatSI(r.resistorPower, 'W', 4)}
              sub={r.recommendedWatts !== null ? `use at least a ${formatPlain(r.recommendedWatts, 4)} W resistor (2x margin)` : 'above 25 W: use a power resistor'}
              tone={r.recommendedWatts !== null && r.recommendedWatts > 1 ? 'warn' : undefined}
            />
          </div>
          <Panel>
            <PanelHeader title="Summary">
              <CopyButton
                value={`Supply ${vs} V, ${nn} LED(s) at ${vf} V, ${ma} mA\nResistor: ${formatSI(r.rExact, 'Ω', 5)} exact, ${formatSI(r.rUsed, 'Ω', 4)} standard\nCurrent: ${formatSI(r.currentActual, 'A', 4)}\nResistor dissipation: ${formatSI(r.resistorPower, 'W', 4)} (rating ${r.recommendedWatts ?? '>25'} W)`}
              />
            </PanelHeader>
            <div className="divide-y text-sm">
              {(
                [
                  ['Total LED voltage drop', formatSI(r.totalLedVf, 'V', 4)],
                  ['Voltage across the resistor', formatSI(vsMinus(vs, r.totalLedVf), 'V', 4)],
                  ['Total power from supply', formatSI(r.totalPower, 'W', 4)],
                  ['Share of power that reaches the LEDs', `${r.efficiencyPct.toFixed(1)} %`],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Note>
            R = (Vsupply - n × Vf) / I. Round up to the next standard value so the current stays at or below your target. Forward voltages
            are typical; check the datasheet. Strings of LEDs in parallel should each have their own resistor.
          </Note>
        </>
      )}
    </div>
  );
}

function vsMinus(vs: string, total: number): number {
  const v = parseSI(vs, 'V');
  return Number.isNaN(v) ? NaN : v - total;
}

// ================================================================== AC power

type AcMode = 'amps' | 'kw' | 'kva';

function AcTab() {
  const [phases, setPhases] = useState<'1' | '3'>('3');
  const [volts, setVolts] = useState('400');
  const [pf, setPf] = useState('0.85');
  const [given, setGiven] = useState<AcMode>('amps');
  const [value, setValue] = useState('50');
  const [targetPf, setTargetPf] = useState('0.95');
  const [kwIn, setKwIn] = useState('80');
  const [kvaIn, setKvaIn] = useState('100');

  const calc = useMemo(() => {
    try {
      const v = parseSI(volts, 'V');
      const p = Number(pf);
      const x = given === 'amps' ? parseSI(value, 'A') : Number(value);
      if (Number.isNaN(v)) throw new Error('Enter a valid voltage.');
      if (Number.isNaN(p) || pf.trim() === '') throw new Error('Enter a power factor between 0 and 1.');
      if (Number.isNaN(x) || value.trim() === '') throw new Error('Enter the known value.');
      const res = acPower(phases === '3' ? 3 : 1, v, p, given, x);
      let corr: number | null = null;
      const tp = Number(targetPf);
      if (targetPf.trim() !== '' && tp > p && tp <= 1) corr = pfCorrectionKvar(res.kw, p, tp);
      return { res, corr, error: null as string | null };
    } catch (e) {
      return { res: null, corr: null, error: errMsg(e) };
    }
  }, [phases, volts, pf, given, value, targetPf]);

  const pfCalc = useMemo(() => {
    try {
      const kw = Number(kwIn);
      const kva = Number(kvaIn);
      if (Number.isNaN(kw) || Number.isNaN(kva)) throw new Error('Enter kW and kVA.');
      const f = powerFactorFrom(kw, kva);
      return { pf: f, angle: (Math.acos(f) * 180) / Math.PI, kvar: Math.sqrt(Math.max(0, kva * kva - kw * kw)), error: null as string | null };
    } catch (e) {
      return { pf: 0, angle: 0, kvar: 0, error: errMsg(e) };
    }
  }, [kwIn, kvaIn]);

  const res = calc.res;
  const givenLabel = given === 'amps' ? 'Current (A)' : given === 'kw' ? 'Real power (kW)' : 'Apparent power (kVA)';

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="System">
          <Tabs value={phases} onValueChange={(v) => setPhases(v as '1' | '3')}>
            <TabsList>
              <TabsTrigger value="1">Single-phase</TabsTrigger>
              <TabsTrigger value="3">Three-phase</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label={phases === '3' ? 'Voltage (line-to-line)' : 'Voltage'}>
          <TextBox value={volts} onChange={setVolts} className="w-28" label="Voltage" />
        </Field>
        <Field label="Power factor">
          <TextBox value={pf} onChange={setPf} className="w-24" label="Power factor" />
        </Field>
        <Field label="I know">
          <Tabs value={given} onValueChange={(v) => setGiven(v as AcMode)}>
            <TabsList>
              <TabsTrigger value="amps">Amps</TabsTrigger>
              <TabsTrigger value="kw">kW</TabsTrigger>
              <TabsTrigger value="kva">kVA</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label={givenLabel}>
          <TextBox value={value} onChange={setValue} className="w-28" label={givenLabel} />
        </Field>
      </OptionsBar>
      <ErrorBanner error={calc.error} />
      {res && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <BigStat label="Current" value={formatSI(res.amps, 'A', 4)} sub={given === 'amps' ? 'given' : 'calculated'} />
            <BigStat label="Real power" value={`${formatPlain(res.kw, 5)} kW`} sub="P = S × PF" />
            <BigStat label="Apparent power" value={`${formatPlain(res.kva, 5)} kVA`} sub="S = V × I" />
            <BigStat label="Reactive power" value={`${formatPlain(res.kvar, 5)} kVAR`} sub="Q = √(S² - P²)" />
            <BigStat label="Phase angle" value={`${res.angleDeg.toFixed(2)}°`} sub={`cos φ = ${res.pf}`} />
          </div>
          <Panel>
            <PanelHeader title="Formulas">
              <CopyButton
                value={`${phases === '3' ? 'Three-phase' : 'Single-phase'} ${volts} V, PF ${pf}\nI = ${formatSI(res.amps, 'A', 5)}\nP = ${formatPlain(res.kw, 6)} kW\nS = ${formatPlain(res.kva, 6)} kVA\nQ = ${formatPlain(res.kvar, 6)} kVAR`}
              />
            </PanelHeader>
            <div className="space-y-1 p-3 font-mono text-sm">
              {phases === '3' ? (
                <>
                  <div>S (kVA) = √3 × V(L-L) × I / 1000</div>
                  <div>P (kW) = √3 × V(L-L) × I × PF / 1000</div>
                  <div>I (A) = kVA × 1000 / (√3 × V(L-L)) = kW × 1000 / (√3 × V × PF)</div>
                </>
              ) : (
                <>
                  <div>S (kVA) = V × I / 1000</div>
                  <div>P (kW) = V × I × PF / 1000</div>
                  <div>I (A) = kVA × 1000 / V = kW × 1000 / (V × PF)</div>
                </>
              )}
              <div>Q (kVAR) = S × sin(φ), with φ = arccos(PF)</div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Power factor correction" />
            <div className="flex flex-wrap items-end gap-4 p-3">
              <Field label="Target power factor">
                <TextBox value={targetPf} onChange={setTargetPf} className="w-24" label="Target power factor" />
              </Field>
              {calc.corr !== null ? (
                <div className="text-sm">
                  Capacitor bank needed:{' '}
                  <span className="font-mono font-semibold">{formatPlain(calc.corr, 5)} kVAR</span>{' '}
                  <span className="text-xs text-muted-foreground">
                    (Qc = P × (tan φ1 - tan φ2)); new apparent power {formatPlain(res.kw / Number(targetPf), 5)} kVA, current{' '}
                    {formatSI(((res.kw / Number(targetPf)) * 1000) / (res.factor * (parseSI(volts, 'V') || 1)), 'A', 4)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Enter a target above the present PF ({pf}) and up to 1.</span>
              )}
            </div>
          </Panel>
        </>
      )}
      <Panel>
        <PanelHeader title="Power factor from kW and kVA" />
        <div className="flex flex-wrap items-end gap-4 p-3">
          <Field label="Real power (kW)">
            <TextBox value={kwIn} onChange={setKwIn} className="w-28" label="Real power in kW" />
          </Field>
          <Field label="Apparent power (kVA)">
            <TextBox value={kvaIn} onChange={setKvaIn} className="w-28" label="Apparent power in kVA" />
          </Field>
          {pfCalc.error ? (
            <span className="text-xs text-destructive">{pfCalc.error}</span>
          ) : (
            <div className="text-sm">
              PF = <span className="font-mono font-semibold">{pfCalc.pf.toFixed(4)}</span>{' '}
              <span className="text-xs text-muted-foreground">
                (φ = {pfCalc.angle.toFixed(2)}°, {formatPlain(pfCalc.kvar, 5)} kVAR)
              </span>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ================================================================== wire voltage drop

function WireTab() {
  const [std, setStd] = useState<'awg' | 'mm2'>('awg');
  const [awg, setAwg] = useState('12');
  const [mm2, setMm2] = useState('2.5');
  const [material, setMaterial] = useState<Conductor>('copper');
  const [tempC, setTempC] = useState('20');
  const [length, setLength] = useState('30');
  const [lenUnit, setLenUnit] = useState<'m' | 'ft'>('m');
  const [amps, setAmps] = useState('15');
  const [volts, setVolts] = useState('120');
  const [phases, setPhases] = useState<'1' | '3'>('1');

  const calc = useMemo(() => {
    try {
      const area = std === 'awg' ? awgAreaMm2(Number(awg)) : Number(mm2);
      if (!Number.isFinite(area) || area <= 0) throw new Error('Enter a valid conductor size.');
      const len = Number(length);
      const a = parseSI(amps, 'A');
      const v = parseSI(volts, 'V');
      const t = Number(tempC);
      if ([len, a, v, t].some((x) => Number.isNaN(x))) throw new Error('Enter valid numbers for length, current, voltage and temperature.');
      const base = {
        material,
        tempC: t,
        lengthM: lenUnit === 'ft' ? len * FEET_TO_M : len,
        amps: a,
        volts: v,
        phases: phases === '3' ? (3 as const) : (1 as const),
      };
      const r = voltageDrop({ ...base, areaMm2: area });
      const min3 = std === 'awg' ? minAwgForDrop(base, 3) : minMetricForDrop(base, 3);
      const min5 = std === 'awg' ? minAwgForDrop(base, 5) : minMetricForDrop(base, 5);
      return { r, min3, min5, area, error: null as string | null };
    } catch (e) {
      return { r: null, min3: null, min5: null, area: 0, error: errMsg(e) };
    }
  }, [std, awg, mm2, material, tempC, length, lenUnit, amps, volts, phases]);

  const r = calc.r;
  const rho = resistivityAt(material, Number(tempC) || 20);
  const sizeLabel = (n: number | null) => (n === null ? 'none (even the largest is too small)' : std === 'awg' ? `AWG ${awgLabel(n)}` : `${n} mm²`);
  const tone = r ? (r.dropPct > 5 ? 'bad' : r.dropPct > 3 ? 'warn' : 'good') : undefined;

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Size standard">
          <Tabs value={std} onValueChange={(v) => setStd(v as 'awg' | 'mm2')}>
            <TabsList>
              <TabsTrigger value="awg">AWG</TabsTrigger>
              <TabsTrigger value="mm2">mm²</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {std === 'awg' ? (
          <Field label="Wire gauge" className="w-32">
            <SimpleSelect
              value={awg}
              onChange={setAwg}
              options={AWG_GAUGES.map((n) => ({ value: String(n), label: `AWG ${awgLabel(n)}` }))}
              label="AWG gauge"
            />
          </Field>
        ) : (
          <Field label="Cross-section" className="w-36">
            <SimpleSelect
              value={METRIC_SIZES_MM2.includes(Number(mm2)) ? mm2 : 'custom'}
              onChange={(v) => {
                if (v !== 'custom') setMm2(v);
              }}
              options={[...METRIC_SIZES_MM2.map((a) => ({ value: String(a), label: `${a} mm²` })), { value: 'custom', label: 'Custom (type below)' }]}
              label="Conductor cross-section"
            />
          </Field>
        )}
        {std === 'mm2' && (
          <Field label="Area (mm²)">
            <TextBox value={mm2} onChange={setMm2} className="w-24" label="Cross-section in square millimetres" />
          </Field>
        )}
        <Field label="Conductor" className="w-60">
          <SimpleSelect
            value={material}
            onChange={(v) => setMaterial(v as Conductor)}
            options={(Object.keys(CONDUCTORS) as Conductor[]).map((c) => ({ value: c, label: CONDUCTORS[c].name }))}
            label="Conductor material"
          />
        </Field>
        <Field label="Temp (°C)">
          <TextBox value={tempC} onChange={setTempC} className="w-20" label="Conductor temperature" />
        </Field>
      </OptionsBar>
      <OptionsBar>
        <Field label="System">
          <Tabs value={phases} onValueChange={(v) => setPhases(v as '1' | '3')}>
            <TabsList>
              <TabsTrigger value="1">Single-phase / DC</TabsTrigger>
              <TabsTrigger value="3">Three-phase</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="One-way length">
          <div className="flex gap-1.5">
            <TextBox value={length} onChange={setLength} className="w-24" label="One-way cable length" />
            <Tabs value={lenUnit} onValueChange={(v) => setLenUnit(v as 'm' | 'ft')}>
              <TabsList>
                <TabsTrigger value="m">m</TabsTrigger>
                <TabsTrigger value="ft">ft</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Field>
        <Field label="Current (A)">
          <TextBox value={amps} onChange={setAmps} className="w-24" label="Current" />
        </Field>
        <Field label={phases === '3' ? 'Voltage (line-to-line)' : 'Supply voltage'}>
          <TextBox value={volts} onChange={setVolts} className="w-24" label="Supply voltage" />
        </Field>
      </OptionsBar>
      <ErrorBanner error={calc.error} />
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BigStat label="Voltage drop" value={formatSI(r.dropV, 'V', 4)} sub={`${formatSI(r.loadVolts, 'V', 4)} left at the load`} tone={tone} />
            <BigStat
              label="Drop (% of supply)"
              value={`${r.dropPct.toFixed(2)} %`}
              sub={r.dropPct > 5 ? 'above 5 %: too much' : r.dropPct > 3 ? 'above 3 %: over the branch-circuit guideline' : 'within 3 %'}
              tone={tone}
            />
            <BigStat label="Resistance" value={`${formatPlain(r.resistancePerKm, 4)} Ω/km`} sub={`${formatSI(r.conductorOhms, 'Ω', 4)} per conductor over ${formatPlain(lenUnit === 'ft' ? Number(length) * FEET_TO_M : Number(length), 5)} m`} />
            <BigStat label="Cable loss" value={formatSI(r.powerLossW, 'W', 4)} sub="I²R in the conductors" />
          </div>
          {r.dropPct > 5 && <Note tone="warn">The drop is above 5 %, which is more than common guidelines allow for feeder plus branch circuit combined. Use a larger conductor or a shorter run.</Note>}
          {r.dropPct > 3 && r.dropPct <= 5 && <Note tone="warn">The drop is above 3 %, the usual guideline for a single branch circuit (5 % total for feeder plus branch).</Note>}
          <Panel>
            <PanelHeader title="Smallest conductor that stays within the limit" />
            <div className="divide-y text-sm">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Within 3 % drop</span>
                <span className="font-mono">{sizeLabel(calc.min3)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Within 5 % drop</span>
                <span className="font-mono">{sizeLabel(calc.min5)}</span>
              </div>
            </div>
            <StatBar className="h-auto min-h-7 py-1"
              items={[
                `${phases === '3' ? 'Vd = √3 × I × R × L' : 'Vd = 2 × I × R × L (out and back)'}`,
                `ρ = ${(rho * 1e8).toFixed(3)} × 10⁻⁸ Ω·m at ${Number(tempC) || 20} °C`,
                'resistive drop only (no reactance or power-factor effect)',
                'ampacity and code limits not checked',
              ]}
            />
          </Panel>
        </>
      )}

      <Panel>
        <PanelHeader title="AWG table (0000 to 40)">
          <CopyButton
            value={() =>
              [
                'AWG,diameter_mm,diameter_in,area_mm2,ohm_per_km,ohm_per_1000ft',
                ...AWG_GAUGES.map((n) => {
                  const a = awgAreaMm2(n);
                  const rk = resistancePerMetre(a, rho) * 1000;
                  return [awgLabel(n), awgDiameterMm(n).toFixed(4), (awgDiameterMm(n) / 25.4).toFixed(5), a.toFixed(4), rk.toFixed(4), (rk * 0.3048).toFixed(4)].join(',');
                }),
              ].join('\n')
            }
            label="Copy CSV"
          />
        </PanelHeader>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="sticky top-0 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">AWG</th>
                <th className="px-3 py-1.5 text-right font-medium">Diameter (mm)</th>
                <th className="px-3 py-1.5 text-right font-medium">Diameter (in)</th>
                <th className="px-3 py-1.5 text-right font-medium">Area (mm²)</th>
                <th className="px-3 py-1.5 text-right font-medium">Ω / km</th>
                <th className="px-3 py-1.5 text-right font-medium">Ω / 1000 ft</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {AWG_GAUGES.map((n) => {
                const a = awgAreaMm2(n);
                const rk = resistancePerMetre(a, rho) * 1000;
                const sel = std === 'awg' && Number(awg) === n;
                return (
                  <tr
                    key={n}
                    className={cn('cursor-pointer border-b last:border-0 hover:bg-muted/50', sel && 'bg-primary/10')}
                    onClick={() => {
                      setStd('awg');
                      setAwg(String(n));
                    }}
                  >
                    <td className="px-3 py-1">{awgLabel(n)}</td>
                    <td className="px-3 py-1 text-right">{awgDiameterMm(n).toFixed(3)}</td>
                    <td className="px-3 py-1 text-right">{(awgDiameterMm(n) / 25.4).toFixed(4)}</td>
                    <td className="px-3 py-1 text-right">{a.toFixed(3)}</td>
                    <td className="px-3 py-1 text-right">{formatPlain(rk, 4)}</td>
                    <td className="px-3 py-1 text-right">{formatPlain(rk * 0.3048, 4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <StatBar className="h-auto min-h-7 py-1" items={['d = 0.127 mm × 92^((36 - n) / 39)', `${CONDUCTORS[material].name}`, 'click a row to use that gauge']} />
      </Panel>
    </div>
  );
}

// ================================================================== root

export default function ElectricalCalculatorTool() {
  const [tab, setTab] = useState<TabId>('ohm');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="ohm">Ohm&apos;s law</TabsTrigger>
        <TabsTrigger value="color">Resistor colours &amp; SMD</TabsTrigger>
        <TabsTrigger value="combine">Series / parallel</TabsTrigger>
        <TabsTrigger value="divider">Voltage divider</TabsTrigger>
        <TabsTrigger value="led">LED resistor</TabsTrigger>
        <TabsTrigger value="ac">AC power</TabsTrigger>
        <TabsTrigger value="wire">Wire voltage drop</TabsTrigger>
      </TabsList>
      <TabsContent value="ohm">
        <OhmTab />
      </TabsContent>
      <TabsContent value="color">
        <ColorTab />
      </TabsContent>
      <TabsContent value="combine">
        <CombineTab />
      </TabsContent>
      <TabsContent value="divider">
        <DividerTab />
      </TabsContent>
      <TabsContent value="led">
        <LedTab />
      </TabsContent>
      <TabsContent value="ac">
        <AcTab />
      </TabsContent>
      <TabsContent value="wire">
        <WireTab />
      </TabsContent>
    </Tabs>
  );
}
