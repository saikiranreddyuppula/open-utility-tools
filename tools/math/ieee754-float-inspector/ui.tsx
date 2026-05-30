'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Prec = 'single' | 'double';
type Dir = 'decode' | 'fromHex';

interface Decoded {
  bits: string; // full bit string
  signBit: string;
  expBits: string;
  mantBits: string;
  hex: string;
  signValue: number;
  rawExp: number;
  unbiasedExp: number | string;
  storedValue: number;
  label: string;
  scientific: string;
  ulp: string;
}

function decodeSingle(value: number): Decoded {
  const buf = new ArrayBuffer(4);
  const dv = new DataView(buf);
  dv.setFloat32(0, value, false);
  const word = dv.getUint32(0, false) >>> 0;
  return decodeWord(BigInt(word), 32, 8, 23, 127, dv.getFloat32(0, false));
}

function decodeDouble(value: number): Decoded {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, value, false);
  const hi = BigInt(dv.getUint32(0, false) >>> 0);
  const lo = BigInt(dv.getUint32(4, false) >>> 0);
  const word = (hi << 32n) | lo;
  return decodeWord(word, 64, 11, 52, 1023, dv.getFloat64(0, false));
}

function decodeWord(
  word: bigint,
  totalBits: number,
  expBitsN: number,
  mantBitsN: number,
  bias: number,
  storedValue: number,
): Decoded {
  const bits = word.toString(2).padStart(totalBits, '0');
  const signBit = bits.slice(0, 1);
  const expBits = bits.slice(1, 1 + expBitsN);
  const mantBits = bits.slice(1 + expBitsN);
  const rawExp = parseInt(expBits, 2);
  const mantValue = mantBits === '' ? 0n : BigInt('0b' + mantBits);
  const hexLen = totalBits / 4;
  const hex = '0x' + word.toString(16).toUpperCase().padStart(hexLen, '0');
  const signValue = signBit === '1' ? -1 : 1;

  const maxExp = (1 << expBitsN) - 1;
  let label = 'normal';
  let unbiasedExp: number | string = rawExp - bias;
  let scientific = '';
  let ulp = '';

  if (rawExp === maxExp) {
    if (mantValue === 0n) {
      label = signBit === '1' ? '-Infinity' : '+Infinity';
    } else {
      label = 'NaN';
    }
    unbiasedExp = '—';
    scientific = label;
    ulp = '—';
  } else if (rawExp === 0) {
    if (mantValue === 0n) {
      label = signBit === '1' ? '-0' : '+0';
      unbiasedExp = `${1 - bias} (denormal min exp)`;
      scientific = label;
    } else {
      label = 'subnormal';
      unbiasedExp = 1 - bias;
      scientific = `${signValue < 0 ? '-' : ''}0.${mantBits} × 2^${1 - bias}`;
      ulp = Math.pow(2, 1 - bias - mantBitsN).toExponential(4);
    }
  } else {
    scientific = `${signValue < 0 ? '-' : ''}1.${mantBits} × 2^${rawExp - bias}`;
    ulp = Math.pow(2, rawExp - bias - mantBitsN).toExponential(4);
  }

  return {
    bits,
    signBit,
    expBits,
    mantBits,
    hex,
    signValue,
    rawExp,
    unbiasedExp,
    storedValue,
    label,
    scientific,
    ulp,
  };
}

function fromHexSingle(hex: bigint): Decoded {
  const word = hex & 0xffffffffn;
  const buf = new ArrayBuffer(4);
  const dv = new DataView(buf);
  dv.setUint32(0, Number(word), false);
  return decodeWord(word, 32, 8, 23, 127, dv.getFloat32(0, false));
}

function fromHexDouble(hex: bigint): Decoded {
  const word = hex & ((1n << 64n) - 1n);
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, Number(word >> 32n), false);
  dv.setUint32(4, Number(word & 0xffffffffn), false);
  return decodeWord(word, 64, 11, 52, 1023, dv.getFloat64(0, false));
}

export default function Ieee754FloatInspector() {
  const [prec, setPrec] = useState<Prec>('double');
  const [dir, setDir] = useState<Dir>('decode');
  const [numStr, setNumStr] = useState('3.14159265358979');
  const [hexStr, setHexStr] = useState('0x400921FB54442D18');

  const result = useMemo(() => {
    let d: Decoded;
    let inputValue: number | null = null;
    if (dir === 'decode') {
      inputValue = Number(numStr);
      if (numStr.trim() === '' || (Number.isNaN(inputValue) && numStr.trim().toLowerCase() !== 'nan')) {
        return { error: 'Enter a valid decimal number (or "NaN", "Infinity", "-Infinity").' };
      }
      d = prec === 'single' ? decodeSingle(inputValue) : decodeDouble(inputValue);
    } else {
      const s = hexStr.trim().replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]+$/.test(s)) return { error: 'Enter a valid hex word.' };
      const hex = BigInt('0x' + s);
      d = prec === 'single' ? fromHexSingle(hex) : fromHexDouble(hex);
    }

    const err =
      inputValue !== null && Number.isFinite(inputValue)
        ? (d.storedValue - inputValue).toExponential(4)
        : '—';

    const rows = [
      { label: 'Special / class', value: d.label },
      { label: 'Hex word', value: d.hex },
      { label: 'Sign bit', value: `${d.signBit} (${d.signValue < 0 ? 'negative' : 'positive'})` },
      { label: 'Exponent field', value: `${d.expBits} = ${d.rawExp}` },
      { label: 'Unbiased exponent', value: d.unbiasedExp.toString() },
      { label: 'Mantissa field', value: d.mantBits },
      { label: 'Stored value', value: d.storedValue.toString() },
      { label: 'Normalized form', value: d.scientific },
      { label: 'ULP', value: d.ulp },
      { label: 'Rounding error vs input', value: err },
    ];
    return { d, rows, copy: d.hex };
  }, [prec, dir, numStr, hexStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Precision">
            <Tabs value={prec} onValueChange={(v) => setPrec(v as Prec)}>
              <TabsList>
                <TabsTrigger value="single">binary32</TabsTrigger>
                <TabsTrigger value="double">binary64</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="decode">Number → bits</TabsTrigger>
                <TabsTrigger value="fromHex">Hex → number</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'decode' ? (
            <Field label="Decimal value">
              <Input value={numStr} onChange={(e) => setNumStr(e.target.value)} className="font-mono w-56" />
            </Field>
          ) : (
            <Field label="Hex word">
              <Input value={hexStr} onChange={(e) => setHexStr(e.target.value)} className="font-mono w-56" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Decomposition">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="border-b p-3">
            <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Bit pattern (sign | exponent | mantissa)
            </p>
            <code className="block break-all font-mono text-sm leading-relaxed">
              <span className="rounded bg-rose-500/20 px-0.5">{result.d.signBit}</span>{' '}
              <span className="rounded bg-amber-500/20 px-0.5">{result.d.expBits}</span>{' '}
              <span className="rounded bg-sky-500/20 px-0.5">{result.d.mantBits}</span>
            </code>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[prec === 'single' ? '32-bit, bias 127' : '64-bit, bias 1023']} />
        </Panel>
      )}
    </div>
  );
}
