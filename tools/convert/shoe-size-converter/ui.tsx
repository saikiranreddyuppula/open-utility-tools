'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Gender = 'men' | 'women';
type System = 'us' | 'uk' | 'eu' | 'cm';

interface Row {
  us: number;
  uk: number;
  eu: number;
  cm: number; // foot length in cm (Japan / Mondopoint, heel-to-toe)
}

// Published men's chart (US / UK / EU / foot length cm). UK = US - 0.5.
const MEN: Row[] = [
  { us: 4, uk: 3.5, eu: 36, cm: 22.4 },
  { us: 4.5, uk: 4, eu: 36.5, cm: 22.9 },
  { us: 5, uk: 4.5, eu: 37.5, cm: 23.3 },
  { us: 5.5, uk: 5, eu: 38, cm: 23.7 },
  { us: 6, uk: 5.5, eu: 38.5, cm: 24.1 },
  { us: 6.5, uk: 6, eu: 39, cm: 24.6 },
  { us: 7, uk: 6.5, eu: 40, cm: 25.0 },
  { us: 7.5, uk: 7, eu: 40.5, cm: 25.4 },
  { us: 8, uk: 7.5, eu: 41, cm: 25.8 },
  { us: 8.5, uk: 8, eu: 42, cm: 26.2 },
  { us: 9, uk: 8.5, eu: 42.5, cm: 26.7 },
  { us: 9.5, uk: 9, eu: 43, cm: 27.1 },
  { us: 10, uk: 9.5, eu: 44, cm: 27.5 },
  { us: 10.5, uk: 10, eu: 44.5, cm: 27.9 },
  { us: 11, uk: 10.5, eu: 45, cm: 28.3 },
  { us: 11.5, uk: 11, eu: 45.5, cm: 28.8 },
  { us: 12, uk: 11.5, eu: 46, cm: 29.2 },
  { us: 13, uk: 12.5, eu: 47.5, cm: 30.0 },
  { us: 14, uk: 13.5, eu: 48.5, cm: 30.8 },
  { us: 15, uk: 14.5, eu: 49.5, cm: 31.7 },
];

// Published women's chart (US / UK / EU / foot length cm). UK = US - 2.
const WOMEN: Row[] = [
  { us: 4, uk: 2, eu: 35, cm: 21.6 },
  { us: 4.5, uk: 2.5, eu: 35, cm: 22.0 },
  { us: 5, uk: 3, eu: 35.5, cm: 22.4 },
  { us: 5.5, uk: 3.5, eu: 36, cm: 22.9 },
  { us: 6, uk: 4, eu: 36.5, cm: 23.3 },
  { us: 6.5, uk: 4.5, eu: 37, cm: 23.7 },
  { us: 7, uk: 5, eu: 37.5, cm: 24.1 },
  { us: 7.5, uk: 5.5, eu: 38, cm: 24.6 },
  { us: 8, uk: 6, eu: 38.5, cm: 25.0 },
  { us: 8.5, uk: 6.5, eu: 39, cm: 25.4 },
  { us: 9, uk: 7, eu: 39.5, cm: 25.8 },
  { us: 9.5, uk: 7.5, eu: 40, cm: 26.2 },
  { us: 10, uk: 8, eu: 40.5, cm: 26.7 },
  { us: 10.5, uk: 8.5, eu: 41, cm: 27.1 },
  { us: 11, uk: 9, eu: 41.5, cm: 27.5 },
  { us: 11.5, uk: 9.5, eu: 42, cm: 27.9 },
  { us: 12, uk: 10, eu: 42.5, cm: 28.3 },
];

function mmCmToIn(cm: number): string {
  return (cm / 2.54).toFixed(2);
}

export default function ShoeSizeConverter() {
  const [gender, setGender] = useState<Gender>('men');
  const [system, setSystem] = useState<System>('us');
  const [q, setQ] = useState('9');
  const [cmUnit, setCmUnit] = useState<'cm' | 'in'>('cm');

  const rows = gender === 'men' ? MEN : WOMEN;

  const matchIndex = useMemo<number>(() => {
    const n = Number(q.trim());
    if (!Number.isFinite(n)) return -1;
    let best = -1;
    let bestDiff = Infinity;
    rows.forEach((r, i) => {
      const target = system === 'us' ? r.us : system === 'uk' ? r.uk : system === 'eu' ? r.eu : r.cm;
      const d = Math.abs(target - n);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    });
    const tolerance = system === 'eu' ? 0.75 : system === 'cm' ? 0.4 : 0.26;
    return bestDiff <= tolerance ? best : -1;
  }, [q, system, rows]);

  const placeholder =
    system === 'us'
      ? 'e.g. 9'
      : system === 'uk'
        ? 'e.g. 8.5'
        : system === 'eu'
          ? 'e.g. 42.5'
          : 'foot length cm, e.g. 26.7';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Gender">
            <Tabs value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <TabsList>
                <TabsTrigger value="men">Men</TabsTrigger>
                <TabsTrigger value="women">Women</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Look up by">
            <Tabs value={system} onValueChange={(v) => setSystem(v as System)}>
              <TabsList>
                <TabsTrigger value="us">US</TabsTrigger>
                <TabsTrigger value="uk">UK</TabsTrigger>
                <TabsTrigger value="eu">EU</TabsTrigger>
                <TabsTrigger value="cm">cm</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Your size" className="min-w-[150px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} inputMode="decimal" />
          </Field>
          <Field label="Length unit">
            <Tabs value={cmUnit} onValueChange={(v) => setCmUnit(v as 'cm' | 'in')}>
              <TabsList>
                <TabsTrigger value="cm">cm</TabsTrigger>
                <TabsTrigger value="in">inches</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title={`${gender === 'men' ? "Men's" : "Women's"} shoe size chart`}>
          {matchIndex >= 0 && (
            <CopyButton
              value={() => {
                const r = rows[matchIndex];
                if (!r) return '';
                return `US ${r.us} · UK ${r.uk} · EU ${r.eu} · ${r.cm} cm foot length`;
              }}
            />
          )}
        </PanelHeader>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-2xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">US</th>
                <th className="px-3 py-2 text-left font-medium">UK</th>
                <th className="px-3 py-2 text-left font-medium">EU</th>
                <th className="px-3 py-2 text-left font-medium">Foot length</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.us}
                  className={cn('border-t font-mono', i === matchIndex && 'bg-primary/15 font-semibold')}
                >
                  <td className="px-3 py-1.5">{r.us}</td>
                  <td className="px-3 py-1.5">{r.uk}</td>
                  <td className="px-3 py-1.5">{r.eu}</td>
                  <td className="px-3 py-1.5">
                    {cmUnit === 'cm' ? `${r.cm} cm` : `${mmCmToIn(r.cm)} in`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StatBar
          items={[
            `${rows.length} sizes`,
            matchIndex >= 0 ? 'match highlighted' : 'no close match',
            'approximate — brands vary',
          ]}
        />
      </Panel>
    </div>
  );
}
