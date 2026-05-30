'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'generate' | 'complete' | 'validate';
type Symbology = 'ean13' | 'ean8' | 'upca' | 'isbn13' | 'isbn10';

interface Sym {
  label: string;
  /** Total length including check digit. */
  length: number;
  /** Algorithm: GS1 mod-10 (alternating weights) or ISBN-10 mod-11. */
  algo: 'mod10' | 'mod11';
}

const SYMS: Record<Symbology, Sym> = {
  ean13: { label: 'EAN-13', length: 13, algo: 'mod10' },
  ean8: { label: 'EAN-8', length: 8, algo: 'mod10' },
  upca: { label: 'UPC-A', length: 12, algo: 'mod10' },
  isbn13: { label: 'ISBN-13', length: 13, algo: 'mod10' },
  isbn10: { label: 'ISBN-10', length: 10, algo: 'mod11' },
};

/** Mulberry32 seeded PRNG for reproducible batches. */
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

/** GS1 mod-10: weight pattern from the right is 3,1,3,1,... over the body. */
function gs1CheckDigit(body: string): number {
  let sum = 0;
  // Process body right-to-left; rightmost body digit gets weight 3.
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i] ?? '0');
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** ISBN-10 mod-11: positions weighted 10..2 over the 9-digit body; check can be 'X'. */
function isbn10CheckChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[i] ?? '0');
    sum += digit * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

function checkChar(sym: Sym, body: string): string {
  if (sym.algo === 'mod11') return isbn10CheckChar(body);
  return String(gs1CheckDigit(body));
}

function isValid(sym: Symbology, code: string): boolean {
  const spec = SYMS[sym];
  const cleaned = code.replace(/[\s-]/g, '');
  if (cleaned.length !== spec.length) return false;
  const body = cleaned.slice(0, spec.length - 1);
  const last = cleaned.slice(spec.length - 1);
  if (spec.algo === 'mod11') {
    if (!/^\d{9}$/.test(body) || !/^[\dX]$/.test(last)) return false;
    return checkChar(spec, body) === last.toUpperCase();
  }
  if (!/^\d+$/.test(cleaned)) return false;
  return checkChar(spec, body) === last;
}

function genBody(sym: Symbology, prefix: string, rand: () => number): string {
  const spec = SYMS[sym];
  const bodyLen = spec.length - 1;
  let body = '';
  // ISBN-13 always begins 978 / 979.
  if (sym === 'isbn13') body += rand() < 0.5 ? '978' : '979';
  // honour a user GS1 prefix where it fits
  const cleanPrefix = prefix.replace(/\D/g, '');
  if (cleanPrefix && (sym === 'ean13' || sym === 'ean8' || sym === 'upca')) {
    body += cleanPrefix.slice(0, bodyLen);
  }
  while (body.length < bodyLen) {
    body += String(Math.floor(rand() * 10));
  }
  return body.slice(0, bodyLen);
}

export default function EanUpcGeneratorTool() {
  const [mode, setMode] = useState<Mode>('generate');
  const [sym, setSym] = useState<Symbology>('ean13');
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('');
  const [seed, setSeed] = useState('');
  const [partial, setPartial] = useState('');

  const safeCount = Number.isFinite(count) ? Math.min(1000, Math.max(1, Math.floor(count))) : 10;

  const result = useMemo(() => {
    const spec = SYMS[sym];

    if (mode === 'generate') {
      const seedNum = seed.trim() ? hashSeed(seed.trim()) : (Date.now() >>> 0);
      const rand = mulberry32(seedNum);
      const codes: { body: string; check: string }[] = [];
      for (let i = 0; i < safeCount; i += 1) {
        const body = genBody(sym, prefix, rand);
        codes.push({ body, check: checkChar(spec, body) });
      }
      return { kind: 'list' as const, codes };
    }

    if (mode === 'complete') {
      const cleaned = partial.replace(/[\s-]/g, '');
      const need = spec.length - 1;
      if (!cleaned) return { kind: 'error' as const, error: 'Enter a partial code body.' };
      if (!/^\d+$/.test(cleaned)) return { kind: 'error' as const, error: 'Body must be digits only.' };
      if (cleaned.length !== need) {
        return {
          kind: 'error' as const,
          error: `${spec.label} needs exactly ${need} body digits (you have ${cleaned.length}).`,
        };
      }
      const check = checkChar(spec, cleaned);
      return { kind: 'single' as const, body: cleaned, check };
    }

    // validate
    const cleaned = partial.replace(/[\s-]/g, '');
    if (!cleaned) return { kind: 'error' as const, error: 'Enter a full code to validate.' };
    const ok = isValid(sym, cleaned);
    const body = cleaned.slice(0, spec.length - 1);
    const expected = checkChar(spec, body);
    return { kind: 'check' as const, ok, given: cleaned, expected };
  }, [mode, sym, safeCount, prefix, seed, partial]);

  const allText =
    result.kind === 'list'
      ? result.codes.map((c) => c.body + c.check).join('\n')
      : '';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="generate">Generate</TabsTrigger>
              <TabsTrigger value="complete">Check digit</TabsTrigger>
              <TabsTrigger value="validate">Validate</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Symbology">
          <Select value={sym} onValueChange={(v) => setSym(v as Symbology)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SYMS) as Symbology[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SYMS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {mode === 'generate' && (
          <>
            <Field label="Count">
              <Input
                type="number"
                min={1}
                max={1000}
                value={Number.isFinite(count) ? count : 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setCount(Number.isFinite(n) ? Math.min(1000, Math.max(1, Math.floor(n))) : 1);
                }}
                className="w-24 font-mono"
              />
            </Field>
            <Field label="GS1 prefix" hint="optional, EAN/UPC only">
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-28 font-mono"
                placeholder="e.g. 400"
              />
            </Field>
            <Field label="Seed" hint="optional, reproducible">
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-28 font-mono"
                placeholder="random"
              />
            </Field>
          </>
        )}
        {(mode === 'complete' || mode === 'validate') && (
          <Field label={mode === 'complete' ? 'Body digits' : 'Full code'} className="min-w-[260px] flex-1">
            <Input
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              className="font-mono"
              placeholder={mode === 'complete' ? 'digits without check' : 'full code incl. check'}
            />
          </Field>
        )}
      </OptionsBar>

      {result.kind === 'error' ? (
        <ErrorBanner error={result.error} />
      ) : result.kind === 'list' ? (
        <Panel>
          <PanelHeader title={`${SYMS[sym].label} codes`}>
            <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
            <DownloadButton data={() => allText} filename="codes.txt" disabled={!allText} />
          </PanelHeader>
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.codes.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {c.body}
                  <span className="font-semibold text-primary">{c.check}</span>
                </code>
                <CopyButton value={c.body + c.check} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.codes.length.toLocaleString()} generated`,
              SYMS[sym].label,
              seed.trim() ? `seed: ${seed.trim()}` : false,
            ]}
          />
        </Panel>
      ) : result.kind === 'single' ? (
        <Panel>
          <PanelHeader title="Completed code">
            <CopyButton value={() => result.body + result.check} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-lg">
              {result.body}
              <span className="font-bold text-primary">{result.check}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Check digit</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span className="font-bold text-primary">{result.check}</span>
                <CopyButton value={result.check} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar items={[SYMS[sym].label, `${(result.body + result.check).length} digits`]} />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Validation" />
          <div className="space-y-3 p-3">
            <div
              className={
                'rounded-md border px-3 py-2 text-sm font-semibold ' +
                (result.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400')
              }
            >
              {result.ok ? 'Valid — check digit matches.' : 'Invalid — check digit / length mismatch.'}
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Expected check digit</span>
              <span className="font-mono text-sm font-bold text-primary">{result.expected}</span>
            </div>
          </div>
          <StatBar items={[SYMS[sym].label, `entered: ${result.given || '—'}`]} />
        </Panel>
      )}
    </div>
  );
}
