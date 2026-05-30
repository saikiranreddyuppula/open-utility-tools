'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Parsed {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[]; // dot-separated identifiers
  build: string[];
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

function parse(v: string): Parsed | null {
  const m = v.trim().match(SEMVER_RE);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return null;
  const prerelease = m[4] ? m[4].split('.') : [];
  const build = m[5] ? m[5].split('.') : [];
  return { major, minor, patch, prerelease, build };
}

function stringify(p: Parsed): string {
  let s = `${p.major}.${p.minor}.${p.patch}`;
  if (p.prerelease.length > 0) s += `-${p.prerelease.join('.')}`;
  if (p.build.length > 0) s += `+${p.build.join('.')}`;
  return s;
}

type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';

function bump(p: Parsed, type: ReleaseType, id: string, keepBuild: boolean): Parsed {
  const build = keepBuild ? p.build : [];
  switch (type) {
    case 'major':
      return { major: p.major + 1, minor: 0, patch: 0, prerelease: [], build };
    case 'minor':
      return { major: p.major, minor: p.minor + 1, patch: 0, prerelease: [], build };
    case 'patch':
      // If already a prerelease, patch promotes to the release without incrementing.
      if (p.prerelease.length > 0) {
        return { major: p.major, minor: p.minor, patch: p.patch, prerelease: [], build };
      }
      return { major: p.major, minor: p.minor, patch: p.patch + 1, prerelease: [], build };
    case 'premajor':
      return { major: p.major + 1, minor: 0, patch: 0, prerelease: [id, '0'], build };
    case 'preminor':
      return { major: p.major, minor: p.minor + 1, patch: 0, prerelease: [id, '0'], build };
    case 'prepatch':
      return { major: p.major, minor: p.minor, patch: p.patch + 1, prerelease: [id, '0'], build };
    case 'prerelease': {
      if (p.prerelease.length === 0) {
        // start a new prerelease off the next patch
        return { major: p.major, minor: p.minor, patch: p.patch + 1, prerelease: [id, '0'], build };
      }
      // increment trailing numeric identifier, or append .0
      const pre = [...p.prerelease];
      const lastIdx = pre.length - 1;
      const last = pre[lastIdx];
      if (last !== undefined && /^\d+$/.test(last)) {
        pre[lastIdx] = (Number(last) + 1).toString();
      } else {
        pre.push('0');
      }
      return { major: p.major, minor: p.minor, patch: p.patch, prerelease: pre, build };
    }
    default:
      return p;
  }
}

const TYPES: ReleaseType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

export default function SemverBumpTool() {
  const [version, setVersion] = useState('1.2.3');
  const [id, setId] = useState('alpha');
  const [keepBuild, setKeepBuild] = useState(true);

  const result = useMemo((): { error: string } | { parsed: Parsed; rows: [ReleaseType, string][] } => {
    const p = parse(version);
    if (!p) return { error: 'Enter a valid semver like 1.2.3, 1.2.3-alpha.1, or 1.2.3+build.5' };
    const cleanId = id.trim() || 'alpha';
    const rows = TYPES.map((t) => [t, stringify(bump(p, t, cleanId, keepBuild))] as [ReleaseType, string]);
    return { parsed: p, rows };
  }, [version, id, keepBuild]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Current version" className="min-w-[200px] flex-1">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.3-alpha.1+build.7" className="font-mono" spellCheck={false} />
          </Field>
          <Field label="Prerelease identifier" className="min-w-[160px]">
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="alpha" spellCheck={false} />
          </Field>
          <Field label="Keep build metadata">
            <div className="flex h-9 items-center">
              <Switch checked={keepBuild} onCheckedChange={setKeepBuild} />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Bumped versions">
            <CopyButton value={() => result.rows.map(([t, v]) => `${t}: ${v}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map(([t, v]) => (
              <div key={t} className="flex items-center gap-3 px-3 py-2">
                <span className="w-28 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{t}</span>
                <code className="min-w-0 flex-1 font-mono text-sm">{v}</code>
                <CopyButton value={v} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[
            `${result.parsed.major}.${result.parsed.minor}.${result.parsed.patch}`,
            result.parsed.prerelease.length > 0 ? `pre: ${result.parsed.prerelease.join('.')}` : 'stable',
            result.parsed.build.length > 0 ? `build: ${result.parsed.build.join('.')}` : 'no build',
          ]} />
        </Panel>
      )}
    </div>
  );
}
