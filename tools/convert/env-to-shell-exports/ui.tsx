'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `# App config
export NODE_ENV=production
PORT=3000
APP_NAME="My App"
SECRET='s3cr3t$value'
DATABASE_URL=postgres://user:pass@localhost:5432/db
GREETING="Hello \\"world\\""
EMPTY=`;

type Dialect = 'bash' | 'fish' | 'powershell';

interface Pair {
  key: string;
  value: string;
}

/** Parse one .env line into key/value, honoring quotes, escapes and a leading `export`. */
function parseLine(rawLine: string): Pair | null {
  let line = rawLine.trim();
  if (line === '' || line.startsWith('#')) return null;
  if (line.startsWith('export ')) line = line.slice('export '.length).trimStart();

  const eq = line.indexOf('=');
  if (eq === -1) return null;
  const key = line.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let rest = line.slice(eq + 1);
  // Trim leading whitespace before value
  rest = rest.replace(/^[ \t]+/, '');

  const first = rest[0] ?? '';
  let value: string;
  if (first === '"') {
    // double-quoted: process escapes, stop at unescaped closing quote
    let out = '';
    let i = 1;
    while (i < rest.length) {
      const ch = rest[i] ?? '';
      if (ch === '\\') {
        const next = rest[i + 1] ?? '';
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === 'r') out += '\r';
        else out += next;
        i += 2;
        continue;
      }
      if (ch === '"') break;
      out += ch;
      i += 1;
    }
    value = out;
  } else if (first === "'") {
    // single-quoted: literal, stop at next single quote
    let out = '';
    let i = 1;
    while (i < rest.length) {
      const ch = rest[i] ?? '';
      if (ch === "'") break;
      out += ch;
      i += 1;
    }
    value = out;
  } else {
    // unquoted: take up to an inline comment ( # preceded by whitespace) and trim
    const hashMatch = rest.match(/\s+#/);
    if (hashMatch && hashMatch.index !== undefined) {
      value = rest.slice(0, hashMatch.index);
    } else {
      value = rest;
    }
    value = value.trim();
  }
  return { key, value };
}

function emitBash(p: Pair, addExport: boolean): string {
  // double-quoted; escape \ " $ ` and emit literal newlines via $'' style? keep simple: escape and keep newline literal inside quotes
  const escaped = p.value.replace(/([\\$"`])/g, '\\$1');
  const prefix = addExport ? 'export ' : '';
  return `${prefix}${p.key}="${escaped}"`;
}

function emitFish(p: Pair, addExport: boolean): string {
  // fish single-quote: escape \ and '
  const escaped = p.value.replace(/([\\'])/g, '\\$1');
  return addExport ? `set -x ${p.key} '${escaped}'` : `set ${p.key} '${escaped}'`;
}

function emitPowershell(p: Pair): string {
  // PowerShell double-quoted: escape " as `" and ` as ``  and $ as `$
  const escaped = p.value.replace(/`/g, '``').replace(/"/g, '`"').replace(/\$/g, '`$');
  return `$env:${p.key} = "${escaped}"`;
}

export default function EnvToShellExportsTool() {
  const [dialect, setDialect] = useState<Dialect>('bash');
  const [addExport, setAddExport] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = input.split(/\r?\n/);
      const out: string[] = [];
      for (const line of lines) {
        const pair = parseLine(line);
        if (!pair) continue;
        if (dialect === 'bash') out.push(emitBash(pair, addExport));
        else if (dialect === 'fish') out.push(emitFish(pair, addExport));
        else out.push(emitPowershell(pair));
      }
      if (out.length === 0) throw new Error('No valid KEY=VALUE lines found.');
      return out.join('\n') + '\n';
    },
    [dialect, addExport]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, addExport]}
      inputLabel=".env"
      outputLabel="Shell exports"
      sample={SAMPLE}
      downloadName="exports.sh"
      options={
        <>
          <Field label="Shell">
            <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bash">bash / zsh</SelectItem>
                <SelectItem value="fish">fish</SelectItem>
                <SelectItem value="powershell">PowerShell</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {dialect !== 'powershell' && (
            <Field label="Export to environment">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={addExport} onCheckedChange={setAddExport} id="env-export" />
                <Label htmlFor="env-export" className="text-xs text-muted-foreground">
                  {dialect === 'bash'
                    ? addExport
                      ? 'export KEY=…'
                      : 'KEY=…'
                    : addExport
                      ? 'set -x'
                      : 'set'}
                </Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
