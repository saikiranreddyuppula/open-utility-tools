'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

type Mode = 'encode' | 'decode';
type Format = 'uu' | 'xx';

const XX_ALPHABET = '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// uuencode: 6-bit value -> char (v+0x20), 0 -> backtick to avoid trailing-space loss.
function uuEnc(v: number): string {
  const six = v & 0x3f;
  return six === 0 ? '`' : String.fromCharCode(six + 0x20);
}
function uuDec(ch: string): number {
  if (ch === '`') return 0;
  return (ch.charCodeAt(0) - 0x20) & 0x3f;
}

// xxencode: 6-bit value -> XX_ALPHABET[v].
function xxEnc(v: number): string {
  return XX_ALPHABET[v & 0x3f] ?? '+';
}
function xxDec(ch: string): number {
  const idx = XX_ALPHABET.indexOf(ch);
  return idx < 0 ? 0 : idx;
}

function encChar(format: Format, v: number): string {
  return format === 'uu' ? uuEnc(v) : xxEnc(v);
}
function decChar(format: Format, ch: string): number {
  return format === 'uu' ? uuDec(ch) : xxDec(ch);
}

function encode(bytes: Uint8Array, format: Format, mode: string, name: string): string {
  const lines: string[] = [`begin ${mode} ${name}`];
  for (let i = 0; i < bytes.length; i += 45) {
    const chunk = bytes.subarray(i, Math.min(i + 45, bytes.length));
    let line = encChar(format, chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const b0 = chunk[j] ?? 0;
      const b1 = chunk[j + 1] ?? 0;
      const b2 = chunk[j + 2] ?? 0;
      line += encChar(format, b0 >> 2);
      line += encChar(format, ((b0 << 4) | (b1 >> 4)) & 0x3f);
      line += encChar(format, ((b1 << 2) | (b2 >> 6)) & 0x3f);
      line += encChar(format, b2 & 0x3f);
    }
    lines.push(line);
  }
  lines.push(encChar(format, 0)); // zero-length terminator line
  lines.push('end');
  return lines.join('\n');
}

function decode(text: string, format: Format): Uint8Array {
  const lines = text.split(/\r?\n/);
  const out: number[] = [];
  let started = false;
  let ended = false;

  for (const line of lines) {
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
    const count = decChar(format, firstChar);
    if (count === 0) continue;

    const body = line.slice(1);
    const decoded: number[] = [];
    for (let i = 0; i < body.length; i += 4) {
      const c0 = body[i];
      const c1 = body[i + 1];
      const c2 = body[i + 2];
      const c3 = body[i + 3];
      const v0 = c0 !== undefined ? decChar(format, c0) : 0;
      const v1 = c1 !== undefined ? decChar(format, c1) : 0;
      const v2 = c2 !== undefined ? decChar(format, c2) : 0;
      const v3 = c3 !== undefined ? decChar(format, c3) : 0;
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

export default function UuencodeXxencode() {
  const [mode, setMode] = useState<Mode>('encode');
  const [format, setFormat] = useState<Format>('uu');
  const [fileMode, setFileMode] = useState('644');
  const [fileName, setFileName] = useState('file.txt');

  return (
    <TextToolLayout
      deps={[mode, format, fileMode, fileName]}
      transform={(input) => {
        if (!input) return '';
        if (mode === 'encode') {
          const bytes = new TextEncoder().encode(input);
          const m = /^[0-7]{3,4}$/.test(fileMode.trim()) ? fileMode.trim() : '644';
          const n = fileName.trim() || 'file.txt';
          return encode(bytes, format, m, n);
        }
        const bytes = decode(input, format);
        return new TextDecoder('utf-8').decode(bytes);
      }}
      inputLabel={mode === 'encode' ? 'Text to encode' : `${format === 'uu' ? 'UU' : 'XX'}encoded block`}
      outputLabel={mode === 'encode' ? `${format === 'uu' ? 'UU' : 'XX'}encoded` : 'Decoded text'}
      sample={
        mode === 'encode'
          ? 'Hello, encode!'
          : format === 'uu'
            ? 'begin 644 file.txt\n.2&5L;&\\L(&5N8V]D92$`\n`\nend'
            : 'begin 644 file.txt\nCG4JgP4wg64JiMqxYNG2+\n+\nend'
      }
      downloadName={mode === 'encode' ? `encoded.${format}` : 'decoded.txt'}
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
          <Field label="Format">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList>
                <TabsTrigger value="uu">uuencode</TabsTrigger>
                <TabsTrigger value="xx">xxencode</TabsTrigger>
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
