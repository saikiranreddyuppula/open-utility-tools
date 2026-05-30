'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Row {
  label: string;
  value: string;
}

interface Ok {
  rows: Row[];
  valid: boolean;
}

interface Err {
  error: string;
}

function normalize(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** ISBN-10 check digit (0-9 or X). Operates on the 9 payload digits. */
function isbn10Check(digits: number[]): string {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const d = digits[i] ?? 0;
    sum += d * (10 - i);
  }
  const rem = (11 - (sum % 11)) % 11;
  return rem === 10 ? 'X' : String(rem);
}

/** ISBN-13 / EAN-13 check digit. Operates on the 12 payload digits. */
function isbn13Check(digits: number[]): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const d = digits[i] ?? 0;
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

function parseDigits10(s: string): number[] | null {
  if (s.length !== 10) return null;
  const out: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    const ch = s[i] ?? '';
    if (i === 9 && ch === 'X') {
      out.push(10);
    } else if (ch >= '0' && ch <= '9') {
      out.push(ch.charCodeAt(0) - 48);
    } else {
      return null;
    }
  }
  return out;
}

function parseDigits13(s: string): number[] | null {
  if (s.length !== 13) return null;
  const out: number[] = [];
  for (let i = 0; i < 13; i += 1) {
    const ch = s[i] ?? '';
    if (ch >= '0' && ch <= '9') {
      out.push(ch.charCodeAt(0) - 48);
    } else {
      return null;
    }
  }
  return out;
}

export default function IsbnValidatorTool() {
  const [raw, setRaw] = useState('978-0-306-40615-7');

  const result = useMemo<Ok | Err>(() => {
    const s = normalize(raw);
    if (!s) return { error: 'Enter an ISBN-10 or ISBN-13.' };

    if (s.length === 10) {
      const digits = parseDigits10(s);
      if (!digits) {
        return { error: 'ISBN-10 must be 10 characters (digits, last may be X).' };
      }
      const expected = isbn10Check(digits);
      const actual = digits[9] === 10 ? 'X' : String(digits[9] ?? -1);
      const valid = expected === actual;
      // Convert to ISBN-13: prefix 978, drop ISBN-10 check digit, recompute.
      const core13 = [9, 7, 8, ...digits.slice(0, 9)];
      const c13 = isbn13Check(core13);
      const isbn13 = `${[9, 7, 8].join('')}${digits.slice(0, 9).join('')}${c13}`;
      return {
        valid,
        rows: [
          { label: 'Detected format', value: 'ISBN-10' },
          { label: 'Result', value: valid ? 'VALID' : 'INVALID' },
          { label: 'Expected check digit', value: expected },
          { label: 'Provided check digit', value: actual },
          { label: 'Converted ISBN-13', value: isbn13 },
        ],
      };
    }

    if (s.length === 13) {
      const digits = parseDigits13(s);
      if (!digits) return { error: 'ISBN-13 must be 13 digits.' };
      const expected = isbn13Check(digits);
      const actual = String(digits[12] ?? -1);
      const valid = expected === actual;
      const prefix = `${digits[0] ?? ''}${digits[1] ?? ''}${digits[2] ?? ''}`;
      // ISBN-13 -> ISBN-10 only possible for the 978 prefix.
      let isbn10 = 'n/a (only 978-prefixed convert)';
      if (prefix === '978') {
        const core10 = digits.slice(3, 12);
        const c10 = isbn10Check(core10);
        isbn10 = `${core10.join('')}${c10}`;
      }
      return {
        valid,
        rows: [
          { label: 'Detected format', value: 'ISBN-13' },
          { label: 'Result', value: valid ? 'VALID' : 'INVALID' },
          { label: 'Expected check digit', value: expected },
          { label: 'Provided check digit', value: actual },
          { label: 'Converted ISBN-10', value: isbn10 },
        ],
      };
    }

    return { error: `Length ${s.length} is neither ISBN-10 (10) nor ISBN-13 (13).` };
  }, [raw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="ISBN (hyphens/spaces ignored)" className="min-w-[280px] flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="978-0-306-40615-7"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={result.valid ? 'Valid' : 'Invalid'}>
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
          <StatBar items={[`Input: ${normalize(raw) || '(empty)'}`]} />
        </Panel>
      )}
    </div>
  );
}
