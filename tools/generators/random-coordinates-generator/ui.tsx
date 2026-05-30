'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Format = 'lat-lng' | 'lng-lat' | 'geojson';

/** Uniform float in [0, 1) from a fresh 32-bit value. */
function rand(): number {
  const a = new Uint32Array(1);
  wc.getRandomValues(a);
  return (a[0] ?? 0) / 4294967296;
}

function clampNum(s: string, lo: number, hi: number, fallback: number): number {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export default function RandomCoordinatesGenerator() {
  const [minLat, setMinLat] = useState('-90');
  const [maxLat, setMaxLat] = useState('90');
  const [minLng, setMinLng] = useState('-180');
  const [maxLng, setMaxLng] = useState('180');
  const [decimals, setDecimals] = useState('6');
  const [format, setFormat] = useState<Format>('lat-lng');
  const [uniformSphere, setUniformSphere] = useState(true);

  const gen = (): string => {
    let lo = clampNum(minLat, -90, 90, -90);
    let hi = clampNum(maxLat, -90, 90, 90);
    if (lo > hi) [lo, hi] = [hi, lo];
    let lloLng = clampNum(minLng, -180, 180, -180);
    let hhiLng = clampNum(maxLng, -180, 180, 180);
    if (lloLng > hhiLng) [lloLng, hhiLng] = [hhiLng, lloLng];

    const dp = Math.min(8, Math.max(0, Math.round(Number(decimals) || 0)));

    let lat: number;
    if (uniformSphere) {
      // Sample sin(lat) uniformly within [sin(lo), sin(hi)] for equal-area on sphere.
      const sLo = Math.sin((lo * Math.PI) / 180);
      const sHi = Math.sin((hi * Math.PI) / 180);
      const s = sLo + rand() * (sHi - sLo);
      const clamped = Math.min(1, Math.max(-1, s));
      lat = (Math.asin(clamped) * 180) / Math.PI;
    } else {
      lat = lo + rand() * (hi - lo);
    }
    const lng = lloLng + rand() * (hhiLng - lloLng);

    const latS = lat.toFixed(dp);
    const lngS = lng.toFixed(dp);

    if (format === 'lng-lat') return `${lngS},${latS}`;
    if (format === 'geojson') {
      return JSON.stringify({
        type: 'Point',
        coordinates: [Number(lngS), Number(latS)],
      });
    }
    return `${latS},${lngS}`;
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[minLat, maxLat, minLng, maxLng, decimals, format, uniformSphere]}
      defaultCount={10}
      maxCount={1000}
      downloadName="coordinates.txt"
      label="Coordinates"
      options={
        <>
          <Field label="Min lat" className="w-24">
            <Input
              value={minLat}
              onChange={(e) => setMinLat(e.target.value)}
              inputMode="decimal"
              className="font-mono"
            />
          </Field>
          <Field label="Max lat" className="w-24">
            <Input
              value={maxLat}
              onChange={(e) => setMaxLat(e.target.value)}
              inputMode="decimal"
              className="font-mono"
            />
          </Field>
          <Field label="Min lng" className="w-24">
            <Input
              value={minLng}
              onChange={(e) => setMinLng(e.target.value)}
              inputMode="decimal"
              className="font-mono"
            />
          </Field>
          <Field label="Max lng" className="w-24">
            <Input
              value={maxLng}
              onChange={(e) => setMaxLng(e.target.value)}
              inputMode="decimal"
              className="font-mono"
            />
          </Field>
          <Field label="Decimals" className="w-20">
            <Input
              type="number"
              min={0}
              max={8}
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lat-lng">lat,lng</SelectItem>
                <SelectItem value="lng-lat">lng,lat</SelectItem>
                <SelectItem value="geojson">GeoJSON Point</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sampling">
            <div className="flex h-9 items-center gap-2">
              <Switch
                id="uniform-sphere"
                checked={uniformSphere}
                onCheckedChange={setUniformSphere}
              />
              <Label htmlFor="uniform-sphere" className="text-xs">
                {uniformSphere ? 'Uniform on sphere' : 'Uniform in degrees'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
