'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
}

const FULL_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(v: string): SemVer | null {
  const m = v.trim().replace(/^[v=]+/, '').match(FULL_RE);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (![major, minor, patch].every(Number.isInteger)) return null;
  const prerelease = m[4]
    ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p))
    : [];
  return { major, minor, patch, prerelease };
}

// Returns -1, 0, 1.
function comparePre(a: (string | number)[], b: (string | number)[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // no prerelease > has prerelease
  if (b.length === 0) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = typeof x === 'number';
    const yn = typeof y === 'number';
    if (xn && yn) {
      if (x !== y) return x < y ? -1 : 1;
    } else if (xn) {
      return -1; // numeric < alphanumeric
    } else if (yn) {
      return 1;
    } else {
      if (x !== y) return x < y ? -1 : 1;
    }
  }
  return 0;
}

function compare(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePre(a.prerelease, b.prerelease);
}

type Op = '<' | '<=' | '>' | '>=' | '=';
interface Comparator {
  op: Op;
  ver: SemVer;
}

// Expand a single range token (e.g. "^1.2.3", "~1.2", ">=1.0.0", "1.x", "*") to comparators.
function expandToken(tokenRaw: string): Comparator[] | null {
  const token = tokenRaw.trim();
  if (token === '' || token === '*' || token === 'x' || token === 'X' || token === 'latest') {
    return [{ op: '>=', ver: { major: 0, minor: 0, patch: 0, prerelease: [] } }];
  }

  // operator-prefixed comparator: >=, <=, >, <, =
  const opMatch = token.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (opMatch) {
    const op = opMatch[1] as Op;
    const rest = opMatch[2] ?? '';
    const filled = fillPartial(rest);
    if (!filled) return null;
    return [{ op, ver: filled }];
  }

  // caret ^1.2.3
  if (token.startsWith('^')) {
    const v = fillPartial(token.slice(1));
    if (!v) return null;
    const upper = caretUpper(v);
    return [
      { op: '>=', ver: v },
      { op: '<', ver: upper },
    ];
  }

  // tilde ~1.2.3
  if (token.startsWith('~')) {
    const v = fillPartial(token.slice(1));
    if (!v) return null;
    const upper = tildeUpper(token.slice(1), v);
    return [
      { op: '>=', ver: v },
      { op: '<', ver: upper },
    ];
  }

  // plain / x-range like "1", "1.2", "1.x", "1.2.x"
  return xRange(token);
}

function partsOf(s: string): { major?: number; minor?: number; patch?: number; pre: (string | number)[] } | null {
  const cleaned = s.trim().replace(/^[v=]+/, '');
  const m = cleaned.match(/^(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  const toNum = (p: string | undefined): number | undefined => {
    if (p === undefined || p === 'x' || p === 'X' || p === '*') return undefined;
    const n = Number(p);
    return Number.isInteger(n) ? n : undefined;
  };
  const major = toNum(m[1]);
  const minor = toNum(m[2]);
  const patch = toNum(m[3]);
  const pre = m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  // if a part is x but raw was actually a number-ish that failed, ensure first token present
  if (m[1] === undefined) return null;
  return { major, minor, patch, pre };
}

function fillPartial(s: string): SemVer | null {
  const p = partsOf(s);
  if (!p) return null;
  return {
    major: p.major ?? 0,
    minor: p.minor ?? 0,
    patch: p.patch ?? 0,
    prerelease: p.pre,
  };
}

function caretUpper(v: SemVer): SemVer {
  if (v.major > 0) return { major: v.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (v.minor > 0) return { major: 0, minor: v.minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: v.patch + 1, prerelease: [] };
}

function tildeUpper(raw: string, v: SemVer): SemVer {
  const p = partsOf(raw);
  // ~1.2.3 => <1.3.0 ; ~1.2 => <1.3.0 ; ~1 => <2.0.0
  if (p && p.minor !== undefined) {
    return { major: v.major, minor: v.minor + 1, patch: 0, prerelease: [] };
  }
  return { major: v.major + 1, minor: 0, patch: 0, prerelease: [] };
}

function xRange(token: string): Comparator[] | null {
  const p = partsOf(token);
  if (!p) return null;
  const zero: SemVer = { major: p.major ?? 0, minor: p.minor ?? 0, patch: p.patch ?? 0, prerelease: p.pre };
  // fully specified -> exact match
  if (p.major !== undefined && p.minor !== undefined && p.patch !== undefined) {
    return [{ op: '=', ver: zero }];
  }
  // major.minor.x -> >=major.minor.0 <major.(minor+1).0
  if (p.major !== undefined && p.minor !== undefined) {
    return [
      { op: '>=', ver: { major: p.major, minor: p.minor, patch: 0, prerelease: [] } },
      { op: '<', ver: { major: p.major, minor: p.minor + 1, patch: 0, prerelease: [] } },
    ];
  }
  // major.x -> >=major.0.0 <(major+1).0.0
  if (p.major !== undefined) {
    return [
      { op: '>=', ver: { major: p.major, minor: 0, patch: 0, prerelease: [] } },
      { op: '<', ver: { major: p.major + 1, minor: 0, patch: 0, prerelease: [] } },
    ];
  }
  // * -> any
  return [{ op: '>=', ver: { major: 0, minor: 0, patch: 0, prerelease: [] } }];
}

// A comparator set is an AND of comparators. The full range is an OR of sets.
function parseRange(range: string): Comparator[][] | null {
  const orParts = range.split('||');
  const sets: Comparator[][] = [];
  for (const orPart of orParts) {
    const trimmed = orPart.trim();
    // hyphen range "a - b"
    const hyphen = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
    if (hyphen) {
      const lo = fillPartial(hyphen[1] ?? '');
      const hiParts = partsOf(hyphen[2] ?? '');
      const hiFull = fillPartial(hyphen[2] ?? '');
      if (!lo || !hiParts || !hiFull) return null;
      const comps: Comparator[] = [{ op: '>=', ver: lo }];
      // upper bound: if patch omitted, < next minor; if minor omitted, < next major; else <= hi
      if (hiParts.patch === undefined && hiParts.minor !== undefined) {
        comps.push({ op: '<', ver: { major: hiFull.major, minor: hiFull.minor + 1, patch: 0, prerelease: [] } });
      } else if (hiParts.minor === undefined) {
        comps.push({ op: '<', ver: { major: hiFull.major + 1, minor: 0, patch: 0, prerelease: [] } });
      } else {
        comps.push({ op: '<=', ver: hiFull });
      }
      sets.push(comps);
      continue;
    }
    // space-separated comparators (AND)
    const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) {
      sets.push([{ op: '>=', ver: { major: 0, minor: 0, patch: 0, prerelease: [] } }]);
      continue;
    }
    const comps: Comparator[] = [];
    for (const t of tokens) {
      const expanded = expandToken(t);
      if (!expanded) return null;
      comps.push(...expanded);
    }
    sets.push(comps);
  }
  return sets;
}

function sameTuple(a: SemVer, b: SemVer): boolean {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

function evalOp(v: SemVer, c: Comparator): boolean {
  const cmp = compare(v, c.ver);
  switch (c.op) {
    case '<': return cmp < 0;
    case '<=': return cmp <= 0;
    case '>': return cmp > 0;
    case '>=': return cmp >= 0;
    case '=': return cmp === 0;
    default: return false;
  }
}

// npm rule: a prerelease version may satisfy a comparator set only if at least one comparator
// in that set carries a prerelease tag on the exact same [major,minor,patch] tuple.
function satisfiesSet(v: SemVer, set: Comparator[]): boolean {
  if (v.prerelease.length > 0) {
    const allowed = set.some((c) => c.ver.prerelease.length > 0 && sameTuple(v, c.ver));
    if (!allowed) return false;
  }
  return set.every((c) => evalOp(v, c));
}

function satisfies(v: SemVer, sets: Comparator[][]): boolean {
  return sets.some((set) => satisfiesSet(v, set));
}

function verStr(v: SemVer): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease.length > 0) s += `-${v.prerelease.join('.')}`;
  return s;
}

function boundsLabel(sets: Comparator[][]): string {
  return sets
    .map((set) => set.map((c) => `${c.op}${verStr(c.ver)}`).join(' '))
    .join(' || ');
}

interface CandResult {
  raw: string;
  ok: boolean;
  valid: boolean;
}

export default function SemverRangeTesterTool() {
  const [range, setRange] = useState('^1.2.3');
  const [candidates, setCandidates] = useState('1.2.2\n1.2.3\n1.5.0\n2.0.0\n2.0.0-alpha.1\n1.9.9');

  const parsed = useMemo(() => parseRange(range), [range]);

  const results = useMemo((): CandResult[] => {
    if (!parsed) return [];
    const out: CandResult[] = [];
    for (const line of candidates.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const v = parseVersion(t);
      if (!v) { out.push({ raw: t, ok: false, valid: false }); continue; }
      out.push({ raw: t, ok: satisfies(v, parsed), valid: true });
    }
    return out;
  }, [parsed, candidates]);

  const error = parsed === null ? 'Could not parse the range. Use ^, ~, >=, <, =, x/*, hyphen (a - b), or || sets.' : null;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Range" className="min-w-[220px] flex-1" hint="e.g. ^1.2.3, ~1.2, >=1.0.0 <2.0.0, 1.x, 1.2 - 1.5, ^1 || ^2">
            <Input value={range} onChange={(e) => setRange(e.target.value)} className="font-mono" spellCheck={false} />
          </Field>
        </OptionsBar>
        <div className="p-3 pt-0">
          <Field label="Candidate versions (one per line)">
            <Textarea value={candidates} onChange={(e) => setCandidates(e.target.value)} spellCheck={false} className="min-h-[140px] font-mono text-xs" />
          </Field>
        </div>
      </Panel>

      {error ? (
        <ErrorBanner error={error} />
      ) : (
        <Panel>
          <PanelHeader title="Satisfaction">
            <CopyButton value={() => results.map((r) => `${r.raw}\t${!r.valid ? 'invalid' : r.ok ? 'satisfies' : 'no'}`).join('\n')} />
          </PanelHeader>
          <div className="border-b bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Expands to: </span>
            <code className="font-mono">{parsed ? boundsLabel(parsed) : ''}</code>
          </div>
          <div className="divide-y">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">Enter candidate versions to test.</div>
            ) : results.map((r) => (
              <div key={r.raw} className="flex items-center gap-3 px-3 py-2">
                <code className="w-48 shrink-0 break-all font-mono text-sm">{r.raw}</code>
                {!r.valid ? (
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">invalid version</span>
                ) : r.ok ? (
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">satisfies</span>
                ) : (
                  <span className="rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">does not satisfy</span>
                )}
              </div>
            ))}
          </div>
          <StatBar items={[`${results.filter((r) => r.valid && r.ok).length} satisfy`, `${results.filter((r) => r.valid).length} valid`]} />
        </Panel>
      )}
    </div>
  );
}
