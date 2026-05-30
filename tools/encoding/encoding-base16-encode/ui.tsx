'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Sep = 'none' | 'space' | 'colon';

function bytesToHex(bytes: Uint8Array, lower: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    const h = b.toString(16).padStart(2, '0');
    out.push(lower ? h : h.toUpperCase());
  }
  return out;
}

export default function Base16Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [lower, setLower] = useState(false);
  const [sep, setSep] = useState<Sep>('none');
  const [perLine, setPerLine] = useState('0');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        const hexes = bytesToHex(bytes, lower);
        const joiner = sep === 'space' ? ' ' : sep === 'colon' ? ':' : '';
        const wrap = Number(perLine);
        if (Number.isFinite(wrap) && wrap > 0) {
          const lines: string[] = [];
          for (let i = 0; i < hexes.length; i += wrap) {
            lines.push(hexes.slice(i, i + wrap).join(joiner));
          }
          return lines.join('\n');
        }
        return hexes.join(joiner);
      }
      // Decode: strip all whitespace and common separators.
      const cleaned = input.replace(/[\s:_-]+/g, '');
      if (cleaned.length === 0) return '';
      if (cleaned.length % 2 !== 0) {
        throw new Error('Invalid Base16: an odd number of hex digits (each byte needs 2).');
      }
      if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
        throw new Error('Invalid Base16: input contains non-hex characters (only 0-9 A-F allowed).');
      }
      const bytes = new Uint8Array(cleaned.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        const pair = cleaned.slice(i * 2, i * 2 + 2);
        bytes[i] = parseInt(pair, 16);
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
    [mode, lower, sep, perLine],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, lower, sep, perLine]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base16 (hex)'}
      outputLabel={mode === 'encode' ? 'Base16 (hex)' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : '48656C6C6F2C20776F726C6421'}
      downloadName={mode === 'encode' ? 'encoded.hex.txt' : 'decoded.txt'}
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <>
              <Field label="Lowercase output">
                <Switch checked={lower} onCheckedChange={setLower} />
              </Field>
              <Field label="Separator">
                <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="space">Space</SelectItem>
                    <SelectItem value="colon">Colon</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bytes per line (0 = off)">
                <Input
                  value={perLine}
                  onChange={(e) => setPerLine(e.target.value)}
                  inputMode="numeric"
                  className="w-24"
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
