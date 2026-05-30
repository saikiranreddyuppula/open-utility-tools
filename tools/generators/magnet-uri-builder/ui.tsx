'use client';

import { useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const HEX_RE = /^[0-9a-fA-F]{40}$/;
const BASE32_RE = /^[A-Z2-7]{32}$/;

/** Validate + normalize an info hash to the btih form (40-char hex lower / 32-char Base32 upper). */
function normalizeInfoHash(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: 'Enter an info hash.' };
  if (HEX_RE.test(v)) return { ok: true, value: v.toLowerCase() };
  if (BASE32_RE.test(v.toUpperCase())) return { ok: true, value: v.toUpperCase() };
  return {
    ok: false,
    error: 'Info hash must be 40 hex characters or 32 Base32 characters (A–Z, 2–7).',
  };
}

function randomHexHash(): string {
  const bytes = new Uint8Array(20);
  wc.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function MagnetUriBuilderTool() {
  const [hash, setHash] = useState(randomHexHash());
  const [name, setName] = useState('Example Release');
  const [trackers, setTrackers] = useState(
    'udp://tracker.opentrackr.org:1337/announce\nudp://open.tracker.cl:1337/announce',
  );
  const [length, setLength] = useState('');
  const [webseed, setWebseed] = useState('');

  const result = useMemo(() => {
    const norm = normalizeInfoHash(hash);
    if (!norm.ok) return { error: norm.error };

    const params: string[] = [`xt=urn:btih:${norm.value}`];

    const dn = name.trim();
    if (dn) params.push(`dn=${encodeURIComponent(dn)}`);

    const trackerList = trackers
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tr of trackerList) {
      params.push(`tr=${encodeURIComponent(tr)}`);
    }

    const xlRaw = length.trim();
    if (xlRaw) {
      const xl = Number(xlRaw);
      if (!Number.isFinite(xl) || xl < 0 || !Number.isInteger(xl)) {
        return { error: 'Exact length (xl) must be a non-negative integer (bytes).' };
      }
      params.push(`xl=${xl}`);
    }

    const ws = webseed.trim();
    if (ws) params.push(`ws=${encodeURIComponent(ws)}`);

    return {
      value: `magnet:?${params.join('&')}`,
      trackerCount: trackerList.length,
      kind: HEX_RE.test(hash.trim()) ? 'hex (v1)' : 'base32',
    };
  }, [hash, name, trackers, length, webseed]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Info hash (xt)" className="min-w-[320px] flex-1">
            <div className="flex gap-2">
              <Input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                className="font-mono"
                spellCheck={false}
                placeholder="40 hex or 32 Base32 chars"
              />
              <Button variant="secondary" size="sm" onClick={() => setHash(randomHexHash())}>
                <Shuffle className="size-3.5" /> Random
              </Button>
            </div>
          </Field>
          <Field label="Display name (dn)" className="min-w-[220px] flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
          </Field>
          <Field label="Exact length (xl, bytes)">
            <Input
              value={length}
              onChange={(e) => setLength(e.target.value)}
              inputMode="numeric"
              className="w-36 font-mono"
              placeholder="optional"
            />
          </Field>
          <Field label="Web seed (ws)" className="min-w-[220px] flex-1">
            <Input value={webseed} onChange={(e) => setWebseed(e.target.value)} placeholder="optional URL" />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Trackers (tr) — one per line" />
        <Textarea
          value={trackers}
          onChange={(e) => setTrackers(e.target.value)}
          spellCheck={false}
          className="min-h-[110px] rounded-none border-0 font-mono text-xs"
          placeholder="udp://tracker.example.org:1337/announce"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Magnet link">
            <CopyButton value={() => result.value} label="Copy" />
          </PanelHeader>
          <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed">
            {result.value}
          </pre>
          <StatBar
            items={[
              `${result.value.length} chars`,
              `${result.trackerCount} tracker(s)`,
              result.kind,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
