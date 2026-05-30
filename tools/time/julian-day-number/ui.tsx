'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Mode = 'toJd' | 'fromJd';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Meeus / Fliegel-Van Flandern: calendar (Gregorian) date+time -> Julian Date.
function gregorianToJd(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFraction = day + hour / 24 + minute / 1440 + second / 86400;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    dayFraction +
    b -
    1524.5
  );
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Inverse algorithm (Meeus): Julian Date -> calendar date + time.
function jdToGregorian(jd: number): DateParts {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayWithFrac = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayWithFrac);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const frac = dayWithFrac - day;
  let totalSeconds = Math.round(frac * 86400);
  const hour = Math.floor(totalSeconds / 3600);
  totalSeconds -= hour * 3600;
  const minute = Math.floor(totalSeconds / 60);
  const second = totalSeconds - minute * 60;
  return { year, month, day, hour, minute, second };
}

type ToJdResult =
  | { error: string }
  | { jd: number; jdn: number; mjd: number; iso: string };

function computeToJd(dateStr: string, timeStr: string): ToJdResult {
  const text = dateStr.trim();
  if (!text) return { error: 'Pick a date.' };
  const dm = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(text);
  if (!dm) return { error: 'Date must be YYYY-MM-DD.' };
  const year = Number(dm[1] ?? '');
  const month = Number(dm[2] ?? '');
  const day = Number(dm[3] ?? '');
  if (month < 1 || month > 12 || day < 1 || day > 31) return { error: 'Month/day out of range.' };

  let hour = 0;
  let minute = 0;
  let second = 0;
  const t = timeStr.trim();
  if (t) {
    const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (!tm) return { error: 'Time must be HH:MM or HH:MM:SS.' };
    hour = Number(tm[1] ?? '0');
    minute = Number(tm[2] ?? '0');
    second = Number(tm[3] ?? '0');
    if (hour > 23 || minute > 59 || second > 59) return { error: 'Time fields out of range.' };
  }
  if (![year, month, day].every(Number.isFinite)) return { error: 'Invalid date fields.' };

  const jd = gregorianToJd(year, month, day, hour, minute, second);
  const jdn = Math.floor(jd + 0.5);
  const mjd = jd - 2400000.5;
  const iso =
    `${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}-${pad2(month)}-${pad2(day)} ` +
    `${pad2(hour)}:${pad2(minute)}:${pad2(second)} UTC`;
  return { jd, jdn, mjd, iso };
}

type FromJdResult =
  | { error: string }
  | { iso: string; jdn: number; mjd: number; jd: number };

function computeFromJd(jdStr: string): FromJdResult {
  const text = jdStr.trim();
  if (!text) return { error: 'Enter a Julian Date.' };
  const jd = Number(text);
  if (!Number.isFinite(jd)) return { error: 'Julian Date must be a number.' };
  if (jd < 0) return { error: 'Julian Date must be non-negative.' };
  const p = jdToGregorian(jd);
  const iso =
    `${p.year < 0 ? '-' : ''}${String(Math.abs(p.year)).padStart(4, '0')}-${pad2(p.month)}-${pad2(p.day)} ` +
    `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)} UTC`;
  return { iso, jdn: Math.floor(jd + 0.5), mjd: jd - 2400000.5, jd };
}

export default function JulianDayNumberTool() {
  const [mode, setMode] = useState<Mode>('toJd');
  const [dateStr, setDateStr] = useState('2000-01-01');
  const [timeStr, setTimeStr] = useState('12:00:00');
  const [jdStr, setJdStr] = useState('2451545.0');

  const toJd = useMemo(() => computeToJd(dateStr, timeStr), [dateStr, timeStr]);
  const fromJd = useMemo(() => computeFromJd(jdStr), [jdStr]);

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="toJd">Date → JD</TabsTrigger>
          <TabsTrigger value="fromJd">JD → Date</TabsTrigger>
        </TabsList>

        <TabsContent value="toJd" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="Date (UTC)">
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Time (UTC)">
                <Input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} placeholder="12:00:00" className="w-32 font-mono" />
              </Field>
            </OptionsBar>
          </Panel>
          {'error' in toJd ? (
            <ErrorBanner error={toJd.error} />
          ) : (
            <Panel>
              <PanelHeader title="Julian Date">
                <CopyButton value={() => `JD ${toJd.jd}\nJDN ${toJd.jdn}\nMJD ${toJd.mjd}`} />
              </PanelHeader>
              <div className="rounded-lg border bg-card p-5 text-center">
                <div className="font-mono text-3xl font-semibold">{toJd.jd}</div>
                <div className="text-2xs text-muted-foreground">Julian Date</div>
              </div>
              <div className="divide-y">
                {[
                  ['Julian Date (JD)', String(toJd.jd)],
                  ['Julian Day Number (JDN)', String(toJd.jdn)],
                  ['Modified Julian Date (MJD)', String(toJd.mjd)],
                  ['Input (UTC)', toJd.iso],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                      <span>{v}</span>
                      <CopyButton value={v ?? ''} size="icon-sm" />
                    </span>
                  </div>
                ))}
              </div>
              <StatBar items={['MJD = JD − 2400000.5']} />
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="fromJd" className="space-y-4">
          <Panel>
            <OptionsBar>
              <Field label="Julian Date" className="min-w-[200px] flex-1">
                <Input value={jdStr} onChange={(e) => setJdStr(e.target.value)} placeholder="2451545.0" inputMode="decimal" className="font-mono" />
              </Field>
            </OptionsBar>
          </Panel>
          {'error' in fromJd ? (
            <ErrorBanner error={fromJd.error} />
          ) : (
            <Panel>
              <PanelHeader title="Gregorian datetime">
                <CopyButton value={fromJd.iso} />
              </PanelHeader>
              <div className="rounded-lg border bg-card p-5 text-center">
                <div className="font-mono text-2xl font-semibold">{fromJd.iso}</div>
                <div className="text-2xs text-muted-foreground">reconstructed from JD {fromJd.jd}</div>
              </div>
              <div className="divide-y">
                {[
                  ['Gregorian (UTC)', fromJd.iso],
                  ['Julian Day Number (JDN)', String(fromJd.jdn)],
                  ['Modified Julian Date (MJD)', String(fromJd.mjd)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2">
                    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                      <span>{v}</span>
                      <CopyButton value={v ?? ''} size="icon-sm" />
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
