'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Fmt = 'decimal' | 'dms';

type Result =
  | { error: string }
  | {
      distKm: number;
      bearing: number;
      compass: string;
    };

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

function compassPoint(bearing: number): string {
  const idx = Math.round(bearing / 22.5) % 16;
  return COMPASS[idx] ?? 'N';
}

function parseCoord(str: string, fmt: Fmt): number | null {
  const s = str.trim();
  if (s === '') return null;
  if (fmt === 'decimal') {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  // DMS parse
  const hemiMatch = s.match(/([NSEW])\s*$/i) ?? s.match(/^\s*([NSEW])/i);
  const hemi = hemiMatch?.[1]?.toUpperCase() ?? '';
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const deg = Number(nums[0] ?? '0');
  const min = nums.length > 1 ? Number(nums[1] ?? '0') : 0;
  const sec = nums.length > 2 ? Number(nums[2] ?? '0') : 0;
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  let v = Math.abs(deg) + min / 60 + sec / 3600;
  if (deg < 0 || hemi === 'S' || hemi === 'W') v = -v;
  return v;
}

export default function GreatCircleDistance() {
  const [fmt, setFmt] = useState<Fmt>('decimal');
  const [lat1, setLat1] = useState('40.7128');
  const [lon1, setLon1] = useState('-74.0060');
  const [lat2, setLat2] = useState('51.5074');
  const [lon2, setLon2] = useState('-0.1278');
  const [radius, setRadius] = useState('6371');

  const result = useMemo<Result>(() => {
    const la1 = parseCoord(lat1, fmt);
    const lo1 = parseCoord(lon1, fmt);
    const la2 = parseCoord(lat2, fmt);
    const lo2 = parseCoord(lon2, fmt);
    if (la1 === null || lo1 === null || la2 === null || lo2 === null) {
      return { error: 'Enter valid coordinates for both points.' };
    }
    if (Math.abs(la1) > 90 || Math.abs(la2) > 90) return { error: 'Latitude must be within ±90°.' };
    if (Math.abs(lo1) > 180 || Math.abs(lo2) > 180) return { error: 'Longitude must be within ±180°.' };

    const R = Number(radius);
    if (!Number.isFinite(R) || R <= 0) return { error: 'Earth radius must be a positive number.' };

    const toRad = (d: number) => (d * Math.PI) / 180;
    const p1 = toRad(la1);
    const p2 = toRad(la2);
    const dp = toRad(la2 - la1);
    const dl = toRad(lo2 - lo1);

    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;

    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return { distKm, bearing, compass: compassPoint(bearing) };
  }, [lat1, lon1, lat2, lon2, radius, fmt]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Input format">
            <Tabs value={fmt} onValueChange={(v) => setFmt(v as Fmt)}>
              <TabsList>
                <TabsTrigger value="decimal">Decimal</TabsTrigger>
                <TabsTrigger value="dms">DMS</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Earth radius (km)" hint="6371 mean, 6378 equatorial">
            <Input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="decimal" className="w-28" />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Point A latitude">
            <Input value={lat1} onChange={(e) => setLat1(e.target.value)} className="font-mono w-40" />
          </Field>
          <Field label="Point A longitude">
            <Input value={lon1} onChange={(e) => setLon1(e.target.value)} className="font-mono w-40" />
          </Field>
          <Field label="Point B latitude">
            <Input value={lat2} onChange={(e) => setLat2(e.target.value)} className="font-mono w-40" />
          </Field>
          <Field label="Point B longitude">
            <Input value={lon2} onChange={(e) => setLon2(e.target.value)} className="font-mono w-40" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Distance & bearing">
            <CopyButton
              value={() =>
                [
                  `Distance: ${result.distKm.toFixed(3)} km`,
                  `Distance: ${(result.distKm * 0.621371).toFixed(3)} mi`,
                  `Distance: ${(result.distKm / 1.852).toFixed(3)} nmi`,
                  `Bearing: ${result.bearing.toFixed(2)}° (${result.compass})`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Distance (km)', value: result.distKm.toFixed(3) },
              { label: 'Distance (mi)', value: (result.distKm * 0.621371).toFixed(3) },
              { label: 'Distance (nmi)', value: (result.distKm / 1.852).toFixed(3) },
              {
                label: 'Initial bearing',
                value: `${result.bearing.toFixed(2)}° ${result.compass}`,
              },
            ].map((r) => (
              <div key={r.label} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-2xs text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Haversine on a spherical Earth', `Radius = ${radius} km`]} />
        </Panel>
      )}
    </div>
  );
}
