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
import { DownloadButton } from '@/components/tools/download-button';

const GROUPS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'] as const;
type Group = (typeof GROUPS)[number];

interface Release {
  id: number;
  version: string;
  date: string;
  // One bullet block of text per group; blank lines ignored.
  entries: Record<Group, string>;
}

function emptyEntries(): Record<Group, string> {
  return { Added: '', Changed: '', Deprecated: '', Removed: '', Fixed: '', Security: '' };
}

let nextId = 3;

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x, 10));
  const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x, 10));
  for (let i = 0; i < 3; i++) {
    const na = Number.isFinite(pa[i]) ? (pa[i] ?? 0) : 0;
    const nb = Number.isFinite(pb[i]) ? (pb[i] ?? 0) : 0;
    if (na !== nb) return nb - na; // descending
  }
  return 0;
}

export default function ChangelogGeneratorTool() {
  const [unreleased, setUnreleased] = useState('First-pass docs\nRefactor build pipeline');
  const [sortDesc, setSortDesc] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(true);
  const [repoUrl, setRepoUrl] = useState('https://github.com/acme/widget');
  const [releases, setReleases] = useState<Release[]>([
    {
      id: 1,
      version: '1.1.0',
      date: '2026-05-20',
      entries: {
        ...emptyEntries(),
        Added: 'Dark mode toggle\nCSV export',
        Fixed: 'Crash when filtering empty lists',
      },
    },
    {
      id: 2,
      version: '1.0.0',
      date: '2026-04-01',
      entries: { ...emptyEntries(), Added: 'Initial public release' },
    },
  ]);

  const addRelease = () =>
    setReleases((prev) => [
      ...prev,
      { id: nextId++, version: '0.0.0', date: new Date().toISOString().slice(0, 10), entries: emptyEntries() },
    ]);

  const removeRelease = (id: number) => setReleases((prev) => prev.filter((r) => r.id !== id));

  const update = (id: number, patch: Partial<Release>) =>
    setReleases((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateEntry = (id: number, group: Group, value: string) =>
    setReleases((prev) =>
      prev.map((r) => (r.id === id ? { ...r, entries: { ...r.entries, [group]: value } } : r))
    );

  const output = useMemo(() => {
    const lines: string[] = [];
    lines.push('# Changelog');
    lines.push('');
    lines.push('All notable changes to this project are documented here.');
    lines.push('');
    lines.push(
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),'
    );
    lines.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
    lines.push('');

    const renderGroups = (entries: Record<Group, string>) => {
      for (const g of GROUPS) {
        const bullets = entries[g]
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        if (bullets.length === 0) continue;
        lines.push(`### ${g}`);
        for (const b of bullets) lines.push(`- ${b}`);
        lines.push('');
      }
    };

    // Unreleased section.
    lines.push('## [Unreleased]');
    lines.push('');
    const unrel = unreleased
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (unrel.length > 0) {
      for (const b of unrel) lines.push(`- ${b}`);
      lines.push('');
    }

    const ordered = sortDesc
      ? [...releases].sort((a, b) => compareSemver(a.version, b.version))
      : releases;

    for (const r of ordered) {
      const ver = r.version.trim() || '0.0.0';
      const date = r.date.trim();
      lines.push(`## [${ver}]${date ? ` - ${date}` : ''}`);
      lines.push('');
      renderGroups(r.entries);
    }

    if (includeLinks && repoUrl.trim()) {
      const base = repoUrl.trim().replace(/\/$/, '');
      const refs: string[] = [];
      const versions = ordered.map((r) => r.version.trim() || '0.0.0');
      const latest = versions[0];
      refs.push(`[unreleased]: ${base}/compare/v${latest ?? '0.0.0'}...HEAD`);
      for (let i = 0; i < ordered.length; i++) {
        const cur = versions[i] ?? '0.0.0';
        const prev = versions[i + 1];
        if (prev) refs.push(`[${cur}]: ${base}/compare/v${prev}...v${cur}`);
        else refs.push(`[${cur}]: ${base}/releases/tag/v${cur}`);
      }
      lines.push(...refs);
      lines.push('');
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }, [unreleased, releases, sortDesc, includeLinks, repoUrl]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Sort versions">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={sortDesc} onCheckedChange={setSortDesc} id="sort" />
            <Label htmlFor="sort" className="text-xs text-muted-foreground">descending (SemVer)</Label>
          </div>
        </Field>
        <Field label="Comparison links">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={includeLinks} onCheckedChange={setIncludeLinks} id="links" />
            <Label htmlFor="links" className="text-xs text-muted-foreground">reference footnotes</Label>
          </div>
        </Field>
        <Field label="Repository URL" className="min-w-[260px] flex-1">
          <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="font-mono" placeholder="https://github.com/owner/repo" />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Unreleased changes (one bullet per line)" />
        <Textarea
          value={unreleased}
          onChange={(e) => setUnreleased(e.target.value)}
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {releases.map((r) => (
        <Panel key={r.id}>
          <PanelHeader title="Release">
            <Button variant="ghost" size="icon-sm" onClick={() => removeRelease(r.id)} aria-label="Remove release">
              <Trash2 className="size-3.5" />
            </Button>
          </PanelHeader>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap gap-3">
              <Field label="Version">
                <Input value={r.version} onChange={(e) => update(r.id, { version: e.target.value })} className="w-32 font-mono" placeholder="1.2.3" />
              </Field>
              <Field label="Date">
                <Input value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} className="w-40 font-mono" placeholder="2026-01-31" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GROUPS.map((g) => (
                <Field key={g} label={g}>
                  <Textarea
                    value={r.entries[g]}
                    onChange={(e) => updateEntry(r.id, g, e.target.value)}
                    spellCheck={false}
                    placeholder="one bullet per line"
                    className="min-h-16 resize-y font-mono text-xs"
                  />
                </Field>
              ))}
            </div>
          </div>
        </Panel>
      ))}

      <div>
        <Button variant="secondary" size="sm" onClick={addRelease}>
          <Plus className="size-3.5" />
          Add release
        </Button>
      </div>

      <Panel>
        <PanelHeader title="CHANGELOG.md">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename="CHANGELOG.md" />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{output}</pre>
        <StatBar items={[`${releases.length} releases`, `${output.split('\n').length} lines`]} />
      </Panel>
    </div>
  );
}
