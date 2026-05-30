'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LANGS = ['node', 'python', 'go', 'generic'] as const;
type Lang = (typeof LANGS)[number];

const OS_OPTIONS = ['ubuntu-latest', 'macos-latest', 'windows-latest'] as const;
type OsName = (typeof OS_OPTIONS)[number];

function isLang(v: string): v is Lang {
  return (LANGS as readonly string[]).includes(v);
}

interface CustomStep {
  name: string;
  run: string;
}

interface Opts {
  name: string;
  onPush: boolean;
  onPR: boolean;
  branches: string;
  onDispatch: boolean;
  schedule: string;
  osList: OsName[];
  lang: Lang;
  versions: string;
  cache: boolean;
  custom: CustomStep[];
}

/** Quote a YAML scalar only when needed (keeps the output readable). */
function yamlScalar(s: string): string {
  if (s === '') return "''";
  if (/^[A-Za-z0-9_.\-/]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function langSetup(lang: Lang, cache: boolean): string[] {
  // Returns step lines (already indented at 6 spaces under steps:).
  const lines: string[] = [];
  if (lang === 'node') {
    lines.push('      - name: Set up Node.js');
    lines.push('        uses: actions/setup-node@v4');
    lines.push('        with:');
    lines.push('          node-version: ${{ matrix.version }}');
    if (cache) lines.push('          cache: npm');
    lines.push('      - name: Install dependencies');
    lines.push('        run: npm ci');
    lines.push('      - name: Test');
    lines.push('        run: npm test --if-present');
    lines.push('      - name: Build');
    lines.push('        run: npm run build --if-present');
  } else if (lang === 'python') {
    lines.push('      - name: Set up Python');
    lines.push('        uses: actions/setup-python@v5');
    lines.push('        with:');
    lines.push('          python-version: ${{ matrix.version }}');
    if (cache) lines.push('          cache: pip');
    lines.push('      - name: Install dependencies');
    lines.push('        run: |');
    lines.push('          python -m pip install --upgrade pip');
    lines.push('          pip install -r requirements.txt');
    lines.push('      - name: Test');
    lines.push('        run: pytest');
  } else if (lang === 'go') {
    lines.push('      - name: Set up Go');
    lines.push('        uses: actions/setup-go@v5');
    lines.push('        with:');
    lines.push('          go-version: ${{ matrix.version }}');
    if (cache) lines.push('          cache: true');
    lines.push('      - name: Build');
    lines.push('        run: go build ./...');
    lines.push('      - name: Test');
    lines.push('        run: go test ./...');
  } else {
    lines.push('      - name: Build');
    lines.push('        run: echo "Add your build commands here"');
  }
  return lines;
}

function build(o: Opts): string {
  const lines: string[] = [];
  lines.push(`name: ${yamlScalar(o.name.trim() || 'CI')}`);
  lines.push('');

  // Triggers
  lines.push('on:');
  const branches = o.branches
    .split(',')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const branchYaml =
    branches.length > 0 ? `[${branches.map((b) => yamlScalar(b)).join(', ')}]` : '';
  if (o.onPush) {
    if (branchYaml) {
      lines.push('  push:');
      lines.push(`    branches: ${branchYaml}`);
    } else {
      lines.push('  push:');
    }
  }
  if (o.onPR) {
    if (branchYaml) {
      lines.push('  pull_request:');
      lines.push(`    branches: ${branchYaml}`);
    } else {
      lines.push('  pull_request:');
    }
  }
  if (o.onDispatch) lines.push('  workflow_dispatch:');
  const cron = o.schedule.trim();
  if (cron) {
    lines.push('  schedule:');
    lines.push(`    - cron: ${yamlScalar(cron)}`);
  }
  if (!o.onPush && !o.onPR && !o.onDispatch && !cron) {
    // Always emit at least one trigger so the workflow is valid.
    lines.push('  push:');
  }
  lines.push('');

  // Jobs
  lines.push('jobs:');
  lines.push('  build:');
  const osList = o.osList.length > 0 ? o.osList : (['ubuntu-latest'] as OsName[]);
  lines.push('    runs-on: ${{ matrix.os }}');
  lines.push('    strategy:');
  lines.push('      fail-fast: false');
  lines.push('      matrix:');
  lines.push(`        os: [${osList.join(', ')}]`);

  const versions = o.versions
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (o.lang !== 'generic' && versions.length > 0) {
    lines.push(`        version: [${versions.map((v) => yamlScalar(v)).join(', ')}]`);
  }
  lines.push('    steps:');
  lines.push('      - name: Checkout');
  lines.push('        uses: actions/checkout@v4');
  for (const l of langSetup(o.lang, o.cache)) lines.push(l);

  for (const step of o.custom) {
    const sName = step.name.trim();
    const sRun = step.run.trim();
    if (!sName && !sRun) continue;
    lines.push(`      - name: ${yamlScalar(sName || 'Custom step')}`);
    if (sRun.includes('\n')) {
      lines.push('        run: |');
      for (const rl of sRun.split('\n')) lines.push(`          ${rl}`);
    } else {
      lines.push(`        run: ${sRun || 'echo "noop"'}`);
    }
  }

  return lines.join('\n') + '\n';
}

export default function GithubActionsWorkflowTool() {
  const [name, setName] = useState('CI');
  const [onPush, setOnPush] = useState(true);
  const [onPR, setOnPR] = useState(true);
  const [branches, setBranches] = useState('main');
  const [onDispatch, setOnDispatch] = useState(true);
  const [schedule, setSchedule] = useState('');
  const [osList, setOsList] = useState<OsName[]>(['ubuntu-latest']);
  const [lang, setLang] = useState<Lang>('node');
  const [versions, setVersions] = useState('18, 20, 22');
  const [cache, setCache] = useState(true);
  const [custom, setCustom] = useState<CustomStep[]>([]);

  const toggleOs = (os: OsName) => {
    setOsList((prev) => (prev.includes(os) ? prev.filter((o) => o !== os) : [...prev, os]));
  };

  const yaml = useMemo(
    () =>
      build({
        name,
        onPush,
        onPR,
        branches,
        onDispatch,
        schedule,
        osList,
        lang,
        versions,
        cache,
        custom,
      }),
    [name, onPush, onPR, branches, onDispatch, schedule, osList, lang, versions, cache, custom],
  );

  const defaultVersions = (l: Lang): string => {
    if (l === 'node') return '18, 20, 22';
    if (l === 'python') return '3.10, 3.11, 3.12';
    if (l === 'go') return '1.21, 1.22';
    return '';
  };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Workflow name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Language preset">
          <Select
            value={lang}
            onValueChange={(v) => {
              if (isLang(v)) {
                setLang(v);
                setVersions(defaultVersions(v));
              }
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="node">Node.js</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="go">Go</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {lang !== 'generic' && (
          <Field label="Version matrix (comma-separated)" className="min-w-[200px]">
            <Input
              value={versions}
              onChange={(e) => setVersions(e.target.value)}
              className="font-mono"
            />
          </Field>
        )}
        <Field label="Branch filter (comma-separated)" className="min-w-[160px]">
          <Input value={branches} onChange={(e) => setBranches(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Schedule (cron, blank = none)">
          <Input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-40 font-mono"
            placeholder="0 0 * * *"
          />
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Triggers">
          <div className="flex h-8 flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Switch checked={onPush} onCheckedChange={setOnPush} id="gw-push" />
              <Label htmlFor="gw-push" className="text-xs text-muted-foreground">
                push
              </Label>
            </span>
            <span className="flex items-center gap-1.5">
              <Switch checked={onPR} onCheckedChange={setOnPR} id="gw-pr" />
              <Label htmlFor="gw-pr" className="text-xs text-muted-foreground">
                pull_request
              </Label>
            </span>
            <span className="flex items-center gap-1.5">
              <Switch checked={onDispatch} onCheckedChange={setOnDispatch} id="gw-disp" />
              <Label htmlFor="gw-disp" className="text-xs text-muted-foreground">
                workflow_dispatch
              </Label>
            </span>
          </div>
        </Field>
        <Field label="Runner OS matrix">
          <div className="flex h-8 flex-wrap items-center gap-4">
            {OS_OPTIONS.map((os) => (
              <span key={os} className="flex items-center gap-1.5">
                <Switch
                  checked={osList.includes(os)}
                  onCheckedChange={() => toggleOs(os)}
                  id={`gw-${os}`}
                />
                <Label htmlFor={`gw-${os}`} className="text-xs text-muted-foreground">
                  {os.replace('-latest', '')}
                </Label>
              </span>
            ))}
          </div>
        </Field>
        {lang !== 'generic' && (
          <Field label="Dependency cache">
            <div className="flex h-8 items-center gap-1.5">
              <Switch checked={cache} onCheckedChange={setCache} id="gw-cache" />
              <Label htmlFor="gw-cache" className="text-xs text-muted-foreground">
                {cache ? 'enabled' : 'disabled'}
              </Label>
            </div>
          </Field>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title="Custom steps">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCustom((c) => [...c, { name: '', run: '' }])}
          >
            <Plus className="size-3.5" /> Add step
          </Button>
        </PanelHeader>
        <div className="flex flex-col gap-2 p-3">
          {custom.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No custom steps. Add one to append extra <code>run:</code> commands after the preset.
            </p>
          )}
          {custom.map((step, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2 sm:flex-row">
              <Input
                value={step.name}
                onChange={(e) =>
                  setCustom((c) => c.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                }
                placeholder="Step name"
                className="sm:w-48"
              />
              <Textarea
                value={step.run}
                onChange={(e) =>
                  setCustom((c) => c.map((s, j) => (j === i ? { ...s, run: e.target.value } : s)))
                }
                placeholder="run command(s)"
                spellCheck={false}
                rows={1}
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCustom((c) => c.filter((_, j) => j !== i))}
                aria-label="Remove step"
                className="self-start"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title=".github/workflows/ci.yml">
          <CopyButton value={() => yaml} label="Copy" />
          <DownloadButton data={() => yaml} filename="ci.yml" />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs leading-relaxed">{yaml}</pre>
        <StatBar
          items={[
            `lang=${lang}`,
            `${osList.length || 1} OS`,
            `${custom.filter((s) => s.name || s.run).length} custom steps`,
          ]}
        />
      </Panel>
    </div>
  );
}
