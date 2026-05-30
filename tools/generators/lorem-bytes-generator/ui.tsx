'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Unit = 'bytes' | 'chars' | 'kb';

const LOREM_WORDS: string[] = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
  'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip',
  'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat',
  'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim',
  'id', 'est', 'laborum',
];

const PREFIX = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ';
const encoder = new TextEncoder();

function byteLen(s: string): number {
  return encoder.encode(s).length;
}

interface Result {
  text: string;
  bytes: number;
  chars: number;
}

function buildText(
  target: number,
  unit: Unit,
  startWithLorem: boolean,
  exact: boolean,
  wrap: number,
): Result {
  const targetBytes =
    unit === 'kb' ? Math.round(target * 1024) : unit === 'bytes' ? target : -1;
  const targetChars = unit === 'chars' ? target : -1;

  // Build a deterministic word stream from the lorem pool, cycling.
  let out = startWithLorem ? PREFIX : '';
  let wi = 0;
  let sentenceWords = 0;

  const measure = (s: string): number =>
    targetChars >= 0 ? s.length : byteLen(s);
  const limit = targetChars >= 0 ? targetChars : targetBytes;

  // Append words until we reach or exceed the limit.
  while (measure(out) < limit && wi < 200000) {
    const word = LOREM_WORDS[wi % LOREM_WORDS.length] ?? 'lorem';
    wi++;
    const space = out.length > 0 ? ' ' : '';
    let chunk = space + word;
    sentenceWords++;
    // Occasional punctuation to look natural.
    if (sentenceWords >= 12) {
      chunk += '.';
      sentenceWords = 0;
    } else if (sentenceWords % 6 === 0) {
      chunk += ',';
    }
    out += chunk;
  }

  // Trim back, character by character (or byte-safe), to not exceed the limit.
  while (out.length > 0 && measure(out) > limit) {
    out = out.slice(0, -1);
  }
  // Drop a dangling separator.
  out = out.replace(/[\s,]+$/, '');
  if (!exact) out = out.replace(/[,.]?\s*$/, (m) => (m.includes('.') ? '.' : ''));

  // Optional padding to exact size with spaces.
  if (exact) {
    if (targetChars >= 0) {
      if (out.length < limit) out += ' '.repeat(limit - out.length);
    } else {
      let bl = byteLen(out);
      while (bl < limit) {
        out += ' ';
        bl++;
      }
    }
  }

  // Optional line wrapping by width (word-aware).
  if (wrap > 0) {
    const words = out.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if (line.length === 0) {
        line = w;
      } else if (line.length + 1 + w.length <= wrap) {
        line += ` ${w}`;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    out = lines.join('\n');
  }

  return { text: out, bytes: byteLen(out), chars: out.length };
}

export default function LoremBytesGeneratorTool() {
  const [amount, setAmount] = useState('256');
  const [unit, setUnit] = useState<Unit>('bytes');
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [exact, setExact] = useState(false);
  const [wrap, setWrap] = useState('0');

  const result = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return { error: 'Enter a positive target size.' };
    }
    if (unit === 'kb' && n > 1024) return { error: 'Cap KB target at 1024 (1 MB).' };
    if (unit !== 'kb' && n > 1_000_000) return { error: 'Cap target at 1,000,000.' };
    const w = Number(wrap);
    const wrapWidth = Number.isFinite(w) && w >= 20 ? Math.min(w, 200) : 0;
    return { value: buildText(Math.round(n), unit, startWithLorem, exact, wrapWidth) };
  }, [amount, unit, startWithLorem, exact, wrap]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Target size">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bytes">Bytes (UTF-8)</SelectItem>
                <SelectItem value="chars">Characters</SelectItem>
                <SelectItem value="kb">Kilobytes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Wrap width">
            <Input
              value={wrap}
              onChange={(e) => setWrap(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
              placeholder="0 = off"
            />
          </Field>
          <Field label="Start with Lorem">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={startWithLorem} onCheckedChange={setStartWithLorem} id="startlorem" />
              <Label htmlFor="startlorem" className="text-xs text-muted-foreground">Lorem ipsum…</Label>
            </div>
          </Field>
          <Field label="Pad to exact">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={exact} onCheckedChange={setExact} id="exact" />
              <Label htmlFor="exact" className="text-xs text-muted-foreground">Pad with spaces</Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Lorem Ipsum">
            <CopyButton value={() => result.value.text} label="Copy" disabled={!result.value.text} />
            <DownloadButton data={() => result.value.text} filename="lorem.txt" disabled={!result.value.text} />
          </PanelHeader>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
            {result.value.text}
          </pre>
          <StatBar
            items={[
              `${result.value.bytes.toLocaleString()} bytes`,
              `${result.value.chars.toLocaleString()} chars`,
              exact ? 'padded to exact' : 'trimmed ≤ target',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
