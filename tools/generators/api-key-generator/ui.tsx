'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type AlphabetKey = 'base62' | 'base58' | 'hex';

const ALPHABETS: Record<AlphabetKey, string> = {
  // Base58 omits 0, O, I, l to avoid visual ambiguity.
  base62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  hex: '0123456789abcdef',
};

const B62 = ALPHABETS.base62;

interface Preset {
  label: string;
  prefix: string;
  length: number;
  alphabet: AlphabetKey;
  checksum: boolean;
}

const PRESETS: Preset[] = [
  { label: 'Stripe (sk_live_)', prefix: 'sk_live_', length: 24, alphabet: 'base62', checksum: false },
  { label: 'Stripe test (sk_test_)', prefix: 'sk_test_', length: 24, alphabet: 'base62', checksum: false },
  { label: 'GitHub (ghp_)', prefix: 'ghp_', length: 36, alphabet: 'base62', checksum: false },
  { label: 'Generic (key_)', prefix: 'key_', length: 32, alphabet: 'base62', checksum: false },
  { label: 'OpenAI-style (sk-)', prefix: 'sk-', length: 48, alphabet: 'base62', checksum: false },
];

/** Unbiased index in [0, max) via rejection sampling on a uint32. */
function unbiasedIndex(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    wc.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

function randomBody(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[unbiasedIndex(alphabet.length)] ?? alphabet[0] ?? '0';
  }
  return out;
}

function crc32(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] ?? 0;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase62(n: number): string {
  if (n === 0) return '0';
  let s = '';
  let v = n;
  while (v > 0) {
    s = (B62[v % 62] ?? '0') + s;
    v = Math.floor(v / 62);
  }
  return s;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length);
  // Keep a recognizable prefix and last 4; mask the secret middle.
  const usIdx = key.lastIndexOf('_');
  const dashIdx = key.lastIndexOf('-');
  const sepIdx = Math.max(usIdx, dashIdx);
  const head = sepIdx >= 0 ? key.slice(0, sepIdx + 1) : key.slice(0, 3);
  const tail = key.slice(-4);
  const hiddenLen = Math.max(4, key.length - head.length - tail.length);
  return `${head}${'•'.repeat(Math.min(hiddenLen, 24))}${tail}`;
}

export default function ApiKeyGenerator() {
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState('sk_live_');
  const [length, setLength] = useState(24);
  const [alphabet, setAlphabet] = useState<AlphabetKey>('base62');
  const [checksum, setChecksum] = useState(false);
  const [reveal, setReveal] = useState(true);
  const [keys, setKeys] = useState<string[]>([]);

  const safeCount = Number.isFinite(count) ? Math.min(200, Math.max(1, Math.floor(count))) : 5;
  const safeLength = Number.isFinite(length) ? Math.min(64, Math.max(16, Math.floor(length))) : 24;

  const genOne = useCallback((): string => {
    const body = randomBody(ALPHABETS[alphabet], safeLength);
    if (!checksum) return prefix + body;
    const sum = toBase62(crc32(body));
    return `${prefix}${body}_${sum}`;
  }, [alphabet, safeLength, checksum, prefix]);

  const regen = useCallback(() => {
    setKeys(Array.from({ length: safeCount }, () => genOne()));
  }, [safeCount, genOne]);

  useEffect(() => {
    regen();
  }, [regen]);

  const allText = useMemo(() => keys.join('\n'), [keys]);

  const applyPreset = (p: Preset) => {
    setPrefix(p.prefix);
    setLength(p.length);
    setAlphabet(p.alphabet);
    setChecksum(p.checksum);
  };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count" hint="1-200">
          <Input
            type="number"
            min={1}
            max={200}
            value={Number.isFinite(count) ? count : 5}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.min(200, Math.max(1, Math.floor(n))) : 5);
            }}
            className="w-20 font-mono"
          />
        </Field>
        <Field label="Prefix">
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="sk_live_"
            className="w-36 font-mono"
          />
        </Field>
        <Field label="Secret length" hint="16-64">
          <Input
            type="number"
            min={16}
            max={64}
            value={Number.isFinite(length) ? length : 24}
            onChange={(e) => {
              const n = Number(e.target.value);
              setLength(Number.isFinite(n) ? Math.min(64, Math.max(16, Math.floor(n))) : 24);
            }}
            className="w-20 font-mono"
          />
        </Field>
        <Field label="Alphabet">
          <Select value={alphabet} onValueChange={(v) => setAlphabet(v as AlphabetKey)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base62">Base62</SelectItem>
              <SelectItem value="base58">Base58</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CRC32 checksum">
          <Switch checked={checksum} onCheckedChange={setChecksum} />
        </Field>
        <Field label={reveal ? 'Revealed' : 'Masked'}>
          <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {reveal ? 'Mask' : 'Reveal'}
          </Button>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p)}>
            {p.label}
          </Button>
        ))}
      </div>

      <Panel>
        <PanelHeader title="API keys">
          <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
          <DownloadButton data={() => allText} filename="api-keys.txt" disabled={!allText} />
        </PanelHeader>
        <div className="max-h-[440px] divide-y overflow-auto">
          {keys.map((k, i) => (
            <div key={`${k}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                {i + 1}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">
                {reveal ? k : maskKey(k)}
              </code>
              <CopyButton value={k} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `${keys.length} key(s)`,
            `${alphabet}`,
            `secret ${safeLength} chars`,
            checksum ? 'checksum on' : false,
          ]}
        />
      </Panel>

      <p className="px-1 text-2xs text-muted-foreground">
        Keys are generated locally with crypto.getRandomValues using unbiased sampling. The CRC32
        checksum is for typo detection, not security. Copy buttons always copy the full, unmasked key.
      </p>
    </div>
  );
}
