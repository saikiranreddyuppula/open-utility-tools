'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Equal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
}

const SEMVER_RE =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseSemver(raw: string): SemVer {
  const v = raw.trim().replace(/^[v=]+/, '');
  const m = SEMVER_RE.exec(v);
  if (!m) {
    throw new Error(
      `"${raw}" is not a valid semantic version. Expected MAJOR.MINOR.PATCH (e.g. 1.2.3, 2.0.0-rc.1).`,
    );
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    throw new Error(`"${raw}" has non-numeric version core.`);
  }
  const prerelease = m[4] ? m[4].split('.') : [];
  const build = m[5] ? m[5].split('.') : [];
  return { major, minor, patch, prerelease, build };
}

function isNumericId(s: string): boolean {
  return /^\d+$/.test(s);
}

/** Compare prerelease identifier arrays per semver spec. Returns -1/0/1. */
function comparePrerelease(a: string[], b: string[]): number {
  // A version with a prerelease has LOWER precedence than one without.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // a is the release => greater
  if (b.length === 0) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined) return -1; // a ran out => fewer fields => lower
    if (bi === undefined) return 1;
    const aNum = isNumericId(ai);
    const bNum = isNumericId(bi);
    if (aNum && bNum) {
      const an = Number(ai);
      const bn = Number(bi);
      if (an !== bn) return an < bn ? -1 : 1;
    } else if (aNum && !bNum) {
      return -1; // numeric < alphanumeric
    } else if (!aNum && bNum) {
      return 1;
    } else {
      if (ai !== bi) return ai < bi ? -1 : 1;
    }
  }
  return 0;
}

/** Full semver comparison. Build metadata is ignored per spec. Returns -1/0/1. */
function compareSemver(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

function formatCore(v: SemVer): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease.length) s += `-${v.prerelease.join('.')}`;
  return s;
}

/** Evaluate a single comparator like ">=1.2.0" against a parsed version. */
function satisfiesComparator(version: SemVer, comparator: string): boolean {
  const c = comparator.trim();
  if (!c) return true;
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(c);
  if (!m) throw new Error(`Cannot parse range comparator "${comparator}".`);
  const op = m[1] ?? '=';
  const target = parseSemver(m[2] ?? '');
  const cmp = compareSemver(version, target);
  switch (op) {
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '=':
      return cmp === 0;
    case '^': {
      // Caret: compatible within the same left-most non-zero element.
      if (cmp < 0) return false;
      if (target.major > 0) return version.major === target.major;
      if (target.minor > 0) return version.major === 0 && version.minor === target.minor;
      return version.major === 0 && version.minor === 0 && version.patch === target.patch;
    }
    case '~': {
      // Tilde: allows patch-level changes within the given minor.
      if (cmp < 0) return false;
      return version.major === target.major && version.minor === target.minor;
    }
    default:
      return false;
  }
}

/** A range is space-separated comparators (AND), with "||" between alternatives (OR). */
function satisfiesRange(version: SemVer, range: string): boolean {
  const trimmed = range.trim();
  if (!trimmed) return true;
  const orParts = trimmed.split('||');
  return orParts.some((part) => {
    const andParts = part.trim().split(/\s+/).filter(Boolean);
    if (andParts.length === 0) return true;
    return andParts.every((cmp) => satisfiesComparator(version, cmp));
  });
}

export default function SemverCompareTool() {
  const [versionA, setVersionA] = useState('1.2.3');
  const [versionB, setVersionB] = useState('1.2.10');
  const [range, setRange] = useState('^1.0.0');

  const result = useMemo(() => {
    let parsedA: SemVer | null = null;
    let parsedB: SemVer | null = null;
    let aError: string | null = null;
    let bError: string | null = null;
    try {
      parsedA = parseSemver(versionA);
    } catch (e) {
      aError = e instanceof Error ? e.message : String(e);
    }
    try {
      parsedB = parseSemver(versionB);
    } catch (e) {
      bError = e instanceof Error ? e.message : String(e);
    }

    let comparison: number | null = null;
    if (parsedA && parsedB) comparison = compareSemver(parsedA, parsedB);

    let rangeMatch: boolean | null = null;
    let rangeError: string | null = null;
    if (parsedA && range.trim()) {
      try {
        rangeMatch = satisfiesRange(parsedA, range);
      } catch (e) {
        rangeError = e instanceof Error ? e.message : String(e);
      }
    }

    return { parsedA, parsedB, aError, bError, comparison, rangeMatch, rangeError };
  }, [versionA, versionB, range]);

  const { parsedA, parsedB, aError, bError, comparison, rangeMatch, rangeError } = result;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Versions" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Version A">
            <Input
              value={versionA}
              onChange={(e) => setVersionA(e.target.value)}
              placeholder="1.2.3"
              spellCheck={false}
            />
          </Field>
          <Field label="Version B">
            <Input
              value={versionB}
              onChange={(e) => setVersionB(e.target.value)}
              placeholder="1.3.0"
              spellCheck={false}
            />
          </Field>
        </div>
        <ErrorBanner error={aError ?? bError} />
        {comparison !== null && parsedA && parsedB ? (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-md border border-border bg-muted/40 p-4 text-lg font-medium">
            <span className="font-mono">{formatCore(parsedA)}</span>
            {comparison === 0 ? (
              <Equal className="h-5 w-5 text-muted-foreground" />
            ) : comparison < 0 ? (
              <ChevronLeft className="h-5 w-5 text-primary" />
            ) : (
              <ChevronRight className="h-5 w-5 text-primary" />
            )}
            <span className="font-mono">{formatCore(parsedB)}</span>
            <span className="ml-2 text-sm text-muted-foreground">
              {comparison === 0
                ? 'equal'
                : comparison < 0
                  ? 'A is lower'
                  : 'A is greater'}
            </span>
          </div>
        ) : null}
      </Panel>

      {parsedA ? (
        <Panel>
          <PanelHeader title="Parsed — Version A" />
          <StatBar
            items={[
              `major ${parsedA.major}`,
              `minor ${parsedA.minor}`,
              `patch ${parsedA.patch}`,
              parsedA.prerelease.length > 0 && `prerelease ${parsedA.prerelease.join('.')}`,
              parsedA.build.length > 0 && `build ${parsedA.build.join('.')}`,
            ]}
          />
        </Panel>
      ) : null}

      {parsedB ? (
        <Panel>
          <PanelHeader title="Parsed — Version B" />
          <StatBar
            items={[
              `major ${parsedB.major}`,
              `minor ${parsedB.minor}`,
              `patch ${parsedB.patch}`,
              parsedB.prerelease.length > 0 && `prerelease ${parsedB.prerelease.join('.')}`,
              parsedB.build.length > 0 && `build ${parsedB.build.join('.')}`,
            ]}
          />
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Range test (against Version A)" />
        <Field
          label="Range"
          hint="Supports >, >=, <, <=, =, ^, ~ and space-separated (AND) / || (OR) comparators."
        >
          <Input
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder="^1.0.0 || >=2.0.0 <3.0.0"
            spellCheck={false}
          />
        </Field>
        <ErrorBanner error={rangeError} />
        {rangeMatch !== null && parsedA && !rangeError ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{formatCore(parsedA)}</span>
            <span
              className={
                rangeMatch ? 'font-medium text-emerald-600' : 'font-medium text-red-600'
              }
            >
              {rangeMatch ? 'satisfies' : 'does NOT satisfy'}
            </span>
            <span className="font-mono">{range.trim()}</span>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
