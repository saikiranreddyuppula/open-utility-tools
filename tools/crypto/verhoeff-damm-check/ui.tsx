'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Algo = 'verhoeff' | 'damm';
type Mode = 'validate' | 'generate';

interface Row {
  label: string;
  value: string;
}

interface Ok {
  rows: Row[];
}

interface Err {
  error: string;
}

// Verhoeff D5 multiplication table.
const D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Verhoeff permutation table.
const P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Verhoeff inverse table.
const INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

// Damm 10x10 totally anti-symmetric quasigroup table.
const DAMM: number[][] = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

function row(t: number[][], i: number): number[] {
  return t[i] ?? [];
}

function cell(t: number[][], i: number, j: number): number {
  return row(t, i)[j] ?? 0;
}

/** Verhoeff checksum over an array of digits. Returns 0 when the full string is valid. */
function verhoeffChecksum(digits: number[]): number {
  let c = 0;
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const di = reversed[i] ?? 0;
    const pPos = i % 8;
    c = cell(D, c, cell(P, pPos, di));
  }
  return c;
}

/** Verhoeff check digit appended to make the string valid. */
function verhoeffCheckDigit(digits: number[]): number {
  // Compute checksum treating the payload as if a 0 check digit were present at position 0.
  let c = 0;
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const di = reversed[i] ?? 0;
    const pPos = (i + 1) % 8;
    c = cell(D, c, cell(P, pPos, di));
  }
  return INV[c] ?? 0;
}

/** Damm interim digit over an array; 0 means valid for the full string. */
function dammChecksum(digits: number[]): number {
  let interim = 0;
  for (let i = 0; i < digits.length; i += 1) {
    interim = cell(DAMM, interim, digits[i] ?? 0);
  }
  return interim;
}

function toDigits(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    out.push((s[i] ?? '0').charCodeAt(0) - 48);
  }
  return out;
}

export default function VerhoeffDammTool() {
  const [algo, setAlgo] = useState<Algo>('verhoeff');
  const [mode, setMode] = useState<Mode>('generate');
  const [raw, setRaw] = useState('236');

  const result = useMemo<Ok | Err>(() => {
    const s = raw.replace(/\s/g, '');
    if (!s) return { error: 'Enter a numeric string.' };
    if (!/^\d+$/.test(s)) return { error: 'Only digits are allowed.' };
    const digits = toDigits(s);

    if (mode === 'generate') {
      const check = algo === 'verhoeff' ? verhoeffCheckDigit(digits) : dammChecksum(digits);
      return {
        rows: [
          { label: 'Algorithm', value: algo === 'verhoeff' ? 'Verhoeff' : 'Damm' },
          { label: 'Payload', value: s },
          { label: 'Check digit', value: String(check) },
          { label: 'Full number', value: `${s}${check}` },
        ],
      };
    }

    // validate: last digit is the check digit
    const checksum = algo === 'verhoeff' ? verhoeffChecksum(digits) : dammChecksum(digits);
    const valid = checksum === 0;
    return {
      rows: [
        { label: 'Algorithm', value: algo === 'verhoeff' ? 'Verhoeff' : 'Damm' },
        { label: 'Result', value: valid ? 'VALID' : 'INVALID' },
        { label: 'Interim checksum', value: String(checksum) },
        { label: 'Length', value: String(s.length) },
      ],
    };
  }, [algo, mode, raw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Algorithm">
            <Tabs value={algo} onValueChange={(v) => setAlgo(v as Algo)}>
              <TabsList>
                <TabsTrigger value="verhoeff">Verhoeff</TabsTrigger>
                <TabsTrigger value="damm">Damm</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="generate">Generate</TabsTrigger>
                <TabsTrigger value="validate">Validate</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field
            label={mode === 'generate' ? 'Payload (no check digit)' : 'Number incl. check digit'}
            className="min-w-[240px] flex-1"
          >
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Detects all single-digit and adjacent-transposition errors']} />
        </Panel>
      )}
    </div>
  );
}
