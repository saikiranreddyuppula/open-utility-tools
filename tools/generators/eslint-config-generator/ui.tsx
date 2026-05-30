'use client';

import { useMemo, useState } from 'react';

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

type Style = 'flat' | 'legacy';
type Lang = 'js' | 'ts';
type ModuleType = 'esm' | 'cjs';

interface RuleDef {
  name: string;
  value: string; // JSON-ish value as written in the rules object
}

const RULE_PRESETS: { id: string; label: string; rule: RuleDef }[] = [
  { id: 'unused', label: 'no-unused-vars (error)', rule: { name: 'no-unused-vars', value: '"error"' } },
  { id: 'console', label: 'no-console (warn)', rule: { name: 'no-console', value: '"warn"' } },
  { id: 'preferConst', label: 'prefer-const (error)', rule: { name: 'prefer-const', value: '"error"' } },
  { id: 'eqeqeq', label: 'eqeqeq (error)', rule: { name: 'eqeqeq', value: '["error", "always"]' } },
  { id: 'semi', label: 'semi (error, always)', rule: { name: 'semi', value: '["error", "always"]' } },
  { id: 'quotes', label: 'quotes (single)', rule: { name: 'quotes', value: '["error", "single"]' } },
];

export default function EslintConfigGeneratorTool() {
  const [style, setStyle] = useState<Style>('flat');
  const [lang, setLang] = useState<Lang>('ts');
  const [moduleType, setModuleType] = useState<ModuleType>('esm');
  const [envBrowser, setEnvBrowser] = useState(true);
  const [envNode, setEnvNode] = useState(true);
  const [recommended, setRecommended] = useState(true);
  const [rules, setRules] = useState<Record<string, boolean>>({
    unused: true,
    preferConst: true,
    eqeqeq: true,
  });

  const activeRules = useMemo<RuleDef[]>(() => {
    return RULE_PRESETS.filter((p) => rules[p.id]).map((p) => p.rule);
  }, [rules]);

  const output = useMemo(() => {
    const lines: string[] = [];
    const isTs = lang === 'ts';

    if (style === 'flat') {
      lines.push('// eslint.config.js — ESLint v9 flat config');
      lines.push('// Install: npm i -D eslint' + (recommended ? ' @eslint/js' : '') + (isTs ? ' typescript-eslint' : ''));
      lines.push('');
      if (recommended) lines.push("import js from '@eslint/js';");
      if (isTs) lines.push("import tseslint from 'typescript-eslint';");
      lines.push('');

      const globals: string[] = [];
      if (envBrowser) globals.push('        // browser globals: window, document, ...');
      if (envNode) globals.push('        // node globals: process, __dirname, ...');

      const block: string[] = [];
      block.push('  {');
      block.push(`    files: ['**/*.{${isTs ? 'js,ts,jsx,tsx' : 'js,jsx,mjs,cjs'}}'],`);
      block.push('    languageOptions: {');
      block.push('      ecmaVersion: 2024,');
      block.push(`      sourceType: '${moduleType === 'esm' ? 'module' : 'commonjs'}',`);
      block.push('      globals: {');
      for (const g of globals) block.push(g);
      block.push('      },');
      block.push('    },');
      block.push('    rules: {');
      for (const r of activeRules) {
        block.push(`      '${r.name}': ${r.value},`);
      }
      block.push('    },');
      block.push('  },');

      const arrParts: string[] = [];
      if (recommended) arrParts.push('  js.configs.recommended,');
      if (isTs && recommended) arrParts.push('  ...tseslint.configs.recommended,');

      if (moduleType === 'esm') {
        lines.push('export default [');
      } else {
        lines.push('module.exports = [');
      }
      for (const p of arrParts) lines.push(p);
      for (const b of block) lines.push(b);
      lines.push('];');
      return lines.join('\n') + '\n';
    }

    // legacy .eslintrc.json
    const extendsArr: string[] = [];
    if (recommended) extendsArr.push('eslint:recommended');
    if (isTs && recommended) {
      extendsArr.push('plugin:@typescript-eslint/recommended');
    }

    const obj: Record<string, unknown> = {
      root: true,
      env: {
        browser: envBrowser,
        node: envNode,
        es2024: true,
      },
      ...(extendsArr.length > 0 ? { extends: extendsArr } : {}),
      ...(isTs ? { parser: '@typescript-eslint/parser', plugins: ['@typescript-eslint'] } : {}),
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: moduleType === 'esm' ? 'module' : 'script',
      },
      rules: activeRules.reduce<Record<string, unknown>>((acc, r) => {
        try {
          acc[r.name] = JSON.parse(r.value) as unknown;
        } catch {
          acc[r.name] = r.value.replace(/^"|"$/g, '');
        }
        return acc;
      }, {}),
    };

    const header =
      '// .eslintrc.json — legacy config\n' +
      '// Install: npm i -D eslint' +
      (isTs ? ' @typescript-eslint/parser @typescript-eslint/eslint-plugin' : '') +
      '\n';
    return header + JSON.stringify(obj, null, 2) + '\n';
  }, [style, lang, moduleType, envBrowser, envNode, recommended, activeRules]);

  const filename = style === 'flat' ? 'eslint.config.js' : '.eslintrc.json';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Config style">
          <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat (eslint.config.js)</SelectItem>
              <SelectItem value="legacy">Legacy (.eslintrc.json)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Language">
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ts">TypeScript</SelectItem>
              <SelectItem value="js">JavaScript</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Module type">
          <Select value={moduleType} onValueChange={(v) => setModuleType(v as ModuleType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="esm">ESM (import)</SelectItem>
              <SelectItem value="cjs">CommonJS (require)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={recommended} onCheckedChange={setRecommended} id="rec" />
          <Label htmlFor="rec" className="text-xs text-muted-foreground">
            Recommended baseline
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={envBrowser} onCheckedChange={setEnvBrowser} id="br" />
          <Label htmlFor="br" className="text-xs text-muted-foreground">
            Browser env
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={envNode} onCheckedChange={setEnvNode} id="nd" />
          <Label htmlFor="nd" className="text-xs text-muted-foreground">
            Node env
          </Label>
        </label>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Rule presets" />
        <div className="flex flex-wrap gap-x-5 gap-y-2 p-3">
          {RULE_PRESETS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Switch
                checked={rules[p.id] === true}
                onCheckedChange={(c) => setRules((prev) => ({ ...prev, [p.id]: c === true }))}
                id={`rule-${p.id}`}
              />
              <Label htmlFor={`rule-${p.id}`} className="font-mono text-xs text-muted-foreground">
                {p.label}
              </Label>
            </label>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={filename}>
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename={filename} />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{output}</pre>
      </Panel>
    </div>
  );
}
