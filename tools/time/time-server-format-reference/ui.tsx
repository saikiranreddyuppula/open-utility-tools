'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function p2(n: number): string {
  return String(n).padStart(2, '0');
}
function p3(n: number): string {
  return String(n).padStart(3, '0');
}

// Local offset like +05:30 / -08:00 plus a compact +0530 variant.
function offsetParts(d: Date): { colon: string; compact: string } {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const hh = p2(Math.floor(abs / 60));
  const mm = p2(abs % 60);
  return { colon: `${sign}${hh}:${mm}`, compact: `${sign}${hh}${mm}` };
}

interface Row {
  label: string;
  value: string;
}

function buildRows(d: Date): Row[] {
  const off = offsetParts(d);
  const dowUTC = DAYS[d.getUTCDay()] ?? 'Sun';
  const monUTC = MONTHS[d.getUTCMonth()] ?? 'Jan';
  const dowLocal = DAYS[d.getDay()] ?? 'Sun';
  const monLocal = MONTHS[d.getMonth()] ?? 'Jan';

  const isoUtc = d.toISOString(); // RFC 3339 with Z, ms
  const isoLocal = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${off.colon}`;
  const rfc2822 = `${dowLocal}, ${p2(d.getDate())} ${monLocal} ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${off.compact}`;
  const httpDate = `${dowUTC}, ${p2(d.getUTCDate())} ${monUTC} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`;
  const sqlUtc = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  const unixSec = Math.floor(d.getTime() / 1000);
  const unixMs = d.getTime();
  // .NET DateTime ticks: 100-ns intervals since 0001-01-01. Offset for 1970 epoch = 621355968000000000.
  const dotnetTicks = (BigInt(unixMs) * 10000n + 621355968000000000n).toString();
  const cookieExpires = `${dowUTC}, ${p2(d.getUTCDate())}-${monUTC}-${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`;
  const w3c = isoUtc.replace(/\.\d{3}Z$/, 'Z');
  const isoBasic = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

  return [
    { label: 'ISO 8601 / RFC 3339 (UTC, Z)', value: isoUtc },
    { label: 'ISO 8601 with local offset', value: isoLocal },
    { label: 'ISO 8601 basic (no separators)', value: isoBasic },
    { label: 'RFC 2822 / email Date', value: rfc2822 },
    { label: 'HTTP-date (RFC 7231, GMT)', value: httpDate },
    { label: 'SQL DATETIME (UTC)', value: sqlUtc },
    { label: 'JavaScript Date.toString()', value: d.toString() },
    { label: 'JavaScript Date.toUTCString()', value: d.toUTCString() },
    { label: 'Unix seconds', value: String(unixSec) },
    { label: 'Unix milliseconds', value: String(unixMs) },
    { label: '.NET DateTime ticks', value: dotnetTicks },
    { label: 'Cookie expires (RFC 6265)', value: cookieExpires },
    { label: 'W3C datetime', value: w3c },
    { label: `Local UTC offset`, value: `${off.colon} (${off.compact})` },
    { label: 'Milliseconds component', value: `${p3(d.getUTCMilliseconds())} ms` },
  ];
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

// Fixed sample instant: 2026-03-09T17:05:09Z, with 42 ms.
const SAMPLE = new Date('2026-03-09T17:05:09.042Z');

export default function TimeServerFormatReferenceTool() {
  const [value, setValue] = useState(toLocalInput(SAMPLE));

  const { rows, error } = useMemo<{ rows: Row[]; error: string | null }>(() => {
    if (!value) return { rows: buildRows(SAMPLE), error: null };
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { rows: [], error: 'Enter a valid datetime.' };
    return { rows: buildRows(d), error: null };
  }, [value]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Instant (local time)" className="min-w-[260px]">
            <Input type="datetime-local" step={1} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Button variant="secondary" size="sm" onClick={() => setValue(toLocalInput(new Date()))}>
            Now
          </Button>
          <Button variant="outline" size="sm" onClick={() => setValue(toLocalInput(SAMPLE))}>
            Sample
          </Button>
        </OptionsBar>
      </Panel>

      {error ? (
        <Panel>
          <div className="px-3 py-8 text-center text-sm text-destructive">{error}</div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Formats for this instant">
            <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-64 shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${rows.length} formats`, `Unix: ${rows.find((r) => r.label === 'Unix seconds')?.value ?? ''}`]} />
        </Panel>
      )}
    </div>
  );
}
