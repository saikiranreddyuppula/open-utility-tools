'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Eol = 'auto' | 'lf' | 'crlf';

interface Group {
  comment: string;
  lines: string[];
}

interface CustomRow {
  id: number;
  pattern: string;
  attr: string;
}

const BINARY_PATTERNS = [
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.webp',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.otf',
  '*.zip',
  '*.gz',
  '*.7z',
  '*.tar',
  '*.pdf',
];

const LFS_PATTERNS = ['*.psd', '*.ai', '*.mp4', '*.mov', '*.zip', '*.bin', '*.iso'];

let nextId = 1;
function makeId(): number {
  nextId += 1;
  return nextId;
}

export default function GitattributesGeneratorTool() {
  const [eol, setEol] = useState<Eol>('auto');
  const [markBinary, setMarkBinary] = useState(true);
  const [useLfs, setUseLfs] = useState(false);
  const [linguistVendored, setLinguistVendored] = useState(true);
  const [linguistGenerated, setLinguistGenerated] = useState(true);
  const [linguistDocs, setLinguistDocs] = useState(false);
  const [exportIgnore, setExportIgnore] = useState(true);
  const [custom, setCustom] = useState<CustomRow[]>([
    { id: makeId(), pattern: '', attr: '' },
  ]);

  const addCustom = () =>
    setCustom((rows) => [...rows, { id: makeId(), pattern: '', attr: '' }]);
  const updCustom = (id: number, patch: Partial<CustomRow>) =>
    setCustom((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delCustom = (id: number) => setCustom((rows) => rows.filter((r) => r.id !== id));

  const output = useMemo(() => {
    const groups: Group[] = [];

    // Line-ending normalization
    const eolLines: string[] = [];
    if (eol === 'auto') {
      eolLines.push('* text=auto');
    } else if (eol === 'lf') {
      eolLines.push('* text=auto eol=lf');
    } else {
      eolLines.push('* text=auto eol=crlf');
    }
    // Common scripts that must keep a specific EOL regardless.
    eolLines.push('*.sh    text eol=lf');
    eolLines.push('*.bat   text eol=crlf');
    eolLines.push('*.cmd   text eol=crlf');
    groups.push({ comment: 'Line-ending normalization', lines: eolLines });

    if (markBinary) {
      groups.push({
        comment: 'Treat these as binary (no diff, no EOL conversion)',
        lines: BINARY_PATTERNS.map((p) => `${p} binary`),
      });
    }

    if (useLfs) {
      groups.push({
        comment: 'Track large media with Git LFS',
        lines: LFS_PATTERNS.map((p) => `${p} filter=lfs diff=lfs merge=lfs -text`),
      });
    }

    const linguistLines: string[] = [];
    if (linguistVendored) {
      linguistLines.push('vendor/**       linguist-vendored');
      linguistLines.push('third_party/**  linguist-vendored');
    }
    if (linguistGenerated) {
      linguistLines.push('dist/**         linguist-generated');
      linguistLines.push('*.min.js        linguist-generated');
      linguistLines.push('*.min.css       linguist-generated');
    }
    if (linguistDocs) {
      linguistLines.push('docs/**         linguist-documentation');
      linguistLines.push('*.md            linguist-documentation');
    }
    if (linguistLines.length > 0) {
      groups.push({ comment: 'GitHub Linguist overrides', lines: linguistLines });
    }

    if (exportIgnore) {
      groups.push({
        comment: 'Exclude from git archive exports',
        lines: [
          '.gitattributes export-ignore',
          '.gitignore     export-ignore',
          '.github/       export-ignore',
          'tests/         export-ignore',
        ],
      });
    }

    const customLines = custom
      .filter((c) => c.pattern.trim() !== '' && c.attr.trim() !== '')
      .map((c) => `${c.pattern.trim()} ${c.attr.trim()}`);
    if (customLines.length > 0) {
      groups.push({ comment: 'Custom rules', lines: customLines });
    }

    const blocks = groups.map((g) => `# ${g.comment}\n${g.lines.join('\n')}`);
    return blocks.join('\n\n') + '\n';
  }, [
    eol,
    markBinary,
    useLfs,
    linguistVendored,
    linguistGenerated,
    linguistDocs,
    exportIgnore,
    custom,
  ]);

  const lineCount = output.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Presets" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Line endings (text=auto)">
              <Select value={eol} onValueChange={(v) => setEol(v as Eol)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (recommended)</SelectItem>
                  <SelectItem value="lf">Force LF in working tree</SelectItem>
                  <SelectItem value="crlf">Force CRLF in working tree</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch id="ga-bin" checked={markBinary} onCheckedChange={setMarkBinary} />
              <Label htmlFor="ga-bin" className="text-sm">Mark images/fonts/archives as binary</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ga-lfs" checked={useLfs} onCheckedChange={setUseLfs} />
              <Label htmlFor="ga-lfs" className="text-sm">Track large media with Git LFS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ga-vend" checked={linguistVendored} onCheckedChange={setLinguistVendored} />
              <Label htmlFor="ga-vend" className="text-sm">Linguist: vendored dirs</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ga-gen" checked={linguistGenerated} onCheckedChange={setLinguistGenerated} />
              <Label htmlFor="ga-gen" className="text-sm">Linguist: generated files</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ga-doc" checked={linguistDocs} onCheckedChange={setLinguistDocs} />
              <Label htmlFor="ga-doc" className="text-sm">Linguist: documentation</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ga-exp" checked={exportIgnore} onCheckedChange={setExportIgnore} />
              <Label htmlFor="ga-exp" className="text-sm">export-ignore meta files</Label>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Custom rules</Label>
              <Button variant="ghost" size="sm" onClick={addCustom}>
                <Plus className="size-3.5" /> Add rule
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {custom.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    value={c.pattern}
                    onChange={(e) => updCustom(c.id, { pattern: e.target.value })}
                    placeholder="*.lock"
                    spellCheck={false}
                    className="w-44 font-mono"
                  />
                  <Input
                    value={c.attr}
                    onChange={(e) => updCustom(c.id, { attr: e.target.value })}
                    placeholder="-diff"
                    spellCheck={false}
                    className="flex-1 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => delCustom(c.id)}
                    aria-label="Remove rule"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title=".gitattributes">
          <CopyButton value={() => output} />
        </PanelHeader>
        <pre className="overflow-x-auto whitespace-pre p-3 font-mono text-xs">{output}</pre>
        <StatBar items={[`${lineCount} rules`, eol === 'auto' ? 'text=auto' : `eol=${eol}`]} />
      </Panel>
    </div>
  );
}
