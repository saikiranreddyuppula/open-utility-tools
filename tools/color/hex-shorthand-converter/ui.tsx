'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'expand' | 'minify';
type Case = 'lower' | 'upper';

const HEX_RE = /^#?[0-9a-fA-F]{3,8}$/;

function normalizeHex(raw: string): string | null {
  let h = raw.trim();
  if (!h) return null;
  if (!HEX_RE.test(h)) return null;
  if (!h.startsWith('#')) h = `#${h}`;
  const body = h.slice(1);
  if (body.length === 3 || body.length === 4 || body.length === 6 || body.length === 8) {
    return h.toLowerCase();
  }
  return null;
}

function expandHex(hex: string): string {
  const body = hex.slice(1);
  if (body.length === 3 || body.length === 4) {
    let out = '#';
    for (const ch of body) out += ch + ch;
    return out;
  }
  return hex; // already 6/8
}

function minifyHex(hex: string): string {
  const body = hex.slice(1);
  if (body.length !== 6 && body.length !== 8) return hex; // already short
  const pairs: string[] = [];
  for (let i = 0; i < body.length; i += 2) {
    const a = body[i];
    const b = body[i + 1];
    if (a === undefined || b === undefined) return hex;
    if (a !== b) return hex; // cannot minify
    pairs.push(a);
  }
  return `#${pairs.join('')}`;
}

function applyCase(hex: string, c: Case): string {
  return c === 'upper' ? hex.toUpperCase() : hex.toLowerCase();
}

export default function HexShorthandExpanderTool() {
  const [mode, setMode] = useState<Mode>('expand');
  const [letterCase, setLetterCase] = useState<Case>('lower');

  return (
    <TextToolLayout
      deps={[mode, letterCase]}
      sample={`#f0c\n#fff\n#ff8800\n#ABCDEF\n#11223344\n#f0ca`}
      inputLabel="HEX colors"
      outputLabel={mode === 'expand' ? 'Expanded' : 'Minified'}
      inputPlaceholder="One HEX per line (#rgb, #rgba, #rrggbb, #rrggbbaa)…"
      downloadName="hex-colors.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const lines = input.split('\n');
        const out: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            out.push('');
            continue;
          }
          const norm = normalizeHex(trimmed);
          if (!norm) {
            out.push(`${trimmed}  ⚠ invalid HEX`);
            continue;
          }
          const result = mode === 'expand' ? expandHex(norm) : minifyHex(norm);
          let note = '';
          if (mode === 'minify' && result.length === norm.length && norm.length > 4) {
            note = '  (no shorthand possible)';
          }
          out.push(`${applyCase(result, letterCase)}${note}`);
        }
        return out.join('\n');
      }}
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="expand">Expand</TabsTrigger>
                <TabsTrigger value="minify">Minify</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Case">
            <Select value={letterCase} onValueChange={(v) => setLetterCase(v as Case)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lower">lowercase</SelectItem>
                <SelectItem value="upper">UPPERCASE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
