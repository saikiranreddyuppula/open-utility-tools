'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const CLASSES: Record<string, string> = {
  L: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  l: 'abcdefghijklmnopqrstuvwxyz',
  d: '0123456789',
  s: '!@#$%^&*()-_=+[]{};:,.?',
  a: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  x: '0123456789abcdef',
  X: '0123456789ABCDEF',
  v: 'aeiou',
  c: 'bcdfghjklmnpqrstvwxyz',
};

const LEGEND: { token: string; desc: string }[] = [
  { token: 'L', desc: 'Uppercase letter' },
  { token: 'l', desc: 'Lowercase letter' },
  { token: 'd', desc: 'Digit 0-9' },
  { token: 's', desc: 'Symbol' },
  { token: 'a', desc: 'Alphanumeric' },
  { token: 'x', desc: 'Lowercase hex' },
  { token: 'X', desc: 'Uppercase hex' },
  { token: 'v', desc: 'Vowel' },
  { token: 'c', desc: 'Consonant' },
  { token: '[abc]', desc: 'One of a set' },
  { token: '\\x', desc: 'Literal char' },
];

/** Unbiased index in [0, n) using rejection sampling on 32-bit values. */
function randIndex(n: number): number {
  if (n <= 0) return 0;
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function pickFrom(set: string): string {
  if (!set) return '';
  return set.charAt(randIndex(set.length));
}

/** Expand a pattern into one generated string. */
function expand(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern.charAt(i);
    if (ch === '\\') {
      const next = pattern.charAt(i + 1);
      if (next) {
        out += next;
        i += 2;
        continue;
      }
      // trailing backslash: emit literally
      out += '\\';
      i += 1;
      continue;
    }
    if (ch === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end > i) {
        const set = pattern.slice(i + 1, end);
        out += set ? pickFrom(set) : '';
        i = end + 1;
        continue;
      }
      // no closing bracket: literal '['
      out += '[';
      i += 1;
      continue;
    }
    const cls = CLASSES[ch];
    if (cls) {
      out += pickFrom(cls);
      i += 1;
      continue;
    }
    // any other char is a literal
    out += ch;
    i += 1;
  }
  return out;
}

export default function PatternPasswordGeneratorTool() {
  const [pattern, setPattern] = useState('LLll-dddd-ssXX');

  const generate = useCallback(() => {
    if (!pattern) return '';
    return expand(pattern);
  }, [pattern]);

  return (
    <div className="flex flex-col gap-3">
      <GeneratorList
        generate={generate}
        deps={[pattern]}
        defaultCount={10}
        maxCount={200}
        downloadName="pattern-passwords.txt"
        label="Generated"
        options={
          <Field label="Pattern" className="min-w-[260px] flex-1">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="font-mono"
              placeholder="LLll-dddd-ssXX"
              spellCheck={false}
            />
          </Field>
        }
      />
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Token legend
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {LEGEND.map((t) => (
            <div key={t.token} className="flex items-center gap-2 text-xs">
              <code className="w-10 shrink-0 font-mono font-semibold">{t.token}</code>
              <span className="text-muted-foreground">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
