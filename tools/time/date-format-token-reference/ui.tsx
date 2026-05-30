'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface Row {
  concept: string;
  example: string;
  moment: string;
  datefns: string;
  strftime: string;
  java: string;
  ldml: string;
}

// Example column reflects the sample instant below.
const SAMPLE = '2026-03-09, 17:05:09 (Mon), tz +05:30';

const DATA: Row[] = [
  { concept: '4-digit year', example: '2026', moment: 'YYYY', datefns: 'yyyy', strftime: '%Y', java: 'yyyy', ldml: 'yyyy' },
  { concept: '2-digit year', example: '26', moment: 'YY', datefns: 'yy', strftime: '%y', java: 'yy', ldml: 'yy' },
  { concept: 'Month, zero-padded', example: '03', moment: 'MM', datefns: 'MM', strftime: '%m', java: 'MM', ldml: 'MM' },
  { concept: 'Month, no pad', example: '3', moment: 'M', datefns: 'M', strftime: '%-m', java: 'M', ldml: 'M' },
  { concept: 'Month full name', example: 'March', moment: 'MMMM', datefns: 'MMMM', strftime: '%B', java: 'MMMM', ldml: 'MMMM' },
  { concept: 'Month abbreviated', example: 'Mar', moment: 'MMM', datefns: 'MMM', strftime: '%b', java: 'MMM', ldml: 'MMM' },
  { concept: 'Day of month, padded', example: '09', moment: 'DD', datefns: 'dd', strftime: '%d', java: 'dd', ldml: 'dd' },
  { concept: 'Day of month, no pad', example: '9', moment: 'D', datefns: 'd', strftime: '%-d', java: 'd', ldml: 'd' },
  { concept: 'Day of year', example: '068', moment: 'DDDD', datefns: 'DDD', strftime: '%j', java: 'DDD', ldml: 'DDD' },
  { concept: 'Weekday full name', example: 'Monday', moment: 'dddd', datefns: 'EEEE', strftime: '%A', java: 'EEEE', ldml: 'EEEE' },
  { concept: 'Weekday abbreviated', example: 'Mon', moment: 'ddd', datefns: 'EEE', strftime: '%a', java: 'EEE', ldml: 'EEE' },
  { concept: 'Weekday number (0-6/1-7)', example: '1', moment: 'd / E', datefns: 'i', strftime: '%u', java: 'e', ldml: 'e' },
  { concept: 'Hour 24h, padded', example: '17', moment: 'HH', datefns: 'HH', strftime: '%H', java: 'HH', ldml: 'HH' },
  { concept: 'Hour 24h, no pad', example: '17', moment: 'H', datefns: 'H', strftime: '%-H', java: 'H', ldml: 'H' },
  { concept: 'Hour 12h, padded', example: '05', moment: 'hh', datefns: 'hh', strftime: '%I', java: 'hh', ldml: 'hh' },
  { concept: 'Hour 12h, no pad', example: '5', moment: 'h', datefns: 'h', strftime: '%-I', java: 'h', ldml: 'h' },
  { concept: 'Minute, padded', example: '05', moment: 'mm', datefns: 'mm', strftime: '%M', java: 'mm', ldml: 'mm' },
  { concept: 'Second, padded', example: '09', moment: 'ss', datefns: 'ss', strftime: '%S', java: 'ss', ldml: 'ss' },
  { concept: 'Milliseconds (3)', example: '042', moment: 'SSS', datefns: 'SSS', strftime: '%3N', java: 'SSS', ldml: 'SSS' },
  { concept: 'AM/PM uppercase', example: 'PM', moment: 'A', datefns: 'a', strftime: '%p', java: 'a', ldml: 'a' },
  { concept: 'am/pm lowercase', example: 'pm', moment: 'a', datefns: 'aaaa', strftime: '%P', java: '—', ldml: 'a' },
  { concept: 'Timezone offset ±HH:MM', example: '+05:30', moment: 'Z', datefns: 'xxx', strftime: '%:z', java: 'XXX', ldml: 'xxx' },
  { concept: 'Timezone offset ±HHMM', example: '+0530', moment: 'ZZ', datefns: 'xx', strftime: '%z', java: 'Z', ldml: 'Z' },
  { concept: 'Timezone name/abbr', example: 'IST', moment: 'z (plugin)', datefns: 'zzz', strftime: '%Z', java: 'zzz', ldml: 'zzz' },
  { concept: 'ISO week of year', example: '11', moment: 'W', datefns: 'I', strftime: '%V', java: 'w', ldml: 'w' },
  { concept: 'ISO week-numbering year', example: '2026', moment: 'GGGG', datefns: 'RRRR', strftime: '%G', java: 'YYYY', ldml: 'YYYY' },
  { concept: 'Quarter (1-4)', example: '1', moment: 'Q', datefns: 'Q', strftime: '—', java: 'Q', ldml: 'Q' },
  { concept: 'Unix timestamp (sec)', example: '1773327309', moment: 'X', datefns: 't', strftime: '%s', java: '—', ldml: '—' },
  { concept: 'Era (AD/BC)', example: 'AD', moment: '—', datefns: 'G', strftime: '—', java: 'G', ldml: 'G' },
  { concept: 'Ordinal day', example: '9th', moment: 'Do', datefns: 'do', strftime: '—', java: '—', ldml: '—' },
];

function Cell({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1">
      <code className="font-mono text-xs">{value}</code>
      {value !== '—' && value !== '' ? <CopyButton value={value} size="icon-sm" /> : null}
    </span>
  );
}

export default function DateFormatTokenReferenceTool() {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DATA;
    return DATA.filter((d) =>
      `${d.concept} ${d.example} ${d.moment} ${d.datefns} ${d.strftime} ${d.java} ${d.ldml}`.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <Panel>
      <PanelHeader title="Date format tokens">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter (year, month, %H, EEE)…" className="h-7 w-56" />
      </PanelHeader>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Concept</th>
              <th className="px-3 py-2 font-medium">Example</th>
              <th className="px-3 py-2 font-medium">Moment/Day.js</th>
              <th className="px-3 py-2 font-medium">date-fns</th>
              <th className="px-3 py-2 font-medium">strftime</th>
              <th className="px-3 py-2 font-medium">Java</th>
              <th className="px-3 py-2 font-medium">LDML/CLDR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.concept} className="border-b">
                <td className="px-3 py-2">{r.concept}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.example}</td>
                <td className="px-3 py-2"><Cell value={r.moment} /></td>
                <td className="px-3 py-2"><Cell value={r.datefns} /></td>
                <td className="px-3 py-2"><Cell value={r.strftime} /></td>
                <td className="px-3 py-2"><Cell value={r.java} /></td>
                <td className="px-3 py-2"><Cell value={r.ldml} /></td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No matching tokens.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <StatBar items={[`${rows.length} of ${DATA.length} rows`, `Example instant: ${SAMPLE}`]} />
    </Panel>
  );
}
