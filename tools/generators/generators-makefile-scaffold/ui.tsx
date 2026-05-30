'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface Target {
  name: string;
  desc: string;
  commands: string;
}

const TAB = '\t';

export default function MakefileScaffoldGenerator() {
  const [variables, setVariables] = useState('NODE=node\nNPM=npm');
  const [defaultGoal, setDefaultGoal] = useState(true);
  const [includeHelp, setIncludeHelp] = useState(true);
  const [silence, setSilence] = useState(false);
  const [targets, setTargets] = useState<Target[]>([
    { name: 'install', desc: 'Install dependencies', commands: '$(NPM) ci' },
    { name: 'build', desc: 'Build the project', commands: '$(NPM) run build' },
    { name: 'test', desc: 'Run the test suite', commands: '$(NPM) test' },
    { name: 'clean', desc: 'Remove build artifacts', commands: 'rm -rf dist node_modules' },
  ]);

  const updateTarget = (i: number, patch: Partial<Target>) =>
    setTargets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTarget = () =>
    setTargets((prev) => [...prev, { name: 'task', desc: '', commands: '' }]);
  const removeTarget = (i: number) => setTargets((prev) => prev.filter((_, idx) => idx !== i));

  const makefile = useMemo(() => {
    const lines: string[] = [];

    const validTargets = targets
      .map((t) => ({ ...t, name: t.name.trim().replace(/\s+/g, '-') }))
      .filter((t) => t.name);

    // Variable declarations
    const vars = variables
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*\s*[:?]?=/.test(l) || l.includes('='));
    if (vars.length > 0) {
      for (const v of vars) lines.push(v);
      lines.push('');
    }

    if (defaultGoal && (includeHelp || validTargets.length > 0)) {
      lines.push(`.DEFAULT_GOAL := ${includeHelp ? 'help' : (validTargets[0]?.name ?? 'help')}`);
      lines.push('');
    }

    const phonyNames = validTargets.map((t) => t.name);
    if (includeHelp) phonyNames.push('help');
    if (phonyNames.length > 0) {
      lines.push(`.PHONY: ${phonyNames.join(' ')}`);
      lines.push('');
    }

    if (includeHelp) {
      // Self-documenting help: grep target lines tagged with "## description".
      lines.push('help: ## Show this help');
      lines.push(
        `${TAB}@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \\033[36m%-18s\\033[0m %s\\n", $$1, $$2}'`,
      );
      lines.push('');
    }

    for (const t of validTargets) {
      const header = includeHelp && t.desc.trim()
        ? `${t.name}: ## ${t.desc.trim()}`
        : `${t.name}:`;
      lines.push(header);
      const cmds = t.commands
        .split('\n')
        .map((c) => c.trimEnd())
        .filter((c) => c.trim() !== '');
      if (cmds.length === 0) {
        lines.push(`${TAB}${silence ? '@' : ''}echo "TODO: ${t.name}"`);
      } else {
        for (const c of cmds) {
          const cmd = c.replace(/^\t+/, '').trimStart();
          lines.push(`${TAB}${silence && !cmd.startsWith('@') ? '@' : ''}${cmd}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }, [variables, defaultGoal, includeHelp, silence, targets]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Default goal">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={defaultGoal} onCheckedChange={setDefaultGoal} id="mk-default" />
            <Label htmlFor="mk-default" className="text-xs text-muted-foreground">
              {defaultGoal ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
        <Field label="Help target">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={includeHelp} onCheckedChange={setIncludeHelp} id="mk-help" />
            <Label htmlFor="mk-help" className="text-xs text-muted-foreground">
              {includeHelp ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
        <Field label="Silence (@)">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={silence} onCheckedChange={setSilence} id="mk-silence" />
            <Label htmlFor="mk-silence" className="text-xs text-muted-foreground">
              {silence ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Variables (KEY=value, one per line)" />
        <Textarea
          value={variables}
          onChange={(e) => setVariables(e.target.value)}
          spellCheck={false}
          className="min-h-16 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Targets">
          <Button variant="secondary" size="sm" onClick={addTarget}>
            <Plus className="size-3.5" /> Add target
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {targets.map((t, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              <Field label="Target name">
                <Input value={t.name} onChange={(e) => updateTarget(i, { name: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Description (for help)">
                <Input value={t.desc} onChange={(e) => updateTarget(i, { desc: e.target.value })} />
              </Field>
              <Field label="Commands (one per line)" className="sm:col-span-2">
                <Textarea
                  value={t.commands}
                  onChange={(e) => updateTarget(i, { commands: e.target.value })}
                  spellCheck={false}
                  className="min-h-16 resize-y font-mono text-xs"
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeTarget(i)}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {targets.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No targets. Add one above.</div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Makefile">
          <CopyButton value={() => makefile} />
          <DownloadButton data={() => makefile} filename="Makefile" />
        </PanelHeader>
        <pre className="max-h-[440px] overflow-auto p-3 font-mono text-xs">{makefile}</pre>
        <StatBar items={[`${targets.filter((t) => t.name.trim()).length} targets`, 'tab-indented recipes']} />
      </Panel>
    </div>
  );
}
