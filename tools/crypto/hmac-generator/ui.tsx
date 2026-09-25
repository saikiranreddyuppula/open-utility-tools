'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
type PayloadType = 'text' | 'json';

export default function HmacGeneratorTool() {
  const [algo, setAlgo] = useState<HmacAlgo>('sha256');
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [payloadType, setPayloadType] = useState<PayloadType>('text');
  const [stringify, setStringify] = useState(true);
  const [out, setOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!message && !key) {
      setOut('');
      setError(null);
      return;
    }

    let payload = message;
    if (payloadType === 'json' && message.trim()) {
      try {
        const parsed = JSON.parse(message);
        if (stringify) payload = JSON.stringify(parsed);
      } catch (e) {
        setOut('');
        setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    hmacHex(algo, key, payload)
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
  }, [algo, key, message, payloadType, stringify]);

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
        <Field label="Payload">
          <Select value={payloadType} onValueChange={(v) => setPayloadType(v as PayloadType)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {payloadType === 'json' && (
          <Field label="Stringify">
            <div className="flex h-8 items-center gap-2">
              <Switch id="stringify" checked={stringify} onCheckedChange={setStringify} />
              <Label htmlFor="stringify" className="text-xs text-muted-foreground">
                JSON.stringify
              </Label>
            </div>
          </Field>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title={payloadType === 'json' ? 'JSON Payload' : 'Message'} />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={payloadType === 'json' ? '{"key": "value"}' : 'Message to authenticate…'}
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
