'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Target = 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022' | 'ESNext';
type Module = 'ESNext' | 'CommonJS' | 'NodeNext' | 'ES2022';
type ModRes = 'Bundler' | 'Node' | 'Node10' | 'NodeNext';
type Jsx = 'none' | 'preserve' | 'react' | 'react-jsx' | 'react-jsxdev';

interface PathRow {
  alias: string;
  target: string;
}

interface State {
  target: Target;
  module: Module;
  moduleResolution: ModRes;
  strict: boolean;
  jsx: Jsx;
  outDir: string;
  rootDir: string;
  declaration: boolean;
  sourceMap: boolean;
  esModuleInterop: boolean;
  skipLibCheck: boolean;
  resolveJsonModule: boolean;
  forceConsistentCasing: boolean;
  baseUrl: string;
  paths: PathRow[];
  include: string;
  exclude: string;
  extendsField: string;
}

const DEFAULT_STATE: State = {
  target: 'ES2022',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  strict: true,
  jsx: 'none',
  outDir: 'dist',
  rootDir: 'src',
  declaration: true,
  sourceMap: true,
  esModuleInterop: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  forceConsistentCasing: true,
  baseUrl: '.',
  paths: [{ alias: '@/*', target: 'src/*' }],
  include: 'src',
  exclude: 'node_modules, dist',
  extendsField: '',
};

const PRESETS: { label: string; apply: () => State }[] = [
  {
    label: 'Node app',
    apply: () => ({
      ...DEFAULT_STATE,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      jsx: 'none',
      outDir: 'dist',
      rootDir: 'src',
      declaration: false,
      paths: [],
      baseUrl: '',
      include: 'src',
    }),
  },
  {
    label: 'React app',
    apply: () => ({
      ...DEFAULT_STATE,
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      outDir: '',
      rootDir: '',
      declaration: false,
      sourceMap: false,
      paths: [{ alias: '@/*', target: 'src/*' }],
      baseUrl: '.',
      include: 'src',
    }),
  },
  {
    label: 'Library',
    apply: () => ({
      ...DEFAULT_STATE,
      target: 'ES2021',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'none',
      outDir: 'dist',
      rootDir: 'src',
      declaration: true,
      sourceMap: true,
      paths: [],
      baseUrl: '',
      include: 'src',
    }),
  },
];

const TARGETS: Target[] = ['ES2017', 'ES2018', 'ES2019', 'ES2020', 'ES2021', 'ES2022', 'ESNext'];
const MODULES: Module[] = ['ESNext', 'ES2022', 'CommonJS', 'NodeNext'];
const MODRES: ModRes[] = ['Bundler', 'Node', 'Node10', 'NodeNext'];
const JSX_MODES: Jsx[] = ['none', 'preserve', 'react', 'react-jsx', 'react-jsxdev'];

function splitList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export default function TsconfigGenerator() {
  const [state, setState] = useState<State>(DEFAULT_STATE);

  const set = <K extends keyof State>(key: K, val: State[K]) =>
    setState((prev) => ({ ...prev, [key]: val }));

  const addPath = () => set('paths', [...state.paths, { alias: '', target: '' }]);
  const removePath = (i: number) => set('paths', state.paths.filter((_, idx) => idx !== i));
  const updatePath = (i: number, field: keyof PathRow, val: string) =>
    set(
      'paths',
      state.paths.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)),
    );

  const json = useMemo(() => {
    const compilerOptions: Record<string, unknown> = {
      target: state.target,
      module: state.module,
      moduleResolution: state.moduleResolution,
    };
    if (state.jsx !== 'none') compilerOptions.jsx = state.jsx;
    if (state.strict) {
      compilerOptions.strict = true;
    } else {
      compilerOptions.noImplicitAny = false;
      compilerOptions.strictNullChecks = false;
    }
    if (state.outDir.trim()) compilerOptions.outDir = state.outDir.trim();
    if (state.rootDir.trim()) compilerOptions.rootDir = state.rootDir.trim();
    if (state.declaration) compilerOptions.declaration = true;
    if (state.sourceMap) compilerOptions.sourceMap = true;
    if (state.esModuleInterop) compilerOptions.esModuleInterop = true;
    if (state.skipLibCheck) compilerOptions.skipLibCheck = true;
    if (state.resolveJsonModule) compilerOptions.resolveJsonModule = true;
    if (state.forceConsistentCasing) compilerOptions.forceConsistentCasingInFileNames = true;

    const validPaths = state.paths.filter((p) => p.alias.trim() && p.target.trim());
    if (state.baseUrl.trim() || validPaths.length > 0) {
      if (state.baseUrl.trim()) compilerOptions.baseUrl = state.baseUrl.trim();
      if (validPaths.length > 0) {
        const paths: Record<string, string[]> = {};
        for (const p of validPaths) {
          paths[p.alias.trim()] = [p.target.trim()];
        }
        compilerOptions.paths = paths;
      }
    }

    const root: Record<string, unknown> = {};
    if (state.extendsField.trim()) root.extends = state.extendsField.trim();
    root.compilerOptions = compilerOptions;
    const include = splitList(state.include);
    const exclude = splitList(state.exclude);
    if (include.length > 0) root.include = include;
    if (exclude.length > 0) root.exclude = exclude;

    return JSON.stringify(root, null, 2);
  }, [state]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Presets" />
        <div className="flex flex-wrap gap-2 p-3">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="outline" size="sm" onClick={() => setState(p.apply())}>
              {p.label}
            </Button>
          ))}
        </div>
        <OptionsBar>
          <Field label="Target">
            <Select value={state.target} onValueChange={(v) => set('target', v as Target)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Module">
            <Select value={state.module} onValueChange={(v) => set('module', v as Module)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Module resolution">
            <Select value={state.moduleResolution} onValueChange={(v) => set('moduleResolution', v as ModRes)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODRES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="JSX">
            <Select value={state.jsx} onValueChange={(v) => set('jsx', v as Jsx)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JSX_MODES.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="outDir">
            <Input value={state.outDir} onChange={(e) => set('outDir', e.target.value)} className="w-28 font-mono" />
          </Field>
          <Field label="rootDir">
            <Input value={state.rootDir} onChange={(e) => set('rootDir', e.target.value)} className="w-28 font-mono" />
          </Field>
          <Field label="baseUrl">
            <Input value={state.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} className="w-24 font-mono" />
          </Field>
          <Field label="extends">
            <Input
              value={state.extendsField}
              onChange={(e) => set('extendsField', e.target.value)}
              placeholder="@tsconfig/node20"
              className="w-44 font-mono"
            />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="strict">
            <Switch checked={state.strict} onCheckedChange={(c) => set('strict', c)} />
          </Field>
          <Field label="declaration">
            <Switch checked={state.declaration} onCheckedChange={(c) => set('declaration', c)} />
          </Field>
          <Field label="sourceMap">
            <Switch checked={state.sourceMap} onCheckedChange={(c) => set('sourceMap', c)} />
          </Field>
          <Field label="esModuleInterop">
            <Switch checked={state.esModuleInterop} onCheckedChange={(c) => set('esModuleInterop', c)} />
          </Field>
          <Field label="skipLibCheck">
            <Switch checked={state.skipLibCheck} onCheckedChange={(c) => set('skipLibCheck', c)} />
          </Field>
          <Field label="resolveJsonModule">
            <Switch checked={state.resolveJsonModule} onCheckedChange={(c) => set('resolveJsonModule', c)} />
          </Field>
          <Field label="forceConsistentCasing">
            <Switch checked={state.forceConsistentCasing} onCheckedChange={(c) => set('forceConsistentCasing', c)} />
          </Field>
        </OptionsBar>
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Path aliases</span>
            <Button variant="outline" size="sm" onClick={addPath}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          {state.paths.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={p.alias}
                onChange={(e) => updatePath(i, 'alias', e.target.value)}
                placeholder="@/*"
                className="font-mono"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                value={p.target}
                onChange={(e) => updatePath(i, 'target', e.target.value)}
                placeholder="src/*"
                className="font-mono"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => removePath(i)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <OptionsBar>
          <Field label="include (comma/newline)" className="min-w-[200px] flex-1">
            <Input value={state.include} onChange={(e) => set('include', e.target.value)} className="font-mono" />
          </Field>
          <Field label="exclude (comma/newline)" className="min-w-[200px] flex-1">
            <Input value={state.exclude} onChange={(e) => set('exclude', e.target.value)} className="font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="tsconfig.json">
          <CopyButton value={() => json} />
          <DownloadButton data={() => json} filename="tsconfig.json" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs">{json}</pre>
        <StatBar items={[`${json.split('\n').length} lines`, `${json.length} chars`]} />
      </Panel>
    </div>
  );
}
