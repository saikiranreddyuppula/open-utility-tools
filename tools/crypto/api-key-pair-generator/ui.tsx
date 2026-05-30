'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Encoding = 'base62' | 'base64url' | 'hex';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function randomString(len: number, enc: Encoding): string {
  if (len <= 0) return '';
  if (enc === 'hex') {
    const bytes = new Uint8Array(Math.ceil(len / 2));
    wc.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, len);
  }
  const alphabet = enc === 'base62' ? BASE62 : BASE64URL;
  const out: string[] = [];
  const bytes = new Uint8Array(len);
  wc.getRandomValues(bytes);
  for (let i = 0; i < len; i += 1) {
    const idx = (bytes[i] ?? 0) % alphabet.length;
    out.push(alphabet[idx] ?? 'A');
  }
  return out.join('');
}

/** Mod-97 checksum (ISO 7064 style) of the ASCII codepoints, 2-char zero-padded. */
function mod97(s: string): string {
  let rem = 0;
  for (let i = 0; i < s.length; i += 1) {
    rem = (rem * 10 + (s.charCodeAt(i) % 10)) % 97;
  }
  return String(rem).padStart(2, '0');
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await wc.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

interface Pair {
  keyId: string;
  secret: string;
  secretHash: string;
}

export default function ApiKeyPairTool() {
  const [idPrefix, setIdPrefix] = useState('pk_');
  const [secretPrefix, setSecretPrefix] = useState('sk_');
  const [idLen, setIdLen] = useState(16);
  const [secretLen, setSecretLen] = useState(40);
  const [enc, setEnc] = useState<Encoding>('base62');
  const [checksum, setChecksum] = useState(true);
  const [pair, setPair] = useState<Pair | null>(null);

  const generate = useCallback(async () => {
    let keyBody = randomString(idLen, enc);
    let secretBody = randomString(secretLen, enc);
    if (checksum) {
      keyBody += mod97(keyBody);
      secretBody += mod97(secretBody);
    }
    const keyId = `${idPrefix}${keyBody}`;
    const secret = `${secretPrefix}${secretBody}`;
    const secretHash = await sha256Hex(secret);
    setPair({ keyId, secret, secretHash });
  }, [idPrefix, secretPrefix, idLen, secretLen, enc, checksum]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const fields: { label: string; value: string; mono: boolean }[] = pair
    ? [
        { label: 'Public key ID', value: pair.keyId, mono: true },
        { label: 'Secret key', value: pair.secret, mono: true },
        { label: 'Secret SHA-256 (store this server-side)', value: pair.secretHash, mono: true },
      ]
    : [];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Key-ID prefix">
            <Input
              value={idPrefix}
              onChange={(e) => setIdPrefix(e.target.value)}
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Secret prefix">
            <Input
              value={secretPrefix}
              onChange={(e) => setSecretPrefix(e.target.value)}
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Encoding">
            <Select value={enc} onValueChange={(v) => setEnc(v as Encoding)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base62">Base62</SelectItem>
                <SelectItem value="base64url">Base64url</SelectItem>
                <SelectItem value="hex">Hex</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Checksum suffix" className="flex-row items-center gap-2">
            <Switch checked={checksum} onCheckedChange={setChecksum} />
          </Field>
        </OptionsBar>
        <OptionsBar className="rounded-t-none border-t-0">
          <Field label={`Key ID length: ${idLen}`} className="min-w-[220px] flex-1">
            <Slider
              value={[idLen]}
              min={8}
              max={48}
              step={1}
              onValueChange={(v) => setIdLen(v[0] ?? 16)}
            />
          </Field>
          <Field label={`Secret length: ${secretLen}`} className="min-w-[220px] flex-1">
            <Slider
              value={[secretLen]}
              min={16}
              max={96}
              step={1}
              onValueChange={(v) => setSecretLen(v[0] ?? 40)}
            />
          </Field>
          <div className="ml-auto flex items-end">
            <Button variant="secondary" size="sm" onClick={() => void generate()}>
              <RefreshCw className="size-3.5" /> Regenerate
            </Button>
          </div>
        </OptionsBar>
      </Panel>

      {pair && (
        <Panel>
          <PanelHeader title="Key pair">
            <CopyButton
              value={() =>
                `Key ID: ${pair.keyId}\nSecret: ${pair.secret}\nSecret SHA-256: ${pair.secretHash}`
              }
              label="Copy all"
            />
          </PanelHeader>
          <div className="space-y-3 p-3">
            {fields.map((f) => (
              <div key={f.label} className="rounded-md border bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </span>
                  <CopyButton value={f.value} size="icon-sm" />
                </div>
                <code className="block break-all font-mono text-xs">{f.value}</code>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Encoding: ${enc}`,
              checksum ? 'mod-97 checksum on' : 'no checksum',
              'Generated locally with crypto.getRandomValues',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
