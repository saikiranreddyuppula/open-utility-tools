'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Format = 'json' | 'csv' | 'ndjson';
type NameSet = 'western' | 'generic';

const WESTERN_FIRST = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Edward', 'Deborah',
  'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Alexander', 'Debra', 'Patrick', 'Rachel',
  'Frank', 'Carolyn', 'Raymond', 'Janet', 'Jack', 'Maria', 'Dennis', 'Olivia', 'Jerry', 'Heather',
];

const WESTERN_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Powell',
];

const GENERIC_FIRST = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Taylor', 'Morgan', 'Avery', 'Quinn', 'Reese',
  'Skyler', 'Rowan', 'Sage', 'Drew', 'Blake', 'Cameron', 'Charlie', 'Dakota', 'Elliot', 'Emerson',
  'Finley', 'Harper', 'Hayden', 'Jaden', 'Kai', 'Lane', 'Logan', 'Marley', 'Nova', 'Oakley',
  'Parker', 'Peyton', 'Phoenix', 'Remy', 'River', 'Sasha', 'Shawn', 'Sidney', 'Tatum', 'Wren',
  'Ari', 'Bellamy', 'Briar', 'Cody', 'Devon', 'Eden', 'Frankie', 'Gray', 'Indigo', 'Jules',
  'Kendall', 'Lennon', 'Micah', 'Noel', 'Onyx', 'Presley', 'Robin', 'Shiloh', 'Sterling', 'Toby',
  'Vesper', 'Wynn', 'Zion', 'Arden', 'Blair', 'Campbell', 'Dallas', 'Ellis', 'Flynn', 'Greer',
  'Hollis', 'Ira', 'Jamie', 'Kit', 'Lou', 'Marlow', 'Nico', 'Ocean', 'Pax', 'Quincy',
  'Rory', 'Salem', 'Tate', 'Umber', 'Vale', 'West', 'Xen', 'Yael', 'Zephyr', 'Ash',
  'Bay', 'Cove', 'Dune', 'Echo', 'Fable', 'Gale', 'Haven', 'Isle', 'Juno', 'Kestrel',
];

const GENERIC_LAST = [
  'Stone', 'Rivers', 'Vale', 'Fox', 'Wolf', 'Hart', 'Ash', 'Frost', 'Reed', 'Lake',
  'Wood', 'Field', 'Hill', 'Marsh', 'Brook', 'Cliff', 'Dale', 'Glen', 'Heath', 'Moss',
  'Pike', 'Quill', 'Rook', 'Sand', 'Thorn', 'Vance', 'Ware', 'York', 'Bane', 'Crane',
  'Drake', 'Earle', 'Finch', 'Grove', 'Hale', 'Ives', 'Jett', 'Knox', 'Lowe', 'Mercer',
  'North', 'Orr', 'Pace', 'Quinn', 'Rains', 'Slate', 'Tern', 'Underwood', 'Vega', 'Wren',
  'Bishop', 'Clarke', 'Dunn', 'Ellery', 'Flint', 'Greaves', 'Holt', 'Irwin', 'Jasper', 'Keene',
  'Locke', 'Mason', 'Noble', 'Oakes', 'Payne', 'Quigley', 'Rhodes', 'Sterling', 'Tate', 'Voss',
  'Ward', 'Xander', 'Yates', 'Zane', 'Abney', 'Brandt', 'Calder', 'Doyle', 'Easton', 'Fenwick',
  'Galloway', 'Harlow', 'Ingram', 'Joyce', 'Kerr', 'Lannon', 'Marlowe', 'Nash', 'Osborn', 'Pemberton',
  'Radcliffe', 'Sinclair', 'Thatcher', 'Ulrich', 'Vaughn', 'Whitlock', 'Yardley', 'Zimmerman', 'Ackley', 'Beckett',
];

const DOMAINS = ['gmail.com', 'example.com', 'test.com', 'mail.com'];
const GENDERS = ['male', 'female', 'nonbinary'];

/** mulberry32 — small deterministic PRNG. */
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

/** Hash a string seed to a 32-bit int (xfnv1a). */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], rng: () => number, fallback: T): T {
  if (arr.length === 0) return fallback;
  const idx = Math.floor(rng() * arr.length);
  return arr[idx] ?? fallback;
}

interface Profile {
  name: string;
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  gender: string;
  avatarSeed: string;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default function FakeUserProfileGenerator() {
  const [count, setCount] = useState('10');
  const [seed, setSeed] = useState('');
  const [format, setFormat] = useState<Format>('json');
  const [nameSet, setNameSet] = useState<NameSet>('western');
  const [nonce, setNonce] = useState(0);

  const [fName, setFName] = useState(true);
  const [fUsername, setFUsername] = useState(true);
  const [fEmail, setFEmail] = useState(true);
  const [fPhone, setFPhone] = useState(true);
  const [fBirth, setFBirth] = useState(true);
  const [fGender, setFGender] = useState(true);
  const [fAvatar, setFAvatar] = useState(true);

  const result = useMemo(() => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      return { error: 'Count must be a whole number between 1 and 500.' };
    }

    // Deterministic when a seed is given; otherwise reseed each regenerate.
    const baseSeed = seed.trim()
      ? hashSeed(seed.trim())
      : (() => {
          const r = new Uint32Array(1);
          wc.getRandomValues(r);
          return (r[0] ?? 1) ^ nonce;
        })();
    const rng = mulberry32(baseSeed || 1);

    const firsts = nameSet === 'western' ? WESTERN_FIRST : GENERIC_FIRST;
    const lasts = nameSet === 'western' ? WESTERN_LAST : GENERIC_LAST;

    const profiles: Profile[] = [];
    for (let i = 0; i < n; i++) {
      const first = pick(firsts, rng, 'Alex');
      const last = pick(lasts, rng, 'Doe');
      const name = `${first} ${last}`;
      const base = `${first}.${last}`.toLowerCase();
      const suffix = rng() < 0.5 ? String(10 + Math.floor(rng() * 90)) : '';
      const username = `${base}${suffix}`;
      const domain = pick(DOMAINS, rng, 'example.com');
      const email = `${username}@${domain}`;
      const cc = 200 + Math.floor(rng() * 800);
      const pre = 100 + Math.floor(rng() * 900);
      const lineNo = 1000 + Math.floor(rng() * 9000);
      const phone = `+1 (${cc}) ${pre}-${lineNo}`;
      const year = 1960 + Math.floor(rng() * 45);
      const month = 1 + Math.floor(rng() * 12);
      const day = 1 + Math.floor(rng() * 28);
      const birthdate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const gender = pick(GENDERS, rng, 'nonbinary');
      const avatarSeed = `${username}-${Math.floor(rng() * 1e9).toString(36)}`;
      profiles.push({ name, username, email, phone, birthdate, gender, avatarSeed });
    }

    // Build only the selected fields, preserving order.
    const fieldDefs: { key: keyof Profile; on: boolean }[] = [
      { key: 'name', on: fName },
      { key: 'username', on: fUsername },
      { key: 'email', on: fEmail },
      { key: 'phone', on: fPhone },
      { key: 'birthdate', on: fBirth },
      { key: 'gender', on: fGender },
      { key: 'avatarSeed', on: fAvatar },
    ];
    const keys = fieldDefs.filter((f) => f.on).map((f) => f.key);
    if (keys.length === 0) return { error: 'Select at least one field to include.' };

    const records = profiles.map((p) => {
      const rec: Record<string, string> = {};
      for (const k of keys) rec[k] = p[k];
      return rec;
    });

    let output = '';
    if (format === 'json') {
      output = JSON.stringify(records, null, 2);
    } else if (format === 'ndjson') {
      output = records.map((r) => JSON.stringify(r)).join('\n');
    } else {
      const header = keys.join(',');
      const lines = records.map((r) => keys.map((k) => csvEscape(r[k] ?? '')).join(','));
      output = [header, ...lines].join('\n');
    }

    return { output, n: profiles.length };
  }, [count, seed, format, nameSet, nonce, fName, fUsername, fEmail, fPhone, fBirth, fGender, fAvatar]);

  const ext = format === 'csv' ? 'csv' : format === 'ndjson' ? 'ndjson' : 'json';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Seed" hint="empty = random">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-40 font-mono"
            placeholder="optional"
          />
        </Field>
        <Field label="Name set">
          <Select value={nameSet} onValueChange={(v) => setNameSet(v as NameSet)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="western">Western</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Format">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON array</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="ndjson">NDJSON</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="ml-auto flex items-end">
          <button
            type="button"
            onClick={() => setNonce((x) => x + 1)}
            className="inline-flex h-8 items-center rounded-md border bg-secondary px-3 text-xs font-medium hover:bg-secondary/80"
          >
            Regenerate
          </button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Fields">
          <div className="flex flex-wrap items-center gap-3">
            {([
              ['Name', fName, setFName, 'fld-name'],
              ['Username', fUsername, setFUsername, 'fld-user'],
              ['Email', fEmail, setFEmail, 'fld-email'],
              ['Phone', fPhone, setFPhone, 'fld-phone'],
              ['Birthdate', fBirth, setFBirth, 'fld-birth'],
              ['Gender', fGender, setFGender, 'fld-gender'],
              ['Avatar seed', fAvatar, setFAvatar, 'fld-avatar'],
            ] as const).map(([label, val, set, id]) => (
              <div key={id} className="flex items-center gap-1.5">
                <Checkbox id={id} checked={val} onCheckedChange={(c) => set(c === true)} />
                <Label htmlFor={id} className="text-xs text-muted-foreground">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </PanelHeader>
      </Panel>

      {'error' in result ? (
        <Panel>
          <div className="p-3 text-sm text-destructive">{result.error}</div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title={`Profiles (${format.toUpperCase()})`}>
            <CopyButton value={() => result.output} />
            <DownloadButton data={() => result.output} filename={`users.${ext}`} />
          </PanelHeader>
          <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs">{result.output}</pre>
          <StatBar items={[`${result.n} profiles`, seed.trim() ? `seed: ${seed.trim()}` : 'random seed']} />
        </Panel>
      )}
    </div>
  );
}
