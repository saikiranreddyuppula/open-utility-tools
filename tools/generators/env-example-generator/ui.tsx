'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Redaction = 'blank' | 'mask' | 'keep' | 'placeholder';

interface EnvEntry {
  kind: 'var' | 'comment' | 'blank';
  key: string;
  value: string;
  comment: string;
}

const SAMPLE = `# App configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgres://admin:s3cr3t@localhost:5432/app
REDIS_URL=redis://localhost:6379

# Secrets
JWT_SECRET=9f8a7b6c5d4e3f2a1b0c
STRIPE_API_KEY=sk_live_51HxYzAbCdEfGhIjK
SENDGRID_API_KEY=SG.aBcDeFgHiJkLmNoPqRsT`;

function parseEnv(text: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const trimmed = line.trim();
    if (trimmed === '') {
      entries.push({ kind: 'blank', key: '', value: '', comment: '' });
      continue;
    }
    if (trimmed.startsWith('#')) {
      entries.push({ kind: 'comment', key: '', value: '', comment: trimmed });
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // strip optional `export ` prefix
    if (key.startsWith('export ')) key = key.slice('export '.length).trim();
    // strip a trailing inline comment that is clearly separated
    let inlineComment = '';
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hash = value.indexOf(' #');
      if (hash >= 0) {
        inlineComment = value.slice(hash + 1).trim();
        value = value.slice(0, hash).trim();
      }
    }
    // unquote
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    entries.push({ kind: 'var', key, value, comment: inlineComment });
  }
  return entries;
}

function redactValue(key: string, value: string, mode: Redaction): string {
  switch (mode) {
    case 'blank':
      return '';
    case 'mask':
      return value ? '*'.repeat(Math.min(12, Math.max(4, value.length))) : '';
    case 'keep':
      return value;
    case 'placeholder':
      return `<your-${key.toLowerCase().replace(/_/g, '-')}-here>`;
    default:
      return '';
  }
}

function quoteIfNeeded(value: string, quoteSpaces: boolean): string {
  if (quoteSpaces && /\s/.test(value) && !/^".*"$/.test(value)) {
    return `"${value}"`;
  }
  return value;
}

export default function EnvExampleGeneratorTool() {
  const [input, setInput] = useState(SAMPLE);
  const [redaction, setRedaction] = useState<Redaction>('placeholder');
  const [sortKeys, setSortKeys] = useState(false);
  const [quoteSpaces, setQuoteSpaces] = useState(true);
  const [preserveComments, setPreserveComments] = useState(true);

  const output = useMemo(() => {
    const entries = parseEnv(input);
    const vars = entries.filter((e) => e.kind === 'var');
    if (vars.length === 0) return '# No variables found — paste KEY=VALUE lines above.\n';

    const lines: string[] = [];

    if (sortKeys) {
      const sorted = [...vars].sort((a, b) => a.key.localeCompare(b.key));
      for (const v of sorted) {
        if (preserveComments && v.comment) lines.push(`# ${v.comment.replace(/^#+\s*/, '')}`);
        const val = quoteIfNeeded(redactValue(v.key, v.value, redaction), quoteSpaces);
        lines.push(`${v.key}=${val}`);
      }
    } else {
      for (const e of entries) {
        if (e.kind === 'blank') {
          if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
          continue;
        }
        if (e.kind === 'comment') {
          if (preserveComments) lines.push(e.comment);
          continue;
        }
        if (preserveComments && e.comment) lines.push(`# ${e.comment.replace(/^#+\s*/, '')}`);
        const val = quoteIfNeeded(redactValue(e.key, e.value, redaction), quoteSpaces);
        lines.push(`${e.key}=${val}`);
      }
    }

    // trim leading/trailing blank lines
    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    return lines.join('\n') + '\n';
  }, [input, redaction, sortKeys, quoteSpaces, preserveComments]);

  const varCount = useMemo(() => parseEnv(input).filter((e) => e.kind === 'var').length, [input]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Redaction">
          <Select value={redaction} onValueChange={(v) => setRedaction(v as Redaction)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder">&lt;your-key-here&gt;</SelectItem>
              <SelectItem value="blank">Blank</SelectItem>
              <SelectItem value="mask">Masked (****)</SelectItem>
              <SelectItem value="keep">Keep example</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={sortKeys} onCheckedChange={setSortKeys} id="sk" />
          <Label htmlFor="sk" className="text-xs text-muted-foreground">
            Sort keys
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={preserveComments} onCheckedChange={setPreserveComments} id="pc" />
          <Label htmlFor="pc" className="text-xs text-muted-foreground">
            Keep comments / groups
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={quoteSpaces} onCheckedChange={setQuoteSpaces} id="qs" />
          <Label htmlFor="qs" className="text-xs text-muted-foreground">
            Quote values with spaces
          </Label>
        </label>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input .env (KEY=VALUE lines)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title=".env.example">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename=".env.example" />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{output}</pre>
        <div className="flex h-7 shrink-0 items-center gap-x-3 border-t bg-muted/30 px-3 font-mono text-2xs text-muted-foreground tabular">
          <span>{varCount} variables</span>
        </div>
      </Panel>
    </div>
  );
}
