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

type Pattern = 'adj-noun' | 'noun-noun' | 'adj-noun-num';
type Casing = 'lower' | 'camel' | 'snake' | 'kebab' | 'pascal';

const ADJECTIVES: string[] = [
  'swift', 'brave', 'lucky', 'silent', 'cosmic', 'happy', 'mighty', 'gentle',
  'fuzzy', 'crimson', 'golden', 'frosty', 'wild', 'clever', 'bold', 'calm',
  'eager', 'fancy', 'jolly', 'noble', 'proud', 'quick', 'shiny', 'witty',
  'azure', 'electric', 'mellow', 'rapid', 'stellar', 'velvet',
];

const NOUNS: string[] = [
  'falcon', 'tiger', 'otter', 'panda', 'comet', 'maple', 'river', 'ember',
  'pixel', 'nimbus', 'raven', 'koala', 'wombat', 'phoenix', 'badger', 'lynx',
  'walrus', 'puffin', 'narwhal', 'gecko', 'mantis', 'beacon', 'cipher', 'harbor',
  'meadow', 'quartz', 'summit', 'tundra', 'willow', 'zephyr',
];

/** Unbiased index in [0, n) via rejection sampling. */
function randIndex(n: number): number {
  if (n <= 1) return 0;
  const limit = Math.floor(4294967296 / n) * n;
  const a = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(a);
    v = a[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function pick(list: string[]): string {
  return list[randIndex(list.length)] ?? 'user';
}

function randomDigits(d: number): string {
  let s = '';
  for (let i = 0; i < d; i += 1) s += String(randIndex(10));
  return s;
}

function cap(w: string): string {
  return w.length === 0 ? w : `${w.charAt(0).toUpperCase()}${w.slice(1)}`;
}

function joinCased(parts: string[], casing: Casing, sep: string): string {
  const clean = parts.filter((p) => p.length > 0);
  switch (casing) {
    case 'lower':
      return clean.join(sep).toLowerCase();
    case 'camel':
      return clean
        .map((p, i) => (i === 0 ? p.toLowerCase() : cap(p.toLowerCase())))
        .join('');
    case 'pascal':
      return clean.map((p) => cap(p.toLowerCase())).join('');
    case 'snake':
      return clean.join('_').toLowerCase();
    case 'kebab':
      return clean.join('-').toLowerCase();
    default:
      return clean.join(sep);
  }
}

export default function UsernameGenerator() {
  const [pattern, setPattern] = useState<Pattern>('adj-noun');
  const [casing, setCasing] = useState<Casing>('camel');
  const [sep, setSep] = useState('');
  const [maxLen, setMaxLen] = useState('20');
  const [trailNum, setTrailNum] = useState(false);
  const [numDigits, setNumDigits] = useState('2');

  const gen = (): string => {
    const lenCap = Math.min(64, Math.max(3, Math.round(Number(maxLen) || 20)));
    const digits = Math.min(4, Math.max(1, Math.round(Number(numDigits) || 2)));

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const parts: string[] = [];
      if (pattern === 'noun-noun') {
        parts.push(pick(NOUNS), pick(NOUNS));
      } else {
        parts.push(pick(ADJECTIVES), pick(NOUNS));
      }
      if (pattern === 'adj-noun-num') parts.push(randomDigits(digits));

      let name = joinCased(parts, casing, sep);
      if (trailNum && pattern !== 'adj-noun-num') {
        const glue = casing === 'snake' ? '_' : casing === 'kebab' ? '-' : '';
        name = `${name}${glue}${randomDigits(digits)}`;
      }
      if (name.length <= lenCap) return name;
    }
    // Fallback: hard-truncate after exhausting retries.
    const parts = [pick(ADJECTIVES), pick(NOUNS)];
    return joinCased(parts, casing, sep).slice(0, lenCap);
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[pattern, casing, sep, maxLen, trailNum, numDigits]}
      defaultCount={15}
      maxCount={200}
      downloadName="usernames.txt"
      label="Usernames"
      options={
        <>
          <Field label="Pattern">
            <Select value={pattern} onValueChange={(v) => setPattern(v as Pattern)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adj-noun">adjective + noun</SelectItem>
                <SelectItem value="noun-noun">noun + noun</SelectItem>
                <SelectItem value="adj-noun-num">adjective + noun + number</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Casing">
            <Select value={casing} onValueChange={(v) => setCasing(v as Casing)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lower">lowercase</SelectItem>
                <SelectItem value="camel">camelCase</SelectItem>
                <SelectItem value="pascal">PascalCase</SelectItem>
                <SelectItem value="snake">snake_case</SelectItem>
                <SelectItem value="kebab">kebab-case</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Separator"
            hint="used for lowercase only"
            className="w-24"
          >
            <Input
              value={sep}
              onChange={(e) => setSep(e.target.value)}
              placeholder="(none)"
              className="font-mono"
            />
          </Field>
          <Field label="Max length" className="w-24">
            <Input
              type="number"
              min={3}
              max={64}
              value={maxLen}
              onChange={(e) => setMaxLen(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Trailing #" className="w-20">
            <Input
              type="number"
              min={1}
              max={4}
              value={numDigits}
              onChange={(e) => setNumDigits(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Add number">
            <div className="flex h-9 items-center gap-2">
              <Switch id="trail-num" checked={trailNum} onCheckedChange={setTrailNum} />
              <Label htmlFor="trail-num" className="text-xs">
                Append digits
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
