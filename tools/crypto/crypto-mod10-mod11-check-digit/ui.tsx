'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Algo = 'mod10' | 'mod11';
type Op = 'compute' | 'verify';
type Mod11Scheme = 'cycle2to7' | 'cycle2to10';

interface CheckResult {
  /** computed check character ('0'-'9' or 'X' for mod11 remainder 10) */
  check: string;
  /** weighted sum used */
  sum: number;
}

/** Luhn (mod-10) check digit for the given data digits (no check digit included). */
function luhnCheck(digits: number[]): CheckResult {
  let sum = 0;
  // Rightmost data digit is doubled first (it sits just left of the check position).
  for (let i = digits.length - 1, pos = 1; i >= 0; i--, pos++) {
    let d = digits[i] ?? 0;
    if (pos % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return { check: String(check), sum };
}

/** Mod-11 with cycling weights starting at 2 from the rightmost data digit. */
function mod11Check(digits: number[], maxWeight: number): CheckResult {
  let sum = 0;
  let w = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += (digits[i] ?? 0) * w;
    w++;
    if (w > maxWeight) w = 2;
  }
  const r = sum % 11;
  const c = (11 - r) % 11;
  // remainder/check of 10 → 'X'; 11→0 handled by mod above
  const check = c === 10 ? 'X' : String(c);
  return { check, sum };
}

interface Ok {
  ok: true;
  op: Op;
  check: string;
  sum: number;
  full: string;
  verdict: boolean | null;
  given: string | null;
}
interface Err {
  ok: false;
  error: string;
}

export default function Mod10Mod11Tool() {
  const [algo, setAlgo] = useState<Algo>('mod10');
  const [op, setOp] = useState<Op>('compute');
  const [scheme, setScheme] = useState<Mod11Scheme>('cycle2to7');
  const [input, setInput] = useState('7992739871');

  const result = useMemo<Ok | Err>(() => {
    const cleaned = input.replace(/[\s-]/g, '');
    if (!cleaned) return { ok: false, error: 'Enter a numeric string.' };
    // For verify, the last char may be 'X' (mod-11). For compute it must be all digits.
    const body = op === 'verify' ? cleaned.slice(0, -1) : cleaned;
    const lastChar = op === 'verify' ? cleaned.slice(-1) : null;
    if (op === 'verify' && cleaned.length < 2) {
      return { ok: false, error: 'Provide a full number including its check digit to verify.' };
    }
    if (!/^\d+$/.test(body)) {
      return { ok: false, error: 'Body must contain only digits (0-9).' };
    }
    if (op === 'verify' && lastChar !== null) {
      const validLast = algo === 'mod11' ? /^[0-9Xx]$/.test(lastChar) : /^[0-9]$/.test(lastChar);
      if (!validLast) {
        return {
          ok: false,
          error:
            algo === 'mod11'
              ? 'Check digit must be 0-9 or X.'
              : 'Check digit must be 0-9.',
        };
      }
    }

    const digits: number[] = [];
    for (let i = 0; i < body.length; i++) digits.push(body.charCodeAt(i) - 48);

    const res =
      algo === 'mod10'
        ? luhnCheck(digits)
        : mod11Check(digits, scheme === 'cycle2to7' ? 7 : 10);

    if (op === 'compute') {
      return {
        ok: true,
        op,
        check: res.check,
        sum: res.sum,
        full: body + res.check,
        verdict: null,
        given: null,
      };
    }
    const given = (lastChar ?? '').toUpperCase();
    return {
      ok: true,
      op,
      check: res.check,
      sum: res.sum,
      full: cleaned.toUpperCase(),
      verdict: res.check === given,
      given,
    };
  }, [algo, op, scheme, input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Operation">
            <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
              <TabsList>
                <TabsTrigger value="compute">Compute</TabsTrigger>
                <TabsTrigger value="verify">Verify</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Algorithm">
            <Tabs value={algo} onValueChange={(v) => setAlgo(v as Algo)}>
              <TabsList>
                <TabsTrigger value="mod10">Mod-10 (Luhn)</TabsTrigger>
                <TabsTrigger value="mod11">Mod-11</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {algo === 'mod11' && (
            <Field label="Mod-11 weights">
              <Select value={scheme} onValueChange={(v) => setScheme(v as Mod11Scheme)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cycle2to7">Cycle 2…7</SelectItem>
                  <SelectItem value="cycle2to10">Cycle 2…10</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field
            label={op === 'compute' ? 'Number (no check digit)' : 'Full number (with check digit)'}
            className="min-w-[260px] flex-1"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={op === 'compute' ? 'Computed' : 'Verification'}>
            <CopyButton value={() => result.full} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.op === 'verify' && (
              <div
                className={
                  'flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2 ' +
                  (result.verdict ? 'bg-emerald-500/10' : 'bg-destructive/10')
                }
              >
                <span className="text-sm text-muted-foreground">Verdict</span>
                <span className="font-mono text-sm font-semibold">
                  {result.verdict ? 'VALID' : 'INVALID'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {op === 'compute' ? 'Check digit' : 'Expected check'}
              </span>
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span>{result.check}</span>
                <CopyButton value={result.check} size="icon-sm" />
              </span>
            </div>
            {result.op === 'verify' && result.given !== null && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Provided check</span>
                <span className="font-mono text-sm">{result.given}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">
                {op === 'compute' ? 'Complete number' : 'Input'}
              </span>
              <span className="flex items-center gap-2 break-all font-mono text-sm">
                <span>{result.full}</span>
                <CopyButton value={result.full} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar items={[`weighted sum = ${result.sum}`, algo === 'mod10' ? 'mod 10' : 'mod 11']} />
        </Panel>
      )}
    </div>
  );
}
