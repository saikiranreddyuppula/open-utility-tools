'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Kind = 'pbkdf2' | 'scrypt' | 'argon2id';

interface Row {
  label: string;
  value: string;
  note?: string;
}

interface Ok {
  rows: Row[];
  summary: string;
}

interface Err {
  error: string;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

function intOr(s: string, fallback: number): number {
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : fallback;
}

export default function KdfPlannerTool() {
  const [kind, setKind] = useState<Kind>('scrypt');
  // PBKDF2
  const [iters, setIters] = useState('600000');
  const [hash, setHash] = useState('256');
  // scrypt
  const [logN, setLogN] = useState('15');
  const [r, setR] = useState('8');
  const [p, setP] = useState('1');
  // argon2
  const [mem, setMem] = useState('19456');
  const [argIters, setArgIters] = useState('2');
  const [par, setPar] = useState('1');

  const result = useMemo<Ok | Err>(() => {
    if (kind === 'pbkdf2') {
      const it = intOr(iters, 0);
      if (it <= 0) return { error: 'Iterations must be a positive integer.' };
      const hbits = intOr(hash, 256);
      const owasp =
        hbits === 1
          ? 1_300_000
          : hbits === 512
            ? 210_000
            : 600_000;
      return {
        summary: `PBKDF2 iterations=${it} HMAC-SHA${hbits}`,
        rows: [
          { label: 'Iterations', value: it.toLocaleString() },
          { label: 'PRF', value: `HMAC-SHA${hbits}` },
          {
            label: 'OWASP 2023 minimum',
            value: owasp.toLocaleString(),
            note: it >= owasp ? 'meets minimum' : 'below recommended minimum',
          },
          {
            label: 'Relative cost vs 100k',
            value: `${(it / 100_000).toFixed(2)}x`,
          },
          { label: 'Memory cost', value: 'negligible (not memory-hard)' },
        ],
      };
    }

    if (kind === 'scrypt') {
      const lN = intOr(logN, 0);
      if (lN <= 0 || lN > 28) return { error: 'log2(N) must be 1–28.' };
      const rr = intOr(r, 8);
      const pp = intOr(p, 1);
      const N = Math.pow(2, lN);
      // scrypt memory ≈ 128 * N * r bytes (per the core SMix); total work scales with p.
      const memBytes = 128 * N * rr;
      const totalBytes = memBytes * pp;
      const owaspOk = lN >= 17 && rr >= 8 && pp >= 1;
      return {
        summary: `scrypt N=2^${lN} (${N}) r=${rr} p=${pp}`,
        rows: [
          { label: 'N', value: `2^${lN} = ${N.toLocaleString()}` },
          { label: 'r (block size)', value: String(rr) },
          { label: 'p (parallelism)', value: String(pp) },
          { label: 'Memory (128·N·r)', value: fmtBytes(memBytes) },
          { label: 'Total with p', value: fmtBytes(totalBytes) },
          {
            label: 'OWASP 2023 (N=2^17,r=8,p=1)',
            value: owaspOk ? 'meets minimum' : 'below recommended minimum',
          },
        ],
      };
    }

    // argon2id
    const m = intOr(mem, 0);
    if (m <= 0) return { error: 'Memory must be a positive integer (KiB).' };
    const t = intOr(argIters, 2);
    const pa = intOr(par, 1);
    const memBytes = m * 1024;
    const owaspOk = m >= 19456 && t >= 2 && pa >= 1;
    return {
      summary: `Argon2id m=${m}KiB t=${t} p=${pa}`,
      rows: [
        { label: 'Memory', value: `${m.toLocaleString()} KiB (${fmtBytes(memBytes)})` },
        { label: 'Iterations (t)', value: String(t) },
        { label: 'Parallelism (p)', value: String(pa) },
        { label: 'Relative cost ≈ m·t', value: `${(m * t).toLocaleString()}` },
        {
          label: 'OWASP 2023 (19 MiB, t=2, p=1)',
          value: owaspOk ? 'meets minimum' : 'below recommended minimum',
        },
      ],
    };
  }, [kind, iters, hash, logN, r, p, mem, argIters, par]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="KDF">
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList>
                <TabsTrigger value="pbkdf2">PBKDF2</TabsTrigger>
                <TabsTrigger value="scrypt">scrypt</TabsTrigger>
                <TabsTrigger value="argon2id">Argon2id</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <OptionsBar className="rounded-t-none border-t-0">
          {kind === 'pbkdf2' && (
            <>
              <Field label="Iterations">
                <Input
                  value={iters}
                  onChange={(e) => setIters(e.target.value)}
                  inputMode="numeric"
                  className="w-36 font-mono"
                />
              </Field>
              <Field label="SHA variant (bits)">
                <Input
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  inputMode="numeric"
                  className="w-28 font-mono"
                />
              </Field>
            </>
          )}
          {kind === 'scrypt' && (
            <>
              <Field label="log2(N)">
                <Input
                  value={logN}
                  onChange={(e) => setLogN(e.target.value)}
                  inputMode="numeric"
                  className="w-24 font-mono"
                />
              </Field>
              <Field label="r">
                <Input
                  value={r}
                  onChange={(e) => setR(e.target.value)}
                  inputMode="numeric"
                  className="w-20 font-mono"
                />
              </Field>
              <Field label="p">
                <Input
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  inputMode="numeric"
                  className="w-20 font-mono"
                />
              </Field>
            </>
          )}
          {kind === 'argon2id' && (
            <>
              <Field label="Memory (KiB)">
                <Input
                  value={mem}
                  onChange={(e) => setMem(e.target.value)}
                  inputMode="numeric"
                  className="w-32 font-mono"
                />
              </Field>
              <Field label="Iterations (t)">
                <Input
                  value={argIters}
                  onChange={(e) => setArgIters(e.target.value)}
                  inputMode="numeric"
                  className="w-24 font-mono"
                />
              </Field>
              <Field label="Parallelism (p)">
                <Input
                  value={par}
                  onChange={(e) => setPar(e.target.value)}
                  inputMode="numeric"
                  className="w-24 font-mono"
                />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Parameters">
            <CopyButton
              value={() =>
                `${result.summary}\n${result.rows.map((r2) => `${r2.label}: ${r2.value}`).join('\n')}`
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-56 shrink-0 text-sm text-muted-foreground">{row.label}</span>
                <span className="min-w-0 flex-1 font-mono text-sm">{row.value}</span>
                {row.note && (
                  <span className="shrink-0 text-2xs text-muted-foreground">{row.note}</span>
                )}
              </div>
            ))}
          </div>
          <StatBar items={[result.summary, 'Planner only — no derivation performed']} />
        </Panel>
      )}
    </div>
  );
}
