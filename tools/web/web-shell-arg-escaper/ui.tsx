'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Shell = 'posix' | 'powershell' | 'cmd';

const SAMPLE = `it's a "test" file & more`;

function escapePosix(arg: string): string {
  // Wrap in single quotes; close-quote, escaped-quote, reopen for each '.
  if (arg === '') return "''";
  // Safe unquoted set: keep simple tokens unquoted for readability.
  if (/^[A-Za-z0-9_\-./:=@%+]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function escapePowerShell(arg: string): string {
  // Single-quote wrap; double internal single quotes (literal string).
  return `'${arg.replace(/'/g, "''")}'`;
}

function escapeCmd(arg: string): string {
  // cmd.exe: wrap in double quotes, escape internal " as "" and caret-escape
  // metacharacters that survive quoting in some contexts.
  if (arg === '') return '""';
  const inner = arg.replace(/"/g, '""');
  const needsQuote = /[\s&|<>^()"]/.test(arg);
  const wrapped = needsQuote ? `"${inner}"` : inner;
  return wrapped;
}

function escapeArg(arg: string, shell: Shell): string {
  switch (shell) {
    case 'posix':
      return escapePosix(arg);
    case 'powershell':
      return escapePowerShell(arg);
    case 'cmd':
      return escapeCmd(arg);
    default:
      return arg;
  }
}

export default function ShellArgEscaperTool() {
  const [shell, setShell] = useState<Shell>('posix');
  const [perToken, setPerToken] = useState(false);

  const transform = useMemo(
    () => (input: string) => {
      if (input === '') return '';
      if (perToken) {
        const tokens = input.split(/\s+/).filter((t) => t !== '');
        return tokens.map((t) => escapeArg(t, shell)).join(' ');
      }
      // Treat the entire input (including any newlines) as one literal arg.
      return escapeArg(input, shell);
    },
    [shell, perToken],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Target shell" className="min-w-[200px]">
        <Select value={shell} onValueChange={(v) => setShell(v as Shell)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="posix">POSIX sh / bash</SelectItem>
            <SelectItem value="powershell">PowerShell</SelectItem>
            <SelectItem value="cmd">Windows cmd.exe</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Escape each whitespace token separately"
        hint="Off = treat the whole input as one argument"
      >
        <Switch checked={perToken} onCheckedChange={setPerToken} />
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[shell, perToken]}
      inputLabel="Raw string"
      outputLabel="Escaped argument"
      inputPlaceholder="Type a value to quote safely…"
      sample={SAMPLE}
      downloadName="escaped.txt"
      options={options}
    />
  );
}
