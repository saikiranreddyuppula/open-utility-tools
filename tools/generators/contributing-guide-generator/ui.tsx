'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type PM = 'npm' | 'yarn' | 'pnpm' | 'bun';
type Branch = 'prefix' | 'conventional' | 'plain';
type CommitStyle = 'conventional' | 'gitmoji' | 'plain';

const PM_CMDS: Record<PM, { install: string; test: string; dev: string }> = {
  npm: { install: 'npm install', test: 'npm test', dev: 'npm run dev' },
  yarn: { install: 'yarn', test: 'yarn test', dev: 'yarn dev' },
  pnpm: { install: 'pnpm install', test: 'pnpm test', dev: 'pnpm dev' },
  bun: { install: 'bun install', test: 'bun test', dev: 'bun run dev' },
};

const BRANCH_TEXT: Record<Branch, string> = {
  prefix: 'Use a descriptive prefix: `feature/`, `fix/`, `docs/`, or `chore/` followed by a short kebab-case summary, e.g. `feature/csv-export`.',
  conventional: 'Name branches `<type>/<issue-id>-<summary>`, e.g. `feat/142-csv-export`, mirroring our Conventional Commit types.',
  plain: 'Create a topic branch off `main` with a short, descriptive, kebab-case name, e.g. `csv-export`.',
};

const COMMIT_EXAMPLE: Record<CommitStyle, string> = {
  conventional: 'feat(export): add CSV export to the report view',
  gitmoji: ':sparkles: add CSV export to the report view',
  plain: 'Add CSV export to the report view',
};

const COMMIT_TEXT: Record<CommitStyle, string> = {
  conventional: 'Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec: `<type>(<scope>): <description>`.',
  gitmoji: 'Prefix each commit with a relevant [Gitmoji](https://gitmoji.dev/) and a concise, imperative description.',
  plain: 'Write clear, imperative-mood commit subjects under 72 characters, with an optional body explaining *why*.',
};

const DEFAULT_CHECKLIST = [
  'Tests pass locally',
  'New code is covered by tests',
  'Documentation updated where relevant',
  'Linter and formatter run clean',
  'PR description explains the change and links any related issue',
];

export default function ContributingGuideGeneratorTool() {
  const [project, setProject] = useState('Widget');
  const [repoSlug, setRepoSlug] = useState('acme/widget');
  const [pm, setPm] = useState<PM>('pnpm');
  const [branch, setBranch] = useState<Branch>('prefix');
  const [commitStyle, setCommitStyle] = useState<CommitStyle>('conventional');
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST.join('\n'));
  const [coc, setCoc] = useState(true);
  const [dco, setDco] = useState(false);
  const [issueFirst, setIssueFirst] = useState(true);

  const output = useMemo(() => {
    const name = project.trim() || 'this project';
    const slug = repoSlug.trim() || 'OWNER/REPO';
    const cmds = PM_CMDS[pm];
    const lines: string[] = [];

    lines.push(`# Contributing to ${name}`);
    lines.push('');
    lines.push(`Thanks for taking the time to contribute! This guide explains how to set up the project, propose changes, and get them merged.`);
    lines.push('');

    if (issueFirst) {
      lines.push('## Before you start');
      lines.push('');
      lines.push('Please open or comment on an issue before starting non-trivial work so we can align on the approach and avoid duplicated effort.');
      lines.push('');
    }

    lines.push('## Getting set up');
    lines.push('');
    lines.push('1. Fork the repository and clone your fork:');
    lines.push('');
    lines.push('```bash');
    lines.push(`git clone https://github.com/<your-username>/${slug.split('/')[1] ?? 'repo'}.git`);
    lines.push(`cd ${slug.split('/')[1] ?? 'repo'}`);
    lines.push(`git remote add upstream https://github.com/${slug}.git`);
    lines.push('```');
    lines.push('');
    lines.push('2. Install dependencies and run the test suite:');
    lines.push('');
    lines.push('```bash');
    lines.push(cmds.install);
    lines.push(cmds.test);
    lines.push('```');
    lines.push('');
    lines.push('3. Start the local dev environment:');
    lines.push('');
    lines.push('```bash');
    lines.push(cmds.dev);
    lines.push('```');
    lines.push('');

    lines.push('## Branch naming');
    lines.push('');
    lines.push(BRANCH_TEXT[branch]);
    lines.push('');

    lines.push('## Commit messages');
    lines.push('');
    lines.push(COMMIT_TEXT[commitStyle]);
    lines.push('');
    lines.push('Example:');
    lines.push('');
    lines.push('```');
    lines.push(COMMIT_EXAMPLE[commitStyle]);
    lines.push('```');
    lines.push('');

    if (dco) {
      lines.push('All commits must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/). Add a sign-off with:');
      lines.push('');
      lines.push('```bash');
      lines.push('git commit -s -m "your message"');
      lines.push('```');
      lines.push('');
    }

    lines.push('## Pull request checklist');
    lines.push('');
    const items = checklist.split('\n').map((l) => l.trim()).filter(Boolean);
    if (items.length === 0) {
      lines.push('- [ ] Tests pass locally');
    } else {
      for (const item of items) lines.push(`- [ ] ${item}`);
    }
    lines.push('');
    lines.push('Open your PR against the `main` branch and fill in the PR template. A maintainer will review it as soon as possible.');
    lines.push('');

    if (coc) {
      lines.push('## Code of conduct');
      lines.push('');
      lines.push('This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Please report unacceptable behavior to the maintainers.');
      lines.push('');
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }, [project, repoSlug, pm, branch, commitStyle, checklist, coc, dco, issueFirst]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Project name">
          <Input value={project} onChange={(e) => setProject(e.target.value)} className="w-40" />
        </Field>
        <Field label="Repo slug" hint="owner/repo">
          <Input value={repoSlug} onChange={(e) => setRepoSlug(e.target.value)} className="w-44 font-mono" placeholder="owner/repo" />
        </Field>
        <Field label="Package manager">
          <Select value={pm} onValueChange={(v) => setPm(v as PM)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="npm">npm</SelectItem>
              <SelectItem value="yarn">yarn</SelectItem>
              <SelectItem value="pnpm">pnpm</SelectItem>
              <SelectItem value="bun">bun</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Branch convention">
          <Select value={branch} onValueChange={(v) => setBranch(v as Branch)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">feature/ fix/ prefixes</SelectItem>
              <SelectItem value="conventional">type/issue-summary</SelectItem>
              <SelectItem value="plain">plain topic branch</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Commit style">
          <Select value={commitStyle} onValueChange={(v) => setCommitStyle(v as CommitStyle)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conventional">Conventional Commits</SelectItem>
              <SelectItem value="gitmoji">Gitmoji</SelectItem>
              <SelectItem value="plain">Plain</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Code of conduct">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={coc} onCheckedChange={setCoc} id="coc" />
            <Label htmlFor="coc" className="text-xs text-muted-foreground">include section</Label>
          </div>
        </Field>
        <Field label="DCO sign-off">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={dco} onCheckedChange={setDco} id="dco" />
            <Label htmlFor="dco" className="text-xs text-muted-foreground">require sign-off</Label>
          </div>
        </Field>
        <Field label="Issue-first">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={issueFirst} onCheckedChange={setIssueFirst} id="issuefirst" />
            <Label htmlFor="issuefirst" className="text-xs text-muted-foreground">open issue first</Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="PR checklist items (one per line)" />
        <Textarea
          value={checklist}
          onChange={(e) => setChecklist(e.target.value)}
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <Panel>
        <PanelHeader title="CONTRIBUTING.md">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename="CONTRIBUTING.md" />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{output}</pre>
        <StatBar items={[`${output.split('\n').length} lines`, `${pm}`]} />
      </Panel>
    </div>
  );
}
