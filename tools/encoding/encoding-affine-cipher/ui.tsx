'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const M = 26;
const A_UP = 65;
const A_LO = 97;

// Valid multipliers a are those coprime with 26.
const VALID_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

function gcd(x: number, y: number): number {
  let p = Math.abs(x);
  let q = Math.abs(y);
  while (q !== 0) {
    const t = q;
    q = p % q;
    p = t;
  }
  return p;
}

// Modular multiplicative inverse of a (mod m) via extended Euclidean algorithm.
function modInverse(a: number, m: number): number | null {
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1, 0];
  while (r !== 0) {
    const quotient = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1) return null;
  return ((oldS % m) + m) % m;
}

export default function AffineCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [aStr, setAStr] = useState('5');
  const [bStr, setBStr] = useState('8');
  const [preserveCase, setPreserveCase] = useState(true);
  const [passThrough, setPassThrough] = useState(true);

  const keyInfo = useMemo(() => {
    const a = Number(aStr);
    const b = Number(bStr);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      return { error: 'Keys a and b must be integers.' as const };
    }
    const aNorm = ((a % M) + M) % M;
    if (gcd(aNorm, M) !== 1) {
      return {
        error:
          `a = ${a} is not coprime with 26 (gcd must be 1). Valid a values: ${VALID_A.join(', ')}.` as const,
      };
    }
    const inv = modInverse(aNorm, M);
    if (inv === null) {
      return { error: `a = ${a} has no inverse mod 26.` as const };
    }
    const bNorm = ((b % M) + M) % M;
    return { a: aNorm, b: bNorm, inv };
  }, [aStr, bStr]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if ('error' in keyInfo) throw new Error(keyInfo.error);
      const { a, b, inv } = keyInfo;
      let out = '';
      for (const ch of input) {
        const code = ch.charCodeAt(0);
        let base = -1;
        if (code >= A_UP && code <= A_UP + 25) base = A_UP;
        else if (code >= A_LO && code <= A_LO + 25) base = A_LO;
        if (base === -1) {
          if (passThrough) out += ch;
          continue;
        }
        const x = code - base;
        const y =
          mode === 'encode'
            ? (a * x + b) % M
            : (inv * (((x - b) % M) + M)) % M;
        const outBase = preserveCase ? base : A_LO;
        out += String.fromCharCode(outBase + ((y % M) + M) % M);
      }
      return out;
    },
    [mode, keyInfo, preserveCase, passThrough],
  );

  // Build the per-letter mapping for the chosen keys (encode direction).
  const mapping = useMemo(() => {
    if ('error' in keyInfo) return null;
    const { a, b } = keyInfo;
    const rows: { plain: string; cipher: string }[] = [];
    for (let x = 0; x < M; x++) {
      const y = (a * x + b) % M;
      rows.push({
        plain: String.fromCharCode(A_UP + x),
        cipher: String.fromCharCode(A_UP + y),
      });
    }
    return rows;
  }, [keyInfo]);

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, aStr, bStr, preserveCase, passThrough]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
        outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
        sample="AFFINECIPHER"
        downloadName="affine.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="encode">Encrypt</TabsTrigger>
                  <TabsTrigger value="decode">Decrypt</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Key a (coprime with 26)">
              <Input
                value={aStr}
                onChange={(e) => setAStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Field label="Key b (0–25)">
              <Input
                value={bStr}
                onChange={(e) => setBStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Field label="Preserve case">
              <Switch checked={preserveCase} onCheckedChange={setPreserveCase} />
            </Field>
            <Field label="Pass through non-letters">
              <Switch checked={passThrough} onCheckedChange={setPassThrough} />
            </Field>
          </>
        }
      />

      {mapping && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Encryption mapping for a = {('error' in keyInfo ? '' : keyInfo.a)}, b ={' '}
            {('error' in keyInfo ? '' : keyInfo.b)} (decrypt inverse a⁻¹ ={' '}
            {('error' in keyInfo ? '' : keyInfo.inv)})
          </div>
          <div className="flex flex-wrap gap-1 text-center font-mono text-xs">
            {mapping.map((r) => (
              <div key={r.plain} className="rounded bg-background px-1.5 py-0.5">
                <span className="text-muted-foreground">{r.plain}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold">{r.cipher}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
