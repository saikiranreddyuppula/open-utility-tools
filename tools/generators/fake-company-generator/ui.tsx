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

type Region = 'US' | 'UK' | 'DE' | 'Generic';
type Format = 'cards' | 'json' | 'csv';

const NOUNS = [
  'Apex', 'Vertex', 'Nimbus', 'Quantum', 'Pioneer', 'Summit', 'Orbit', 'Cobalt',
  'Aurora', 'Catalyst', 'Beacon', 'Helix', 'Vanguard', 'Cascade', 'Pinnacle',
  'Atlas', 'Zenith', 'Meridian', 'Horizon', 'Fusion', 'Pulse', 'Stratus', 'Echo', 'Nova',
];
const NOUNS2 = [
  'Tech', 'Data', 'Cloud', 'Soft', 'Logic', 'Works', 'Dynamics', 'Solutions',
  'Innovations', 'Networks', 'Digital', 'Analytics', 'Robotics', 'Media', 'Ventures',
];
const INDUSTRIES = [
  'Software & SaaS', 'Financial Services', 'Healthcare', 'E-commerce & Retail',
  'Manufacturing', 'Logistics & Supply Chain', 'Renewable Energy', 'Biotechnology',
  'Cybersecurity', 'Telecommunications', 'Real Estate', 'Education Technology',
  'Marketing & Advertising', 'Aerospace', 'Consumer Electronics',
];
const ADJ = ['Scalable', 'Seamless', 'Synergistic', 'Agile', 'Intuitive', 'Robust', 'Dynamic', 'Holistic', 'Frictionless', 'Visionary'];
const CATCH_NOUN = ['solutions', 'systems', 'experiences', 'platforms', 'ecosystems', 'workflows', 'paradigms', 'networks'];
const VERBING = ['empowering', 'streamlining', 'transforming', 'accelerating', 'optimizing', 'revolutionizing', 'unlocking', 'reimagining'];

const SUFFIXES: Record<Region, string[]> = {
  US: ['Inc.', 'LLC', 'Corp.', 'Co.'],
  UK: ['Ltd', 'PLC', 'LLP'],
  DE: ['GmbH', 'AG', 'KG', 'SE'],
  Generic: ['Group', 'Labs', 'Systems', 'Holdings'],
};

const TLDS = ['.com', '.io', '.co', '.net', '.app'];

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

function cap(s: string): string {
  return s.length === 0 ? s : (s[0] ?? '').toUpperCase() + s.slice(1);
}

interface Company {
  name: string;
  industry: string;
  catchphrase: string;
  domain: string;
  ein: string;
  regNumber: string;
}

function genCompany(region: Region, rand: () => number): Company {
  const core = `${pick(NOUNS, rand, 'Apex')}${pick(NOUNS2, rand, 'Tech')}`;
  const suffix = pick(SUFFIXES[region], rand, 'Inc.');
  const name = `${core} ${suffix}`;
  const industry = pick(INDUSTRIES, rand, 'Software & SaaS');
  const catchphrase = `${cap(pick(VERBING, rand, 'empowering'))} ${pick(ADJ, rand, 'Scalable').toLowerCase()} ${pick(CATCH_NOUN, rand, 'solutions')}`;
  const slug = core.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = slug + pick(TLDS, rand, '.com');
  const ein = `${String(10 + Math.floor(rand() * 89)).padStart(2, '0')}-${String(Math.floor(rand() * 10000000)).padStart(7, '0')}`;
  const regNumber = `REG-${String(Math.floor(rand() * 100000000)).padStart(8, '0')}`;
  return { name, industry, catchphrase, domain, ein, regNumber };
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function FakeCompanyGeneratorTool() {
  const [region, setRegion] = useState<Region>('US');
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState<Format>('cards');
  const [seed, setSeed] = useState('');

  const safeCount = Number.isFinite(count) ? Math.min(200, Math.max(1, Math.floor(count))) : 10;

  const companies = useMemo(() => {
    const seedNum = seed.trim() ? hashSeed(seed.trim() + region) : (Date.now() >>> 0);
    const rand = mulberry32(seedNum);
    return Array.from({ length: safeCount }, () => genCompany(region, rand));
  }, [region, safeCount, seed]);

  const output = useMemo(() => {
    if (format === 'json') {
      return JSON.stringify(companies, null, 2);
    }
    if (format === 'csv') {
      const header = 'name,industry,catchphrase,domain,ein,regNumber';
      const rows = companies.map((c) =>
        [c.name, c.industry, c.catchphrase, c.domain, c.ein, c.regNumber].map(csvField).join(',')
      );
      return [header, ...rows].join('\n');
    }
    return companies
      .map(
        (c) =>
          `${c.name}\n  Industry:    ${c.industry}\n  Catchphrase: ${c.catchphrase}\n  Domain:      ${c.domain}\n  EIN:         ${c.ein}\n  Reg #:       ${c.regNumber}`
      )
      .join('\n\n');
  }, [companies, format]);

  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Legal suffix region">
          <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">US (Inc/LLC)</SelectItem>
              <SelectItem value="UK">UK (Ltd/PLC)</SelectItem>
              <SelectItem value="DE">DE (GmbH/AG)</SelectItem>
              <SelectItem value="Generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={200}
            value={Number.isFinite(count) ? count : 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.min(200, Math.max(1, Math.floor(n))) : 1);
            }}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Output">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cards">Cards</SelectItem>
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
        <PanelHeader title="Fake companies (test data)">
          <CopyButton value={() => output} label="Copy all" disabled={!output} />
          <DownloadButton data={() => output} filename={`companies.${ext}`} disabled={!output} />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto p-3 font-mono text-xs">{output}</pre>
        <StatBar
          items={[
            `${companies.length.toLocaleString()} companies`,
            region,
            seed.trim() ? `seed: ${seed.trim()}` : false,
          ]}
        />
      </Panel>
    </div>
  );
}
