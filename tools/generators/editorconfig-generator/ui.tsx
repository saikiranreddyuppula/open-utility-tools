'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
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

type IndentStyle = 'space' | 'tab';
type Charset = 'utf-8' | 'utf-8-bom' | 'latin1';
type Eol = 'lf' | 'crlf' | 'cr';

interface Override {
  id: number;
  glob: string;
  lines: string[];
}

const PRESET_OVERRIDES: Override[] = [
  { id: 1, glob: '*.md', lines: ['trim_trailing_whitespace = false'] },
  { id: 2, glob: 'Makefile', lines: ['indent_style = tab'] },
  { id: 3, glob: '*.{yml,yaml}', lines: ['indent_size = 2'] },
  { id: 4, glob: '*.{js,ts,jsx,tsx}', lines: ['indent_size = 2'] },
  { id: 5, glob: '*.py', lines: ['indent_size = 4'] },
  { id: 6, glob: '*.go', lines: ['indent_style = tab'] },
];

export default function EditorconfigGeneratorTool() {
  const [indentStyle, setIndentStyle] = useState<IndentStyle>('space');
  const [indentSize, setIndentSize] = useState('2');
  const [charset, setCharset] = useState<Charset>('utf-8');
  const [eol, setEol] = useState<Eol>('lf');
  const [finalNewline, setFinalNewline] = useState(true);
  const [trimTrailing, setTrimTrailing] = useState(true);
  const [maxLineLength, setMaxLineLength] = useState('');
  const [enabled, setEnabled] = useState<Record<number, boolean>>({ 1: true, 3: true });
  const [customGlobs, setCustomGlobs] = useState('');

  const output = useMemo(() => {
    const lines: string[] = ['root = true', '', '[*]'];
    lines.push(`indent_style = ${indentStyle}`);
    if (indentStyle === 'space') {
      const sz = Number(indentSize);
      if (Number.isFinite(sz) && sz > 0) lines.push(`indent_size = ${Math.floor(sz)}`);
    }
    lines.push(`charset = ${charset}`);
    lines.push(`end_of_line = ${eol}`);
    lines.push(`insert_final_newline = ${finalNewline}`);
    lines.push(`trim_trailing_whitespace = ${trimTrailing}`);
    const mll = Number(maxLineLength);
    if (maxLineLength.trim() && Number.isFinite(mll) && mll > 0) {
      lines.push(`max_line_length = ${Math.floor(mll)}`);
    }

    for (const ov of PRESET_OVERRIDES) {
      if (!enabled[ov.id]) continue;
      lines.push('');
      lines.push(`[${ov.glob}]`);
      for (const l of ov.lines) lines.push(l);
    }

    // Custom globs: "glob | key=value, key2=value2" per line
    for (const raw of customGlobs.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split('|');
      const glob = (parts[0] ?? '').trim();
      if (!glob) continue;
      lines.push('');
      lines.push(`[${glob}]`);
      const rules = (parts[1] ?? '').trim();
      if (rules) {
        for (const r of rules.split(',')) {
          const rule = r.trim();
          if (rule) lines.push(rule.replace(/\s*=\s*/, ' = '));
        }
      }
    }

    return lines.join('\n') + '\n';
  }, [
    indentStyle,
    indentSize,
    charset,
    eol,
    finalNewline,
    trimTrailing,
    maxLineLength,
    enabled,
    customGlobs,
  ]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Indent style">
          <Select value={indentStyle} onValueChange={(v) => setIndentStyle(v as IndentStyle)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="space">space</SelectItem>
              <SelectItem value="tab">tab</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Indent size">
          <Input
            value={indentSize}
            onChange={(e) => setIndentSize(e.target.value)}
            className="w-20 font-mono"
            inputMode="numeric"
            disabled={indentStyle === 'tab'}
          />
        </Field>
        <Field label="Charset">
          <Select value={charset} onValueChange={(v) => setCharset(v as Charset)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf-8">utf-8</SelectItem>
              <SelectItem value="utf-8-bom">utf-8-bom</SelectItem>
              <SelectItem value="latin1">latin1</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="End of line">
          <Select value={eol} onValueChange={(v) => setEol(v as Eol)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lf">lf</SelectItem>
              <SelectItem value="crlf">crlf</SelectItem>
              <SelectItem value="cr">cr</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Max line length" hint="optional">
          <Input
            value={maxLineLength}
            onChange={(e) => setMaxLineLength(e.target.value)}
            className="w-24 font-mono"
            inputMode="numeric"
            placeholder="off"
          />
        </Field>
      </OptionsBar>

      <OptionsBar>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={finalNewline} onCheckedChange={setFinalNewline} id="fn" />
          <Label htmlFor="fn" className="text-xs text-muted-foreground">
            insert_final_newline
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={trimTrailing} onCheckedChange={setTrimTrailing} id="tt" />
          <Label htmlFor="tt" className="text-xs text-muted-foreground">
            trim_trailing_whitespace
          </Label>
        </label>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Per-glob overrides" />
        <div className="flex flex-wrap gap-x-5 gap-y-2 p-3">
          {PRESET_OVERRIDES.map((ov) => (
            <label key={ov.id} className="flex items-center gap-2 text-sm">
              <Switch
                checked={enabled[ov.id] === true}
                onCheckedChange={(c) =>
                  setEnabled((prev) => ({ ...prev, [ov.id]: c === true }))
                }
                id={`ov-${ov.id}`}
              />
              <Label htmlFor={`ov-${ov.id}`} className="font-mono text-xs text-muted-foreground">
                [{ov.glob}]
              </Label>
            </label>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Custom globs (one per line: glob | key=value, key=value)" />
        <Textarea
          value={customGlobs}
          onChange={(e) => setCustomGlobs(e.target.value)}
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          placeholder="*.json | indent_size = 4"
        />
      </Panel>

      <Panel>
        <PanelHeader title=".editorconfig">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename=".editorconfig" />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{output}</pre>
      </Panel>
    </div>
  );
}
