'use client';

import { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 Base32 encode, no padding, uppercase. */
function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31] ?? '';
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31] ?? '';
  }
  return out;
}

type Bits = '80' | '128' | '160' | '256';
type Type = 'totp' | 'hotp';

function randomSecret(bits: number): string {
  const bytes = new Uint8Array(bits / 8);
  wc.getRandomValues(bytes);
  return base32Encode(bytes);
}

function groupSecret(s: string): string {
  return (s.match(/.{1,4}/g) ?? []).join(' ');
}

export default function OtpSecretGeneratorTool() {
  const [bits, setBits] = useState<Bits>('160');
  const [type, setType] = useState<Type>('totp');
  const [digits, setDigits] = useState('6');
  const [period, setPeriod] = useState('30');
  const [algorithm, setAlgorithm] = useState('SHA1');
  const [issuer, setIssuer] = useState('Acme Corp');
  const [account, setAccount] = useState('alice@example.com');
  const [secret, setSecret] = useState<string>(() => randomSecret(160));

  const regen = useCallback(() => {
    setSecret(randomSecret(Number(bits)));
  }, [bits]);

  const onBits = (v: Bits) => {
    setBits(v);
    setSecret(randomSecret(Number(v)));
  };

  const label = issuer.trim()
    ? `${encodeURIComponent(issuer.trim())}:${encodeURIComponent(account.trim() || 'account')}`
    : encodeURIComponent(account.trim() || 'account');

  const params: string[] = [`secret=${secret}`];
  if (issuer.trim()) params.push(`issuer=${encodeURIComponent(issuer.trim())}`);
  params.push(`algorithm=${algorithm}`);
  params.push(`digits=${Number(digits) === 8 ? 8 : 6}`);
  if (type === 'totp') {
    params.push(`period=${Number(period) > 0 ? Math.round(Number(period)) : 30}`);
  } else {
    params.push('counter=0');
  }
  const uri = `otpauth://${type}/${label}?${params.join('&')}`;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Entropy">
            <Select value={bits} onValueChange={(v) => onBits(v as Bits)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="80">80 bits</SelectItem>
                <SelectItem value="128">128 bits</SelectItem>
                <SelectItem value="160">160 bits (rec.)</SelectItem>
                <SelectItem value="256">256 bits</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as Type)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="totp">TOTP</SelectItem>
                <SelectItem value="hotp">HOTP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Digits">
            <Select value={digits} onValueChange={setDigits}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {type === 'totp' && (
            <Field label="Period (s)">
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="w-20 font-mono" inputMode="numeric" />
            </Field>
          )}
          <Field label="Algorithm">
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SHA1">SHA1</SelectItem>
                <SelectItem value="SHA256">SHA256</SelectItem>
                <SelectItem value="SHA512">SHA512</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Issuer" className="min-w-[160px]">
            <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Acme Corp" />
          </Field>
          <Field label="Account" className="min-w-[200px] flex-1">
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="user@example.com" />
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={regen}>
              <RefreshCw className="size-3.5" /> New secret
            </Button>
          </div>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Base32 secret">
          <CopyButton value={() => secret} label="Copy" />
        </PanelHeader>
        <div className="space-y-2 p-3">
          <code className="block break-all font-mono text-sm">{groupSecret(secret)}</code>
        </div>
        <StatBar items={[`${bits} bits`, `${secret.length} chars`, 'RFC 4648, no padding']} />
      </Panel>

      <Panel>
        <PanelHeader title="otpauth:// URI">
          <CopyButton value={() => uri} label="Copy" />
        </PanelHeader>
        <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed">
          {uri}
        </pre>
        <StatBar items={[type.toUpperCase(), `${Number(digits) === 8 ? 8 : 6} digits`, algorithm]} />
      </Panel>
    </div>
  );
}
