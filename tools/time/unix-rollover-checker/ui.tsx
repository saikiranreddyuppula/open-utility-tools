'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface Milestone {
  name: string;
  value: string;
  datetime: string;
  note: string;
}

function utc(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

// Build the static milestone table. Many of these are exact UTC instants.
function buildMilestones(): Milestone[] {
  const I32_MAX = 2147483647; // seconds
  const U32_MAX = 4294967295; // seconds
  return [
    {
      name: 'Signed 32-bit Unix overflow (Y2038)',
      value: `${I32_MAX} s`,
      datetime: utc(I32_MAX * 1000),
      note: 'time_t as int32 wraps to negative; affects legacy C, embedded, old filesystems.',
    },
    {
      name: 'Unsigned 32-bit Unix overflow',
      value: `${U32_MAX} s`,
      datetime: utc(U32_MAX * 1000),
      note: 'Unsigned 32-bit second counters (some protocols) saturate here.',
    },
    {
      name: 'Year 2000 problem (Y2K)',
      value: '2-digit year 99 → 00',
      datetime: '2000-01-01T00:00:00Z',
      note: 'Two-digit year storage rolled 99 to 00; mostly remediated by 1999.',
    },
    {
      name: 'NTP era rollover (era 0 → 1)',
      value: '2^32 seconds since 1900',
      datetime: '2036-02-07T06:28:16Z',
      note: 'NTP 32-bit seconds field since 1900-01-01 wraps; NTPv4 uses era numbering.',
    },
    {
      name: 'GPS week number rollover (10-bit)',
      value: '1024 weeks',
      datetime: '2038-11-21T00:00:00Z',
      note: 'Legacy 10-bit GPS week counter wraps every 1024 weeks; modern receivers use 13-bit.',
    },
    {
      name: 'Signed 64-bit Unix overflow',
      value: '9223372036854775807 s',
      datetime: '~year 292,277,026,596',
      note: 'int64 time_t — effectively never; this is the modern standard.',
    },
    {
      name: 'Signed 64-bit milliseconds (JS Date max)',
      value: '8640000000000000 ms',
      datetime: '+275760-09-13T00:00:00Z',
      note: 'JavaScript Date caps at ±8.64e15 ms (±100,000,000 days from epoch).',
    },
    {
      name: 'Windows FILETIME (64-bit, 100 ns since 1601)',
      value: '2^64 × 100 ns',
      datetime: '~year 60056',
      note: '100-nanosecond ticks since 1601-01-01 UTC; overflow is far future.',
    },
  ];
}

export default function UnixRolloverCheckerTool() {
  const [raw, setRaw] = useState('');

  const milestones = useMemo(() => buildMilestones(), []);

  const probe = useMemo<{ note: string } | { secISO: string; msISO: string; sec: string; ms: string } | { error: string }>(() => {
    const s = raw.trim();
    if (!s) return { note: 'Optional: paste an integer to interpret it as seconds and milliseconds.' };
    if (!/^-?\d+$/.test(s)) return { error: 'Enter a whole integer (digits only).' };
    let n: bigint;
    try {
      n = BigInt(s);
    } catch {
      return { error: 'Number is not a valid integer.' };
    }
    const asSecMs = n * 1000n;
    const asMs = n;
    const LIMIT = 8640000000000000n; // JS Date range in ms
    const secISO = asSecMs > LIMIT || asSecMs < -LIMIT ? 'Out of representable JS Date range' : utc(Number(asSecMs));
    const msISO = asMs > LIMIT || asMs < -LIMIT ? 'Out of representable JS Date range' : utc(Number(asMs));
    return { secISO, msISO, sec: s, ms: s };
  }, [raw]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Time storage overflow milestones">
          <CopyButton value={() => milestones.map((m) => `${m.name}\t${m.value}\t${m.datetime}`).join('\n')} />
        </PanelHeader>
        <div className="max-h-[420px] divide-y overflow-auto">
          {milestones.map((m) => (
            <div key={m.name} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.name}</span>
                <CopyButton value={m.datetime} size="icon-sm" />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <code className="font-mono text-xs text-muted-foreground">{m.value}</code>
                <code className="font-mono text-xs">{m.datetime}</code>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>
            </div>
          ))}
        </div>
        <StatBar items={[`${milestones.length} milestones`, 'All datetimes in UTC']} />
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="Interpret an integer (optional)" className="min-w-[260px] flex-1">
            <Input value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="numeric" placeholder="e.g. 2147483647" className="font-mono" />
          </Field>
        </OptionsBar>
        <div className="p-3">
          {'error' in probe ? (
            <p className="text-sm text-destructive">{probe.error}</p>
          ) : 'note' in probe ? (
            <p className="text-sm text-muted-foreground">{probe.note}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">As seconds</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span>{probe.secISO}</span>
                  <CopyButton value={probe.secISO} size="icon-sm" />
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">As milliseconds</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span>{probe.msISO}</span>
                  <CopyButton value={probe.msISO} size="icon-sm" />
                </span>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
