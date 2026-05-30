'use client';

import { useMemo, useState } from 'react';

import { GeneratorList } from '@/components/tools/generator-list';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// Crockford Base32 without I, L, O, U (avoids look-alike characters).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Pick `n` random chars from the alphabet using rejection sampling for an unbiased draw. */
function randomChars(n: number, alphabet: string): string {
  const len = alphabet.length;
  const max = Math.floor(256 / len) * len; // largest multiple of len <= 256
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < n) {
    wc.getRandomValues(buf);
    const b = buf[0] ?? 0;
    if (b >= max) continue; // reject to avoid modulo bias
    out.push(alphabet[b % len] ?? alphabet[0] ?? '0');
  }
  return out.join('');
}

/** Standard CRC-32 over the UTF-8 bytes of a string. */
function crc32(str: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) & 0xff;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Render a number as `width` chars in the given alphabet (base = alphabet length). */
function checksumGroup(payload: string, width: number, alphabet: string): string {
  const base = alphabet.length;
  let value = crc32(payload);
  let out = '';
  for (let i = 0; i < width; i++) {
    out = (alphabet[value % base] ?? alphabet[0] ?? '0') + out;
    value = Math.floor(value / base);
  }
  return out;
}

interface BuildOpts {
  groups: number;
  charsPerGroup: number;
  separator: string;
  useChecksum: boolean;
  alphabet: string;
}

function buildKey(o: BuildOpts): string {
  const bodyGroups = o.useChecksum ? o.groups - 1 : o.groups;
  const parts: string[] = [];
  for (let i = 0; i < bodyGroups; i++) {
    parts.push(randomChars(o.charsPerGroup, o.alphabet));
  }
  if (o.useChecksum) {
    const payload = parts.join('');
    parts.push(checksumGroup(payload, o.charsPerGroup, o.alphabet));
  }
  return parts.join(o.separator);
}

interface VerifyResult {
  ok: boolean;
  message: string;
}

function verifyKey(key: string, separator: string, charsPerGroup: number, alphabet: string): VerifyResult {
  const trimmed = key.trim().toUpperCase();
  if (!trimmed) return { ok: false, message: 'Enter a key to verify.' };
  const groups = trimmed.split(separator || '-');
  if (groups.length < 2) {
    return { ok: false, message: 'Key has no separable checksum group.' };
  }
  const last = groups[groups.length - 1] ?? '';
  const body = groups.slice(0, -1).join('');
  // Validate alphabet membership across all key characters (separators already removed by split/join).
  for (const ch of groups.join('')) {
    if (!alphabet.includes(ch)) {
      return { ok: false, message: `Character "${ch}" is not in the key alphabet.` };
    }
  }
  const expected = checksumGroup(body, last.length || charsPerGroup, alphabet);
  if (expected === last) {
    return { ok: true, message: `Valid — checksum group "${last}" matches.` };
  }
  return { ok: false, message: `Invalid — expected checksum "${expected}", got "${last}".` };
}

export default function LicenseKeyGeneratorTool() {
  const [groups, setGroups] = useState(4);
  const [charsPerGroup, setCharsPerGroup] = useState(5);
  const [separator, setSeparator] = useState('-');
  const [useChecksum, setUseChecksum] = useState(true);
  const [alphabet] = useState(ALPHABET);

  const [verifyInput, setVerifyInput] = useState('');

  const gen = (): string =>
    buildKey({ groups, charsPerGroup, separator: separator || '-', useChecksum, alphabet });

  const verification = useMemo(() => {
    if (!verifyInput.trim()) return null;
    return verifyKey(verifyInput, separator || '-', charsPerGroup, alphabet);
  }, [verifyInput, separator, charsPerGroup, alphabet]);

  return (
    <div className="flex flex-col gap-4">
      <GeneratorList
        generate={gen}
        deps={[groups, charsPerGroup, separator, useChecksum, alphabet]}
        defaultCount={10}
        maxCount={200}
        downloadName="license-keys.txt"
        label="License keys"
        options={
          <>
            <Field label={`Groups: ${groups}`} className="min-w-[160px]">
              <Slider
                value={[groups]}
                min={3}
                max={6}
                step={1}
                onValueChange={(v) => setGroups(v[0] ?? 4)}
              />
            </Field>
            <Field label={`Chars / group: ${charsPerGroup}`} className="min-w-[160px]">
              <Slider
                value={[charsPerGroup]}
                min={4}
                max={6}
                step={1}
                onValueChange={(v) => setCharsPerGroup(v[0] ?? 5)}
              />
            </Field>
            <Field label="Separator">
              <Input
                value={separator}
                onChange={(e) => setSeparator(e.target.value.slice(0, 1))}
                className="w-16 text-center font-mono"
                maxLength={1}
              />
            </Field>
            <Field label="Checksum group">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={useChecksum} onCheckedChange={setUseChecksum} id="lk-cksum" />
                <Label htmlFor="lk-cksum" className="text-xs text-muted-foreground">
                  {useChecksum ? 'last group = CRC32' : 'off'}
                </Label>
              </div>
            </Field>
          </>
        }
      />

      {useChecksum && (
        <Panel>
          <PanelHeader title="Verify a key" />
          <div className="space-y-3 p-3">
            <Input
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder={`Paste a generated key (e.g. ABCDE${separator || '-'}FGHJK${separator || '-'}…)`}
              className="font-mono uppercase"
            />
            {verification && (
              <div className="flex items-center gap-2">
                <Badge variant={verification.ok ? 'success' : 'destructive'}>
                  {verification.ok ? 'VALID' : 'INVALID'}
                </Badge>
                <span className="text-sm text-muted-foreground">{verification.message}</span>
              </div>
            )}
            <p className="text-2xs text-muted-foreground">
              The checksum group is the CRC-32 of the preceding characters, rendered in the same
              alphabet. Verification recomputes it from the body groups.
            </p>
          </div>
          <StatBar
            items={[
              `alphabet: ${alphabet.length} chars (Crockford, no I/L/O/U)`,
              useChecksum ? '1 checksum group' : 'no checksum',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
