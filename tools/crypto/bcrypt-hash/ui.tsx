'use client';

import { useCallback, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { bcryptHash, bcryptVerify } from '@/lib/wasm/core';
import { cn } from '@/lib/utils';

export default function BcryptTool() {
  const [mode, setMode] = useState<'hash' | 'verify'>('hash');
  const [password, setPassword] = useState('');
  const [cost, setCost] = useState(10);
  const [hash, setHash] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doHash = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setHash(await bcryptHash(password, cost));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [password, cost]);

  const doVerify = useCallback(async () => {
    setBusy(true);
    setError(null);
    setVerifyResult(null);
    try {
      setVerifyResult(await bcryptVerify(password, verifyHash));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [password, verifyHash]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'hash' | 'verify')}>
            <TabsList>
              <TabsTrigger value="hash">Hash</TabsTrigger>
              <TabsTrigger value="verify">Verify</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'hash' && (
          <Field label={`Cost · ${cost}`} className="min-w-44">
            <Slider value={[cost]} onValueChange={([v]) => setCost(v ?? 10)} min={4} max={15} className="mt-2.5" />
          </Field>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title="Password" />
        <div className="p-3">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" placeholder="password to hash" />
        </div>
      </Panel>

      {error && <ErrorBanner error={error} />}

      {mode === 'hash' ? (
        <>
          <Button size="sm" onClick={doHash} disabled={busy || !password} className="w-fit">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Generate hash
          </Button>
          {hash && (
            <Panel>
              <PanelHeader title="Bcrypt hash">
                <CopyButton value={hash} />
              </PanelHeader>
              <code className="block break-all p-3 font-mono text-xs">{hash}</code>
            </Panel>
          )}
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Hash to verify against" />
            <div className="p-3">
              <Input value={verifyHash} onChange={(e) => setVerifyHash(e.target.value)} className="font-mono text-xs" placeholder="$2b$10$..." />
            </div>
          </Panel>
          <Button size="sm" onClick={doVerify} disabled={busy || !password || !verifyHash} className="w-fit">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Verify
          </Button>
          {verifyResult !== null && (
            <div className={cn('flex items-center gap-2 rounded-lg border p-4', verifyResult ? 'border-success/30 bg-[color-mix(in_oklch,var(--success)_10%,transparent)] text-success' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
              {verifyResult ? <Check className="size-5" /> : <X className="size-5" />}
              <span className="font-medium">{verifyResult ? 'Password matches the hash' : 'Password does NOT match'}</span>
            </div>
          )}
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">Bcrypt runs in a Web Worker (Rust/WASM) — your password never leaves the browser. Higher cost = slower = stronger.</p>
    </div>
  );
}
