'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'birthdate' | 'earthyears';

interface Planet {
  name: string;
  // Orbital period in Earth years.
  period: number;
}

const PLANETS: Planet[] = [
  { name: 'Mercury', period: 0.2408467 },
  { name: 'Venus', period: 0.61519726 },
  { name: 'Earth', period: 1.0 },
  { name: 'Mars', period: 1.8808158 },
  { name: 'Jupiter', period: 11.862615 },
  { name: 'Saturn', period: 29.447498 },
  { name: 'Uranus', period: 84.016846 },
  { name: 'Neptune', period: 164.79132 },
];

const EARTH_YEAR_SECONDS = 365.25 * 24 * 60 * 60;

function pad(n: number, w = 2): string {
  return n.toString().padStart(w, '0');
}

function formatDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(value: string): Date | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

interface PlanetRow {
  name: string;
  age: string;
  nextBirthday: string;
}

type Result =
  | { error: string }
  | { rows: PlanetRow[]; earthSeconds: number };

export default function AgeOnOtherPlanets() {
  const [mode, setMode] = useState<Mode>('birthdate');
  const [birthdate, setBirthdate] = useState<string>('2000-01-01');
  const [earthYears, setEarthYears] = useState<string>('25');

  const result = useMemo<Result>(() => {
    let earthSeconds: number;
    let birthEpochMs: number | null = null;

    if (mode === 'birthdate') {
      const d = parseISODate(birthdate);
      if (!d) return { error: 'Enter a valid birth date.' };
      birthEpochMs = d.getTime();
      const nowMs = Date.now();
      if (birthEpochMs > nowMs) return { error: 'Birth date is in the future.' };
      earthSeconds = (nowMs - birthEpochMs) / 1000;
    } else {
      const y = Number(earthYears);
      if (!Number.isFinite(y) || y < 0) {
        return { error: 'Enter a non-negative number of Earth years.' };
      }
      earthSeconds = y * EARTH_YEAR_SECONDS;
    }

    const rows: PlanetRow[] = PLANETS.map((p) => {
      const planetSeconds = p.period * EARTH_YEAR_SECONDS;
      const age = earthSeconds / planetSeconds;

      let nextBirthday = '—';
      if (birthEpochMs !== null) {
        // Next whole planet-year after the current age, projected onto Earth's calendar.
        const nextWhole = Math.floor(age) + 1;
        const nextMs = birthEpochMs + nextWhole * planetSeconds * 1000;
        nextBirthday = `${formatDate(new Date(nextMs))} (turns ${nextWhole})`;
      }

      return {
        name: p.name,
        age: age.toFixed(2),
        nextBirthday,
      };
    });

    return { rows, earthSeconds };
  }, [mode, birthdate, earthYears]);

  const ok = !('error' in result);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Age on Other Planets" />
        <OptionsBar>
          <Field label="Input">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="birthdate">Birth date</TabsTrigger>
                <TabsTrigger value="earthyears">Earth years</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'birthdate' ? (
            <Field label="Birth date">
              <Input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Earth years">
              <Input
                type="number"
                value={earthYears}
                onChange={(e) => setEarthYears(e.target.value)}
                inputMode="decimal"
                className="w-28 font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Equivalent age per planet">
            <CopyButton
              value={() =>
                result.rows.map((r) => `${r.name}: ${r.age} years`).join('\n')
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-20 shrink-0 text-sm font-medium">{r.name}</span>
                <span className="w-28 shrink-0 font-mono text-sm tabular-nums">
                  {r.age} yr
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  Next birthday: {r.nextBirthday}
                </span>
                <CopyButton value={`${r.age}`} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Earth seconds elapsed: ${Math.round(result.earthSeconds).toLocaleString()}`,
              `Earth days: ${(result.earthSeconds / 86400).toFixed(1)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
