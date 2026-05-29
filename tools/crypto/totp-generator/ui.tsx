'use client';

import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { hotp, base32Decode } from '@/lib/crypto/webcrypto';

type Hash = 'SHA-1' | 'SHA-256' | 'SHA-512';

export default function TotpGeneratorTool() {
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP');
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [hash, setHash] = useState<Hash>('SHA-1');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const counter = Math.floor(now / 1000 / period);
  const remaining = period - (Math.floor(now / 1000) % period);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seed = base32Decode(secret);
        const c = await hotp(seed, counter, digits, hash);
        if (!cancelled) {
          setCode(c);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCode('');
          setError(e instanceof Error ? e.message : 'Invalid secret');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secret, counter, digits, hash]);

  const pct = useMemo(() => (remaining / period) * 100, [remaining, period]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Base32 secret" className="flex-1">
          <Input value={secret} onChange={(e) => setSecret(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Digits">
          <Select value={String(digits)} onValueChange={(v) => setDigits(Number(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="7">7</SelectItem>
              <SelectItem value="8">8</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Period (s)">
          <Input
            type="number"
            value={period}
            min={10}
            max={120}
            onChange={(e) => setPeriod(Math.max(10, Number(e.target.value) || 30))}
            className="w-20 font-mono"
          />
        </Field>
        <Field label="Hash">
          <Select value={hash} onValueChange={(v) => setHash(v as Hash)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SHA-1">SHA-1</SelectItem>
              <SelectItem value="SHA-256">SHA-256</SelectItem>
              <SelectItem value="SHA-512">SHA-512</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      {error ? (
        <ErrorBanner error={error} />
      ) : (
        <Panel>
          <PanelHeader title="Current code">
            <CopyButton value={code} disabled={!code} />
          </PanelHeader>
          <div className="flex flex-col items-center gap-3 p-6">
            <span className="font-mono text-4xl font-semibold tracking-[0.3em] tabular">
              {code || '------'}
            </span>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-2xs text-muted-foreground tabular">
              refreshes in {remaining}s
            </span>
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Codes are computed locally with the Web Crypto API. Try the sample secret in any authenticator app to verify.
      </p>
    </div>
  );
}
