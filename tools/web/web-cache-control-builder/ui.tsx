'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FlagDef {
  key: FlagKey;
  directive: string;
  explain: string;
}

const FLAG_KEYS = [
  'public',
  'private',
  'noCache',
  'noStore',
  'mustRevalidate',
  'proxyRevalidate',
  'immutable',
  'noTransform',
] as const;
type FlagKey = (typeof FLAG_KEYS)[number];

const FLAGS: FlagDef[] = [
  { key: 'public', directive: 'public', explain: 'Any cache (including shared CDN/proxy caches) may store the response.' },
  { key: 'private', directive: 'private', explain: 'Only the end-user browser may cache the response, never a shared cache.' },
  { key: 'noCache', directive: 'no-cache', explain: 'Cache may store it but must revalidate with the origin before each reuse.' },
  { key: 'noStore', directive: 'no-store', explain: 'No cache may store any part of the request or response.' },
  { key: 'mustRevalidate', directive: 'must-revalidate', explain: 'Once stale, the cache must revalidate and not serve a stale copy.' },
  { key: 'proxyRevalidate', directive: 'proxy-revalidate', explain: 'Like must-revalidate but applies only to shared caches.' },
  { key: 'immutable', directive: 'immutable', explain: 'The body will never change while fresh, so the browser skips revalidation on reload.' },
  { key: 'noTransform', directive: 'no-transform', explain: 'Intermediaries must not modify the response body (e.g. recompress images).' },
];

interface DurationDef {
  key: DurationKey;
  directive: string;
  explain: (s: number) => string;
}

const DURATION_KEYS = ['maxAge', 'sMaxAge', 'swr', 'sie'] as const;
type DurationKey = (typeof DURATION_KEYS)[number];

const DURATIONS: DurationDef[] = [
  { key: 'maxAge', directive: 'max-age', explain: (s) => `Fresh for ${s} seconds in any cache (${humanize(s)}).` },
  { key: 'sMaxAge', directive: 's-maxage', explain: (s) => `Fresh for ${s} seconds in shared caches, overriding max-age there (${humanize(s)}).` },
  { key: 'swr', directive: 'stale-while-revalidate', explain: (s) => `May serve stale up to ${s} seconds while revalidating in the background (${humanize(s)}).` },
  { key: 'sie', directive: 'stale-if-error', explain: (s) => `May serve stale up to ${s} seconds if the origin errors (${humanize(s)}).` },
];

// Parse "1h", "30m", "1d2h", "604800", "1y" etc. into seconds. Empty -> null.
function parseDuration(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const re = /(\d+(?:\.\d+)?)\s*(y|w|d|h|m|s)/g;
  const units: Record<string, number> = { y: 31536000, w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const num = Number(m[1] ?? '0');
    const unit = m[2] ?? '';
    const mult = units[unit];
    if (!Number.isFinite(num) || mult === undefined) return null;
    total += num * mult;
    matched = true;
  }
  if (!matched) return null;
  return Math.round(total);
}

function humanize(secs: number): string {
  if (secs <= 0) return '0s';
  const parts: string[] = [];
  let s = secs;
  const units: Array<[string, number]> = [
    ['y', 31536000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  for (const [label, size] of units) {
    if (s >= size) {
      const v = Math.floor(s / size);
      s -= v * size;
      parts.push(`${v}${label}`);
    }
  }
  return parts.slice(0, 2).join(' ') || '0s';
}

interface Preset {
  label: string;
  flags: FlagKey[];
  durations: Partial<Record<DurationKey, string>>;
}

const PRESETS: Preset[] = [
  { label: 'Static asset (hashed)', flags: ['public', 'immutable'], durations: { maxAge: '1y' } },
  { label: 'HTML page', flags: ['public'], durations: { maxAge: '0', sMaxAge: '60', swr: '600' } },
  { label: 'API (private)', flags: ['private', 'noCache'], durations: {} },
  { label: 'No cache at all', flags: ['noStore'], durations: {} },
];

export default function CacheControlBuilderTool() {
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({
    public: true,
    private: false,
    noCache: false,
    noStore: false,
    mustRevalidate: false,
    proxyRevalidate: false,
    immutable: true,
    noTransform: false,
  });
  const [durations, setDurations] = useState<Record<DurationKey, string>>({
    maxAge: '1y',
    sMaxAge: '',
    swr: '',
    sie: '',
  });

  const applyPreset = (p: Preset) => {
    const nf: Record<FlagKey, boolean> = {
      public: false,
      private: false,
      noCache: false,
      noStore: false,
      mustRevalidate: false,
      proxyRevalidate: false,
      immutable: false,
      noTransform: false,
    };
    for (const k of p.flags) nf[k] = true;
    setFlags(nf);
    setDurations({
      maxAge: p.durations.maxAge ?? '',
      sMaxAge: p.durations.sMaxAge ?? '',
      swr: p.durations.swr ?? '',
      sie: p.durations.sie ?? '',
    });
  };

  const result = useMemo(() => {
    const tokens: string[] = [];
    const explanations: Array<{ token: string; text: string }> = [];
    const warnings: string[] = [];

    for (const f of FLAGS) {
      if (flags[f.key]) {
        tokens.push(f.directive);
        explanations.push({ token: f.directive, text: f.explain });
      }
    }
    for (const d of DURATIONS) {
      const raw = durations[d.key] ?? '';
      if (raw.trim() === '') continue;
      const secs = parseDuration(raw);
      if (secs === null) {
        warnings.push(`Could not parse "${raw}" for ${d.directive}. Use seconds or "1h", "7d", "1y".`);
        continue;
      }
      tokens.push(`${d.directive}=${secs}`);
      explanations.push({ token: `${d.directive}=${secs}`, text: d.explain(secs) });
    }

    // Conflict detection
    if (flags.noStore) {
      const extras = tokens.filter((t) => t !== 'no-store');
      if (extras.length > 0) {
        warnings.push('no-store overrides everything else — other directives are ignored. Use it alone.');
      }
    }
    if (flags.public && flags.private) {
      warnings.push('public and private are mutually exclusive; pick one.');
    }
    if (flags.noCache && tokens.some((t) => t.startsWith('max-age='))) {
      warnings.push('no-cache forces revalidation on every use, so max-age has little effect.');
    }
    if (flags.immutable && !tokens.some((t) => t.startsWith('max-age='))) {
      warnings.push('immutable only helps while the response is fresh — pair it with a long max-age.');
    }
    if (tokens.length === 0) {
      warnings.push('No directives selected — the header would be empty.');
    }

    return { header: tokens.join(', '), explanations, warnings };
  }, [flags, durations]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Presets">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </PanelHeader>
        <div className="space-y-4 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map((f) => (
              <Label
                key={f.key}
                className="flex items-start gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-sm font-normal"
              >
                <Checkbox
                  checked={flags[f.key]}
                  onCheckedChange={(c) => setFlags((prev) => ({ ...prev, [f.key]: c === true }))}
                />
                <span className="flex flex-col">
                  <code className="font-mono text-xs">{f.directive}</code>
                  <span className="text-2xs text-muted-foreground">{f.explain}</span>
                </span>
              </Label>
            ))}
          </div>
          <OptionsBar>
            {DURATIONS.map((d) => (
              <Field key={d.key} label={d.directive} className="w-40">
                <Input
                  value={durations[d.key]}
                  onChange={(e) => setDurations((prev) => ({ ...prev, [d.key]: e.target.value }))}
                  placeholder="e.g. 1h, 604800"
                  className="font-mono"
                />
              </Field>
            ))}
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Cache-Control header">
          <CopyButton value={() => `Cache-Control: ${result.header}`} label="Copy header" disabled={!result.header} />
          <CopyButton value={() => result.header} size="icon-sm" disabled={!result.header} />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-sm">
          {result.header ? `Cache-Control: ${result.header}` : '(select at least one directive)'}
        </pre>
        <StatBar items={[`${result.explanations.length} directive(s)`, `${result.header.length} chars`]} />
      </Panel>

      {result.warnings.length > 0 && (
        <Panel>
          <PanelHeader title="Warnings" />
          <ul className="space-y-1 p-3 text-xs text-amber-600 dark:text-amber-500">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </Panel>
      )}

      {result.explanations.length > 0 && (
        <Panel>
          <PanelHeader title="Plain-English explanation" />
          <div className="divide-y">
            {result.explanations.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <code className="w-56 shrink-0 font-mono text-xs">{e.token}</code>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{e.text}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
