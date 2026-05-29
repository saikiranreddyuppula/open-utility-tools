'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const MAX_LINE = 76;

function hex2(byte: number): string {
  return '=' + byte.toString(16).toUpperCase().padStart(2, '0');
}

function encodeQuotedPrintable(text: string): string {
  const bytes = new TextEncoder().encode(text);
  // Build the encoded representation per byte, then wrap into 76-char lines
  // with soft line breaks. CRLF in the source becomes a hard line break.
  const lines: string[] = [];
  let line = '';

  const pushSoft = () => {
    lines.push(line + '=');
    line = '';
  };

  const append = (token: string) => {
    // A token (1 char literal or 3 char =XX) must not be split across a soft break.
    if (line.length + token.length > MAX_LINE - 1) {
      pushSoft();
    }
    line += token;
  };

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    // Handle CRLF (hard line break)
    if (b === 0x0d && bytes[i + 1] === 0x0a) {
      lines.push(line);
      line = '';
      i++;
      continue;
    }
    // Bare LF treated as hard line break too
    if (b === 0x0a) {
      lines.push(line);
      line = '';
      continue;
    }

    const isTab = b === 0x09;
    const isSpace = b === 0x20;
    const isPrintable = b >= 0x21 && b <= 0x7e && b !== 0x3d; // exclude '='

    if (isPrintable) {
      append(String.fromCharCode(b));
    } else if (isTab || isSpace) {
      // Space/tab are literal unless at end of line — handled by post-pass below.
      append(String.fromCharCode(b));
    } else {
      append(hex2(b));
    }
  }
  lines.push(line);

  // Protect trailing whitespace on each non-soft line by encoding it.
  const fixed = lines.map((ln) => {
    if (ln.endsWith('=')) return ln; // soft break line, already fine
    const m = /[ \t]+$/.exec(ln);
    if (!m) return ln;
    const head = ln.slice(0, m.index);
    const ws = m[0]
      .split('')
      .map((c) => hex2(c.charCodeAt(0)))
      .join('');
    return head + ws;
  });

  return fixed.join('\r\n');
}

function decodeQuotedPrintable(text: string): string {
  const out: number[] = [];
  // Normalise line endings, then process. Soft breaks: "=" at end of line.
  const lines = text.split(/\r\n|\n|\r/);
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li] ?? '';
    const soft = line.endsWith('=');
    if (soft) line = line.slice(0, -1);

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '=') {
        const hex = line.slice(i + 1, i + 3);
        if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
          throw new Error(`Invalid quoted-printable escape "=${hex}".`);
        }
        out.push(parseInt(hex, 16));
        i += 2;
      } else {
        out.push((c ?? '').charCodeAt(0) & 0xff);
      }
    }

    if (!soft && li < lines.length - 1) {
      out.push(0x0d, 0x0a);
    }
  }
  return new TextDecoder().decode(Uint8Array.from(out));
}

export default function QuotedPrintableTool() {
  const [mode, setMode] = useState<Mode>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode'
        ? encodeQuotedPrintable(input)
        : decodeQuotedPrintable(input);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Plain text' : 'Quoted-printable'}
      outputLabel={mode === 'encode' ? 'Quoted-printable' : 'Plain text'}
      sample={
        mode === 'encode'
          ? 'Café costs 5 € — that’s a deal!'
          : 'Caf=C3=A9 costs 5 =E2=82=AC =E2=80=94 that=E2=80=99s a deal!'
      }
      downloadName="quoted-printable.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
