'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface Job {
  name: string;
  stage: string;
  image: string;
  script: string;
  only: string;
}

/** Quote a scalar for YAML only when needed. */
function yamlScalar(v: string): string {
  const s = v.trim();
  if (s === '') return "''";
  if (/^[A-Za-z0-9_./:@-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function listToLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function GitlabCiYamlGenerator() {
  const [defaultImage, setDefaultImage] = useState('node:20-alpine');
  const [stages, setStages] = useState('build\ntest\ndeploy');
  const [beforeScript, setBeforeScript] = useState('npm ci');
  const [includeBefore, setIncludeBefore] = useState(true);
  const [includeCache, setIncludeCache] = useState(true);
  const [cachePaths, setCachePaths] = useState('node_modules/\n.npm/');
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([
    { name: 'build', stage: 'build', image: '', script: 'npm run build', only: 'main' },
    { name: 'test', stage: 'test', image: '', script: 'npm test', only: '' },
  ]);

  const updateJob = (i: number, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));
  };
  const addJob = () => setJobs((prev) => [...prev, { name: 'job', stage: '', image: '', script: '', only: '' }]);
  const removeJob = (i: number) => setJobs((prev) => prev.filter((_, idx) => idx !== i));

  const yaml = useMemo(() => {
    const lines: string[] = [];
    const stageList = listToLines(stages);

    if (defaultImage.trim()) {
      lines.push(`default:`);
      lines.push(`  image: ${yamlScalar(defaultImage)}`);
      if (includeBefore) {
        const bs = listToLines(beforeScript);
        if (bs.length > 0) {
          lines.push('  before_script:');
          for (const s of bs) lines.push(`    - ${yamlScalar(s)}`);
        }
      }
      lines.push('');
    }

    if (stageList.length > 0) {
      lines.push('stages:');
      for (const s of stageList) lines.push(`  - ${yamlScalar(s)}`);
      lines.push('');
    }

    if (includeCache) {
      const paths = listToLines(cachePaths);
      if (paths.length > 0) {
        lines.push('cache:');
        lines.push('  key: ${CI_COMMIT_REF_SLUG}');
        lines.push('  paths:');
        for (const p of paths) lines.push(`    - ${yamlScalar(p)}`);
        lines.push('');
      }
    }

    for (const job of jobs) {
      const name = job.name.trim();
      if (!name) continue;
      lines.push(`${name}:`);
      if (job.stage.trim()) lines.push(`  stage: ${yamlScalar(job.stage)}`);
      if (job.image.trim()) lines.push(`  image: ${yamlScalar(job.image)}`);
      const scriptLines = listToLines(job.script);
      lines.push('  script:');
      if (scriptLines.length === 0) {
        lines.push('    - echo "TODO"');
      } else {
        for (const s of scriptLines) lines.push(`    - ${yamlScalar(s)}`);
      }
      if (includeArtifacts && job.stage.trim() === 'build') {
        lines.push('  artifacts:');
        lines.push('    paths:');
        lines.push('      - dist/');
        lines.push('    expire_in: 1 week');
      }
      const branches = job.only
        .split(/[,\n]/)
        .map((b) => b.trim())
        .filter(Boolean);
      if (branches.length > 0) {
        lines.push('  only:');
        for (const b of branches) lines.push(`    - ${yamlScalar(b)}`);
      }
      lines.push('');
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }, [defaultImage, stages, beforeScript, includeBefore, includeCache, cachePaths, includeArtifacts, jobs]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Default image" className="min-w-[180px]">
          <Input value={defaultImage} onChange={(e) => setDefaultImage(e.target.value)} className="font-mono" />
        </Field>
        <Field label="before_script">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={includeBefore} onCheckedChange={setIncludeBefore} id="gl-before" />
            <Label htmlFor="gl-before" className="text-xs text-muted-foreground">
              {includeBefore ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
        <Field label="Cache block">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={includeCache} onCheckedChange={setIncludeCache} id="gl-cache" />
            <Label htmlFor="gl-cache" className="text-xs text-muted-foreground">
              {includeCache ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
        <Field label="Artifacts (build)">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={includeArtifacts} onCheckedChange={setIncludeArtifacts} id="gl-art" />
            <Label htmlFor="gl-art" className="text-xs text-muted-foreground">
              {includeArtifacts ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Stages (one per line)" />
          <Textarea
            value={stages}
            onChange={(e) => setStages(e.target.value)}
            spellCheck={false}
            className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <div className="grid gap-3">
          {includeBefore && (
            <Panel>
              <PanelHeader title="before_script (one cmd per line)" />
              <Textarea
                value={beforeScript}
                onChange={(e) => setBeforeScript(e.target.value)}
                spellCheck={false}
                className="min-h-16 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </Panel>
          )}
          {includeCache && (
            <Panel>
              <PanelHeader title="Cache paths (one per line)" />
              <Textarea
                value={cachePaths}
                onChange={(e) => setCachePaths(e.target.value)}
                spellCheck={false}
                className="min-h-16 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </Panel>
          )}
        </div>
      </div>

      <Panel>
        <PanelHeader title="Jobs">
          <Button variant="secondary" size="sm" onClick={addJob}>
            <Plus className="size-3.5" /> Add job
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {jobs.map((job, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              <Field label="Job name">
                <Input value={job.name} onChange={(e) => updateJob(i, { name: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Stage">
                <Input value={job.stage} onChange={(e) => updateJob(i, { stage: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Image (optional, overrides default)">
                <Input value={job.image} onChange={(e) => updateJob(i, { image: e.target.value })} className="font-mono" />
              </Field>
              <Field label="only branches (comma/line)">
                <Input value={job.only} onChange={(e) => updateJob(i, { only: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Script (one cmd per line)" className="sm:col-span-2">
                <Textarea
                  value={job.script}
                  onChange={(e) => updateJob(i, { script: e.target.value })}
                  spellCheck={false}
                  className="min-h-16 resize-y font-mono text-xs"
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeJob(i)}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
          {jobs.length === 0 && <div className="p-3 text-xs text-muted-foreground">No jobs. Add one above.</div>}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title=".gitlab-ci.yml">
          <CopyButton value={() => yaml} />
          <DownloadButton data={() => yaml} filename=".gitlab-ci.yml" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs">{yaml}</pre>
      </Panel>
    </div>
  );
}
