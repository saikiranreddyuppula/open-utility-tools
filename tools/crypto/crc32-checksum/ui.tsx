'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Format = 'hex' | 'decimal';

/* ----------------------------------------------------------------------------
 * Standard CRC-32 (IEEE 802.3, reflected, poly 0xEDB88320), pure TypeScript.
 * ------------------------------------------------------------------------- */

function buildTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = buildTable();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const idx = (crc ^ (bytes[i] ?? 0)) & 0xff;
    crc = (crc >>> 8) ^ (CRC_TABLE[idx] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export default function Crc32ChecksumTool() {
  const [format, setFormat] = useState<Format>('hex');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const bytes = new TextEncoder().encode(input);
      const value = crc32(bytes);
      return format === 'hex' ? value.toString(16).padStart(8, '0') : String(value);
    },
    [format],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[format]}
      inputLabel="Text"
      outputLabel="CRC-32"
      inputPlaceholder="Type or paste text to checksum…"
      sample="The quick brown fox jumps over the lazy dog"
      downloadName="crc32.txt"
      options={
        <Field label="Output format">
          <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList>
              <TabsTrigger value="hex">Hex</TabsTrigger>
              <TabsTrigger value="decimal">Decimal</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
