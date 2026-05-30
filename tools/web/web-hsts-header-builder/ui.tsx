'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Mode = 'build' | 'parse';

const ONE_YEAR = 31536000;

const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  m: 60,
  min: 60,
  h: 3600,
  hr: 3600,
  d: 86400,
  w: 604800,
  mo: 2592000, // 30 days
  y: 31536000, // 365 days
};

/** Parse a duration string like "1y", "6mo", "30d", or a bare seconds count. */
function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/.exec(s);
  if (!m) return null;
  const numStr = m[1];
  const unit = m[2];
  if (numStr === undefined || unit === undefined) return null;
  const num = Number(numStr);
  const mult = UNIT_SECONDS[unit];
  if (!Number.isFinite(num) || mult === undefined) return null;
  return Math.round(num * mult);
}

/** Render a seconds count as a friendly duration. */
function humanizeSeconds(total: number): string {
  if (total <= 0) return '0 seconds';
  const units: Array<[string, number]> = [
    ['year', 31536000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const parts: string[] = [];
  let rem = total;
  for (const [name, size] of units) {
    if (rem >= size) {
      const count = Math.floor(rem / size);
      rem -= count * size;
      parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
    }
    if (parts.length >= 2) break;
  }
  return parts.join(', ');
}

interface Eligibility {
  ok: boolean;
  reasons: string[];
}

function checkPreload(
  seconds: number,
  includeSub: boolean,
  preload: boolean,
): Eligibility {
  const reasons: string[] = [];
  if (!preload) {
    reasons.push('The `preload` directive is not present (required to submit to the list).');
  }
  if (!includeSub) {
    reasons.push('`includeSubDomains` is required for preload eligibility.');
  }
  if (seconds < ONE_YEAR) {
    reasons.push(
      `max-age must be at least ${ONE_YEAR} seconds (1 year); current value is ${seconds}.`,
    );
  }
  return { ok: reasons.length === 0, reasons };
}

export default function HstsHeaderBuilderTool() {
  const [mode, setMode] = useState<Mode>('build');

  // Build
  const [maxAgeInput, setMaxAgeInput] = useState('1y');
  const [includeSub, setIncludeSub] = useState(true);
  const [preload, setPreload] = useState(true);

  // Parse
  const [headerInput, setHeaderInput] = useState(
    'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
  );

  const built = useMemo((): { error: string } | { value: string; elig: Eligibility; seconds: number } => {
    const seconds = parseDuration(maxAgeInput);
    if (seconds === null || seconds < 0) {
      return { error: 'Enter a valid max-age (seconds or e.g. "1y", "6mo", "30d").' };
    }
    const directives = [`max-age=${seconds}`];
    if (includeSub) directives.push('includeSubDomains');
    if (preload) directives.push('preload');
    const value = directives.join('; ');
    return { value, elig: checkPreload(seconds, includeSub, preload), seconds };
  }, [maxAgeInput, includeSub, preload]);

  const parsed = useMemo((): { error: string } | {
    seconds: number;
    human: string;
    includeSub: boolean;
    preload: boolean;
    elig: Eligibility;
  } => {
    let raw = headerInput.trim();
    if (raw === '') return { error: 'Paste a Strict-Transport-Security header to parse.' };
    // Strip an optional "Header-Name:" prefix.
    const colon = raw.indexOf(':');
    if (colon !== -1 && /strict-transport-security/i.test(raw.slice(0, colon))) {
      raw = raw.slice(colon + 1).trim();
    }
    const tokens = raw
      .split(';')
      .map((t) => t.trim())
      .filter((t) => t !== '');
    let seconds: number | null = null;
    let hasSub = false;
    let hasPreload = false;
    for (const tok of tokens) {
      const lower = tok.toLowerCase();
      if (lower.startsWith('max-age')) {
        const eq = tok.indexOf('=');
        const valStr = eq === -1 ? '' : tok.slice(eq + 1).trim().replace(/^"|"$/g, '');
        const n = Number(valStr);
        if (!Number.isFinite(n)) return { error: `Invalid max-age value: "${valStr}".` };
        seconds = n;
      } else if (lower === 'includesubdomains') {
        hasSub = true;
      } else if (lower === 'preload') {
        hasPreload = true;
      }
    }
    if (seconds === null) return { error: 'Header is missing the required max-age directive.' };
    return {
      seconds,
      human: humanizeSeconds(seconds),
      includeSub: hasSub,
      preload: hasPreload,
      elig: checkPreload(seconds, hasSub, hasPreload),
    };
  }, [headerInput]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="parse">Parse</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-4">
          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader title="Directives" />
              <div className="p-3">
                <OptionsBar>
                  <Field label="max-age">
                    <Input
                      value={maxAgeInput}
                      onChange={(e) => setMaxAgeInput(e.target.value)}
                      placeholder="1y / 6mo / 31536000"
                      spellCheck={false}
                      className="w-44 font-mono"
                    />
                  </Field>
                  <div className="flex items-center gap-2 self-end pb-1">
                    <Switch id="sub" checked={includeSub} onCheckedChange={setIncludeSub} />
                    <Label htmlFor="sub" className="text-sm">includeSubDomains</Label>
                  </div>
                  <div className="flex items-center gap-2 self-end pb-1">
                    <Switch id="pre" checked={preload} onCheckedChange={setPreload} />
                    <Label htmlFor="pre" className="text-sm">preload</Label>
                  </div>
                </OptionsBar>
              </div>
            </Panel>

            {'error' in built ? (
              <ErrorBanner error={built.error} />
            ) : (
              <>
                <Panel>
                  <PanelHeader title="Header">
                    <CopyButton value={() => `Strict-Transport-Security: ${built.value}`} />
                  </PanelHeader>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
                    {`Strict-Transport-Security: ${built.value}`}
                  </pre>
                  <StatBar
                    items={[
                      `max-age = ${humanizeSeconds(built.seconds)}`,
                      includeSub ? 'subdomains: yes' : 'subdomains: no',
                    ]}
                  />
                </Panel>
                <Panel>
                  <PanelHeader title="Preload eligibility (hstspreload.org rules)" />
                  <div className="p-3 text-sm">
                    {built.elig.ok ? (
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Eligible for the HSTS preload list.
                      </p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {built.elig.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Panel>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="parse" className="mt-4">
          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader title="Header to parse" />
              <div className="p-3">
                <Input
                  value={headerInput}
                  onChange={(e) => setHeaderInput(e.target.value)}
                  spellCheck={false}
                  className="font-mono"
                  placeholder="Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
                />
              </div>
            </Panel>

            {'error' in parsed ? (
              <ErrorBanner error={parsed.error} />
            ) : (
              <Panel>
                <PanelHeader title="Parsed" />
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  {[
                    { label: 'max-age (seconds)', value: String(parsed.seconds) },
                    { label: 'max-age (human)', value: parsed.human },
                    { label: 'includeSubDomains', value: parsed.includeSub ? 'yes' : 'no' },
                    { label: 'preload', value: parsed.preload ? 'yes' : 'no' },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">{r.label}</span>
                      <span className="font-mono text-sm">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t p-3 text-sm">
                  {parsed.elig.ok ? (
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Eligible for the HSTS preload list.
                    </p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {parsed.elig.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
