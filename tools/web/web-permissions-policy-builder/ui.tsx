'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'star' | 'self' | 'none' | 'origins';

interface FeatureState {
  mode: Mode;
  origins: string;
}

const FEATURES: { key: string; label: string }[] = [
  { key: 'camera', label: 'camera' },
  { key: 'microphone', label: 'microphone' },
  { key: 'geolocation', label: 'geolocation' },
  { key: 'fullscreen', label: 'fullscreen' },
  { key: 'autoplay', label: 'autoplay' },
  { key: 'payment', label: 'payment' },
  { key: 'usb', label: 'usb' },
  { key: 'clipboard-read', label: 'clipboard-read' },
  { key: 'clipboard-write', label: 'clipboard-write' },
  { key: 'accelerometer', label: 'accelerometer' },
  { key: 'gyroscope', label: 'gyroscope' },
  { key: 'display-capture', label: 'display-capture' },
];

const DEFAULTS: Record<string, FeatureState> = (() => {
  const m: Record<string, FeatureState> = {};
  for (const f of FEATURES) m[f.key] = { mode: 'none', origins: '' };
  const cam = m['camera'];
  if (cam) cam.mode = 'self';
  const fs = m['fullscreen'];
  if (fs) fs.mode = 'self';
  const auto = m['autoplay'];
  if (auto) auto.mode = 'self';
  return m;
})();

function parseOrigins(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PermissionsPolicyBuilder() {
  const [features, setFeatures] = useState<Record<string, FeatureState>>(() =>
    structuredClone(DEFAULTS),
  );

  const setMode = (key: string, mode: Mode) =>
    setFeatures((prev) => {
      const cur = prev[key] ?? { mode: 'none', origins: '' };
      return { ...prev, [key]: { ...cur, mode } };
    });

  const setOrigins = (key: string, origins: string) =>
    setFeatures((prev) => {
      const cur = prev[key] ?? { mode: 'none', origins: '' };
      return { ...prev, [key]: { ...cur, origins } };
    });

  const result = useMemo(() => {
    const ppDirectives: string[] = [];
    const fpDirectives: string[] = [];
    const risky: string[] = [];

    for (const f of FEATURES) {
      const st = features[f.key];
      if (!st) continue;
      // Permissions-Policy structured syntax
      let ppValue: string;
      let fpValue: string;
      switch (st.mode) {
        case 'star':
          ppValue = '*';
          fpValue = '*';
          risky.push(f.key);
          break;
        case 'self':
          ppValue = '(self)';
          fpValue = "'self'";
          break;
        case 'none':
          ppValue = '()';
          fpValue = "'none'";
          break;
        case 'origins': {
          const origins = parseOrigins(st.origins);
          if (origins.length === 0) {
            ppValue = '()';
            fpValue = "'none'";
          } else {
            const ppList = origins.map((o) => `"${o}"`).join(' ');
            ppValue = `(self ${ppList})`;
            fpValue = `'self' ${origins.join(' ')}`;
          }
          break;
        }
        default:
          ppValue = '()';
          fpValue = "'none'";
          break;
      }
      ppDirectives.push(`${f.key}=${ppValue}`);
      fpDirectives.push(`${f.key} ${fpValue}`);
    }

    const permissionsPolicy = `Permissions-Policy: ${ppDirectives.join(', ')}`;
    const featurePolicy = `Feature-Policy: ${fpDirectives.join('; ')}`;

    return { permissionsPolicy, featurePolicy, risky };
  }, [features]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Features" />
        <div className="max-h-[560px] divide-y overflow-auto">
          {FEATURES.map((f) => {
            const st = features[f.key] ?? { mode: 'none' as Mode, origins: '' };
            return (
              <div key={f.key} className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-xs">{f.label}</code>
                  {st.mode === 'star' && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-2xs font-medium text-amber-700 dark:text-amber-400">
                      risky
                    </span>
                  )}
                  <Select
                    value={st.mode}
                    onValueChange={(v) => setMode(f.key, v as Mode)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">none</SelectItem>
                      <SelectItem value="self">self</SelectItem>
                      <SelectItem value="star">* (all)</SelectItem>
                      <SelectItem value="origins">origins…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {st.mode === 'origins' && (
                  <Input
                    value={st.origins}
                    onChange={(e) => setOrigins(f.key, e.target.value)}
                    placeholder="https://a.com https://b.com"
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Permissions-Policy">
            <CopyButton value={() => result.permissionsPolicy} />
          </PanelHeader>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {result.permissionsPolicy}
          </pre>
        </Panel>

        <Panel>
          <PanelHeader title="Legacy Feature-Policy">
            <CopyButton value={() => result.featurePolicy} />
          </PanelHeader>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {result.featurePolicy}
          </pre>
          <StatBar
            items={[
              `${FEATURES.length} features`,
              result.risky.length > 0
                ? `${result.risky.length} set to * (review)`
                : 'no wildcards',
            ]}
          />
        </Panel>

        {result.risky.length > 0 && (
          <Field label="Open to all origins (*)">
            <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Granting {result.risky.join(', ')} to every origin lets embedded
              iframes use these capabilities. Restrict to self or specific
              origins unless intentional.
            </p>
          </Field>
        )}
      </div>
    </div>
  );
}
