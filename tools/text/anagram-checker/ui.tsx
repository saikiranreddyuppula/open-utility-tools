'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Options {
  ignoreCase: boolean;
  ignoreSpaces: boolean;
  ignorePunct: boolean;
  ignoreAccents: boolean;
}

type Result =
  | { error: string }
  | {
      isAnagram: boolean;
      normA: string;
      normB: string;
      sigA: string;
      sigB: string;
      extraInA: string;
      extraInB: string;
    };

function normalize(input: string, o: Options): string {
  let s = input;
  if (o.ignoreAccents) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (o.ignoreCase) s = s.toLowerCase();
  if (o.ignoreSpaces) s = s.replace(/\s+/g, '');
  if (o.ignorePunct) s = s.replace(/[^\p{L}\p{N}]/gu, '');
  return s;
}

function counts(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of s) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

function signature(s: string): string {
  return Array.from(s).sort().join('');
}

// Characters present in `a` more times than in `b`.
function diffExtra(a: Map<string, number>, b: Map<string, number>): string {
  const out: string[] = [];
  for (const [ch, n] of a) {
    const surplus = n - (b.get(ch) ?? 0);
    for (let i = 0; i < surplus; i += 1) out.push(ch);
  }
  return out.sort().join('');
}

export default function AnagramCheckerTool() {
  const [a, setA] = useState('Dormitory');
  const [b, setB] = useState('Dirty room');
  const [opts, setOpts] = useState<Options>({
    ignoreCase: true,
    ignoreSpaces: true,
    ignorePunct: true,
    ignoreAccents: true,
  });

  const result = useMemo<Result>(() => {
    if (a.trim().length === 0 || b.trim().length === 0) {
      return { error: 'Enter text in both fields.' };
    }
    const normA = normalize(a, opts);
    const normB = normalize(b, opts);
    const cA = counts(normA);
    const cB = counts(normB);
    const sigA = signature(normA);
    const sigB = signature(normB);
    return {
      isAnagram: sigA === sigB && normA.length > 0,
      normA,
      normB,
      sigA,
      sigB,
      extraInA: diffExtra(cA, cB),
      extraInB: diffExtra(cB, cA),
    };
  }, [a, b, opts]);

  const set = (k: keyof Options) => (v: boolean) =>
    setOpts((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Text A" className="min-w-[220px] flex-1">
            <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="dormitory" />
          </Field>
          <Field label="Text B" className="min-w-[220px] flex-1">
            <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="dirty room" />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Ignore case">
            <div className="flex h-8 items-center">
              <Switch checked={opts.ignoreCase} onCheckedChange={set('ignoreCase')} />
            </div>
          </Field>
          <Field label="Ignore spaces">
            <div className="flex h-8 items-center">
              <Switch checked={opts.ignoreSpaces} onCheckedChange={set('ignoreSpaces')} />
            </div>
          </Field>
          <Field label="Ignore punctuation">
            <div className="flex h-8 items-center">
              <Switch checked={opts.ignorePunct} onCheckedChange={set('ignorePunct')} />
            </div>
          </Field>
          <Field label="Ignore accents">
            <div className="flex h-8 items-center">
              <Switch checked={opts.ignoreAccents} onCheckedChange={set('ignoreAccents')} />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Verdict">
            <CopyButton
              value={() =>
                [
                  `Anagram: ${result.isAnagram ? 'yes' : 'no'}`,
                  `A normalized: ${result.normA}`,
                  `B normalized: ${result.normB}`,
                  `A signature: ${result.sigA}`,
                  `B signature: ${result.sigB}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="p-3">
            <div
              className={
                result.isAnagram
                  ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400'
                  : 'rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400'
              }
            >
              {result.isAnagram
                ? 'These are anagrams of each other.'
                : 'These are NOT anagrams.'}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  A normalized
                </div>
                <div className="break-all font-mono text-sm">{result.normA || '(empty)'}</div>
                <div className="mt-2 text-2xs uppercase tracking-wide text-muted-foreground">
                  Signature
                </div>
                <div className="break-all font-mono text-sm">{result.sigA || '(empty)'}</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  B normalized
                </div>
                <div className="break-all font-mono text-sm">{result.normB || '(empty)'}</div>
                <div className="mt-2 text-2xs uppercase tracking-wide text-muted-foreground">
                  Signature
                </div>
                <div className="break-all font-mono text-sm">{result.sigB || '(empty)'}</div>
              </div>
            </div>
            {!result.isAnagram && (result.extraInA || result.extraInB) && (
              <div className="mt-3 rounded-md border bg-muted/30 p-3 font-mono text-sm">
                {result.extraInA && <div>Only in A: {result.extraInA}</div>}
                {result.extraInB && <div>Only in B: {result.extraInB}</div>}
              </div>
            )}
          </div>
          <StatBar
            items={[
              `A: ${result.normA.length} chars`,
              `B: ${result.normB.length} chars`,
              result.isAnagram ? 'match' : 'differ',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
