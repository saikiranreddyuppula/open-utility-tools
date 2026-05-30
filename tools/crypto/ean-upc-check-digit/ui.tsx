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

type BarType = 'ean13' | 'ean8' | 'upca';

const TYPE_LEN: Record<BarType, number> = { ean13: 13, ean8: 8, upca: 12 };
const TYPE_LABEL: Record<BarType, string> = { ean13: 'EAN-13', ean8: 'EAN-8', upca: 'UPC-A' };

/**
 * GS1 mod-10 check digit over the data digits (excluding the check position).
 * Weights alternate 3,1,3,1… starting from the digit immediately left of the check digit.
 */
function gs1Check(dataDigits: number[]): { check: number; sum: number } {
  let sum = 0;
  // dataDigits[last] is adjacent to the check position → weight 3.
  for (let i = dataDigits.length - 1, pos = 0; i >= 0; i--, pos++) {
    const w = pos % 2 === 0 ? 3 : 1;
    sum += (dataDigits[i] ?? 0) * w;
  }
  const check = (10 - (sum % 10)) % 10;
  return { check, sum };
}

interface Ok {
  ok: true;
  type: BarType;
  mode: 'computed' | 'verified';
  check: number;
  sum: number;
  full: string;
  verdict: boolean | null;
  given: number | null;
}
interface Err {
  ok: false;
  error: string;
}

export default function EanUpcCheckDigitTool() {
  const [type, setType] = useState<BarType>('ean13');
  const [input, setInput] = useState('978014300723');

  const result = useMemo<Ok | Err>(() => {
    const cleaned = input.replace(/[\s-]/g, '');
    if (!cleaned) return { ok: false, error: 'Enter a barcode number.' };
    if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'Barcodes contain only digits (0-9).' };

    const full = TYPE_LEN[type];
    const dataLen = full - 1;

    if (cleaned.length === dataLen) {
      // compute the missing trailing check digit
      const digits: number[] = [];
      for (let i = 0; i < cleaned.length; i++) digits.push(cleaned.charCodeAt(i) - 48);
      const { check, sum } = gs1Check(digits);
      return {
        ok: true,
        type,
        mode: 'computed',
        check,
        sum,
        full: cleaned + String(check),
        verdict: null,
        given: null,
      };
    }
    if (cleaned.length === full) {
      // verify the supplied full code
      const digits: number[] = [];
      for (let i = 0; i < dataLen; i++) digits.push(cleaned.charCodeAt(i) - 48);
      const { check, sum } = gs1Check(digits);
      const given = cleaned.charCodeAt(full - 1) - 48;
      return {
        ok: true,
        type,
        mode: 'verified',
        check,
        sum,
        full: cleaned,
        verdict: check === given,
        given,
      };
    }
    return {
      ok: false,
      error: `${TYPE_LABEL[type]} needs ${dataLen} digits (to compute) or ${full} digits (to verify); got ${cleaned.length}.`,
    };
  }, [type, input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Barcode type">
            <Select value={type} onValueChange={(v) => setType(v as BarType)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ean13">EAN-13</SelectItem>
                <SelectItem value="ean8">EAN-8</SelectItem>
                <SelectItem value="upca">UPC-A</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Digits" className="min-w-[260px] flex-1" hint="omit the last digit to compute it, or include it to verify">
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
          <PanelHeader title={result.mode === 'computed' ? 'Computed check digit' : 'Verification'}>
            <CopyButton value={() => result.full} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.mode === 'verified' && result.verdict !== null && (
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
                {result.mode === 'computed' ? 'Check digit' : 'Expected check'}
              </span>
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span>{result.check}</span>
                <CopyButton value={String(result.check)} size="icon-sm" />
              </span>
            </div>
            {result.mode === 'verified' && result.given !== null && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Provided check</span>
                <span className="font-mono text-sm">{result.given}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Complete code</span>
              <span className="flex items-center gap-2 break-all font-mono text-sm">
                <span>{result.full}</span>
                <CopyButton value={result.full} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar
            items={[
              TYPE_LABEL[result.type],
              `weighted sum = ${result.sum}`,
              `check = (10 − ${result.sum % 10}) mod 10 = ${result.check}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
