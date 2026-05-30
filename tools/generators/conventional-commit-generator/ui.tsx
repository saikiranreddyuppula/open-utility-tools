'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert',
] as const;
type CommitType = (typeof TYPES)[number];

const GITMOJI: Record<CommitType, string> = {
  feat: ':sparkles:',
  fix: ':bug:',
  docs: ':memo:',
  style: ':art:',
  refactor: ':recycle:',
  perf: ':zap:',
  test: ':white_check_mark:',
  build: ':construction_worker:',
  ci: ':green_heart:',
  chore: ':wrench:',
  revert: ':rewind:',
};

interface Footer {
  id: number;
  token: string;
  value: string;
}

let nextId = 2;

function wrapBody(text: string, width: number): string {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      if (line && (line.length + 1 + w.length) > width) {
        out.push(line);
        line = w;
      } else {
        line = line ? `${line} ${w}` : w;
      }
    }
    if (line) out.push(line);
  }
  return out.join('\n');
}

export default function ConventionalCommitGeneratorTool() {
  const [type, setType] = useState<CommitType>('feat');
  const [scope, setScope] = useState('export');
  const [description, setDescription] = useState('add CSV export to the report view');
  const [body, setBody] = useState('Adds a download button that serializes the visible rows to CSV. Large exports stream in chunks to avoid blocking the UI.');
  const [breaking, setBreaking] = useState(false);
  const [breakingDesc, setBreakingDesc] = useState('the report API now returns rows as an array, not a map');
  const [gitmoji, setGitmoji] = useState(false);
  const [footers, setFooters] = useState<Footer[]>([{ id: 1, token: 'Closes', value: '#142' }]);

  const addFooter = () => setFooters((p) => [...p, { id: nextId++, token: 'Refs', value: '' }]);
  const removeFooter = (id: number) => setFooters((p) => p.filter((f) => f.id !== id));
  const updateFooter = (id: number, patch: Partial<Footer>) =>
    setFooters((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const built = useMemo(() => {
    const desc = description.trim();
    const scopePart = scope.trim() ? `(${scope.trim()})` : '';
    const bang = breaking ? '!' : '';
    const prefix = gitmoji ? `${GITMOJI[type]} ` : '';
    const header = `${prefix}${type}${scopePart}${bang}: ${desc}`;

    const parts: string[] = [header];

    const wrappedBody = body.trim() ? wrapBody(body, 72) : '';
    if (wrappedBody) {
      parts.push('');
      parts.push(wrappedBody);
    }

    const footerLines: string[] = [];
    if (breaking) {
      footerLines.push(`BREAKING CHANGE: ${breakingDesc.trim() || desc}`);
    }
    for (const f of footers) {
      const tok = f.token.trim();
      const val = f.value.trim();
      if (tok && val) footerLines.push(`${tok}: ${val}`);
    }
    if (footerLines.length > 0) {
      parts.push('');
      parts.push(...footerLines);
    }

    const message = parts.join('\n');

    const warnings: string[] = [];
    // The header length warning ignores any gitmoji prefix.
    const headerForLen = `${type}${scopePart}${bang}: ${desc}`;
    if (headerForLen.length > 72) warnings.push(`Header is ${headerForLen.length} chars — keep it ≤ 72.`);
    if (!desc) warnings.push('Description is empty.');
    if (/[A-Z]/.test(type)) warnings.push('Type should be lowercase.');
    if (/\.$/.test(desc)) warnings.push('Description should not end with a period.');

    return { message, warnings, headerLen: headerForLen.length };
  }, [type, scope, description, body, breaking, breakingDesc, gitmoji, footers]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as CommitType)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Scope" hint="optional">
          <Input value={scope} onChange={(e) => setScope(e.target.value)} className="w-36 font-mono" placeholder="api" />
        </Field>
        <Field label="Description" className="min-w-[260px] flex-1">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="short imperative summary" />
        </Field>
        <Field label="Breaking">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={breaking} onCheckedChange={setBreaking} id="breaking" />
            <Label htmlFor="breaking" className="text-xs text-muted-foreground">!</Label>
          </div>
        </Field>
        <Field label="Gitmoji">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={gitmoji} onCheckedChange={setGitmoji} id="gitmoji" />
            <Label htmlFor="gitmoji" className="text-xs text-muted-foreground">prefix</Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Body (wrapped to 72 cols)" />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {breaking && (
        <Panel>
          <PanelHeader title="Breaking change description" />
          <Textarea
            value={breakingDesc}
            onChange={(e) => setBreakingDesc(e.target.value)}
            spellCheck={false}
            className="min-h-16 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Footers">
          <Button variant="ghost" size="sm" onClick={addFooter}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-2 p-3">
          {footers.length === 0 && (
            <span className="text-xs text-muted-foreground">No footers. Add ones like Refs, Reviewed-by, Closes.</span>
          )}
          {footers.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input value={f.token} onChange={(e) => updateFooter(f.id, { token: e.target.value })} className="w-40 font-mono" placeholder="Closes" />
              <span className="text-muted-foreground">:</span>
              <Input value={f.value} onChange={(e) => updateFooter(f.id, { value: e.target.value })} className="flex-1 font-mono" placeholder="#123" />
              <Button variant="ghost" size="icon-sm" onClick={() => removeFooter(f.id)} aria-label="Remove footer">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      {built.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {built.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader title="Commit message">
          <CopyButton value={() => built.message} />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{built.message}</pre>
        <StatBar items={[`header ${built.headerLen} chars`, breaking ? 'breaking change' : 'non-breaking', `${footers.length} footers`]} />
      </Panel>
    </div>
  );
}
