'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Country = 'US' | 'UK' | 'CA' | 'DE' | 'FR' | 'AU' | 'Generic';
type Format = 'labels' | 'json' | 'csv';

const STREET_NAMES = [
  'Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lincoln', 'Park', 'Hill',
  'Sunset', 'Lake', 'River', 'Forest', 'Spring', 'Church', 'Market', 'Bridge',
  'King', 'Queen', 'Victoria', 'Station', 'High', 'Mill', 'Garden', 'Meadow',
];
const STREET_SUFFIX = ['Street', 'Avenue', 'Road', 'Lane', 'Drive', 'Boulevard', 'Court', 'Way', 'Place', 'Terrace'];
const CITIES = [
  'Springfield', 'Riverside', 'Fairview', 'Greenville', 'Madison', 'Georgetown',
  'Clinton', 'Franklin', 'Salem', 'Bristol', 'Newport', 'Ashland', 'Oxford',
  'Burlington', 'Manchester', 'Kingston', 'Hamilton', 'Richmond', 'Auburn', 'Dover',
];
const UNITS = ['Apt', 'Unit', 'Suite', 'Flat', '#'];

interface CountrySpec {
  name: string;
  regions: string[];
  /** Mask: # = digit, A = uppercase letter, anything else literal. */
  postalMask: string;
}

const COUNTRIES: Record<Country, CountrySpec> = {
  US: {
    name: 'United States',
    regions: ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'WA', 'AZ'],
    postalMask: '#####',
  },
  UK: {
    name: 'United Kingdom',
    regions: ['England', 'Scotland', 'Wales', 'N. Ireland'],
    postalMask: 'A#A #AA',
  },
  CA: {
    name: 'Canada',
    regions: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB'],
    postalMask: 'A#A #A#',
  },
  DE: {
    name: 'Germany',
    regions: ['Bayern', 'Berlin', 'Hessen', 'Sachsen', 'NRW', 'Hamburg'],
    postalMask: '#####',
  },
  FR: {
    name: 'France',
    regions: ['Île-de-France', 'Occitanie', 'Bretagne', 'Normandie', 'Grand Est'],
    postalMask: '#####',
  },
  AU: {
    name: 'Australia',
    regions: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
    postalMask: '####',
  },
  Generic: {
    name: 'Generic',
    regions: ['North', 'South', 'East', 'West', 'Central'],
    postalMask: '#####',
  },
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], rand: () => number, fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[Math.floor(rand() * arr.length)] ?? fallback;
}

function fillMask(mask: string, rand: () => number): string {
  let out = '';
  for (const ch of mask) {
    if (ch === '#') out += String(Math.floor(rand() * 10));
    else if (ch === 'A') out += LETTERS[Math.floor(rand() * LETTERS.length)] ?? 'A';
    else out += ch;
  }
  return out;
}

interface Address {
  house: string;
  street: string;
  unit: string;
  city: string;
  region: string;
  postal: string;
  country: string;
}

function genAddress(country: Country, rand: () => number): Address {
  const spec = COUNTRIES[country];
  const house = String(1 + Math.floor(rand() * 9999));
  const street = `${pick(STREET_NAMES, rand, 'Main')} ${pick(STREET_SUFFIX, rand, 'Street')}`;
  const hasUnit = rand() < 0.35;
  const unit = hasUnit ? `${pick(UNITS, rand, 'Apt')} ${1 + Math.floor(rand() * 200)}` : '';
  const city = pick(CITIES, rand, 'Springfield');
  const region = pick(spec.regions, rand, '—');
  const postal = fillMask(spec.postalMask, rand);
  return { house, street, unit, city, region, postal, country: spec.name };
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function FakeAddressGeneratorTool() {
  const [country, setCountry] = useState<Country>('US');
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState<Format>('labels');
  const [seed, setSeed] = useState('');

  const safeCount = Number.isFinite(count) ? Math.min(500, Math.max(1, Math.floor(count))) : 10;

  const addresses = useMemo(() => {
    const seedNum = seed.trim() ? hashSeed(seed.trim() + country) : (Date.now() >>> 0);
    const rand = mulberry32(seedNum);
    return Array.from({ length: safeCount }, () => genAddress(country, rand));
  }, [country, safeCount, seed]);

  const formatLabel = (a: Address): string => {
    const line1 = a.unit ? `${a.house} ${a.street}, ${a.unit}` : `${a.house} ${a.street}`;
    return `${line1}\n${a.city}, ${a.region} ${a.postal}\n${a.country}`;
  };

  const output = useMemo(() => {
    if (format === 'json') {
      return JSON.stringify(addresses, null, 2);
    }
    if (format === 'csv') {
      const header = 'house,street,unit,city,region,postal,country';
      const rows = addresses.map((a) =>
        [a.house, a.street, a.unit, a.city, a.region, a.postal, a.country].map(csvField).join(',')
      );
      return [header, ...rows].join('\n');
    }
    return addresses.map(formatLabel).join('\n\n');
  }, [addresses, format]);

  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Country format">
          <Select value={country} onValueChange={(v) => setCountry(v as Country)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COUNTRIES) as Country[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {COUNTRIES[c].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={500}
            value={Number.isFinite(count) ? count : 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.min(500, Math.max(1, Math.floor(n))) : 1);
            }}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Output">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="labels">Mailing labels</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Seed" hint="optional, reproducible">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-28 font-mono"
            placeholder="random"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Fake addresses (test data)">
          <CopyButton value={() => output} label="Copy all" disabled={!output} />
          <DownloadButton data={() => output} filename={`addresses.${ext}`} disabled={!output} />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto p-3 font-mono text-xs">{output}</pre>
        <StatBar
          items={[
            `${addresses.length.toLocaleString()} addresses`,
            COUNTRIES[country].name,
            seed.trim() ? `seed: ${seed.trim()}` : false,
          ]}
        />
      </Panel>
    </div>
  );
}
