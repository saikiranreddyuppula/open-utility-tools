'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

type Mode = 'encode' | 'decode';

// uuencode maps a 6-bit value v to the character (v + 0x20), with 0 mapped to backtick (0x60)
// instead of space in the common GNU sharutils variant. We use ` for 0 to avoid trailing-space loss.
function encChar(v: number): string {
  const six = v & 0x3f;
  return six === 0 ? '`' : String.fromCharCode(six + 0x20);
}

function decVal(ch: string): number {
  const code = ch.charCodeAt(0);
  if (ch === '`') return 0;
  return (code - 0x20) & 0x3f;
}

function uuencode(bytes: Uint8Array, mode: string, name: string): string {
  const lines: string[] = [`begin ${mode} ${name}`];
  for (let i = 0; i < bytes.length; i += 45) {
    const chunk = bytes.subarray(i, Math.min(i + 45, bytes.length));
    let line = encChar(chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const b0 = chunk[j] ?? 0;
      const b1 = chunk[j + 1] ?? 0;
      const b2 = chunk[j + 2] ?? 0;
      line += encChar(b0 >> 2);
      line += encChar(((b0 << 4) | (b1 >> 4)) & 0x3f);
      line += encChar(((b1 << 2) | (b2 >> 6)) & 0x3f);
      line += encChar(b2 & 0x3f);
    }
    lines.push(line);
  }
  lines.push('`'); // zero-length data line
  lines.push('end');
  return lines.join('\n');
}

function uudecode(text: string): Uint8Array {
  const lines = text.split(/\r?\n/);
  const out: number[] = [];
  let started = false;
  let ended = false;

  for (const rawLine of lines) {
    const line = rawLine;
    if (!started) {
      if (/^begin\s+\d{3,4}\s+\S+/.test(line.trim())) started = true;
      continue;
    }
    if (line.trim() === 'end') {
      ended = true;
      break;
    }
    if (line === '') continue;
    const firstChar = line[0];
    if (firstChar === undefined) continue;
    const count = decVal(firstChar);
    if (count === 0) continue; // terminating zero-length line

    const body = line.slice(1);
    const decoded: number[] = [];
    for (let i = 0; i < body.length; i += 4) {
      const c0 = body[i];
      const c1 = body[i + 1];
      const c2 = body[i + 2];
      const c3 = body[i + 3];
      const v0 = c0 !== undefined ? decVal(c0) : 0;
      const v1 = c1 !== undefined ? decVal(c1) : 0;
      const v2 = c2 !== undefined ? decVal(c2) : 0;
      const v3 = c3 !== undefined ? decVal(c3) : 0;
      decoded.push((v0 << 2) | (v1 >> 4));
      decoded.push(((v1 << 4) | (v2 >> 2)) & 0xff);
      decoded.push(((v2 << 6) | v3) & 0xff);
    }
    for (let k = 0; k < count; k += 1) {
      const b = decoded[k];
      if (b !== undefined) out.push(b);
    }
  }

  if (!started) throw new Error('No "begin <mode> <name>" header found.');
  if (!ended) throw new Error('Missing "end" line — input is truncated.');
  return new Uint8Array(out);
}

export default function UuencodeTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [fileMode, setFileMode] = useState('644');
  const [fileName, setFileName] = useState('file.txt');

  return (
    <TextToolLayout
      deps={[mode, fileMode, fileName]}
      transform={(input) => {
        if (!input) return '';
        if (mode === 'encode') {
          const bytes = new TextEncoder().encode(input);
          const m = /^[0-7]{3,4}$/.test(fileMode.trim()) ? fileMode.trim() : '644';
          const n = fileName.trim() || 'file.txt';
          return uuencode(bytes, m, n);
        }
        const bytes = uudecode(input);
        return new TextDecoder('utf-8').decode(bytes);
      }}
      inputLabel={mode === 'encode' ? 'Text to encode' : 'UUencoded block'}
      outputLabel={mode === 'encode' ? 'UUencoded' : 'Decoded text'}
      sample={
        mode === 'encode'
          ? 'Hello, uuencode!'
          : 'begin 644 file.txt\n02&5L;&\\L(\x275U96YC;V1E(0``\n`\nend'
      }
      downloadName={mode === 'encode' ? 'encoded.uu' : 'decoded.txt'}
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
              <Field label="File mode">
                <Input
                  value={fileMode}
                  onChange={(e) => setFileMode(e.target.value)}
                  className="w-20 font-mono"
                  placeholder="644"
                />
              </Field>
              <Field label="File name">
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-40 font-mono"
                  placeholder="file.txt"
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
