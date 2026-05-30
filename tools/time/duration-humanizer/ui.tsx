'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type InUnit = 'ms' | 's' | 'min' | 'h';
type Style = 'long' | 'short';

interface UnitDef {
  key: string;
  seconds: number;
  long: string;
  longPlural: string;
  short: string;
}

const UNITS: UnitDef[] = [
  { key: 'year', seconds: 365 * 86400, long: 'year', longPlural: 'years', short: 'y' },
  { key: 'week', seconds: 7 * 86400, long: 'week', longPlural: 'weeks', short: 'w' },
  { key: 'day', seconds: 86400, long: 'day', longPlural: 'days', short: 'd' },
  { key: 'hour', seconds: 3600, long: 'hour', longPlural: 'hours', short: 'h' },
  { key: 'minute', seconds: 60, long: 'minute', longPlural: 'minutes', short: 'm' },
  { key: 'second', seconds: 1, long: 'second', longPlural: 'seconds', short: 's' },
];

const IN_FACTORS: Record<InUnit, number> = { ms: 0.001, s: 1, min: 60, h: 3600 };

interface BreakdownEntry { key: string; count: number; longLabel: string; shortLabel: string }

interface Result {
  human: string;
  colon: string;
  breakdown: BreakdownEntry[];
  totalSeconds: number;
}

function compute(
  raw: string,
  inUnit: InUnit,
  maxUnits: number,
  includeWeeks: boolean,
  includeYears: boolean,
  style: Style,
  oxford: boolean,
): Result | { error: string } {
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Enter a valid number.' };
  if (n < 0) return { error: 'Duration must be zero or positive.' };

  const totalSeconds = n * IN_FACTORS[inUnit];
  let remaining = Math.floor(totalSeconds);

  const active = UNITS.filter((u) => {
    if (u.key === 'year' && !includeYears) return false;
    if (u.key === 'week' && !includeWeeks) return false;
    return true;
  });

  const all: BreakdownEntry[] = [];
  for (const u of active) {
    const count = Math.floor(remaining / u.seconds);
    remaining -= count * u.seconds;
    all.push({
      key: u.key,
      count,
      longLabel: `${count} ${count === 1 ? u.long : u.longPlural}`,
      shortLabel: `${count}${u.short}`,
    });
  }

  // For the human phrase, drop leading zero units and cap to maxUnits non-zero (from the largest).
  const nonZero = all.filter((e) => e.count > 0);
  const shown = nonZero.length > 0 ? nonZero.slice(0, Math.max(1, maxUnits)) : [all[all.length - 1] ?? { key: 'second', count: 0, longLabel: '0 seconds', shortLabel: '0s' }];

  let human: string;
  if (style === 'short') {
    human = shown.map((e) => e.shortLabel).join(' ');
  } else {
    const labels = shown.map((e) => e.longLabel);
    if (labels.length <= 1) {
      human = labels[0] ?? '0 seconds';
    } else {
      const last = labels[labels.length - 1] ?? '';
      const head = labels.slice(0, -1);
      human = oxford
        ? `${head.join(', ')}, and ${last}`
        : `${head.join(', ')} and ${last}`;
    }
  }

  // colon HH:MM:SS (with days prefix if present)
  const totalInt = Math.floor(totalSeconds);
  const days = Math.floor(totalInt / 86400);
  const hh = Math.floor((totalInt % 86400) / 3600);
  const mm = Math.floor((totalInt % 3600) / 60);
  const ss = totalInt % 60;
  const pad = (x: number) => x.toString().padStart(2, '0');
  const colon = (days > 0 ? `${days}d ` : '') + `${pad(hh)}:${pad(mm)}:${pad(ss)}`;

  return { human, colon, breakdown: all, totalSeconds };
}

export default function DurationHumanizer() {
  const [raw, setRaw] = useState('190500');
  const [inUnit, setInUnit] = useState<InUnit>('s');
  const [maxUnits, setMaxUnits] = useState(3);
  const [includeWeeks, setIncludeWeeks] = useState(true);
  const [includeYears, setIncludeYears] = useState(true);
  const [style, setStyle] = useState<Style>('long');
  const [oxford, setOxford] = useState(true);

  const result = useMemo(
    () => compute(raw, inUnit, maxUnits, includeWeeks, includeYears, style, oxford),
    [raw, inUnit, maxUnits, includeWeeks, includeYears, style, oxford],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Duration">
            <Input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" className="w-32 font-mono" />
          </Field>
          <Field label="Input unit">
            <Select value={inUnit} onValueChange={(v) => setInUnit(v as InUnit)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ms">milliseconds</SelectItem>
                <SelectItem value="s">seconds</SelectItem>
                <SelectItem value="min">minutes</SelectItem>
                <SelectItem value="h">hours</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Max units: ${maxUnits}`} className="min-w-[160px]">
            <Slider value={[maxUnits]} min={1} max={6} step={1} onValueChange={(v) => setMaxUnits(v[0] ?? 3)} />
          </Field>
          <Field label="Style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">long</SelectItem>
                <SelectItem value="short">short</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Years">
            <div className="flex h-9 items-center"><Switch checked={includeYears} onCheckedChange={setIncludeYears} /></div>
          </Field>
          <Field label="Weeks">
            <div className="flex h-9 items-center"><Switch checked={includeWeeks} onCheckedChange={setIncludeWeeks} /></div>
          </Field>
          <Field label="Oxford comma">
            <div className="flex h-9 items-center"><Switch checked={oxford} onCheckedChange={setOxford} /></div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Humanized">
            <CopyButton value={() => result.human} />
          </PanelHeader>
          <div className="space-y-3 p-4">
            <div className="break-words rounded-md border bg-muted/30 px-3 py-3 text-lg">{result.human}</div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Colon format</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{result.colon}</span>
                <CopyButton value={result.colon} size="icon-sm" />
              </span>
            </div>
          </div>
          <div className="border-t">
            <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="w-24">Unit</span>
              <span className="flex-1">Count</span>
            </div>
            {result.breakdown.map((b) => (
              <div key={b.key} className="flex items-center gap-3 border-t px-3 py-1.5">
                <span className="w-24 text-sm capitalize text-muted-foreground">{b.key}s</span>
                <span className="flex-1 font-mono text-sm tabular">{b.count}</span>
              </div>
            ))}
          </div>
          <StatBar items={[`${result.totalSeconds.toLocaleString()} total seconds`]} />
        </Panel>
      )}
    </div>
  );
}
