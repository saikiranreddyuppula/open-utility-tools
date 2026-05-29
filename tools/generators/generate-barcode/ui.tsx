'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Symbology = 'code39' | 'ean13';

// Code 39: 9 modules per char, 1 = wide, 0 = narrow. Patterns from the standard.
const CODE39: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  A: '100001001',
  B: '001001001',
  C: '101001000',
  D: '000011001',
  E: '100011000',
  F: '001011000',
  G: '000001101',
  H: '100001100',
  I: '001001100',
  J: '000011100',
  K: '100000011',
  L: '001000011',
  M: '101000010',
  N: '000010011',
  O: '100010010',
  P: '001010010',
  Q: '000000111',
  R: '100000110',
  S: '001000110',
  T: '000010110',
  U: '110000001',
  V: '011000001',
  W: '111000000',
  X: '010010001',
  Y: '110010000',
  Z: '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  $: '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100', // start/stop
};

// Build a list of bar widths (each module: wide=3, narrow=1), alternating black/white starting black.
function code39Modules(value: string, wide: number, narrow: number): number[] {
  const chars = `*${value}*`.split('');
  const bars: number[] = [];
  for (let ci = 0; ci < chars.length; ci++) {
    const ch = chars[ci] ?? '';
    const pat = CODE39[ch];
    if (!pat) {
      throw new Error(`Code 39 cannot encode the character "${ch}". Allowed: 0-9 A-Z - . space $ / + %`);
    }
    for (let i = 0; i < pat.length; i++) {
      bars.push((pat[i] ?? '0') === '1' ? wide : narrow);
    }
    // inter-character gap (narrow white)
    if (ci < chars.length - 1) bars.push(narrow);
  }
  return bars;
}

// EAN-13 encoding tables.
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
// Parity pattern for the left 6 digits, indexed by the first digit. L=0, G=1.
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function ean13CheckDigit(digits12: number[]): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits12[i] ?? 0;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// Returns the full 95-module bit string for EAN-13 plus the normalized 13-digit string.
function ean13Bits(value: string): { bits: string; digits: string } {
  const clean = value.replace(/\D/g, '');
  if (clean.length !== 12 && clean.length !== 13) {
    throw new Error('EAN-13 requires 12 digits (check digit auto-added) or a full 13-digit number.');
  }
  const nums = clean.split('').map((c) => Number(c));
  const first12 = nums.slice(0, 12);
  const check = ean13CheckDigit(first12);
  if (clean.length === 13 && (nums[12] ?? -1) !== check) {
    throw new Error(`Invalid EAN-13 check digit. Expected ${check} but got ${nums[12]}.`);
  }
  const all = [...first12, check];
  const firstDigit = all[0] ?? 0;
  const parity = EAN_PARITY[firstDigit] ?? 'LLLLLL';

  let bits = '101'; // start guard
  for (let i = 0; i < 6; i++) {
    const d = all[i + 1] ?? 0;
    const useG = (parity[i] ?? 'L') === 'G';
    bits += (useG ? EAN_G[d] : EAN_L[d]) ?? '0000000';
  }
  bits += '01010'; // center guard
  for (let i = 0; i < 6; i++) {
    const d = all[i + 7] ?? 0;
    bits += EAN_R[d] ?? '0000000';
  }
  bits += '101'; // end guard
  return { bits, digits: all.join('') };
}

type Rect = { x: number; w: number };

function buildSvg(rects: Rect[], totalWidth: number, height: number, quiet: number, label: string | null): string {
  const w = totalWidth + quiet * 2;
  const labelH = label ? 20 : 0;
  const h = height + labelH + 8;
  const bars = rects
    .map((r) => `<rect x="${(r.x + quiet).toFixed(2)}" y="4" width="${r.w.toFixed(2)}" height="${height}" fill="#000000"/>`)
    .join('');
  const text = label
    ? `<text x="${(w / 2).toFixed(2)}" y="${height + 20}" font-family="monospace" font-size="14" text-anchor="middle" fill="#000000">${label}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(
    2,
  )}"><rect width="100%" height="100%" fill="#ffffff"/>${bars}${text}</svg>`;
}

export default function BarcodeGeneratorTool() {
  const [sym, setSym] = useState<Symbology>('ean13');
  const [text, setText] = useState('5901234123457');
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(80);
  const [showText, setShowText] = useState(true);

  const result = useMemo<{ svg: string; rects: Rect[]; totalWidth: number; label: string | null } | { error: string }>(() => {
    try {
      const quiet = barWidth * 10;
      if (sym === 'code39') {
        const value = text.toUpperCase();
        if (!value.trim()) throw new Error('Enter text to encode.');
        const widths = code39Modules(value, barWidth * 3, barWidth);
        const rects: Rect[] = [];
        let x = 0;
        for (let i = 0; i < widths.length; i++) {
          const w = widths[i] ?? barWidth;
          if (i % 2 === 0) rects.push({ x, w }); // even index = black bar
          x += w;
        }
        const label = showText ? `*${value}*` : null;
        return { svg: buildSvg(rects, x, height, quiet, label), rects, totalWidth: x, label };
      }
      // EAN-13
      const { bits, digits } = ean13Bits(text);
      const rects: Rect[] = [];
      let x = 0;
      for (let i = 0; i < bits.length; i++) {
        if ((bits[i] ?? '0') === '1') rects.push({ x, w: barWidth });
        x += barWidth;
      }
      const label = showText ? digits : null;
      return { svg: buildSvg(rects, x, height, quiet, label), rects, totalWidth: x, label };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to generate barcode.' };
    }
  }, [sym, text, barWidth, height, showText]);

  const error = 'error' in result ? result.error : null;
  const svg = 'svg' in result ? result.svg : '';

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode-${sym}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    if (!('svg' in result)) return;
    const quiet = barWidth * 10;
    const w = result.totalWidth + quiet * 2;
    const labelH = result.label ? 20 : 0;
    const h = height + labelH + 8;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    for (const r of result.rects) {
      ctx.fillRect(r.x + quiet, 4, r.w, height);
    }
    if (result.label) {
      ctx.fillStyle = '#000000';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(result.label, w / 2, height + 18);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode-${sym}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Panel>
      <PanelHeader title="Barcode Generator">
        <CopyButton value={() => svg} />
      </PanelHeader>

      <OptionsBar>
        <Field label="Symbology">
          <Tabs value={sym} onValueChange={(v) => setSym(v as Symbology)}>
            <TabsList>
              <TabsTrigger value="ean13">EAN-13</TabsTrigger>
              <TabsTrigger value="code39">Code 39</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label={`Bar width: ${barWidth}px`}>
          <Slider min={1} max={6} step={1} value={[barWidth]} onValueChange={(v) => setBarWidth(v[0] ?? 2)} />
        </Field>
        <Field label={`Height: ${height}px`}>
          <Slider min={30} max={200} step={5} value={[height]} onValueChange={(v) => setHeight(v[0] ?? 80)} />
        </Field>
        <Field label="Caption">
          <Tabs value={showText ? 'on' : 'off'} onValueChange={(v) => setShowText(v === 'on')}>
            <TabsList>
              <TabsTrigger value="on">Show</TabsTrigger>
              <TabsTrigger value="off">Hide</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <Field
        label={sym === 'ean13' ? 'Number (12 or 13 digits)' : 'Text (0-9 A-Z and - . space $ / + %)'}
        hint={sym === 'ean13' ? 'The 13th check digit is computed automatically.' : 'Lowercase is converted to uppercase.'}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={sym === 'ean13' ? '590123412345' : 'HELLO-123'} />
      </Field>

      <ErrorBanner error={error} />

      {svg && !error ? (
        <div className="space-y-3">
          <div className="overflow-auto rounded-md border bg-white p-4" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={downloadSvg}>
              Download SVG
            </Button>
            <Button type="button" variant="outline" onClick={downloadPng}>
              Download PNG
            </Button>
          </div>
        </div>
      ) : null}

      <StatBar
        items={[
          `Symbology: ${sym === 'ean13' ? 'EAN-13' : 'Code 39'}`,
          'rects' in result && `Bars: ${result.rects.length}`,
          'totalWidth' in result && `Width: ${Math.round(result.totalWidth + barWidth * 20)}px`,
        ]}
      />
    </Panel>
  );
}
