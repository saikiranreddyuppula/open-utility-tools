'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { hmacHex, type HmacAlgo } from '@/lib/wasm/core';

const ALGOS: HmacAlgo[] = ['sha1', 'sha256', 'sha384', 'sha512'];

export default function HmacGeneratorTool() {
  const [algo, setAlgo] = useState<HmacAlgo>('sha256');
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [out, setOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!message && !key) {
      setOut('');
      setError(null);
      return;
    }
    hmacHex(algo, key, message)
      .then((r) => {
        if (!cancelled) {
          setOut(r);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [algo, key, message]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Algorithm">
          <Select value={algo} onValueChange={(v) => setAlgo(v as HmacAlgo)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALGOS.map((a) => (
                <SelectItem key={a} value={a}>
                  HMAC-{a.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Secret key" className="flex-1">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="secret"
            className="font-mono"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Message" />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to authenticate…"
          spellCheck={false}
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title={`HMAC-${algo.toUpperCase()}`}>
          <CopyButton value={out} size="icon-sm" disabled={!out} />
        </PanelHeader>
        <div className="p-3">
          {error ? (
            <ErrorBanner error={error} />
          ) : (
            <code className="block break-all font-mono text-xs">
              {out || <span className="text-muted-foreground">—</span>}
            </code>
          )}
        </div>
        <StatBar items={[out && `${out.length * 4} bits · ${out.length} hex chars`]} />
      </Panel>
    </div>
  );
}
