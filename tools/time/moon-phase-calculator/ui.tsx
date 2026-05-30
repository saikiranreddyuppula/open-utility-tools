'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const SYNODIC = 29.530588853; // mean synodic month, days
// Known new moon reference: 2000-01-06 18:14 UTC.
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASES: Array<{ name: string; glyph: string }> = [
  { name: 'New Moon', glyph: '🌑' },
  { name: 'Waxing Crescent', glyph: '🌒' },
  { name: 'First Quarter', glyph: '🌓' },
  { name: 'Waxing Gibbous', glyph: '🌔' },
  { name: 'Full Moon', glyph: '🌕' },
  { name: 'Waning Gibbous', glyph: '🌖' },
  { name: 'Last Quarter', glyph: '🌗' },
  { name: 'Waning Crescent', glyph: '🌘' },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

// Map lunar age (0..SYNODIC) to one of 8 phases centered on the canonical angles.
function phaseIndex(age: number): number {
  const frac = age / SYNODIC; // 0..1
  // Center each of 8 phases over a 1/8 window.
  const idx = Math.floor((frac + 1 / 16) * 8) % 8;
  return idx;
}

type Result =
  | { error: string }
  | {
      glyph: string;
      name: string;
      age: number;
      illumination: number;
      waxing: boolean;
      nextNew: string;
      nextFull: string;
      inputUtc: string;
    };

function compute(dateStr: string, timeStr: string): Result {
  const text = dateStr.trim();
  if (!text) return { error: 'Pick a date.' };
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!dm) return { error: 'Date must be YYYY-MM-DD.' };
  const y = Number(dm[1] ?? '');
  const mo = Number(dm[2] ?? '');
  const da = Number(dm[3] ?? '');

  let hh = 0;
  let mm = 0;
  const t = timeStr.trim();
  if (t) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!tm) return { error: 'Time must be HH:MM (UTC).' };
    hh = Number(tm[1] ?? '0');
    mm = Number(tm[2] ?? '0');
    if (hh > 23 || mm > 59) return { error: 'Time out of range.' };
  }
  if (![y, mo, da].every(Number.isFinite) || mo < 1 || mo > 12 || da < 1 || da > 31) {
    return { error: 'Invalid date.' };
  }

  const targetMs = Date.UTC(y, mo - 1, da, hh, mm, 0);
  if (Number.isNaN(targetMs)) return { error: 'Date is out of range.' };

  const daysSince = (targetMs - NEW_MOON_EPOCH) / 86400000;
  let age = daysSince % SYNODIC;
  if (age < 0) age += SYNODIC;

  const idx = phaseIndex(age);
  const phase = PHASES[idx] ?? PHASES[0]!;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2 * 100;
  const waxing = age < SYNODIC / 2;

  // Next new moon: when age completes the cycle.
  const daysToNewMoon = SYNODIC - age;
  const nextNewMs = targetMs + daysToNewMoon * 86400000;
  // Next full moon: age reaches half-cycle.
  const halfAge = SYNODIC / 2;
  let daysToFull = halfAge - age;
  if (daysToFull < 0) daysToFull += SYNODIC;
  const nextFullMs = targetMs + daysToFull * 86400000;

  return {
    glyph: phase.glyph,
    name: phase.name,
    age,
    illumination,
    waxing,
    nextNew: fmtUtc(nextNewMs),
    nextFull: fmtUtc(nextFullMs),
    inputUtc: `${y}-${pad2(mo)}-${pad2(da)} ${pad2(hh)}:${pad2(mm)} UTC`,
  };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function MoonPhaseCalculatorTool() {
  const [dateStr, setDateStr] = useState(todayStr());
  const [timeStr, setTimeStr] = useState('00:00');

  const result = useMemo(() => compute(dateStr, timeStr), [dateStr, timeStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Date">
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Time (UTC)">
            <Input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} placeholder="00:00" className="w-28 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Moon phase">
            <CopyButton
              value={() =>
                `${result.name} ${result.glyph} — age ${result.age.toFixed(2)} days, ${result.illumination.toFixed(1)}% illuminated`
              }
            />
          </PanelHeader>
          <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-5 text-center">
            <div className="text-6xl leading-none">{result.glyph}</div>
            <div className="text-lg font-semibold">{result.name}</div>
            <div className="text-2xs text-muted-foreground">{result.illumination.toFixed(1)}% illuminated · {result.waxing ? 'waxing' : 'waning'}</div>
          </div>
          <div className="divide-y">
            {[
              ['Lunar age', `${result.age.toFixed(2)} days`],
              ['Illumination', `${result.illumination.toFixed(1)} %`],
              ['Trend', result.waxing ? 'Waxing (growing)' : 'Waning (shrinking)'],
              ['Next new moon (≈)', result.nextNew],
              ['Next full moon (≈)', result.nextFull],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-2">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                <span className="font-mono text-sm font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <StatBar items={[`For ${result.inputUtc}`, `Synodic month ${SYNODIC} d`, 'Mean-phase approximation']} />
        </Panel>
      )}
    </div>
  );
}
