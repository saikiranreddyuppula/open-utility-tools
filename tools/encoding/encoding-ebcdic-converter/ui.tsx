'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'to-ebcdic' | 'from-ebcdic';
type Page = 'cp037' | 'cp500' | 'cp1047';
type Radix = 'hex' | 'dec' | 'bin';

// EBCDIC byte (0..255) → Unicode/Latin-1 code point, for IBM Code Page 037.
// Undefined slots (control/unassigned) map to the same byte value (Latin-1).
const CP037: number[] = [
  0x00, 0x01, 0x02, 0x03, 0x9c, 0x09, 0x86, 0x7f, 0x97, 0x8d, 0x8e, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x10, 0x11, 0x12, 0x13, 0x9d, 0x85, 0x08, 0x87, 0x18, 0x19, 0x92, 0x8f, 0x1c, 0x1d, 0x1e, 0x1f,
  0x80, 0x81, 0x82, 0x83, 0x84, 0x0a, 0x17, 0x1b, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x05, 0x06, 0x07,
  0x90, 0x91, 0x16, 0x93, 0x94, 0x95, 0x96, 0x04, 0x98, 0x99, 0x9a, 0x9b, 0x14, 0x15, 0x9e, 0x1a,
  0x20, 0xa0, 0xe2, 0xe4, 0xe0, 0xe1, 0xe3, 0xe5, 0xe7, 0xf1, 0xa2, 0x2e, 0x3c, 0x28, 0x2b, 0x7c,
  0x26, 0xe9, 0xea, 0xeb, 0xe8, 0xed, 0xee, 0xef, 0xec, 0xdf, 0x21, 0x24, 0x2a, 0x29, 0x3b, 0xac,
  0x2d, 0x2f, 0xc2, 0xc4, 0xc0, 0xc1, 0xc3, 0xc5, 0xc7, 0xd1, 0xa6, 0x2c, 0x25, 0x5f, 0x3e, 0x3f,
  0xf8, 0xc9, 0xca, 0xcb, 0xc8, 0xcd, 0xce, 0xcf, 0xcc, 0x60, 0x3a, 0x23, 0x40, 0x27, 0x3d, 0x22,
  0xd8, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0xab, 0xbb, 0xf0, 0xfd, 0xfe, 0xb1,
  0xb0, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0xaa, 0xba, 0xe6, 0xb8, 0xc6, 0xa4,
  0xb5, 0x7e, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0xa1, 0xbf, 0xd0, 0xdd, 0xde, 0xae,
  0x5e, 0xa3, 0xa5, 0xb7, 0xa9, 0xa7, 0xb6, 0xbc, 0xbd, 0xbe, 0x5b, 0x5d, 0xaf, 0xa8, 0xb4, 0xd7,
  0x7b, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0xad, 0xf4, 0xf6, 0xf2, 0xf3, 0xf5,
  0x7d, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0xb9, 0xfb, 0xfc, 0xf9, 0xfa, 0xff,
  0x5c, 0xf7, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0xb2, 0xd4, 0xd6, 0xd2, 0xd3, 0xd5,
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0xb3, 0xdb, 0xdc, 0xd9, 0xda, 0x9f,
];

// CP500 and CP1047 share most of CP037; only a handful of byte positions differ.
// Each entry maps an EBCDIC byte index → its Unicode code point in that page.
const CP500_DIFF: Record<number, number> = {
  0x4a: 0x5b, // ¢ -> [
  0x4f: 0x21, // | -> !
  0x5a: 0x5d, // ! -> ]
  0x5f: 0x5e, // ¬ -> ^
};

const CP1047_DIFF: Record<number, number> = {
  0x4a: 0xa2, // [ -> ¢
  0x4f: 0x7c, // ! -> |
  0x5a: 0x21, // ] -> !
  0x5f: 0x5e, // ^ stays ^
  0xa1: 0x7e, // ~
  0xb0: 0xdd, // Ý
  0xba: 0x5b, // [
  0xbb: 0x5d, // ]
  0xbc: 0xac, // ¬
};

function buildTable(page: Page): number[] {
  const base = CP037.slice();
  const diff = page === 'cp500' ? CP500_DIFF : page === 'cp1047' ? CP1047_DIFF : {};
  for (const [k, v] of Object.entries(diff)) {
    const idx = Number(k);
    base[idx] = v;
  }
  return base;
}

function buildInverse(table: number[]): Map<number, number> {
  const inv = new Map<number, number>();
  for (let b = 0; b < table.length; b += 1) {
    const cp = table[b];
    if (cp !== undefined && !inv.has(cp)) inv.set(cp, b);
  }
  return inv;
}

function fmtByte(b: number, radix: Radix): string {
  if (radix === 'dec') return String(b);
  if (radix === 'bin') return b.toString(2).padStart(8, '0');
  return b.toString(16).toUpperCase().padStart(2, '0');
}

function parseBytes(input: string, radix: Radix): number[] {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  const out: number[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^0x/i, '');
    const r = radix === 'dec' ? 10 : radix === 'bin' ? 2 : 16;
    const v = Number.parseInt(clean, r);
    if (!Number.isFinite(v) || v < 0 || v > 255) {
      throw new Error(`Invalid byte value: "${tok}"`);
    }
    out.push(v);
  }
  return out;
}

function textToEbcdic(input: string, page: Page, radix: Radix): string {
  const table = buildTable(page);
  const inv = buildInverse(table);
  const bytes: string[] = [];
  const mapping: string[] = ['char  ASCII  EBCDIC'];
  let flagged = false;
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    const eb = inv.get(cp);
    if (eb === undefined) {
      flagged = true;
      mapping.push(`${ch.padEnd(4)}  ${cp.toString(16).toUpperCase().padStart(2, '0').padEnd(5)}  -- not in ${page.toUpperCase()}`);
      bytes.push('??');
      continue;
    }
    bytes.push(fmtByte(eb, radix));
    mapping.push(
      `${ch.padEnd(4)}  ${cp.toString(16).toUpperCase().padStart(2, '0').padEnd(5)}  ${fmtByte(eb, 'hex')}`,
    );
  }
  let out = bytes.join(' ');
  out += `\n\nPer-character mapping (${page.toUpperCase()}):\n${mapping.join('\n')}`;
  if (flagged) out += `\n\nNote: characters marked ?? are not representable in ${page.toUpperCase()}.`;
  return out;
}

function ebcdicToText(input: string, page: Page, radix: Radix): string {
  const table = buildTable(page);
  const bytes = parseBytes(input, radix);
  let out = '';
  for (const b of bytes) {
    out += String.fromCodePoint(table[b] ?? b);
  }
  return out;
}

export default function EbcdicConverterTool() {
  const [mode, setMode] = useState<Mode>('to-ebcdic');
  const [page, setPage] = useState<Page>('cp037');
  const [radix, setRadix] = useState<Radix>('hex');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'to-ebcdic'
        ? textToEbcdic(input, page, radix)
        : ebcdicToText(input, page, radix);
    },
    [mode, page, radix],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, page, radix]}
      inputLabel={mode === 'to-ebcdic' ? 'Text' : `EBCDIC bytes (${radix})`}
      outputLabel={mode === 'to-ebcdic' ? 'EBCDIC bytes' : 'Text'}
      inputPlaceholder={mode === 'to-ebcdic' ? 'HELLO' : 'C8 C5 D3 D3 D6'}
      sample={mode === 'to-ebcdic' ? 'Hello, World!' : 'C8 C5 D3 D3 D6'}
      downloadName="ebcdic.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="to-ebcdic">Text → EBCDIC</TabsTrigger>
                <TabsTrigger value="from-ebcdic">EBCDIC → Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Code page" className="w-40">
            <Select value={page} onValueChange={(v) => setPage(v as Page)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cp037">CP037 (US/Canada)</SelectItem>
                <SelectItem value="cp500">CP500 (Intl)</SelectItem>
                <SelectItem value="cp1047">CP1047 (Latin-1/Open)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Byte radix">
            <Tabs value={radix} onValueChange={(v) => setRadix(v as Radix)}>
              <TabsList>
                <TabsTrigger value="hex">Hex</TabsTrigger>
                <TabsTrigger value="dec">Dec</TabsTrigger>
                <TabsTrigger value="bin">Bin</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
