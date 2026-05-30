'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
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

type Mode = 'escape' | 'unescape';
type Dialect = 'posix-single' | 'posix-double' | 'powershell';

/** POSIX single-quote escaping: wrap in '...', replacing each ' with '\'' . */
function posixSingle(s: string): string {
  if (s === '') return "''";
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/** POSIX double-quote escaping: wrap in "...", backslash-escape $ ` \ " . */
function posixDouble(s: string): string {
  return '"' + s.replace(/[$`\\"]/g, (m) => '\\' + m) + '"';
}

/** PowerShell single-quote escaping: wrap in '...', double embedded ' . */
function powershell(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

function quoteOne(s: string, dialect: Dialect): string {
  switch (dialect) {
    case 'posix-single':
      return posixSingle(s);
    case 'posix-double':
      return posixDouble(s);
    case 'powershell':
      return powershell(s);
    default:
      return posixSingle(s);
  }
}

/** Parse a single quoted token back to its literal value. */
function dequoteOne(s: string, dialect: Dialect): string {
  const t = s.trim();
  if (dialect === 'powershell') {
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
      return t.slice(1, -1).replace(/''/g, "'");
    }
    if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
      return t.slice(1, -1).replace(/`(.)/g, '$1');
    }
    throw new Error('Expected a single- or double-quoted PowerShell token.');
  }

  // POSIX: handle a token that may concatenate single-quoted, double-quoted,
  // and unquoted backslash-escaped segments.
  let out = '';
  let i = 0;
  while (i < t.length) {
    const ch = t[i] ?? '';
    if (ch === "'") {
      const end = t.indexOf("'", i + 1);
      if (end === -1) throw new Error('Unterminated single quote.');
      out += t.slice(i + 1, end);
      i = end + 1;
    } else if (ch === '"') {
      i += 1;
      let seg = '';
      let closed = false;
      while (i < t.length) {
        const c = t[i] ?? '';
        if (c === '\\') {
          const nxt = t[i + 1] ?? '';
          if (nxt === '$' || nxt === '`' || nxt === '"' || nxt === '\\') {
            seg += nxt;
            i += 2;
            continue;
          }
          seg += c;
          i += 1;
          continue;
        }
        if (c === '"') {
          closed = true;
          i += 1;
          break;
        }
        seg += c;
        i += 1;
      }
      if (!closed) throw new Error('Unterminated double quote.');
      out += seg;
    } else if (ch === '\\') {
      const nxt = t[i + 1] ?? '';
      if (nxt === '') {
        out += '\\';
        i += 1;
      } else {
        out += nxt;
        i += 2;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

export default function ShellArgEscapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [dialect, setDialect] = useState<Dialect>('posix-single');
  const [perLine, setPerLine] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input && mode === 'escape') {
        // Even empty input has a meaningful empty-arg representation.
        return quoteOne('', dialect);
      }
      if (!input) return '';
      const fn = mode === 'escape' ? quoteOne : dequoteOne;
      if (perLine) {
        return input
          .split('\n')
          .map((line) => fn(line, dialect))
          .join('\n');
      }
      return fn(input, dialect);
    },
    [mode, dialect, perLine],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, dialect, perLine]}
      inputLabel={mode === 'escape' ? 'Raw text' : 'Quoted token'}
      outputLabel={mode === 'escape' ? 'Shell argument' : 'Literal value'}
      sample={mode === 'escape' ? `O'Brien said "hi"; rm -rf $HOME` : `'O'\\''Brien said "hi"'`}
      downloadName="shell-arg.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="escape">Quote</TabsTrigger>
                <TabsTrigger value="unescape">Unquote</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Dialect">
            <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="posix-single">POSIX sh/bash (single quotes)</SelectItem>
                <SelectItem value="posix-double">POSIX sh/bash (double quotes)</SelectItem>
                <SelectItem value="powershell">PowerShell</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Per-line (one arg per line)">
            <Switch checked={perLine} onCheckedChange={setPerLine} />
          </Field>
        </>
      }
    />
  );
}
