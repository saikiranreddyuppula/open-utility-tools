'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'name-to-number' | 'number-to-name';

interface GroupInfo {
  index: number;
  name: string | null;
  position: number;
}

interface ParseResult {
  groups: GroupInfo[];
  // Maps original group name -> 1-based index (for name->number conversion).
  nameToIndex: Map<string, number>;
}

const SAMPLE = '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})';

/**
 * Walk the pattern with bracket-depth awareness, recording each capturing
 * group (numbered or named) in left-to-right open-paren order. Non-capturing
 * groups (?:...) and lookarounds (?= ?! ?<= ?<!) are skipped. Character classes
 * [...] and escaped parens are ignored so their contents never count.
 */
function parseGroups(pattern: string): ParseResult {
  const groups: GroupInfo[] = [];
  const nameToIndex = new Map<string, number>();
  let i = 0;
  let inClass = false;
  let index = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i];
    if (ch === '\\') {
      i += 2; // skip escaped char
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      i += 1;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      i += 1;
      continue;
    }
    if (ch === '(') {
      const next = pattern[i + 1];
      if (next === '?') {
        // (?:  (?=  (?!  (?<=  (?<!  -> non-capturing / lookaround
        const after = pattern[i + 2];
        if (after === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
          // named group (?<name>...)
          const close = pattern.indexOf('>', i + 3);
          const name = close > -1 ? pattern.slice(i + 3, close) : '';
          index += 1;
          groups.push({ index, name, position: i });
          if (name) nameToIndex.set(name, index);
          i = close > -1 ? close + 1 : i + 3;
          continue;
        }
        // skip the (?... prefix; it is non-capturing
        i += 1;
        continue;
      }
      // plain capturing group
      index += 1;
      groups.push({ index, name: null, position: i });
      i += 1;
      continue;
    }
    i += 1;
  }

  return { groups, nameToIndex };
}

function convertPattern(pattern: string, mode: Mode): string {
  // We rebuild by re-walking; replace named/plain open parens as needed.
  let out = '';
  let i = 0;
  let inClass = false;
  let index = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i] ?? '';
    if (ch === '\\') {
      out += ch + (pattern[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '(') {
      const next = pattern[i + 1];
      if (next === '?') {
        const after = pattern[i + 2];
        if (after === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
          const close = pattern.indexOf('>', i + 3);
          index += 1;
          if (mode === 'name-to-number') {
            out += '(';
            i = close > -1 ? close + 1 : i + 3;
          } else {
            // already named; keep as is
            out += close > -1 ? pattern.slice(i, close + 1) : '(';
            i = close > -1 ? close + 1 : i + 3;
          }
          continue;
        }
        out += ch;
        i += 1;
        continue;
      }
      // plain capturing group
      index += 1;
      if (mode === 'number-to-name') {
        out += `(?<g${index}>`;
      } else {
        out += '(';
      }
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function convertReplacement(repl: string, mode: Mode, parsed: ParseResult): string {
  if (mode === 'name-to-number') {
    // \k<name> -> \N  and  $<name> -> $N
    return repl
      .replace(/\\k<([^>]+)>/g, (_m, name: string) => {
        const idx = parsed.nameToIndex.get(name);
        return idx !== undefined ? `\\${idx}` : `\\k<${name}>`;
      })
      .replace(/\$<([^>]+)>/g, (_m, name: string) => {
        const idx = parsed.nameToIndex.get(name);
        return idx !== undefined ? `$${idx}` : `$<${name}>`;
      });
  }
  // number-to-name: \N -> \k<gN>, $N -> $<gN> (skip $0 / $& / $$)
  return repl
    .replace(/\\(\d+)/g, (_m, num: string) => `\\k<g${num}>`)
    .replace(/\$(\d+)/g, (_m, num: string) =>
      num === '0' ? '$0' : `$<g${num}>`,
    );
}

export default function RegexNamedGroupConverterTool() {
  const [mode, setMode] = useState<Mode>('name-to-number');
  const [replacement, setReplacement] = useState('$<year>/$<month>');

  const transform = useMemo(
    () => (input: string) => {
      const pattern = input.trim();
      if (!pattern) return '';

      const parsed = parseGroups(pattern);
      const newPattern = convertPattern(pattern, mode);

      const lines: string[] = [];
      lines.push('Pattern:');
      lines.push(newPattern);

      if (replacement.trim()) {
        lines.push('');
        lines.push('Replacement:');
        lines.push(convertReplacement(replacement, mode, parsed));
      }

      if (parsed.groups.length > 0) {
        lines.push('');
        lines.push('--- Groups (index · name · position) ---');
        for (const g of parsed.groups) {
          const newName =
            mode === 'number-to-name' && g.name === null
              ? `g${g.index}`
              : (g.name ?? '(numbered)');
          lines.push(`${g.index}\t${newName}\tcol ${g.position + 1}`);
        }
      } else {
        lines.push('');
        lines.push('(no capturing groups found)');
      }

      return lines.join('\n');
    },
    [mode, replacement],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Direction">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="name-to-number">Named → Numbered</TabsTrigger>
            <TabsTrigger value="number-to-name">Numbered → Named</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>
      <Field label="Replacement (optional)" className="min-w-[240px] flex-1">
        <Input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="e.g. $<year>/$<month> or $1/$2"
          className="font-mono"
          spellCheck={false}
        />
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, replacement]}
      inputLabel="Regex pattern"
      outputLabel="Converted"
      inputPlaceholder="Paste a regex pattern…"
      sample={SAMPLE}
      downloadName="regex-groups.txt"
      options={options}
    />
  );
}
