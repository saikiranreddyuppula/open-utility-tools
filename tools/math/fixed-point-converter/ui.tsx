'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'encode' | 'decode';

interface Row {
  label: string;
  value: string;
}

export default function FixedPointConverter() {
  const [dir, setDir] = useState<Dir>('encode');
  const [signed, setSigned] = useState(true);
  const [mStr, setMStr] = useState('1');
  const [nStr, setNStr] = useState('15');
  const [valStr, setValStr] = useState('0.75');
  const [rawStr, setRawStr] = useState('24576');

  const result = useMemo(() => {
    const m = Number(mStr);
    const n = Number(nStr);
    if (!Number.isInteger(m) || m < 0) return { error: 'Integer bits m must be a non-negative integer.' };
    if (!Number.isInteger(n) || n < 0) return { error: 'Fraction bits n must be a non-negative integer.' };
    const totalBits = m + n + (signed ? 1 : 0);
    if (totalBits < 1) return { error: 'Total bit width must be at least 1.' };
    if (totalBits > 64) return { error: 'Total bit width is capped at 64.' };

    const scale = 2n ** BigInt(n);
    const resolution = Math.pow(2, -n);

    // Representable range.
    let minRaw: bigint;
    let maxRaw: bigint;
    if (signed) {
      minRaw = -(2n ** BigInt(totalBits - 1));
      maxRaw = 2n ** BigInt(totalBits - 1) - 1n;
    } else {
      minRaw = 0n;
      maxRaw = 2n ** BigInt(totalBits) - 1n;
    }
    const minVal = Number(minRaw) / Number(scale);
    const maxVal = Number(maxRaw) / Number(scale);

    const fmtName = `${signed ? '' : 'U'}Q${m}.${n}`;

    if (dir === 'encode') {
      const value = Number(valStr);
      if (!Number.isFinite(value)) return { error: 'Enter a valid real number.' };

      // Multiply by 2^n and round to nearest.
      const scaled = value * Math.pow(2, n);
      if (!Number.isFinite(scaled)) return { error: 'Value is too large to encode in this format.' };
      const rounded = BigInt(Math.round(scaled));

      if (rounded < minRaw || rounded > maxRaw) {
        return {
          error: `Value out of ${fmtName} range [${minVal}, ${maxVal}]. Raw would be ${rounded.toString()}.`,
        };
      }

      // Two's complement bit pattern over totalBits.
      let twos = rounded;
      if (twos < 0n) twos += 2n ** BigInt(totalBits);
      const mask = (1n << BigInt(totalBits)) - 1n;
      const pattern = twos & mask;

      const hex = '0x' + pattern.toString(16).toUpperCase().padStart(Math.ceil(totalBits / 4), '0');
      const bin = pattern.toString(2).padStart(totalBits, '0');

      const actual = Number(rounded) / Number(scale);
      const err = actual - value;

      const rows: Row[] = [
        { label: 'Format', value: fmtName + ` (${totalBits} bits)` },
        { label: 'Raw integer', value: rounded.toString() },
        { label: 'Hex pattern', value: hex },
        { label: 'Binary pattern', value: bin },
        { label: 'Quantized value', value: actual.toString() },
        { label: 'Rounding error', value: err.toExponential(4) },
        { label: 'Resolution (2^-n)', value: resolution.toString() },
        { label: 'Representable range', value: `[${minVal}, ${maxVal}]` },
      ];
      return { rows, copy: rounded.toString() };
    }

    // decode
    const raw = (() => {
      const s = rawStr.trim();
      try {
        if (/^[-+]?0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
        if (/^[-+]?[0-9]+$/.test(s)) return BigInt(s);
        return null;
      } catch {
        return null;
      }
    })();
    if (raw === null) return { error: 'Enter a valid raw integer (decimal or 0x-hex).' };

    // Interpret as totalBits-wide value, applying two's complement for signed.
    const mask = (1n << BigInt(totalBits)) - 1n;
    let pattern = raw & mask;
    let signedRaw = pattern;
    if (signed && pattern >= 2n ** BigInt(totalBits - 1)) {
      signedRaw = pattern - 2n ** BigInt(totalBits);
    }
    const decoded = Number(signedRaw) / Number(scale);

    const hex = '0x' + pattern.toString(16).toUpperCase().padStart(Math.ceil(totalBits / 4), '0');
    const bin = pattern.toString(2).padStart(totalBits, '0');

    const rows: Row[] = [
      { label: 'Format', value: fmtName + ` (${totalBits} bits)` },
      { label: 'Raw integer (interpreted)', value: signedRaw.toString() },
      { label: 'Hex pattern', value: hex },
      { label: 'Binary pattern', value: bin },
      { label: 'Decoded value', value: decoded.toString() },
      { label: 'Resolution (2^-n)', value: resolution.toString() },
      { label: 'Representable range', value: `[${minVal}, ${maxVal}]` },
    ];
    return { rows, copy: decoded.toString() };
  }, [dir, signed, mStr, nStr, valStr, rawStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="encode">Real → Fixed</TabsTrigger>
                <TabsTrigger value="decode">Fixed → Real</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Integer bits m">
            <Input value={mStr} onChange={(e) => setMStr(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
          <Field label="Fraction bits n">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
          <Field label={`Signed: ${signed ? 'on' : 'off'}`}>
            <Switch checked={signed} onCheckedChange={setSigned} />
          </Field>
          {dir === 'encode' ? (
            <Field label="Real value">
              <Input value={valStr} onChange={(e) => setValStr(e.target.value)} inputMode="decimal" />
            </Field>
          ) : (
            <Field label="Raw integer">
              <Input value={rawStr} onChange={(e) => setRawStr(e.target.value)} className="font-mono" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
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
          <StatBar items={[signed ? 'signed (two’s complement)' : 'unsigned']} />
        </Panel>
      )}
    </div>
  );
}
