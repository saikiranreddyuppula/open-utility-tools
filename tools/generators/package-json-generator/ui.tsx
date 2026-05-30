'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ModuleType = 'module' | 'commonjs';

interface KV {
  id: number;
  key: string;
  value: string;
}

const LICENSES: string[] = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'GPL-3.0-only',
  'GPL-2.0-only',
  'LGPL-3.0-only',
  'MPL-2.0',
  'AGPL-3.0-only',
  'Unlicense',
  'UNLICENSED',
];

const SCRIPT_PRESETS: { label: string; key: string; cmd: string }[] = [
  { label: 'build', key: 'build', cmd: 'tsc' },
  { label: 'dev', key: 'dev', cmd: 'node --watch src/index.js' },
  { label: 'start', key: 'start', cmd: 'node dist/index.js' },
  { label: 'test', key: 'test', cmd: 'vitest run' },
  { label: 'lint', key: 'lint', cmd: 'eslint .' },
];

let nextId = 1;
const mkId = () => nextId++;

// npm package-name validity (simplified but faithful to the core rules).
function validateName(name: string): string | null {
  if (!name) return 'Name is required.';
  if (name.length > 214) return 'Name must be 214 characters or fewer.';
  if (name.trim() !== name) return 'Name must not have leading/trailing spaces.';
  if (name.toLowerCase() !== name) return 'Name must be lowercase.';
  const scoped = /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/;
  const plain = /^[a-z0-9-~][a-z0-9-._~]*$/;
  if (name.startsWith('@')) {
    if (!scoped.test(name)) return 'Invalid scoped name (use @scope/name).';
    return null;
  }
  if (name.startsWith('.') || name.startsWith('_')) return 'Name cannot start with . or _';
  if (!plain.test(name)) return 'Name has invalid characters.';
  return null;
}

// Loose semver core (major.minor.patch with optional prerelease/build).
function validateVersion(v: string): string | null {
  if (!v) return 'Version is required.';
  const re = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
  if (!re.test(v)) return 'Version must be valid semver (e.g. 1.0.0).';
  return null;
}

export default function PackageJsonGeneratorTool() {
  const [name, setName] = useState('my-package');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ModuleType>('module');
  const [main, setMain] = useState('dist/index.js');
  const [bin, setBin] = useState('');
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState('MIT');
  const [repo, setRepo] = useState('');
  const [enginesNode, setEnginesNode] = useState('>=18');
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [scripts, setScripts] = useState<KV[]>([{ id: mkId(), key: 'test', value: 'vitest run' }]);
  const [deps, setDeps] = useState<KV[]>([]);
  const [devDeps, setDevDeps] = useState<KV[]>([]);

  const addRow = (set: React.Dispatch<React.SetStateAction<KV[]>>) =>
    set((prev) => [...prev, { id: mkId(), key: '', value: '' }]);

  const updateRow = (
    set: React.Dispatch<React.SetStateAction<KV[]>>,
    id: number,
    field: 'key' | 'value',
    val: string
  ) => set((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  const removeRow = (set: React.Dispatch<React.SetStateAction<KV[]>>, id: number) =>
    set((prev) => prev.filter((r) => r.id !== id));

  const addScriptPreset = (key: string, cmd: string) =>
    setScripts((prev) => {
      const existing = prev.find((r) => r.key === key);
      if (existing) return prev.map((r) => (r.id === existing.id ? { ...r, value: cmd } : r));
      return [...prev, { id: mkId(), key, value: cmd }];
    });

  const result = useMemo(() => {
    const nameErr = validateName(name.trim());
    if (nameErr) return { error: nameErr };
    const verErr = validateVersion(version.trim());
    if (verErr) return { error: verErr };

    const rowsToObj = (rows: KV[]): Record<string, string> => {
      const obj: Record<string, string> = {};
      for (const r of rows) {
        const k = r.key.trim();
        if (!k) continue;
        obj[k] = r.value;
      }
      return obj;
    };

    const keywords = keywordsRaw
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter(Boolean);

    // Build with a deliberate key order matching npm convention.
    const pkg: Record<string, unknown> = {};
    pkg.name = name.trim();
    pkg.version = version.trim();
    if (description.trim()) pkg.description = description.trim();
    if (keywords.length) pkg.keywords = keywords;
    if (repo.trim()) pkg.repository = { type: 'git', url: repo.trim() };
    if (license.trim()) pkg.license = license.trim();
    if (author.trim()) pkg.author = author.trim();
    if (isPrivate) pkg.private = true;
    pkg.type = type;
    if (main.trim()) pkg.main = main.trim();
    if (bin.trim()) pkg.bin = bin.trim();

    const scriptsObj = rowsToObj(scripts);
    if (Object.keys(scriptsObj).length) pkg.scripts = scriptsObj;

    if (enginesNode.trim()) pkg.engines = { node: enginesNode.trim() };

    const depsObj = rowsToObj(deps);
    if (Object.keys(depsObj).length) pkg.dependencies = depsObj;
    const devObj = rowsToObj(devDeps);
    if (Object.keys(devObj).length) pkg.devDependencies = devObj;

    return { json: JSON.stringify(pkg, null, 2) + '\n' };
  }, [
    name,
    version,
    description,
    type,
    main,
    bin,
    author,
    license,
    repo,
    enginesNode,
    keywordsRaw,
    isPrivate,
    scripts,
    deps,
    devDeps,
  ]);

  const renderRows = (
    rows: KV[],
    set: React.Dispatch<React.SetStateAction<KV[]>>,
    title: string,
    keyPh: string,
    valuePh: string,
    extraHeader?: React.ReactNode
  ) => (
    <Panel>
      <PanelHeader title={title}>
        {extraHeader}
        <Button variant="ghost" size="sm" onClick={() => addRow(set)}>
          <Plus className="size-3.5" /> Add
        </Button>
      </PanelHeader>
      <div className="flex flex-col gap-2 p-3">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No entries.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              value={r.key}
              onChange={(e) => updateRow(set, r.id, 'key', e.target.value)}
              placeholder={keyPh}
              className="w-44 font-mono text-xs"
            />
            <Input
              value={r.value}
              onChange={(e) => updateRow(set, r.id, 'value', e.target.value)}
              placeholder={valuePh}
              className="flex-1 font-mono text-xs"
            />
            <Button variant="ghost" size="icon-sm" onClick={() => removeRow(set, r.id)}>
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Name" hint="lowercase, npm rules">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-52 font-mono"
            placeholder="my-package"
          />
        </Field>
        <Field label="Version">
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-28 font-mono"
            placeholder="1.0.0"
          />
        </Field>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as ModuleType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="module">module (ESM)</SelectItem>
              <SelectItem value="commonjs">commonjs</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="License">
          <Select value={license} onValueChange={setLicense}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENSES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="engines.node">
          <Input
            value={enginesNode}
            onChange={(e) => setEnginesNode(e.target.value)}
            className="w-28 font-mono"
            placeholder=">=18"
          />
        </Field>
        <Field label="Private">
          <Select value={isPrivate ? 'yes' : 'no'} onValueChange={(v) => setIsPrivate(v === 'yes')}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">false</SelectItem>
              <SelectItem value="yes">true</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Description" className="min-w-[240px] flex-1">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description"
          />
        </Field>
        <Field label="Main / entry">
          <Input
            value={main}
            onChange={(e) => setMain(e.target.value)}
            className="w-40 font-mono"
            placeholder="dist/index.js"
          />
        </Field>
        <Field label="Bin (path)">
          <Input
            value={bin}
            onChange={(e) => setBin(e.target.value)}
            className="w-40 font-mono"
            placeholder="(none)"
          />
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Author">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-52"
            placeholder="Name <email> (url)"
          />
        </Field>
        <Field label="Repository URL" className="min-w-[220px] flex-1">
          <Input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="font-mono"
            placeholder="git+https://github.com/user/repo.git"
          />
        </Field>
        <Field label="Keywords" hint="comma or newline separated" className="min-w-[200px] flex-1">
          <Input
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            placeholder="cli, utility"
          />
        </Field>
      </OptionsBar>

      {renderRows(
        scripts,
        setScripts,
        'Scripts',
        'name',
        'command',
        <div className="mr-1 flex flex-wrap items-center gap-1">
          {SCRIPT_PRESETS.map((p) => (
            <Button
              key={p.key}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-2xs"
              onClick={() => addScriptPreset(p.key, p.cmd)}
            >
              + {p.label}
            </Button>
          ))}
        </div>
      )}

      {renderRows(deps, setDeps, 'dependencies', 'package', '^1.0.0')}
      {renderRows(devDeps, setDevDeps, 'devDependencies', 'package', '^1.0.0')}

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="package.json">
            <CopyButton value={() => result.json} />
            <DownloadButton data={() => result.json} filename="package.json" />
          </PanelHeader>
          <pre className="overflow-auto p-3 font-mono text-xs">{result.json}</pre>
        </Panel>
      )}
    </div>
  );
}
