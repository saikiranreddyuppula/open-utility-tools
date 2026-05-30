'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

/** Leading institution code → bank name (Australian BSB allocations, abbreviated). */
const BANKS: Record<string, string> = {
  '01': 'ANZ',
  '03': 'Westpac',
  '04': 'Westpac',
  '06': 'Commonwealth Bank',
  '08': 'National Australia Bank',
  '11': 'St George Bank',
  '12': 'Bank of Queensland',
  '13': 'Bank of Queensland',
  '14': 'Rabobank',
  '15': 'Town & Country / IMB',
  '18': 'Macquarie Bank',
  '19': 'Bank of Melbourne',
  '21': 'JPMorgan Chase',
  '22': 'BNP Paribas',
  '25': 'BankWest',
  '30': 'BankWest',
  '32': 'Police Bank',
  '33': 'Westpac',
  '34': 'HSBC Australia',
  '40': 'Commonwealth Bank',
  '42': 'ANZ',
  '48': 'Suncorp Bank',
  '51': 'AMP Bank',
  '57': 'Australian Settlements (ASL)',
  '63': 'Bendigo Bank',
  '64': 'ME Bank',
  '65': 'Bendigo & Adelaide Bank',
  '73': 'Cuscal (credit unions)',
  '76': 'Commonwealth Bank',
  '80': 'Cuscal',
  '94': 'St George Bank',
};

/** Third digit (state code) → region. */
const STATES: Record<string, string> = {
  '2': 'ACT',
  '3': 'NSW (interstate) / general',
  '4': 'NSW',
  '5': 'VIC',
  '6': 'VIC (interstate)',
  '7': 'QLD',
  '8': 'SA / NT',
  '9': 'WA',
  '0': 'National / head office',
  '1': 'National / head office',
};

interface Ok {
  ok: true;
  formatted: string;
  bankCode: string;
  bankName: string;
  stateCode: string;
  stateName: string;
  branch: string;
}
interface Err {
  ok: false;
  error: string;
}

export default function BsbValidatorTool() {
  const [input, setInput] = useState('062-000');

  const result = useMemo<Ok | Err>(() => {
    const cleaned = input.replace(/[\s-]/g, '');
    if (!cleaned) return { ok: false, error: 'Enter a 6-digit BSB (e.g. 062-000).' };
    if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'A BSB contains only digits.' };
    if (cleaned.length !== 6) {
      return { ok: false, error: `A BSB is exactly 6 digits (got ${cleaned.length}).` };
    }
    const bankCode = cleaned.slice(0, 2);
    const stateCode = cleaned.charAt(2);
    const branch = cleaned.slice(3, 6);
    return {
      ok: true,
      formatted: `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`,
      bankCode,
      bankName: BANKS[bankCode] ?? 'Unknown institution',
      stateCode,
      stateName: STATES[stateCode] ?? 'Unknown / reserved',
      branch,
    };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="BSB number" className="min-w-[260px] flex-1" hint="6 digits, optional XXX-XXX hyphen. BSBs have no checksum.">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="062-000"
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
          <PanelHeader title="Parsed BSB">
            <CopyButton
              value={() =>
                `${result.formatted} · ${result.bankName} · ${result.stateName} · branch ${result.branch}`
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Formatted</span>
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span>{result.formatted}</span>
                <CopyButton value={result.formatted} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Bank ({result.bankCode})</span>
              <span className="font-mono text-sm">{result.bankName}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">State ({result.stateCode})</span>
              <span className="font-mono text-sm">{result.stateName}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Branch</span>
              <span className="font-mono text-sm">{result.branch}</span>
            </div>
          </div>
          <StatBar
            items={[
              'Format valid',
              `bank ${result.bankCode}`,
              `state ${result.stateCode}`,
              `branch ${result.branch}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
