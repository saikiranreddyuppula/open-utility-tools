'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  CURRENCIES,
  buildSchedule,
  cashFlowTable,
  discountedPayback,
  effectiveAnnualRate,
  formatDateDays,
  formatMoney,
  formatNumber,
  formatPctFrac,
  impliedInflation,
  inflationEffect,
  inflationTable,
  irr,
  mirr,
  nominalReturn,
  npv,
  npvExcel,
  parseCashFlows,
  parseNum,
  paybackPeriod,
  profitabilityIndex,
  realReturn,
  scheduleCsv,
  scheduleHeaders,
  solveTvm,
  xirr,
  xnpv,
  type TvmInput,
  type TvmVar,
} from './logic';

type TabId = 'tvm' | 'cf' | 'infl';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function NumInput({
  value,
  onChange,
  className,
  readOnly,
  id,
  placeholder,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange?: (v: string) => void;
  className?: string;
  readOnly?: boolean;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn('font-mono', className)}
    />
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-[11rem]" aria-label="Currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BigStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          'break-words font-mono text-xl font-semibold tabular-nums',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive'
        )}
      >
        {value}
      </div>
      {sub && <div className="text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ chart

interface ChartPoint {
  x: number;
  y: number;
}
interface ChartMarker {
  x: number;
  label: string;
  tone: 'success' | 'warning';
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function LineChart({
  points,
  markers = [],
  xFmt,
  yFmt,
  xTitle,
  yTitle,
  zeroLine,
  label,
}: {
  points: ChartPoint[];
  markers?: ChartMarker[];
  xFmt: (x: number) => string;
  yFmt: (y: number) => string;
  xTitle: string;
  yTitle: string;
  zeroLine?: boolean;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680;
  const H = 280;
  const m = { l: 62, r: 14, t: 18, b: 40 };
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (zeroLine) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  if (yMax === yMin) {
    yMax += 1;
    yMin -= 1;
  }
  const padY = (yMax - yMin) * 0.06;
  yMin -= padY;
  yMax += padY;
  const sx = (x: number) => m.l + ((x - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const line = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ');
  const baseY = sy(Math.max(yMin, Math.min(0, yMax)));
  const area = `${line} L${sx(xMax).toFixed(2)} ${baseY.toFixed(2)} L${sx(xMin).toFixed(2)} ${baseY.toFixed(2)} Z`;
  const xt = niceTicks(xMin, xMax, 6);
  const yt = niceTicks(yMin, yMax, 5);
  const hp = hover !== null ? pts[hover] : undefined;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const vx = ((e.clientX - r.left) / r.width) * W;
        const x = xMin + ((vx - m.l) / (W - m.l - m.r)) * (xMax - xMin);
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < pts.length; k++) {
          const d = Math.abs((pts[k] as ChartPoint).x - x);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        setHover(best);
      }}
      onPointerLeave={() => setHover(null)}
    >
      {yt.map((v) => (
        <g key={`y${v}`}>
          <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} className="stroke-border" strokeWidth={1} />
          <text x={m.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
            {yFmt(v)}
          </text>
        </g>
      ))}
      {xt.map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={H - m.b} y2={H - m.b + 4} className="stroke-muted-foreground" strokeWidth={1} />
          <text x={sx(v)} y={H - m.b + 16} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
            {xFmt(v)}
          </text>
        </g>
      ))}
      {zeroLine && (
        <line x1={m.l} x2={W - m.r} y1={sy(0)} y2={sy(0)} className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="4 3" />
      )}
      <path d={area} className="fill-primary/10" stroke="none" />
      <path d={line} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" />
      {markers.map((mk, k) => (
        <g key={k}>
          <line
            x1={sx(mk.x)}
            x2={sx(mk.x)}
            y1={m.t}
            y2={H - m.b}
            className={mk.tone === 'success' ? 'stroke-success' : 'stroke-warning'}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          {zeroLine && (
            <circle cx={sx(mk.x)} cy={sy(0)} r={4} className={mk.tone === 'success' ? 'fill-success' : 'fill-warning'} />
          )}
          <text
            x={Math.min(sx(mk.x) + 4, W - 90)}
            y={m.t + 10 + (k % 3) * 12}
            className={mk.tone === 'success' ? 'fill-success' : 'fill-warning'}
            fontSize={10}
            fontWeight={600}
            strokeWidth={3}
            paintOrder="stroke"
            strokeLinejoin="round"
            stroke="var(--card)"
          >
            {mk.label}
          </text>
        </g>
      ))}
      {hp && (
        <g>
          <line x1={sx(hp.x)} x2={sx(hp.x)} y1={m.t} y2={H - m.b} className="stroke-muted-foreground" strokeWidth={1} />
          <circle cx={sx(hp.x)} cy={sy(hp.y)} r={3.5} className="fill-primary" />
          <text x={W - m.r} y={12} textAnchor="end" className="fill-foreground" fontSize={11} fontWeight={600}>
            {`${xTitle}: ${xFmt(hp.x)}  |  ${yTitle}: ${yFmt(hp.y)}`}
          </text>
        </g>
      )}
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
        {xTitle}
      </text>
    </svg>
  );
}

function compactFmt(v: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(v);
}

// ------------------------------------------------------------------ TVM tab

const SOLVE_LABEL: Record<TvmVar, string> = {
  n: 'N',
  iy: 'I/Y',
  pv: 'PV',
  pmt: 'PMT',
  fv: 'FV',
};

const PY_PRESETS: { v: string; label: string }[] = [
  { v: '1', label: 'Annual (1)' },
  { v: '2', label: 'Semi-annual (2)' },
  { v: '4', label: 'Quarterly (4)' },
  { v: '12', label: 'Monthly (12)' },
  { v: '24', label: 'Semi-monthly (24)' },
  { v: '26', label: 'Bi-weekly (26)' },
  { v: '52', label: 'Weekly (52)' },
  { v: '365', label: 'Daily (365)' },
];

const MAX_TABLE_ROWS = 600;

interface TvmRaw {
  n: string;
  iy: string;
  pv: string;
  pmt: string;
  fv: string;
}

function TvmTab({ currency }: { currency: string }) {
  const [solveFor, setSolveFor] = useState<TvmVar>('pmt');
  const [raw, setRaw] = useState<TvmRaw>({ n: '360', iy: '6.5', pv: '250000', pmt: '', fv: '0' });
  const [pyMode, setPyMode] = useState('12');
  const [pyCustom, setPyCustom] = useState('12');
  const [cyMode, setCyMode] = useState('same');
  const [cyCustom, setCyCustom] = useState('12');
  const [begin, setBegin] = useState(false);

  const py = pyMode === 'custom' ? parseNum(pyCustom) : Number(pyMode);
  const cy = cyMode === 'same' ? py : cyMode === 'custom' ? parseNum(cyCustom) : cyMode === 'cont' ? 0 : Number(cyMode);

  const calc = useMemo(() => {
    try {
      const get = (k: TvmVar): number => {
        if (k === solveFor) return 0;
        const v = parseNum(raw[k]);
        if (Number.isNaN(v)) throw new Error(`${SOLVE_LABEL[k]} is required (or choose it as the value to solve for).`);
        return v;
      };
      if (!Number.isFinite(py) || py <= 0) throw new Error('Payments per year (P/Y) must be a positive number.');
      if (!Number.isFinite(cy) || cy < 0) throw new Error('Compounding per year (C/Y) must be 0 or more.');
      const inp: TvmInput = { n: get('n'), iy: get('iy'), pv: get('pv'), pmt: get('pmt'), fv: get('fv'), py, cy, begin };
      const sol = solveTvm(inp, solveFor);
      const sch = buildSchedule(sol.periodRate, sol.input.n, sol.input.pv, sol.input.pmt, sol.input.fv, begin);
      return { sol, sch, error: null as string | null };
    } catch (e) {
      return { sol: null, sch: null, error: errMsg(e) };
    }
  }, [raw, solveFor, py, cy, begin]);

  const sol = calc.sol;
  const sch = calc.sch;

  const display = (k: TvmVar): string => {
    if (!sol || k !== solveFor) return raw[k];
    return k === 'n' ? String(Number(sol.value.toFixed(8))) : k === 'iy' ? String(Number(sol.value.toFixed(8))) : sol.value.toFixed(2);
  };

  const fieldLabel: Record<TvmVar, string> = {
    n: 'N (periods)',
    iy: 'I/Y (annual %)',
    pv: 'PV (present value)',
    pmt: 'PMT (payment)',
    fv: 'FV (future value)',
  };

  const headline = (): string => {
    if (!sol) return '';
    switch (sol.variable) {
      case 'n':
        return `${formatNumber(sol.value, 4)} periods`;
      case 'iy':
        return `${formatNumber(sol.value, 6)}% per year`;
      case 'pv':
      case 'pmt':
      case 'fv':
        return formatMoney(sol.value, currency);
    }
  };

  const years = sol ? sol.input.n / py : 0;
  const ear = sol ? effectiveAnnualRate(sol.input.iy, cy) : 0;
  const rows = sch ? sch.rows.slice(0, MAX_TABLE_ROWS) : [];
  const chartPoints: ChartPoint[] = sch
    ? [{ x: 0, y: sch.openingBalance }, ...sch.rows.map((r) => ({ x: r.period, y: r.balance }))]
    : [];

  const sampleLoan = () => {
    setSolveFor('pmt');
    setRaw({ n: '360', iy: '6.5', pv: '250000', pmt: '', fv: '0' });
    setPyMode('12');
    setCyMode('same');
    setBegin(false);
  };
  const sampleSavings = () => {
    setSolveFor('fv');
    setRaw({ n: '240', iy: '7', pv: '-10000', pmt: '-500', fv: '' });
    setPyMode('12');
    setCyMode('same');
    setBegin(false);
  };
  const sampleRate = () => {
    setSolveFor('iy');
    setRaw({ n: '60', iy: '', pv: '25000', pmt: '-495.03', fv: '0' });
    setPyMode('12');
    setCyMode('same');
    setBegin(false);
  };

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Solve for">
          <Tabs value={solveFor} onValueChange={(v) => setSolveFor(v as TvmVar)}>
            <TabsList>
              {(Object.keys(SOLVE_LABEL) as TvmVar[]).map((k) => (
                <TabsTrigger key={k} value={k} className="px-3">
                  {SOLVE_LABEL[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Payment timing">
          <Tabs value={begin ? 'begin' : 'end'} onValueChange={(v) => setBegin(v === 'begin')}>
            <TabsList>
              <TabsTrigger value="end">End of period</TabsTrigger>
              <TabsTrigger value="begin">Beginning</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Payments per year (P/Y)" className="w-48">
          <Select value={pyMode} onValueChange={setPyMode}>
            <SelectTrigger className="w-full" aria-label="Payments per year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PY_PRESETS.map((p) => (
                <SelectItem key={p.v} value={p.v}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom...</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {pyMode === 'custom' && (
          <Field label="Custom P/Y">
            <NumInput value={pyCustom} onChange={setPyCustom} className="w-20" />
          </Field>
        )}
        <Field label="Compounding per year (C/Y)" className="w-52">
          <Select value={cyMode} onValueChange={setCyMode}>
            <SelectTrigger className="w-full" aria-label="Compounding per year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="same">Same as P/Y</SelectItem>
              {PY_PRESETS.filter((p) => ['1', '2', '4', '12', '365'].includes(p.v)).map((p) => (
                <SelectItem key={p.v} value={p.v}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="cont">Continuous</SelectItem>
              <SelectItem value="custom">Custom...</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {cyMode === 'custom' && (
          <Field label="Custom C/Y">
            <NumInput value={cyCustom} onChange={setCyCustom} className="w-20" />
          </Field>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title="Values">
          <Button variant="ghost" size="sm" onClick={sampleLoan}>
            Loan example
          </Button>
          <Button variant="ghost" size="sm" onClick={sampleSavings}>
            Savings example
          </Button>
          <Button variant="ghost" size="sm" onClick={sampleRate}>
            Find-the-rate example
          </Button>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          {(['n', 'iy', 'pv', 'pmt', 'fv'] as TvmVar[]).map((k) => (
            <Field key={k} label={fieldLabel[k]}>
              <div className="relative">
                <NumInput
                  value={display(k)}
                  onChange={(v) => setRaw({ ...raw, [k]: v })}
                  readOnly={k === solveFor}
                  className={cn(k === solveFor && 'border-primary bg-primary/10 font-semibold')}
                  aria-label={fieldLabel[k]}
                />
              </div>
              {k === solveFor && <span className="text-2xs text-primary">calculated</span>}
            </Field>
          ))}
        </div>
        <div className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Sign convention:</strong> money you pay out is negative and money you receive is positive.
          A loan you receive has a positive PV and negative payments; a deposit you make is a negative PV or PMT and the balance
          you collect is a positive FV. N counts payment periods.
        </div>
      </Panel>

      <ErrorBanner error={calc.error} />

      {sol && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BigStat label={`${SOLVE_LABEL[sol.variable]} result`} value={headline()} sub={sol.variable === 'n' ? `${formatNumber(years, 3)} years` : undefined} />
            <BigStat
              label="Rate per payment period"
              value={formatPctFrac(sol.periodRate, 6)}
              sub={`effective annual ${formatPctFrac(ear, 4)}`}
            />
            {sch && (
              <BigStat
                label={sch.kind === 'loan' ? 'Total paid' : 'Total deposited'}
                value={formatMoney(sch.totalPayments, currency)}
                sub={`over ${formatNumber(sol.input.n, 3)} periods`}
              />
            )}
            {sch && (
              <BigStat
                label={sch.kind === 'loan' ? 'Total interest' : 'Interest earned'}
                value={formatMoney(sch.totalInterest, currency)}
                tone={sch.kind === 'loan' ? 'bad' : 'good'}
              />
            )}
          </div>
          {sol.warnings.map((w, k) => (
            <div key={k} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              {w}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              N={formatNumber(sol.input.n, 6)} I/Y={formatNumber(sol.input.iy, 6)} PV={formatNumber(sol.input.pv, 2)} PMT=
              {formatNumber(sol.input.pmt, 2)} FV={formatNumber(sol.input.fv, 2)} P/Y={formatNumber(py)} C/Y=
              {cy === 0 ? 'continuous' : formatNumber(cy)} {begin ? 'BEGIN' : 'END'}
            </span>
            <CopyButton
              value={() =>
                `N=${sol.input.n}\nI/Y=${sol.input.iy}\nPV=${sol.input.pv}\nPMT=${sol.input.pmt}\nFV=${sol.input.fv}\nP/Y=${py}\nC/Y=${cy === 0 ? 'continuous' : cy}\n${begin ? 'BEGIN' : 'END'}`
              }
              label="Copy values"
            />
          </div>

          {sch ? (
            <>
              <Panel>
                <PanelHeader title={sch.kind === 'loan' ? 'Balance over time' : 'Account value over time'} />
                <div className="p-3">
                  <LineChart
                    points={chartPoints}
                    xTitle="Period"
                    yTitle="Balance"
                    xFmt={(x) => formatNumber(x, 0)}
                    yFmt={compactFmt}
                    zeroLine
                    label="Balance by period"
                  />
                </div>
              </Panel>
              <Panel>
                <PanelHeader title={sch.kind === 'loan' ? 'Amortization schedule' : 'Growth schedule'}>
                  <CopyButton value={() => scheduleCsv(sch)} label="Copy CSV" />
                  <DownloadButton data={() => scheduleCsv(sch)} filename="tvm-schedule.csv" mime="text/csv" />
                </PanelHeader>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead className="sticky top-0 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {scheduleHeaders(sch.kind).map((h, k) => (
                          <th key={h} className={cn('px-3 py-1.5 font-medium', k === 0 ? 'text-left' : 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      <tr className="border-b text-muted-foreground">
                        <td className="px-3 py-1">0</td>
                        <td className="px-3 py-1 text-right" />
                        <td className="px-3 py-1 text-right" />
                        <td className="px-3 py-1 text-right" />
                        <td className="px-3 py-1 text-right">{formatMoney(sch.openingBalance, currency)}</td>
                      </tr>
                      {rows.map((r) => (
                        <tr key={r.period} className="border-b last:border-0">
                          <td className="px-3 py-1">{r.period}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(r.payment, currency)}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(r.interest, currency)}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(r.principal, currency)}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(r.balance, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <StatBar className="h-auto min-h-7 py-1"
                  items={[
                    `${sch.rows.length} periods`,
                    sch.rows.length > rows.length && `showing first ${rows.length} (CSV has all rows)`,
                    sch.finalAdjusted && 'N is fractional: last row holds the adjusted final payment',
                  ]}
                />
              </Panel>
            </>
          ) : (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No schedule is shown for N = {formatNumber(sol.input.n, 2)} (schedules need between 0 and 12,000 periods).
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ cash flow tab

const SAMPLE_PLAIN = '-10000\n3000\n4200\n6800\n2500';
const SAMPLE_MULTI = '-100\n230\n-132';
const SAMPLE_XIRR = '2008-01-01, -10000\n2008-03-01, 2750\n2008-10-30, 4250\n2009-02-15, 3250\n2009-04-01, 2750';

function CashFlowTab({ currency }: { currency: string }) {
  const [text, setText] = useState(SAMPLE_PLAIN);
  const [dated, setDated] = useState(false);
  const [rateRaw, setRateRaw] = useState('8');
  const [finRaw, setFinRaw] = useState('8');
  const [reinvRaw, setReinvRaw] = useState('6');
  const [ppyRaw, setPpyRaw] = useState('1');

  const calc = useMemo(() => {
    try {
      const rate = parseNum(rateRaw);
      if (Number.isNaN(rate)) throw new Error('Enter a discount rate.');
      if (rate <= -100) throw new Error('Discount rate must be greater than -100 %.');
      const flows = parseCashFlows(text, dated);
      if (flows.values.length < 2) throw new Error('Enter at least two cash flows.');
      if (flows.values.length > 1000) throw new Error('Too many cash flows (limit 1000).');
      const r = rate / 100;
      const values = flows.values;
      const hasPos = values.some((v) => v > 0);
      const hasNeg = values.some((v) => v < 0);
      if (flows.days) {
        const days = flows.days;
        const res = xirr(values, days);
        const val = xnpv(r, values, days);
        const d0 = days[0] as number;
        const dMax = Math.max(...days);
        return {
          mode: 'dated' as const,
          values,
          days,
          rate: r,
          npv: val,
          irr: res,
          spanYears: (dMax - d0) / 365,
          hasPos,
          hasNeg,
          error: null as string | null,
        };
      }
      const res = irr(values);
      const fin = parseNum(finRaw);
      const reinv = parseNum(reinvRaw);
      const m = Number.isNaN(fin) || Number.isNaN(reinv) ? NaN : mirr(values, fin / 100, reinv / 100);
      return {
        mode: 'periodic' as const,
        values,
        days: null,
        rate: r,
        npv: npv(r, values),
        npvExcel: npvExcel(r, values),
        irr: res,
        mirr: m,
        pi: profitabilityIndex(r, values),
        payback: paybackPeriod(values),
        dpayback: discountedPayback(r, values),
        table: cashFlowTable(r, values),
        hasPos,
        hasNeg,
        error: null as string | null,
      };
    } catch (e) {
      return { mode: 'error' as const, error: errMsg(e) };
    }
  }, [text, dated, rateRaw, finRaw, reinvRaw]);

  const ppy = Math.max(1, parseNum(ppyRaw) || 1);

  const curve = useMemo(() => {
    if (calc.mode === 'error') return null;
    const roots = calc.irr.roots;
    const lo = Math.max(-0.9, Math.min(-0.1, roots.length ? Math.min(...roots) * 1.5 - 0.05 : -0.1));
    const hiBase = Math.max(0.3, roots.length ? Math.max(...roots) * 1.6 : 0.3, calc.rate * 1.6);
    const hi = Math.min(10, hiBase);
    const f = (rate: number): number => {
      if (calc.mode === 'dated') return xnpv(rate, calc.values, calc.days);
      return npv(rate, calc.values);
    };
    const pts: ChartPoint[] = [];
    const N = 160;
    for (let k = 0; k <= N; k++) {
      const rate = lo + ((hi - lo) * k) / N;
      pts.push({ x: rate * 100, y: f(rate) });
    }
    return pts;
  }, [calc]);

  const loadSample = (which: 'plain' | 'multi' | 'xirr') => {
    if (which === 'xirr') {
      setDated(true);
      setText(SAMPLE_XIRR);
      setRateRaw('10');
    } else {
      setDated(false);
      setText(which === 'plain' ? SAMPLE_PLAIN : SAMPLE_MULTI);
      setRateRaw(which === 'plain' ? '8' : '15');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel>
          <PanelHeader title="Cash flows">
            <Button variant="ghost" size="sm" onClick={() => loadSample('plain')}>
              Project
            </Button>
            <Button variant="ghost" size="sm" onClick={() => loadSample('multi')}>
              Multiple IRRs
            </Button>
            <Button variant="ghost" size="sm" onClick={() => loadSample('xirr')}>
              Dated (XIRR)
            </Button>
          </PanelHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-[200px] flex-1 resize-none rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
            aria-label="Cash flows"
            placeholder={dated ? '2024-01-01, -10000\n2024-07-01, 2500' : '-10000\n3000\n4200\n6800'}
          />
          <div className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {dated
              ? 'One "date, amount" per line (YYYY-MM-DD or M/D/YYYY). The first date is the valuation date; Actual/365.'
              : 'One amount per line (or separated by commas/spaces). The first value is CF0 at time 0. Use (500) or -500 for outflows.'}
          </div>
        </Panel>
        <div className="space-y-3">
          <OptionsBar>
            <Field label="Dated flows (XNPV / XIRR)">
              <div className="flex h-8 items-center">
                <Switch checked={dated} onCheckedChange={setDated} aria-label="Dated cash flows" />
              </div>
            </Field>
            <Field label={dated ? 'Discount rate (% per year)' : 'Discount rate (% per period)'}>
              <NumInput value={rateRaw} onChange={setRateRaw} className="w-28" />
            </Field>
            {!dated && (
              <>
                <Field label="MIRR finance rate %">
                  <NumInput value={finRaw} onChange={setFinRaw} className="w-24" />
                </Field>
                <Field label="MIRR reinvest rate %">
                  <NumInput value={reinvRaw} onChange={setReinvRaw} className="w-24" />
                </Field>
                <Field label="Periods per year">
                  <NumInput value={ppyRaw} onChange={setPpyRaw} className="w-20" />
                </Field>
              </>
            )}
          </OptionsBar>
          <ErrorBanner error={calc.error} />
          {calc.mode !== 'error' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BigStat
                label={calc.mode === 'dated' ? 'XNPV' : 'NPV'}
                value={formatMoney(calc.npv, currency)}
                tone={calc.npv >= 0 ? 'good' : 'bad'}
                sub={calc.npv >= 0 ? 'value-creating at this rate' : 'destroys value at this rate'}
              />
              <BigStat
                label={calc.mode === 'dated' ? 'XIRR (per year)' : 'IRR (per period)'}
                value={calc.irr.rate === null ? 'n/a' : formatPctFrac(calc.irr.rate, 4)}
                sub={
                  calc.mode === 'periodic' && calc.irr.rate !== null && ppy > 1
                    ? `annualised ${formatPctFrac(Math.pow(1 + calc.irr.rate, ppy) - 1, 4)} (${formatNumber(ppy)}/yr)`
                    : calc.irr.roots.length > 1
                      ? `${calc.irr.roots.length} roots found`
                      : undefined
                }
              />
              {calc.mode === 'periodic' && (
                <>
                  <BigStat label="MIRR" value={Number.isNaN(calc.mirr) ? 'n/a' : formatPctFrac(calc.mirr, 4)} sub={`finance ${finRaw}%, reinvest ${reinvRaw}%`} />
                  <BigStat label="Profitability index" value={calc.pi === null ? 'n/a' : formatNumber(calc.pi, 4)} sub={calc.pi === null ? 'needs an initial outflow (CF0 < 0)' : calc.pi >= 1 ? 'PV of inflows / outlay (>= 1 is good)' : 'PV of inflows / outlay (< 1)'} />
                  <BigStat
                    label="Payback period"
                    value={calc.payback === null ? 'not recovered' : `${formatNumber(calc.payback, 2)} periods`}
                    sub="simple, undiscounted"
                  />
                  <BigStat
                    label="Discounted payback"
                    value={calc.dpayback === null ? 'not recovered' : `${formatNumber(calc.dpayback, 2)} periods`}
                    sub={`at ${rateRaw}% per period`}
                  />
                </>
              )}
              {calc.mode === 'dated' && (
                <BigStat label="Time span" value={`${formatNumber(calc.spanYears, 2)} years`} sub={`${calc.values.length} dated flows`} />
              )}
            </div>
          )}
        </div>
      </div>

      {calc.mode !== 'error' && (
        <>
          {calc.irr.note && (
            <div
              className={cn(
                'rounded-md border px-3 py-2 text-xs',
                calc.irr.signChanges > 1 ? 'border-warning/40 bg-warning/10' : 'bg-muted/30 text-muted-foreground'
              )}
            >
              {calc.irr.note}
            </div>
          )}
          {calc.irr.roots.length > 1 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium">All IRRs found in [-99%, 1000%]: </span>
              <span className="font-mono">{calc.irr.roots.map((r) => formatPctFrac(r, 4)).join(',  ')}</span>
            </div>
          )}
          {curve && (
            <Panel>
              <PanelHeader title="NPV vs discount rate" />
              <div className="p-3">
                <LineChart
                  points={curve}
                  xTitle="Rate"
                  yTitle={calc.mode === 'dated' ? 'XNPV' : 'NPV'}
                  xFmt={(x) => `${formatNumber(x, 1)}%`}
                  yFmt={compactFmt}
                  zeroLine
                  label="Net present value as a function of the discount rate"
                  markers={[
                    ...calc.irr.roots.map((r) => ({ x: r * 100, label: `IRR ${formatNumber(r * 100, 2)}%`, tone: 'success' as const })),
                    { x: calc.rate * 100, label: `rate ${formatNumber(calc.rate * 100, 2)}%`, tone: 'warning' as const },
                  ]}
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  The curve crosses zero at each IRR (green). The dashed amber line is your discount rate. Hover to read values.
                </p>
              </div>
            </Panel>
          )}
          {calc.mode === 'periodic' ? (
            <Panel>
              <PanelHeader title="Cash flow table">
                <CopyButton
                  value={() =>
                    ['t,cash_flow,discounted,cumulative,cumulative_discounted', ...calc.table.map((r) => [r.t, r.cf, r.discounted.toFixed(4), r.cumulative, r.cumulativeDiscounted.toFixed(4)].join(','))].join('\n')
                  }
                  label="Copy CSV"
                />
              </PanelHeader>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="sticky top-0 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">t</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cash flow</th>
                      <th className="px-3 py-1.5 text-right font-medium">Discounted</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cumulative</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cum. discounted</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {calc.table.slice(0, 400).map((r) => (
                      <tr key={r.t} className="border-b last:border-0">
                        <td className="px-3 py-1">{r.t}</td>
                        <td className="px-3 py-1 text-right">{formatMoney(r.cf, currency)}</td>
                        <td className="px-3 py-1 text-right">{formatMoney(r.discounted, currency)}</td>
                        <td className={cn('px-3 py-1 text-right', r.cumulative < 0 && 'text-destructive')}>{formatMoney(r.cumulative, currency)}</td>
                        <td className={cn('px-3 py-1 text-right', r.cumulativeDiscounted < 0 && 'text-destructive')}>{formatMoney(r.cumulativeDiscounted, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <StatBar className="h-auto min-h-7 py-1"
                items={[
                  `${calc.values.length} flows`,
                  `Excel NPV() equivalent: ${formatMoney(calc.npvExcel, currency)}`,
                  'NPV here puts CF0 at t = 0 (Excel NPV() discounts the first value one period)',
                ]}
              />
            </Panel>
          ) : (
            <Panel>
              <PanelHeader title="Dated cash flows" />
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Date</th>
                      <th className="px-3 py-1.5 text-right font-medium">Years from first</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cash flow</th>
                      <th className="px-3 py-1.5 text-right font-medium">Present value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {calc.values.map((v, k) => {
                      const d = calc.days[k] as number;
                      const yrs = (d - (calc.days[0] as number)) / 365;
                      return (
                        <tr key={k} className="border-b last:border-0">
                          <td className="px-3 py-1">{formatDateDays(d)}</td>
                          <td className="px-3 py-1 text-right">{formatNumber(yrs, 4)}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(v, currency)}</td>
                          <td className="px-3 py-1 text-right">{formatMoney(v / Math.pow(1 + calc.rate, yrs), currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <StatBar className="h-auto min-h-7 py-1" items={['XNPV = sum of amount / (1 + rate)^(days / 365)', 'same day-count as Excel XNPV / XIRR']} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ inflation tab

type FisherMode = 'real' | 'nominal' | 'inflation';

function InflationTab({ currency }: { currency: string }) {
  const [amountRaw, setAmountRaw] = useState('10000');
  const [yearsRaw, setYearsRaw] = useState('20');
  const [inflRaw, setInflRaw] = useState('3');
  const [nomRaw, setNomRaw] = useState('7');
  const [fisherMode, setFisherMode] = useState<FisherMode>('real');
  const [realRaw, setRealRaw] = useState('4');

  const calc = useMemo(() => {
    try {
      const amount = parseNum(amountRaw);
      const years = parseNum(yearsRaw);
      const infl = parseNum(inflRaw);
      const nom = parseNum(nomRaw);
      if (Number.isNaN(amount)) throw new Error('Enter an amount.');
      if (Number.isNaN(years) || years < 0 || years > 200) throw new Error('Years must be between 0 and 200.');
      if (Number.isNaN(infl) || infl <= -100) throw new Error('Enter an inflation rate above -100 %.');
      const eff = inflationEffect({ amount, years, ratePct: infl });
      const tableOk = !Number.isNaN(nom) && nom > -100;
      const table = inflationTable(amount, years, infl, tableOk ? nom : 0);
      return { ok: true as const, amount, years, infl, nom, eff, table, tableOk, error: null as string | null };
    } catch (e) {
      return { ok: false as const, error: errMsg(e) };
    }
  }, [amountRaw, yearsRaw, inflRaw, nomRaw]);

  const fisher = useMemo(() => {
    const infl = parseNum(inflRaw) / 100;
    const nom = parseNum(nomRaw) / 100;
    const real = parseNum(realRaw) / 100;
    try {
      if (fisherMode === 'real') {
        if (Number.isNaN(nom) || Number.isNaN(infl)) throw new Error('Enter the nominal return and inflation.');
        if (nom <= -1 || infl <= -1) throw new Error('Rates must be above -100 %.');
        const r = realReturn(nom, infl);
        return { label: 'Real return', exact: r, approx: nom - infl, error: null as string | null };
      }
      if (fisherMode === 'nominal') {
        if (Number.isNaN(real) || Number.isNaN(infl)) throw new Error('Enter the real return and inflation.');
        if (real <= -1 || infl <= -1) throw new Error('Rates must be above -100 %.');
        const n = nominalReturn(real, infl);
        return { label: 'Nominal return needed', exact: n, approx: real + infl, error: null as string | null };
      }
      if (Number.isNaN(nom) || Number.isNaN(real)) throw new Error('Enter the nominal and real returns.');
      if (nom <= -1 || real <= -1) throw new Error('Rates must be above -100 %.');
      const i = impliedInflation(nom, real);
      return { label: 'Implied inflation', exact: i, approx: nom - real, error: null as string | null };
    } catch (e) {
      return { label: '', exact: NaN, approx: NaN, error: errMsg(e) };
    }
  }, [fisherMode, inflRaw, nomRaw, realRaw]);

  const m = (v: number) => formatMoney(v, currency);

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Amount today">
          <NumInput value={amountRaw} onChange={setAmountRaw} className="w-36" />
        </Field>
        <Field label="Years">
          <NumInput value={yearsRaw} onChange={setYearsRaw} className="w-20" />
        </Field>
        <Field label="Inflation (% per year)">
          <NumInput value={inflRaw} onChange={setInflRaw} className="w-24" />
        </Field>
        <Field label="Nominal return (% per year)">
          <NumInput value={nomRaw} onChange={setNomRaw} className="w-24" />
        </Field>
      </OptionsBar>
      <ErrorBanner error={calc.error} />
      {calc.ok && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BigStat
              label={`Future cost of ${m(calc.amount)} today`}
              value={m(calc.eff.futureCost)}
              sub={`prices x${formatNumber(calc.eff.factor, 4)} after ${formatNumber(calc.years)} years`}
            />
            <BigStat
              label={`Value of ${m(calc.amount)} in today's money`}
              value={m(calc.eff.purchasingPower)}
              tone="bad"
              sub={`${formatPctFrac(calc.eff.powerLost, 2)} of purchasing power lost`}
            />
            {calc.tableOk && calc.table.length > 0 && (
              <BigStat
                label={`Invested at ${formatNumber(calc.nom, 2)}% nominal`}
                value={m(calc.table[calc.table.length - 1]?.nominalValue ?? 0)}
                sub={`worth ${m(calc.table[calc.table.length - 1]?.realValue ?? 0)} in today's money`}
              />
            )}
          </div>

          <Panel>
            <PanelHeader title="Nominal vs real return (Fisher equation)" />
            <div className="space-y-3 p-3">
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Find">
                  <Tabs value={fisherMode} onValueChange={(v) => setFisherMode(v as FisherMode)}>
                    <TabsList>
                      <TabsTrigger value="real">Real return</TabsTrigger>
                      <TabsTrigger value="nominal">Nominal needed</TabsTrigger>
                      <TabsTrigger value="inflation">Inflation</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </Field>
                {fisherMode !== 'real' && (
                  <Field label="Real return (% per year)">
                    <NumInput value={realRaw} onChange={setRealRaw} className="w-24" />
                  </Field>
                )}
                <span className="pb-1.5 text-xs text-muted-foreground">
                  Uses the inflation and nominal return above as needed.
                </span>
              </div>
              <ErrorBanner error={fisher.error} />
              {!fisher.error && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <BigStat label={fisher.label} value={formatPctFrac(fisher.exact, 4)} sub="exact: (1 + nominal) = (1 + real)(1 + inflation)" />
                  <BigStat label="Quick approximation" value={formatPctFrac(fisher.approx, 4)} sub="nominal - inflation (close for small rates)" />
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Year by year">
              <CopyButton
                value={() =>
                  ['year,price_level,purchasing_power,nominal_value,real_value', ...calc.table.map((r) => [r.year, r.priceLevel.toFixed(2), r.purchasingPower.toFixed(2), r.nominalValue.toFixed(2), r.realValue.toFixed(2)].join(','))].join('\n')
                }
                label="Copy CSV"
              />
            </PanelHeader>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="sticky top-0 bg-muted text-2xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Year</th>
                    <th className="px-3 py-1.5 text-right font-medium">Cost of today&apos;s basket</th>
                    <th className="px-3 py-1.5 text-right font-medium">Cash buys (today&apos;s money)</th>
                    <th className="px-3 py-1.5 text-right font-medium">Invested (nominal)</th>
                    <th className="px-3 py-1.5 text-right font-medium">Invested (real)</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {calc.table.map((r) => (
                    <tr key={r.year} className="border-b last:border-0">
                      <td className="px-3 py-1">{formatNumber(r.year, 2)}</td>
                      <td className="px-3 py-1 text-right">{m(r.priceLevel)}</td>
                      <td className="px-3 py-1 text-right">{m(r.purchasingPower)}</td>
                      <td className="px-3 py-1 text-right">{m(r.nominalValue)}</td>
                      <td className="px-3 py-1 text-right">{m(r.realValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StatBar className="h-auto min-h-7 py-1"
              items={[
                calc.tableOk ? `invested at ${formatNumber(calc.nom, 2)}% nominal` : 'enter a nominal return to see investment columns',
                'constant inflation assumed',
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ root

export default function TimeValueOfMoneyTool() {
  const [tab, setTab] = useState<TabId>('tvm');
  const [currency, setCurrency] = useState('USD');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="tvm">TVM solver</TabsTrigger>
          <TabsTrigger value="cf">Cash flows (NPV / IRR)</TabsTrigger>
          <TabsTrigger value="infl">Inflation &amp; real value</TabsTrigger>
        </TabsList>
        <Field label="Currency" className="w-52">
          <CurrencySelect value={currency} onChange={setCurrency} />
        </Field>
      </div>
      <TabsContent value="tvm">
        <TvmTab currency={currency} />
      </TabsContent>
      <TabsContent value="cf">
        <CashFlowTab currency={currency} />
      </TabsContent>
      <TabsContent value="infl">
        <InflationTab currency={currency} />
      </TabsContent>
    </Tabs>
  );
}
