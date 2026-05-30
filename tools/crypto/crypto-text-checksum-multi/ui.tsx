'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type InputEnc = 'utf8' | 'hex';
type Crc16Preset = 'ccitt' | 'modbus';

const enc = new TextEncoder();

function parseHex(input: string): Uint8Array {
  const clean = input.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex input contains non-hex characters.');
  if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of digits.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// CRC-8/CCITT (poly 0x07, init 0x00).
function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] ?? 0;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc & 0xff;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection).
function crc16Ccitt(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= (bytes[i] ?? 0) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

// CRC-16/MODBUS (poly 0xA001 reflected, init 0xFFFF).
function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] ?? 0;
    for (let b = 0; b < 8; b++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

const CRC32_TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ (CRC32_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] ?? 0)) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

// BSD 16-bit checksum: rotate-right then add each byte.
function bsdSum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum >>> 1) | ((sum & 1) << 15);
    sum = (sum + (bytes[i] ?? 0)) & 0xffff;
  }
  return sum & 0xffff;
}

function xorByte(bytes: Uint8Array): number {
  let x = 0;
  for (let i = 0; i < bytes.length; i++) x ^= bytes[i] ?? 0;
  return x & 0xff;
}

function addByte(bytes: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < bytes.length; i++) s = (s + (bytes[i] ?? 0)) & 0xff;
  return s & 0xff;
}

function hexN(value: number, digits: number, upper: boolean): string {
  const h = (value >>> 0).toString(16).padStart(digits, '0');
  return upper ? h.toUpperCase() : h;
}

export default function MultiChecksumTool() {
  const [inputEnc, setInputEnc] = useState<InputEnc>('utf8');
  const [crc16Preset, setCrc16Preset] = useState<Crc16Preset>('ccitt');
  const [upper, setUpper] = useState(false);

  return (
    <TextToolLayout
      deps={[inputEnc, crc16Preset, upper]}
      transform={(input) => {
        if (!input) return '';
        const bytes = inputEnc === 'hex' ? parseHex(input) : enc.encode(input);
        const c16 = crc16Preset === 'modbus' ? crc16Modbus(bytes) : crc16Ccitt(bytes);
        const c16Label = crc16Preset === 'modbus' ? 'CRC-16/MODBUS' : 'CRC-16/CCITT';
        const rows: { label: string; value: number; digits: number }[] = [
          { label: 'CRC-8/CCITT', value: crc8(bytes), digits: 2 },
          { label: c16Label, value: c16, digits: 4 },
          { label: 'CRC-32/IEEE', value: crc32(bytes), digits: 8 },
          { label: 'Adler-32', value: adler32(bytes), digits: 8 },
          { label: 'BSD 16-bit sum', value: bsdSum(bytes), digits: 4 },
          { label: 'XOR (8-bit)', value: xorByte(bytes), digits: 2 },
          { label: 'Sum (8-bit)', value: addByte(bytes), digits: 2 },
        ];
        const labelW = Math.max(...rows.map((r) => r.label.length));
        return rows
          .map(
            (r) =>
              `${r.label.padEnd(labelW)}  0x${hexN(r.value, r.digits, upper)}  (${(r.value >>> 0).toString()})`
          )
          .join('\n');
      }}
      inputLabel={inputEnc === 'hex' ? 'Input (hex bytes)' : 'Input (UTF-8 text)'}
      outputLabel="Checksums"
      sample="123456789"
      downloadName="checksums.txt"
      options={
        <>
          <Field label="Input encoding">
            <Tabs value={inputEnc} onValueChange={(v) => setInputEnc(v as InputEnc)}>
              <TabsList>
                <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                <TabsTrigger value="hex">Hex</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="CRC-16 preset">
            <Select value={crc16Preset} onValueChange={(v) => setCrc16Preset(v as Crc16Preset)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ccitt">CCITT (0x1021)</SelectItem>
                <SelectItem value="modbus">Modbus (0xA001)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uppercase">
            <div className="flex h-8 items-center gap-2">
              <Switch id="upper" checked={upper} onCheckedChange={setUpper} />
              <Label htmlFor="upper" className="text-xs text-muted-foreground">
                Hex case
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
