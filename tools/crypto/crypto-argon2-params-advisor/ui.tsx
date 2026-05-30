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

type Tier = 'interactive' | 'moderate' | 'sensitive';

interface TierSpec {
  /** Time cost (iterations). */
  t: number;
  /** Preferred memory in MiB if RAM budget allows. */
  prefMib: number;
  /** Minimum acceptable memory in MiB (OWASP floor for Argon2id is 19 MiB). */
  minMib: number;
  note: string;
}

const TIERS: Record<Tier, TierSpec> = {
  interactive: { t: 2, prefMib: 47, minMib: 19, note: 'Login forms, low-latency UX (OWASP 19 MiB / t=2 floor).' },
  moderate: { t: 3, prefMib: 96, minMib: 46, note: 'Standard accounts; balances security and speed.' },
  sensitive: { t: 4, prefMib: 256, minMib: 96, note: 'Admin, key material, backups; tolerate higher latency.' },
};

interface Ok {
  ok: true;
  mKib: number;
  mMib: number;
  t: number;
  p: number;
  footprintMib: number;
  phc: string;
  note: string;
}
interface Err {
  ok: false;
  error: string;
}

export default function Argon2ParamsAdvisorTool() {
  const [ramMib, setRamMib] = useState('512');
  const [threads, setThreads] = useState('4');
  const [tier, setTier] = useState<Tier>('moderate');

  const result = useMemo<Ok | Err>(() => {
    const ram = Number(ramMib);
    const th = Number(threads);
    if (!Number.isFinite(ram) || ram <= 0) return { ok: false, error: 'Enter a positive RAM budget (MiB).' };
    if (!Number.isFinite(th) || th <= 0) return { ok: false, error: 'Enter a positive thread count.' };

    const spec = TIERS[tier];
    // Reserve headroom: never use more than ~75% of the stated budget for a single hash.
    const budget = Math.max(spec.minMib, Math.floor(ram * 0.75));
    if (budget < spec.minMib) {
      return {
        ok: false,
        error: `RAM budget too small for the ${tier} tier (needs ≥ ${spec.minMib} MiB usable).`,
      };
    }
    const mMib = Math.min(spec.prefMib, budget);
    const mKib = mMib * 1024;
    // Parallelism: cap to threads, but keep it sane (RFC 9106 suggests p = 1 for many servers, up to lanes).
    const p = Math.max(1, Math.min(Math.floor(th), 8));
    const phc = `$argon2id$v=19$m=${mKib},t=${spec.t},p=${p}`;
    return {
      ok: true,
      mKib,
      mMib,
      t: spec.t,
      p,
      footprintMib: mMib,
      phc,
      note: spec.note,
    };
  }, [ramMib, threads, tier]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="RAM budget (MiB)">
            <Input
              value={ramMib}
              onChange={(e) => setRamMib(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="CPU threads / lanes">
            <Input
              value={threads}
              onChange={(e) => setThreads(e.target.value)}
              inputMode="numeric"
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Security tier">
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interactive">Interactive</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="sensitive">Sensitive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Recommended Argon2id parameters">
            <CopyButton value={() => result.phc} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Memory (m)</span>
              <span className="font-mono text-sm">{result.mKib} KiB</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Iterations (t)</span>
              <span className="font-mono text-sm">{result.t}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Parallelism (p)</span>
              <span className="font-mono text-sm">{result.p}</span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                PHC parameter string
              </div>
              <code className="block break-all font-mono text-sm">{result.phc}</code>
            </div>
          </div>
          <StatBar
            items={[
              `per-hash ≈ ${result.footprintMib} MiB`,
              `peak ≈ ${result.footprintMib * result.p} MiB across ${result.p} lanes`,
              result.note,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
