'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `id,name,score
1,Ada,88
2,Linus,54
3,Grace,92
4,Dennis,41
5,Margaret,33
6,Tim,77
7,Brian,61
8,Ken,95
9,Donald,80
10,Edsger,70`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type Mode = 'head' | 'tail' | 'nth' | 'randomN' | 'randomPct';

const MODES: { value: Mode; label: string }[] = [
  { value: 'head', label: 'First N rows' },
  { value: 'tail', label: 'Last N rows' },
  { value: 'nth', label: 'Every Nth row' },
  { value: 'randomN', label: 'Random N rows' },
  { value: 'randomPct', label: 'Random percent' },
];

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1] ?? '';
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string, delim: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => !(l === '' && idx === arr.length - 1))
    .map((l) => parseLine(l, delim));
}

function formatField(field: string, delim: string): string {
  const needs = field.includes('"') || field.includes('\n') || field.includes(delim);
  return needs ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][], delim: string): string {
  return rows.map((r) => r.map((f) => formatField(f, delim)).join(delim)).join('\n');
}

// mulberry32 seedable PRNG — deterministic for a given seed
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

export default function CsvSampleRowsTool() {
  const [delim, setDelim] = useState(',');
  const [mode, setMode] = useState<Mode>('head');
  const [n, setN] = useState('5');
  const [pct, setPct] = useState('25');
  const [stride, setStride] = useState('2');
  const [offset, setOffset] = useState('0');
  const [seed, setSeed] = useState('42');
  const [hasHeader, setHasHeader] = useState(true);

  const transform = useCallback(
    (text: string) => {
      if (!text.trim()) return '';
      const rows = parseCsv(text, delim);
      if (rows.length === 0) return '';
      const head = hasHeader ? rows[0] : null;
      const body = hasHeader ? rows.slice(1) : rows;
      if (body.length === 0) return hasHeader && head ? toCsv([head], delim) : '';

      let sampled: string[][] = [];

      switch (mode) {
        case 'head': {
          const k = Math.floor(Number(n));
          if (!Number.isFinite(k) || k < 0) throw new Error('Enter a valid N (≥ 0).');
          sampled = body.slice(0, k);
          break;
        }
        case 'tail': {
          const k = Math.floor(Number(n));
          if (!Number.isFinite(k) || k < 0) throw new Error('Enter a valid N (≥ 0).');
          sampled = k === 0 ? [] : body.slice(Math.max(0, body.length - k));
          break;
        }
        case 'nth': {
          const s = Math.floor(Number(stride));
          const off = Math.floor(Number(offset));
          if (!Number.isFinite(s) || s < 1) throw new Error('Stride must be ≥ 1.');
          if (!Number.isFinite(off) || off < 0) throw new Error('Offset must be ≥ 0.');
          for (let i = off; i < body.length; i += s) {
            const row = body[i];
            if (row) sampled.push(row);
          }
          break;
        }
        case 'randomN': {
          const k = Math.floor(Number(n));
          const sd = Math.floor(Number(seed));
          if (!Number.isFinite(k) || k < 0) throw new Error('Enter a valid N (≥ 0).');
          if (!Number.isFinite(sd)) throw new Error('Enter a valid integer seed.');
          const take = Math.min(k, body.length);
          const idx = body.map((_, i) => i);
          const rand = mulberry32(sd);
          // partial Fisher–Yates: pick `take` distinct indices
          for (let i = 0; i < take; i++) {
            const j = i + Math.floor(rand() * (idx.length - i));
            const a = idx[i];
            const b = idx[j];
            if (a === undefined || b === undefined) continue;
            idx[i] = b;
            idx[j] = a;
          }
          const chosen = idx.slice(0, take).sort((x, y) => x - y);
          sampled = chosen.map((i) => body[i]).filter((r): r is string[] => r !== undefined);
          break;
        }
        case 'randomPct': {
          const p = Number(pct);
          const sd = Math.floor(Number(seed));
          if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error('Percent must be 0–100.');
          if (!Number.isFinite(sd)) throw new Error('Enter a valid integer seed.');
          const rand = mulberry32(sd);
          const thresh = p / 100;
          for (const row of body) {
            if (rand() < thresh) sampled.push(row);
          }
          break;
        }
        default:
          throw new Error('Unknown sampling mode.');
      }

      const out = head ? [head, ...sampled] : sampled;
      return toCsv(out, delim);
    },
    [delim, mode, n, pct, stride, offset, seed, hasHeader]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, mode, n, pct, stride, offset, seed, hasHeader]}
      inputLabel="CSV"
      outputLabel="Sampled CSV"
      inputPlaceholder={'id,name\n1,Ada'}
      sample={SAMPLE}
      downloadName="sample.csv"
      downloadMime="text/csv"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={setDelim}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIMS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {(mode === 'head' || mode === 'tail' || mode === 'randomN') && (
            <Field label="N">
              <Input value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" className="w-24" />
            </Field>
          )}
          {mode === 'randomPct' && (
            <Field label="Percent">
              <Input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" className="w-24" />
            </Field>
          )}
          {mode === 'nth' && (
            <>
              <Field label="Stride">
                <Input value={stride} onChange={(e) => setStride(e.target.value)} inputMode="numeric" className="w-24" />
              </Field>
              <Field label="Offset">
                <Input value={offset} onChange={(e) => setOffset(e.target.value)} inputMode="numeric" className="w-24" />
              </Field>
            </>
          )}
          {(mode === 'randomN' || mode === 'randomPct') && (
            <Field label="Seed">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} inputMode="numeric" className="w-24" />
            </Field>
          )}
          <Field label="Header">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Switch checked={hasHeader} onCheckedChange={setHasHeader} /> first row is header
            </label>
          </Field>
        </>
      }
    />
  );
}
