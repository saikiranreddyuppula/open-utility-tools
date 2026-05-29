'use client';

import { useEffect, useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { hashHex, type HashAlgo } from '@/lib/wasm/core';

const ALGOS: { id: HashAlgo; label: string }[] = [
  { id: 'md5', label: 'MD5' },
  { id: 'sha1', label: 'SHA-1' },
  { id: 'sha256', label: 'SHA-256' },
  { id: 'sha384', label: 'SHA-384' },
  { id: 'sha512', label: 'SHA-512' },
  { id: 'sha3-256', label: 'SHA3-256' },
  { id: 'sha3-512', label: 'SHA3-512' },
  { id: 'blake3', label: 'BLAKE3' },
  { id: 'crc32', label: 'CRC32' },
];

const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const enc = new TextEncoder();

export default function HashTextTool() {
  const [input, setInput] = useState('');
  const [upper, setUpper] = useState(false);
  const [digests, setDigests] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ALGOS.map(async ({ id }) => {
          try {
            const hex = await hashHex(id, input);
            return [id, hex] as const;
          } catch {
            return [id, ''] as const;
          }
        })
      );
      if (!cancelled) setDigests(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [input]);

  const fmt = (s: string) => (upper ? s.toUpperCase() : s);
  const bytes = useMemo(() => enc.encode(input).length, [input]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Uppercase">
          <div className="flex h-8 items-center gap-2">
            <Switch id="upper" checked={upper} onCheckedChange={setUpper} />
            <Label htmlFor="upper" className="text-xs text-muted-foreground">
              Hex case
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput(SAMPLE)}
          >
            Sample
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste text to hash…"
          spellCheck={false}
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${input.length.toLocaleString()} chars · ${bytes.toLocaleString()} bytes`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Digests" />
        <div className="divide-y">
          {ALGOS.map(({ id, label }) => {
            const value = digests[id] ?? '';
            return (
              <div key={id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-20 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                  {label}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {value || <span className="text-muted-foreground">—</span>}
                </code>
                <CopyButton value={fmt(value)} size="icon-sm" disabled={!value} />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
