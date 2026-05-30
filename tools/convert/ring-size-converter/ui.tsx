'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ISO 8653 / common US ring-size relation:
//   inner circumference (mm) = EU/ISO size, diameter = circumference / pi.
// US whole-size step is ~0.8128 mm of diameter; US 3 ~= 14.07 mm diameter.
// UK/AU use a letter scale (A..Z with half steps) offset from US by ~ (UK = 2*US - ~0.5),
//   the standard chart maps US to UK letters as below.

const DIAMETER_AT_US3 = 14.07; // mm
const MM_PER_US_SIZE = 0.8128; // diameter mm per full US size

// UK / Australia letter scale aligned to US sizes per the standard jeweller chart.
// Index 0 = US 3, each step = +0.5 US.
const UK_LETTERS: string[] = [
  'F', 'F½', 'G', 'H', 'H½', 'I', 'J', 'J½', 'K', 'L', 'L½',
  'M', 'N', 'N½', 'O', 'P', 'P½', 'Q', 'R', 'R½', 'S', 'T',
];

interface Row {
  us: number;
  uk: string;
  eu: number; // ISO circumference, mm
  jp: number; // Japan size
  diaMm: number;
  circMm: number;
}

// Japan sizes follow a near-linear chart: JP ~ (US - 3) * 2 + 4, rounded to a whole number.
function japanSize(usIndex: number): number {
  return Math.round(usIndex + 4);
}

const ROWS: Row[] = (() => {
  const out: Row[] = [];
  // US 3 .. 13.5 in half steps => 22 rows (indices 0..21)
  for (let i = 0; i <= 21; i++) {
    const us = 3 + i * 0.5;
    const dia = DIAMETER_AT_US3 + i * (MM_PER_US_SIZE / 2);
    const circ = dia * Math.PI;
    out.push({
      us,
      uk: UK_LETTERS[i] ?? '—',
      eu: Math.round(circ * 10) / 10,
      jp: japanSize(i),
      diaMm: Math.round(dia * 100) / 100,
      circMm: Math.round(circ * 100) / 100,
    });
  }
  return out;
})();

type System = 'us' | 'uk' | 'eu' | 'jp';

function mmToIn(mm: number): string {
  return (mm / 25.4).toFixed(3);
}

export default function RingSizeConverter() {
  const [system, setSystem] = useState<System>('us');
  const [q, setQ] = useState('7');
  const [diaUnit, setDiaUnit] = useState<'mm' | 'in'>('mm');

  const matchIndex = useMemo<number>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return -1;
    if (system === 'us') {
      const n = Number(s);
      if (!Number.isFinite(n)) return -1;
      return ROWS.findIndex((r) => Math.abs(r.us - n) < 0.001);
    }
    if (system === 'uk') {
      const norm = s.replace('1/2', '½').toUpperCase();
      return ROWS.findIndex((r) => r.uk.toUpperCase() === norm);
    }
    if (system === 'eu') {
      const n = Number(s);
      if (!Number.isFinite(n)) return -1;
      // nearest EU/ISO circumference
      let best = -1;
      let bestDiff = Infinity;
      ROWS.forEach((r, i) => {
        const d = Math.abs(r.eu - n);
        if (d < bestDiff) {
          bestDiff = d;
          best = i;
        }
      });
      return bestDiff <= 1.5 ? best : -1;
    }
    // jp
    const n = Number(s);
    if (!Number.isFinite(n)) return -1;
    return ROWS.findIndex((r) => r.jp === Math.round(n));
  }, [q, system]);

  const placeholder =
    system === 'us'
      ? 'e.g. 7 or 7.5'
      : system === 'uk'
        ? 'e.g. N or N½'
        : system === 'eu'
          ? 'e.g. 54 (mm circumference)'
          : 'e.g. 14 (Japan)';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Look up by">
            <Tabs value={system} onValueChange={(v) => setSystem(v as System)}>
              <TabsList>
                <TabsTrigger value="us">US / CA</TabsTrigger>
                <TabsTrigger value="uk">UK / AU</TabsTrigger>
                <TabsTrigger value="eu">EU / ISO</TabsTrigger>
                <TabsTrigger value="jp">Japan</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Your size" className="min-w-[160px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          </Field>
          <Field label="Diameter unit">
            <Tabs value={diaUnit} onValueChange={(v) => setDiaUnit(v as 'mm' | 'in')}>
              <TabsList>
                <TabsTrigger value="mm">mm</TabsTrigger>
                <TabsTrigger value="in">inches</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Ring size chart (ISO 8653)">
          {matchIndex >= 0 && (
            <CopyButton
              value={() => {
                const r = ROWS[matchIndex];
                if (!r) return '';
                return `US ${r.us} · UK ${r.uk} · EU ${r.eu} · JP ${r.jp} · Ø ${r.diaMm}mm · circ ${r.circMm}mm`;
              }}
            />
          )}
        </PanelHeader>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-2xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">US / CA</th>
                <th className="px-3 py-2 text-left font-medium">UK / AU</th>
                <th className="px-3 py-2 text-left font-medium">EU / ISO</th>
                <th className="px-3 py-2 text-left font-medium">Japan</th>
                <th className="px-3 py-2 text-left font-medium">Inner Ø</th>
                <th className="px-3 py-2 text-left font-medium">Circumference</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.us}
                  className={cn(
                    'border-t font-mono',
                    i === matchIndex && 'bg-primary/15 font-semibold'
                  )}
                >
                  <td className="px-3 py-1.5">{r.us}</td>
                  <td className="px-3 py-1.5">{r.uk}</td>
                  <td className="px-3 py-1.5">{r.eu}</td>
                  <td className="px-3 py-1.5">{r.jp}</td>
                  <td className="px-3 py-1.5">
                    {diaUnit === 'mm' ? `${r.diaMm} mm` : `${mmToIn(r.diaMm)} in`}
                  </td>
                  <td className="px-3 py-1.5">
                    {diaUnit === 'mm' ? `${r.circMm} mm` : `${mmToIn(r.circMm)} in`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StatBar
          items={[
            `${ROWS.length} sizes (US 3–13.5)`,
            matchIndex >= 0 ? 'match highlighted' : 'no exact match',
          ]}
        />
      </Panel>
    </div>
  );
}
