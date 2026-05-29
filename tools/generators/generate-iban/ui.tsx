'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

interface CountrySpec {
  name: string;
  /** BBAN structure: 'n' = digit, 'a' = uppercase letter, 'c' = alphanumeric. */
  bban: string;
}

// BBAN structures per the IBAN registry (length of BBAN, char classes).
const COUNTRIES: Record<string, CountrySpec> = {
  DE: { name: 'Germany', bban: 'nnnnnnnnnnnnnnnnnn' }, // 18n
  FR: { name: 'France', bban: 'nnnnnnnnnncccccccccccnn' }, // 5n5n11c2n -> 10n + 11c + 2n
  GB: { name: 'United Kingdom', bban: 'aaaannnnnnnnnnnnnn' }, // 4a + 14n
  ES: { name: 'Spain', bban: 'nnnnnnnnnnnnnnnnnnnn' }, // 20n
  IT: { name: 'Italy', bban: 'annnnnnnnnncccccccccccc' }, // 1a + 10n + 12c (23 total)
  NL: { name: 'Netherlands', bban: 'aaaannnnnnnnnn' }, // 4a + 10n
  BE: { name: 'Belgium', bban: 'nnnnnnnnnnnn' }, // 12n
  CH: { name: 'Switzerland', bban: 'nnnnncccccccccccc' }, // 5n + 12c (17 total)
  AT: { name: 'Austria', bban: 'nnnnnnnnnnnnnnnn' }, // 16n
  IE: { name: 'Ireland', bban: 'aaaannnnnnnnnnnnnn' }, // 4a + 14n
  PT: { name: 'Portugal', bban: 'nnnnnnnnnnnnnnnnnnnnn' }, // 21n
  PL: { name: 'Poland', bban: 'nnnnnnnnnnnnnnnnnnnnnnnn' }, // 24n
  SE: { name: 'Sweden', bban: 'nnnnnnnnnnnnnnnnnnnn' }, // 20n
  NO: { name: 'Norway', bban: 'nnnnnnnnnnn' }, // 11n
  FI: { name: 'Finland', bban: 'nnnnnnnnnnnnnn' }, // 14n
};

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Unbiased index in [0, max). */
function randInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

function randomChar(set: string): string {
  return set[randInt(set.length)] ?? set[0] ?? '0';
}

function buildBban(structure: string): string {
  let out = '';
  for (const ch of structure) {
    if (ch === 'n') out += randomChar(DIGITS);
    else if (ch === 'a') out += randomChar(LETTERS);
    else out += randomChar(ALNUM);
  }
  return out;
}

/** Converts A-Z to 10-35, digits stay; per ISO 13616. */
function toNumericString(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else {
      // A=10 ... Z=35
      out += String(ch.charCodeAt(0) - 55);
    }
  }
  return out;
}

/** mod 97 of a long numeric string, computed in chunks to avoid overflow. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 1) {
    remainder = (remainder * 10 + Number(numeric[i] ?? '0')) % 97;
  }
  return remainder;
}

function generateIban(code: string): string {
  const spec = COUNTRIES[code];
  if (!spec) return '';
  const bban = buildBban(spec.bban);
  // Move country code + '00' to the end, convert to numeric, compute check digits.
  const rearranged = bban + code + '00';
  const numeric = toNumericString(rearranged);
  const check = 98 - mod97(numeric);
  const checkDigits = String(check).padStart(2, '0');
  return code + checkDigits + bban;
}

function formatIban(iban: string): string {
  return (iban.match(/.{1,4}/g) ?? [iban]).join(' ');
}

export default function IbanTool() {
  const [code, setCode] = useState('DE');
  const [count, setCount] = useState(5);
  const [grouped, setGrouped] = useState(true);
  const [ibans, setIbans] = useState<string[]>([]);

  const safeCount = Number.isFinite(count) ? Math.min(1000, Math.max(1, Math.floor(count))) : 5;

  const regen = useCallback(() => {
    setIbans(Array.from({ length: safeCount }, () => generateIban(code)));
  }, [code, safeCount]);

  useEffect(() => {
    regen();
  }, [regen]);

  const display = (iban: string): string => (grouped ? formatIban(iban) : iban);
  const allText = ibans.map(display).join('\n');
  const sampleLen = ibans[0]?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Country">
          <Select value={code} onValueChange={(v) => setCode(v)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(COUNTRIES).map((c) => (
                <SelectItem key={c} value={c}>
                  {c} — {COUNTRIES[c]?.name ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
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
        <Field label="Format">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={grouped} onCheckedChange={(v) => setGrouped(v === true)} />
            <span>Group in blocks of 4</span>
          </label>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Test IBANs">
          <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
          <DownloadButton data={() => allText} filename="ibans.txt" disabled={!allText} />
        </PanelHeader>
        <div className="max-h-[420px] divide-y overflow-auto">
          {ibans.map((iban, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                {i + 1}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{display(iban)}</code>
              <CopyButton value={iban} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `${ibans.length.toLocaleString()} generated`,
            COUNTRIES[code]?.name ?? code,
            sampleLen ? `${sampleLen} chars` : false,
          ]}
        />
      </Panel>
    </div>
  );
}
