'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Direction = 'ns2date' | 'date2ns';

const NS_PER_SEC = 1_000_000_000n;
const NS_PER_MS = 1_000_000n;

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

/** Format a UTC datetime with 9-digit fractional seconds from a total ns BigInt. */
function formatNs(totalNs: bigint): { iso: string; secFrac: string } {
  // Floor division toward negative infinity for the seconds part.
  let seconds = totalNs / NS_PER_SEC;
  let frac = totalNs % NS_PER_SEC;
  if (frac < 0n) {
    frac += NS_PER_SEC;
    seconds -= 1n;
  }
  const ms = Number(seconds * 1000n);
  const date = new Date(ms);
  const fracStr = frac.toString().padStart(9, '0');
  const iso =
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}` +
    `.${fracStr}Z`;
  const secFrac = `${seconds.toString()}.${fracStr}`;
  return { iso, secFrac };
}

export default function UnixNanosecondsConverter() {
  const [direction, setDirection] = useState<Direction>('ns2date');
  const [nsInput, setNsInput] = useState('1700000000123456789');
  const [dateInput, setDateInput] = useState('2023-11-14T22:13:20Z');
  const [subNs, setSubNs] = useState('123456789');

  const result = useMemo(() => {
    if (direction === 'ns2date') {
      const t = nsInput.trim().replace(/_/g, '');
      if (!/^-?\d+$/.test(t)) return { error: 'Enter an integer number of nanoseconds.' };
      let ns: bigint;
      try {
        ns = BigInt(t);
      } catch {
        return { error: 'Could not parse the nanosecond value.' };
      }
      const { iso, secFrac } = formatNs(ns);
      let wholeSec = ns / NS_PER_SEC;
      let rem = ns % NS_PER_SEC;
      if (rem < 0n) {
        rem += NS_PER_SEC;
        wholeSec -= 1n;
      }
      return {
        fullNs: ns.toString(),
        secFrac,
        iso,
        wholeSeconds: wholeSec.toString(),
        subSecond: rem.toString().padStart(9, '0'),
      };
    }

    // date2ns
    const ms = Date.parse(dateInput.trim());
    if (Number.isNaN(ms)) {
      return { error: 'Enter a parseable ISO datetime (e.g. 2023-11-14T22:13:20Z).' };
    }
    const subRaw = subNs.trim() || '0';
    if (!/^\d{1,9}$/.test(subRaw)) {
      return { error: 'Sub-millisecond nanoseconds must be 0–999999999 (up to 9 digits).' };
    }
    // Date.parse gives whole milliseconds. The sub-ns field replaces the
    // sub-millisecond portion of the timestamp (the extra 6 digits beyond ms).
    const sub = BigInt(subRaw.padStart(9, '0'));
    if (sub >= NS_PER_SEC) return { error: 'Sub-second nanoseconds exceed one second.' };
    const wholeMs = BigInt(ms);
    const fracMsPart = ((wholeMs % 1000n) + 1000n) % 1000n; // ms component already in the date
    const baseSecMs = wholeMs - fracMsPart;
    const totalNs = baseSecMs * NS_PER_MS + sub;
    const { iso, secFrac } = formatNs(totalNs);
    return {
      fullNs: totalNs.toString(),
      secFrac,
      iso,
      wholeSeconds: (totalNs / NS_PER_SEC).toString(),
      subSecond: (totalNs % NS_PER_SEC).toString().padStart(9, '0'),
    };
  }, [direction, nsInput, dateInput, subNs]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="ns2date">Nanoseconds → Date</TabsTrigger>
                <TabsTrigger value="date2ns">Date → Nanoseconds</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <OptionsBar>
          {direction === 'ns2date' ? (
            <Field label="Unix nanoseconds" className="min-w-[280px] flex-1">
              <Input
                value={nsInput}
                onChange={(e) => setNsInput(e.target.value)}
                inputMode="numeric"
                className="font-mono"
                placeholder="1700000000123456789"
              />
            </Field>
          ) : (
            <>
              <Field label="ISO datetime" className="min-w-[240px] flex-1">
                <Input
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="font-mono"
                  placeholder="2023-11-14T22:13:20Z"
                />
              </Field>
              <Field label="Sub-second ns" hint="0–999999999 (9 digits)">
                <Input
                  value={subNs}
                  onChange={(e) => setSubNs(e.target.value)}
                  inputMode="numeric"
                  className="w-40 font-mono"
                />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Converted">
            <CopyButton
              value={() =>
                [
                  `Nanoseconds: ${result.fullNs}`,
                  `Seconds.fraction: ${result.secFrac}`,
                  `UTC: ${result.iso}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3">
            {[
              { label: 'Full nanosecond integer', value: result.fullNs },
              { label: 'Seconds.fraction', value: result.secFrac },
              { label: 'UTC datetime (9-digit frac)', value: result.iso },
              { label: 'Whole seconds', value: result.wholeSeconds },
              { label: 'Sub-second nanoseconds', value: result.subSecond },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="truncate">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['BigInt math — no float loss', '1 s = 1,000,000,000 ns']} />
        </Panel>
      )}
    </div>
  );
}
