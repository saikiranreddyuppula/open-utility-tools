'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

/** ISO 13616 IBAN total length per country code (registry, abbreviated to common members). */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20,
};

/** Compute big-integer value mod 97 piecewise over the numeric string. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    const c = numeric.charCodeAt(i) - 48;
    remainder = (remainder * 10 + c) % 97;
  }
  return remainder;
}

interface Ok {
  ok: true;
  valid: boolean;
  remainder: number;
  country: string;
  checkDigits: string;
  bban: string;
  formatted: string;
  expectedLen: number | null;
  lenMatches: boolean;
}
interface Err {
  ok: false;
  error: string;
}

export default function IbanValidatorTool() {
  const [input, setInput] = useState('GB82 WEST 1234 5698 7654 32');

  const result = useMemo<Ok | Err>(() => {
    const cleaned = input.replace(/\s+/g, '').toUpperCase();
    if (!cleaned) return { ok: false, error: 'Enter an IBAN.' };
    if (!/^[A-Z0-9]+$/.test(cleaned)) {
      return { ok: false, error: 'An IBAN contains only letters and digits.' };
    }
    if (cleaned.length < 5) return { ok: false, error: 'IBAN is too short.' };
    if (cleaned.length > 34) return { ok: false, error: 'IBAN exceeds the maximum length of 34 characters.' };
    if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
      return { ok: false, error: 'IBAN must start with a 2-letter country code and 2 check digits.' };
    }

    const country = cleaned.slice(0, 2);
    const checkDigits = cleaned.slice(2, 4);
    const bban = cleaned.slice(4);

    // Move first four chars to the end, then map A=10…Z=35.
    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    let numeric = '';
    for (let i = 0; i < rearranged.length; i++) {
      const ch = rearranged.charCodeAt(i);
      if (ch >= 65 && ch <= 90) {
        numeric += String(ch - 55); // A(65)->10
      } else {
        numeric += String(ch - 48); // '0'(48)->0
      }
    }
    const remainder = mod97(numeric);

    const expectedLen = IBAN_LENGTHS[country] ?? null;
    const lenMatches = expectedLen === null ? true : cleaned.length === expectedLen;
    const valid = remainder === 1 && lenMatches;

    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();

    return {
      ok: true,
      valid,
      remainder,
      country,
      checkDigits,
      bban,
      formatted,
      expectedLen,
      lenMatches,
    };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="IBAN" className="min-w-[280px] flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="GB82 WEST 1234 5698 7654 32"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                `${result.formatted}: ${result.valid ? 'VALID' : 'INVALID'} (mod-97 = ${result.remainder})`
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div
              className={
                'flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2 ' +
                (result.valid ? 'bg-emerald-500/10' : 'bg-destructive/10')
              }
            >
              <span className="text-sm text-muted-foreground">Checksum</span>
              <span className="font-mono text-sm font-semibold">
                {result.valid ? 'VALID' : 'INVALID'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">mod-97 remainder</span>
              <span className="font-mono text-sm">{result.remainder} (valid = 1)</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Country</span>
              <span className="font-mono text-sm">{result.country}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Check digits</span>
              <span className="font-mono text-sm">{result.checkDigits}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Length</span>
              <span className="font-mono text-sm">
                {result.expectedLen === null
                  ? `${result.formatted.replace(/\s/g, '').length} (unknown country)`
                  : `${result.formatted.replace(/\s/g, '').length} / ${result.expectedLen}${result.lenMatches ? ' ok' : ' mismatch'}`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">BBAN</span>
              <span className="flex items-center gap-2 break-all font-mono text-sm">
                <span>{result.bban}</span>
                <CopyButton value={result.bban} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Formatted</span>
              <span className="flex items-center gap-2 break-all font-mono text-sm">
                <span>{result.formatted}</span>
                <CopyButton value={result.formatted} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar
            items={[
              `mod-97 = ${result.remainder}`,
              result.expectedLen !== null
                ? result.lenMatches
                  ? `length matches ${result.country}`
                  : `expected ${result.expectedLen} chars for ${result.country}`
                : 'country length unknown',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
