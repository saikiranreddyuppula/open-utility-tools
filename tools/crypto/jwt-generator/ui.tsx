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
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { signJwt, type HsAlg } from '@/lib/crypto/webcrypto';

const SAMPLE = '{\n  "sub": "1234567890",\n  "name": "Jane Doe",\n  "iat": 1716239022\n}';

export default function JwtGeneratorTool() {
  const [payload, setPayload] = useState(SAMPLE);
  const [secret, setSecret] = useState('your-256-bit-secret');
  const [alg, setAlg] = useState<HsAlg>('HS256');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const obj = JSON.parse(payload);
        const t = await signJwt({}, obj, secret, alg);
        if (!cancelled) {
          setToken(t);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setToken('');
          setError(e instanceof Error ? e.message : 'Invalid payload');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, secret, alg]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Algorithm">
          <Select value={alg} onValueChange={(v) => setAlg(v as HsAlg)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HS256">HS256</SelectItem>
              <SelectItem value="HS384">HS384</SelectItem>
              <SelectItem value="HS512">HS512</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Secret" className="flex-1">
          <Input value={secret} onChange={(e) => setSecret(e.target.value)} className="font-mono" />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Payload (JSON)" />
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          spellCheck={false}
          className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {error && <ErrorBanner error={error} />}

      {token && (
        <Panel>
          <PanelHeader title="Signed JWT">
            <CopyButton value={token} />
          </PanelHeader>
          <code className="block break-all p-3 font-mono text-xs">
            <span className="text-cat-crypto">{token.split('.')[0]}</span>.
            <span className="text-cat-web">{token.split('.')[1]}</span>.
            <span className="text-muted-foreground">{token.split('.')[2]}</span>
          </code>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">Signed locally with the Web Crypto API — your secret never leaves the browser.</p>
    </div>
  );
}
