'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';

interface Entry {
  letter: string;
  nato: string; // ICAO/NATO
  raf: string; // WWII RAF / British (pre-NATO)
  western: string; // Western Union (US, 1942)
  lapd: string; // LAPD / US police
  din: string; // German DIN 5009
}

// Columns: ICAO/NATO, RAF (WWII), Western Union, LAPD/police, German DIN.
const LETTERS: Entry[] = [
  { letter: 'A', nato: 'Alfa', raf: 'Able', western: 'Adams', lapd: 'Adam', din: 'Anton' },
  { letter: 'B', nato: 'Bravo', raf: 'Baker', western: 'Boston', lapd: 'Boy', din: 'Berta' },
  { letter: 'C', nato: 'Charlie', raf: 'Charlie', western: 'Chicago', lapd: 'Charles', din: 'Cäsar' },
  { letter: 'D', nato: 'Delta', raf: 'Dog', western: 'Denver', lapd: 'David', din: 'Dora' },
  { letter: 'E', nato: 'Echo', raf: 'Easy', western: 'Easy', lapd: 'Edward', din: 'Emil' },
  { letter: 'F', nato: 'Foxtrot', raf: 'Fox', western: 'Frank', lapd: 'Frank', din: 'Friedrich' },
  { letter: 'G', nato: 'Golf', raf: 'George', western: 'George', lapd: 'George', din: 'Gustav' },
  { letter: 'H', nato: 'Hotel', raf: 'How', western: 'Henry', lapd: 'Henry', din: 'Heinrich' },
  { letter: 'I', nato: 'India', raf: 'Item', western: 'Ida', lapd: 'Ida', din: 'Ida' },
  { letter: 'J', nato: 'Juliett', raf: 'Jig', western: 'John', lapd: 'John', din: 'Julius' },
  { letter: 'K', nato: 'Kilo', raf: 'King', western: 'King', lapd: 'King', din: 'Kaufmann' },
  { letter: 'L', nato: 'Lima', raf: 'Love', western: 'Lincoln', lapd: 'Lincoln', din: 'Ludwig' },
  { letter: 'M', nato: 'Mike', raf: 'Mike', western: 'Mary', lapd: 'Mary', din: 'Martha' },
  { letter: 'N', nato: 'November', raf: 'Nan', western: 'New York', lapd: 'Nora', din: 'Nordpol' },
  { letter: 'O', nato: 'Oscar', raf: 'Oboe', western: 'Ocean', lapd: 'Ocean', din: 'Otto' },
  { letter: 'P', nato: 'Papa', raf: 'Peter', western: 'Peter', lapd: 'Paul', din: 'Paula' },
  { letter: 'Q', nato: 'Quebec', raf: 'Queen', western: 'Queen', lapd: 'Queen', din: 'Quelle' },
  { letter: 'R', nato: 'Romeo', raf: 'Roger', western: 'Roger', lapd: 'Robert', din: 'Richard' },
  { letter: 'S', nato: 'Sierra', raf: 'Sugar', western: 'Sugar', lapd: 'Sam', din: 'Samuel' },
  { letter: 'T', nato: 'Tango', raf: 'Tare', western: 'Thomas', lapd: 'Tom', din: 'Theodor' },
  { letter: 'U', nato: 'Uniform', raf: 'Uncle', western: 'Union', lapd: 'Union', din: 'Ulrich' },
  { letter: 'V', nato: 'Victor', raf: 'Victor', western: 'Victor', lapd: 'Victor', din: 'Viktor' },
  { letter: 'W', nato: 'Whiskey', raf: 'William', western: 'William', lapd: 'William', din: 'Wilhelm' },
  { letter: 'X', nato: 'X-ray', raf: 'X-ray', western: 'X-ray', lapd: 'X-ray', din: 'Xanthippe' },
  { letter: 'Y', nato: 'Yankee', raf: 'Yoke', western: 'Young', lapd: 'Young', din: 'Ypsilon' },
  { letter: 'Z', nato: 'Zulu', raf: 'Zebra', western: 'Zero', lapd: 'Zebra', din: 'Zacharias' },
];

interface Digit {
  digit: string;
  nato: string;
}

// NATO/aviation digit pronunciations.
const DIGITS: Digit[] = [
  { digit: '0', nato: 'Zero' },
  { digit: '1', nato: 'Wun' },
  { digit: '2', nato: 'Too' },
  { digit: '3', nato: 'Tree' },
  { digit: '4', nato: 'Fower' },
  { digit: '5', nato: 'Fife' },
  { digit: '6', nato: 'Six' },
  { digit: '7', nato: 'Seven' },
  { digit: '8', nato: 'Ait' },
  { digit: '9', nato: 'Niner' },
];

const COLS: { key: keyof Omit<Entry, 'letter'>; label: string }[] = [
  { key: 'nato', label: 'ICAO/NATO' },
  { key: 'raf', label: 'RAF (WWII)' },
  { key: 'western', label: 'Western Union' },
  { key: 'lapd', label: 'LAPD/Police' },
  { key: 'din', label: 'German DIN' },
];

export default function SpellAlphabetReference() {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LETTERS;
    return LETTERS.filter((r) =>
      `${r.letter} ${r.nato} ${r.raf} ${r.western} ${r.lapd} ${r.din}`.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Spelling Alphabets">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter letter or code word…"
            className="h-7 w-56"
          />
        </PanelHeader>
        <div className="overflow-auto">
          <div className="min-w-[680px]">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="w-8 shrink-0">Ltr</span>
              {COLS.map((c) => (
                <span key={c.key} className="min-w-0 flex-1">
                  {c.label}
                </span>
              ))}
              <span className="w-8 shrink-0" />
            </div>
            <div className="max-h-[460px] divide-y overflow-auto">
              {rows.map((r) => (
                <div key={r.letter} className="flex items-center gap-2 px-3 py-1.5">
                  <code className="w-8 shrink-0 font-mono text-sm font-semibold">{r.letter}</code>
                  {COLS.map((c) => (
                    <span key={c.key} className="min-w-0 flex-1 truncate text-sm">
                      {r[c.key]}
                    </span>
                  ))}
                  <span className="w-8 shrink-0">
                    <CopyButton value={`${r.letter}: ${r.nato}`} size="icon-sm" />
                  </span>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
              )}
            </div>
          </div>
        </div>
        <StatBar items={[`${rows.length} of ${LETTERS.length} letters`, '5 alphabets']} />
      </Panel>

      <Panel>
        <PanelHeader title="Digit Pronunciation (Aviation)" />
        <div className="flex flex-wrap gap-2 p-3">
          {DIGITS.map((d) => (
            <div
              key={d.digit}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5"
            >
              <code className="font-mono text-sm font-semibold">{d.digit}</code>
              <span className="text-sm">{d.nato}</span>
              <CopyButton value={`${d.digit}: ${d.nato}`} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
