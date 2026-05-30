'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const SAMPLE =
  'M 10.000000 20.5000 C 30.123456 40.987654, 50.111111 60.222222, 70.333333 80.444444 ' +
  'A 25.5000 25.5000 0 0 1 100.123456 120.654321 L 0.5000000 0.2500000 Z';

const COMMANDS = new Set(['M', 'L', 'H', 'V', 'C', 'S', 'Q', 'T', 'A', 'Z']);

function roundNum(raw: string, decimals: number): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const fixed = n.toFixed(decimals);
  // Strip trailing zeros and dangling decimal point.
  let out = decimals > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
  if (out === '' || out === '-') out = '0';
  if (out === '-0') out = '0';
  // Strip a leading zero before a decimal point (0.5 -> .5) for compactness.
  out = out.replace(/^(-?)0\./, '$1.');
  return out;
}

/**
 * Tokenize an SVG path 'd' string into command letters and the numbers that follow.
 * Numbers can be separated by spaces, commas, or sign/decimal boundaries.
 */
function tokenize(d: string): Array<{ cmd: string; args: string[] }> {
  const segments: Array<{ cmd: string; args: string[] }> = [];
  // Match a command letter OR a number (including exponential, leading sign, leading dot).
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  let current: { cmd: string; args: string[] } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const letter = m[1];
    const number = m[2];
    if (letter !== undefined) {
      current = { cmd: letter, args: [] };
      segments.push(current);
    } else if (number !== undefined) {
      if (!current) {
        // Numbers before any command: treat as an implicit move-to.
        current = { cmd: 'M', args: [] };
        segments.push(current);
      }
      current.args.push(number);
    }
  }
  return segments;
}

/** Whether a number string needs a separator before it given the previous emitted token. */
function needsSeparator(prev: string, next: string): boolean {
  if (prev === '') return false;
  const lastChar = prev[prev.length - 1] ?? '';
  const firstChar = next[0] ?? '';
  // A negative sign or a leading dot can self-delimit, but only if previous didn't end with a dot.
  if (firstChar === '-') return false;
  if (firstChar === '.' && !prev.includes('.')) {
    // ".5" after an integer like "3" would read as "3.5"; need a separator.
    // Safe rule: only skip separator if previous token already contains a dot.
    return true;
  }
  if (firstChar === '.' && prev.includes('.')) return false;
  void lastChar;
  return true;
}

function emit(segments: Array<{ cmd: string; args: string[] }>, decimals: number): string {
  const parts: string[] = [];
  for (const seg of segments) {
    const upper = seg.cmd.toUpperCase();
    if (!COMMANDS.has(upper)) {
      // Unknown command letter: keep verbatim.
      parts.push(seg.cmd);
      continue;
    }
    if (upper === 'Z') {
      parts.push(seg.cmd);
      continue;
    }
    // Build the args string with minimal separators.
    let argStr = '';
    let prev = '';
    seg.args.forEach((rawArg, idx) => {
      // For arc commands, args 4 and 5 (large-arc-flag, sweep-flag) per group of 7 are booleans.
      let token: string;
      if (upper === 'A') {
        const posInGroup = idx % 7;
        if (posInGroup === 3 || posInGroup === 4) {
          // Flag: keep as 0 or 1.
          token = Number(rawArg) ? '1' : '0';
        } else {
          token = roundNum(rawArg, decimals);
        }
      } else {
        token = roundNum(rawArg, decimals);
      }
      if (idx > 0 && needsSeparator(prev, token)) {
        argStr += ' ';
      }
      argStr += token;
      prev = token;
    });
    parts.push(seg.cmd + argStr);
  }
  return parts.join(' ');
}

export default function SvgPathRounderTool() {
  const [decimals, setDecimals] = useState(2);
  const [stripLeadingZero, setStripLeadingZero] = useState(true);

  return (
    <TextToolLayout
      deps={[decimals, stripLeadingZero]}
      transform={(input) => {
        if (!input.trim()) return '';
        const segments = tokenize(input);
        if (segments.length === 0) {
          throw new Error('No path commands found. Paste the value of a path "d" attribute.');
        }
        let out = emit(segments, decimals);
        if (!stripLeadingZero) {
          // Re-add the leading zero before a bare decimal point.
          out = out.replace(/(^|[\s,])\.(\d)/g, '$10.$2').replace(/(^|[\s,])-\.(\d)/g, '$1-0.$2');
        }
        const before = input.length;
        const after = out.length;
        const saved = before - after;
        const pct = before > 0 ? ((saved / before) * 100).toFixed(1) : '0';
        return `${out}\n\n/* ${before} → ${after} chars (saved ${saved}, ${pct}%) */`;
      }}
      inputLabel="SVG path d"
      outputLabel="Rounded path"
      inputPlaceholder='Paste a path "d" string, e.g. M10.0 20.5 L30.123 40.987 Z'
      sample={SAMPLE}
      downloadName="path-rounded.txt"
      options={
        <>
          <Field
            label={`Decimal places: ${decimals}`}
            hint="0–6"
            className="min-w-[12rem] flex-1"
          >
            <Slider
              min={0}
              max={6}
              step={1}
              value={[decimals]}
              onValueChange={(v) => setDecimals(v[0] ?? 2)}
            />
          </Field>
          <Field label="Strip leading zero" hint="0.5 → .5">
            <Switch checked={stripLeadingZero} onCheckedChange={setStripLeadingZero} />
          </Field>
        </>
      }
    />
  );
}
