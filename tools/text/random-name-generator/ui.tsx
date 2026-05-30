'use client';

import { useMemo, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

type Mode = 'human' | 'fantasy' | 'username' | 'gamertag';
type CaseStyle = 'pascal' | 'camel' | 'lower' | 'kebab' | 'snake';

const FIRST_NAMES: string[] = [
  'Alex', 'Maya', 'Liam', 'Noor', 'Owen', 'Aria', 'Ezra', 'Luna', 'Kai', 'Ivy',
  'Theo', 'Nova', 'Finn', 'Ruby', 'Milo', 'Wren', 'Cole', 'Iris', 'Reed', 'Zara',
  'Jude', 'Elsie', 'Rory', 'Cleo', 'Hugo', 'Tess', 'Otto', 'Sage', 'Dean', 'Lena',
  'Cyrus', 'Mira', 'Beau', 'Esme', 'Knox', 'Faye', 'Soren', 'Anya', 'Cruz', 'Greta',
];

const LAST_NAMES: string[] = [
  'Rivera', 'Chen', 'Patel', 'Okafor', 'Nguyen', 'Kowalski', 'Mbeki', 'Larsen', 'Haddad',
  'Romano', 'Singh', 'Garcia', 'Tanaka', 'Murphy', 'Schmidt', 'Reyes', 'Novak', 'Costa',
  'Ahmed', 'Walsh', 'Petrov', 'Diaz', 'Holt', 'Kim', 'Fischer', 'Bauer', 'Mendez',
  'Olsen', 'Khan', 'Russo', 'Dvorak', 'Park', 'Sato', 'Ferreira', 'Brennan', 'Yusuf',
];

const FANTASY_ON: string[] = [
  'br', 'th', 'dr', 'gr', 'kr', 'v', 'm', 'n', 'z', 'sh', 'k', 'l', 'r', 's', 'el',
  'gal', 'mor', 'thal', 'syl', 'vor', 'kal', 'fen', 'dra',
];
const FANTASY_NUC: string[] = [
  'a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'ou', 'eo', 'ar', 'or', 'en', 'al', 'yr',
];
const FANTASY_COD: string[] = [
  'n', 'r', 's', 'th', 'l', 'x', 'd', 'm', 'ndor', 'iel', 'wyn', 'dris', 'thas',
  'mir', 'gar', 'roth', '',
];

const ADJECTIVES: string[] = [
  'Crimson', 'Silent', 'Cosmic', 'Rapid', 'Golden', 'Frosty', 'Shadow', 'Electric',
  'Lunar', 'Velvet', 'Iron', 'Mellow', 'Savage', 'Quantum', 'Neon', 'Wild', 'Brave',
  'Mystic', 'Turbo', 'Stealth', 'Royal', 'Atomic', 'Hollow', 'Vivid', 'Rogue', 'Solar',
  'Misty', 'Jade', 'Onyx', 'Swift', 'Hazel', 'Nimble', 'Stormy', 'Amber', 'Fierce',
];
const NOUNS: string[] = [
  'Otter', 'Falcon', 'Wolf', 'Comet', 'Pixel', 'Raven', 'Tiger', 'Ember', 'Maple',
  'Cobra', 'Lynx', 'Phoenix', 'Badger', 'Heron', 'Panther', 'Willow', 'Mantis',
  'Sparrow', 'Bison', 'Otter', 'Drake', 'Ferret', 'Falcon', 'Quokka', 'Viper',
  'Gecko', 'Walrus', 'Puffin', 'Marmot', 'Ocelot', 'Fennec', 'Heron', 'Stoat', 'Yak',
];

const LEET: Record<string, string> = {
  a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9',
};

function pick<T>(arr: T[], rnd: () => number): T {
  const idx = Math.floor(rnd() * arr.length);
  return (arr[idx] ?? arr[0]) as T;
}

function fantasyName(rnd: () => number): string {
  const syllables = 2 + Math.floor(rnd() * 2); // 2..3
  let out = '';
  for (let i = 0; i < syllables; i++) {
    out += pick(FANTASY_ON, rnd) + pick(FANTASY_NUC, rnd);
    if (i === syllables - 1) out += pick(FANTASY_COD, rnd);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function applyCase(parts: string[], style: CaseStyle): string {
  const lower = parts.map((p) => p.toLowerCase());
  switch (style) {
    case 'pascal':
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    case 'camel':
      return lower
        .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join('');
    case 'lower':
      return lower.join('');
    case 'kebab':
      return lower.join('-');
    case 'snake':
      return lower.join('_');
    default:
      return parts.join('');
  }
}

function leetify(text: string, rnd: () => number): string {
  return text
    .split('')
    .map((ch) => {
      const lc = ch.toLowerCase();
      const sub = LEET[lc];
      if (sub && rnd() < 0.5) return sub;
      return ch;
    })
    .join('');
}

export default function RandomNameGenerator() {
  const [mode, setMode] = useState<Mode>('username');
  const [caseStyle, setCaseStyle] = useState<CaseStyle>('pascal');
  const [addDigits, setAddDigits] = useState(true);
  const [digitCount, setDigitCount] = useState('2');
  const [maxLen, setMaxLen] = useState('20');
  const [seed, setSeed] = useState('1');

  const baseSeed = useMemo(() => {
    const n = Number(seed);
    if (Number.isFinite(n)) return Math.floor(Math.abs(n)) || 1;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }, [seed]);

  const dCount = useMemo(() => {
    const n = Math.floor(Number(digitCount));
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 6)) : 2;
  }, [digitCount]);

  const cap = useMemo(() => {
    const n = Math.floor(Number(maxLen));
    return Number.isFinite(n) ? Math.max(4, Math.min(n, 64)) : 20;
  }, [maxLen]);

  let callIndex = 0;

  const generate = (): string => {
    const rnd = mulberry32(baseSeed + callIndex * 2654435761);
    callIndex += 1;

    if (mode === 'human') {
      const name = `${pick(FIRST_NAMES, rnd)} ${pick(LAST_NAMES, rnd)}`;
      return name;
    }

    if (mode === 'fantasy') {
      const useSurname = rnd() < 0.4;
      const name = useSurname
        ? `${fantasyName(rnd)} ${fantasyName(rnd)}`
        : fantasyName(rnd);
      return name;
    }

    // username / gamertag
    const adj = pick(ADJECTIVES, rnd);
    const noun = pick(NOUNS, rnd);
    let core = applyCase([adj, noun], caseStyle);

    if (mode === 'gamertag' && rnd() < 0.6) {
      core = leetify(core, rnd);
    }

    if (addDigits && dCount > 0) {
      let digits = '';
      for (let i = 0; i < dCount; i++) digits += Math.floor(rnd() * 10).toString();
      const sep =
        mode === 'gamertag'
          ? rnd() < 0.5
            ? '_'
            : 'x'
          : caseStyle === 'kebab'
            ? '-'
            : caseStyle === 'snake'
              ? '_'
              : '';
      core = `${core}${sep}${digits}`;
    }

    if (core.length > cap) core = core.slice(0, cap);
    return core;
  };

  const isUsernameMode = mode === 'username' || mode === 'gamertag';

  return (
    <GeneratorList
      generate={generate}
      deps={[mode, caseStyle, addDigits, dCount, cap, baseSeed]}
      defaultCount={10}
      maxCount={500}
      downloadName="names.txt"
      label="Generated names"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="human">Human full name</SelectItem>
                <SelectItem value="fantasy">Fantasy name</SelectItem>
                <SelectItem value="username">Username handle</SelectItem>
                <SelectItem value="gamertag">Gamer-tag (leet)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isUsernameMode ? (
            <Field label="Case style">
              <Select
                value={caseStyle}
                onValueChange={(v) => setCaseStyle(v as CaseStyle)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pascal">PascalCase</SelectItem>
                  <SelectItem value="camel">camelCase</SelectItem>
                  <SelectItem value="lower">lowercase</SelectItem>
                  <SelectItem value="kebab">kebab-case</SelectItem>
                  <SelectItem value="snake">snake_case</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {isUsernameMode ? (
            <Field label="Append digits">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={addDigits} onCheckedChange={setAddDigits} />
                <Label className="text-xs text-muted-foreground">random number</Label>
              </div>
            </Field>
          ) : null}
          {isUsernameMode && addDigits ? (
            <Field label="Digit count">
              <Input
                type="number"
                value={digitCount}
                onChange={(e) => setDigitCount(e.target.value)}
                className="w-20 font-mono"
              />
            </Field>
          ) : null}
          {isUsernameMode ? (
            <Field label="Max length">
              <Input
                type="number"
                value={maxLen}
                onChange={(e) => setMaxLen(e.target.value)}
                className="w-20 font-mono"
              />
            </Field>
          ) : null}
          <Field label="Seed">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
        </>
      }
    />
  );
}
