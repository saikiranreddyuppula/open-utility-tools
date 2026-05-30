'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'permute' | 'combine';

const CAP = 5000;

// Distinct permutations of a multiset of characters (Heap-style with dedupe via Set).
function permutations(letters: string[], cap: number): { items: string[]; truncated: boolean } {
  const out: string[] = [];
  const seen = new Set<string>();
  const arr = [...letters].sort();
  const used = new Array<boolean>(arr.length).fill(false);
  const cur: string[] = [];
  let truncated = false;

  const recurse = () => {
    if (truncated) return;
    if (cur.length === arr.length) {
      const s = cur.join('');
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
        if (out.length >= cap) truncated = true;
      }
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      if (used[i]) continue;
      // Skip duplicate letters at the same recursion depth to avoid repeats.
      if (i > 0 && arr[i] === arr[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      cur.push(arr[i] ?? '');
      recurse();
      cur.pop();
      used[i] = false;
      if (truncated) return;
    }
  };

  recurse();
  return { items: out, truncated };
}

// Distinct combinations (sub-multisets rendered as sorted strings) of a chosen length.
function combinations(
  letters: string[],
  k: number,
  cap: number
): { items: string[]; truncated: boolean } {
  const arr = [...letters].sort();
  const out: string[] = [];
  const cur: string[] = [];
  let truncated = false;

  const recurse = (start: number) => {
    if (truncated) return;
    if (cur.length === k) {
      out.push(cur.join(''));
      if (out.length >= cap) truncated = true;
      return;
    }
    let prev = '';
    for (let i = start; i < arr.length; i++) {
      const ch = arr[i] ?? '';
      // Skip duplicate letter at the same position to keep combinations distinct.
      if (ch === prev) continue;
      prev = ch;
      cur.push(ch);
      recurse(i + 1);
      cur.pop();
      if (truncated) return;
    }
  };

  recurse(0);
  return { items: out, truncated };
}

export default function AnagramSolver() {
  const [raw, setRaw] = useState('listen');
  const [mode, setMode] = useState<Mode>('permute');
  const [comboLen, setComboLen] = useState('3');

  const result = useMemo(() => {
    const letters = (raw.toLowerCase().match(/[a-z0-9]/g) ?? []);
    if (letters.length === 0) return { error: 'Enter some letters (a–z or digits) to rearrange.' };
    if (letters.length > 9)
      return {
        error: `Too many letters (${letters.length}). Limit to 9 to keep the permutation count manageable.`,
      };

    if (mode === 'permute') {
      const { items, truncated } = permutations(letters, CAP);
      return { items, truncated, mode, letterCount: letters.length };
    }

    const k = Math.trunc(Number(comboLen) || 0);
    if (!Number.isFinite(k) || k < 1) return { error: 'Choose a combination length of at least 1.' };
    if (k > letters.length)
      return { error: `Length ${k} exceeds the ${letters.length} available letters.` };
    const { items, truncated } = combinations(letters, k, CAP);
    return { items, truncated, mode, letterCount: letters.length };
  }, [raw, mode, comboLen]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Letters" className="min-w-[200px] flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono"
              placeholder="e.g. listen"
            />
          </Field>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="permute">Permutations</TabsTrigger>
                <TabsTrigger value="combine">Combinations</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'combine' && (
            <Field label="Length">
              <Input
                value={comboLen}
                onChange={(e) => setComboLen(e.target.value)}
                inputMode="numeric"
                className="w-20 font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader
            title={mode === 'permute' ? 'Rearrangements' : 'Letter combinations'}
          >
            <CopyButton value={() => result.items.join('\n')} />
            <DownloadButton data={() => result.items.join('\n')} filename="anagrams.txt" />
          </PanelHeader>
          {result.truncated && (
            <div className="border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
              Showing the first {CAP.toLocaleString()} results (output capped for performance).
            </div>
          )}
          <div className="max-h-[420px] overflow-auto p-3">
            {result.items.length === 0 ? (
              <span className="text-sm text-muted-foreground">No candidates.</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {result.items.map((s, i) => (
                  <code
                    key={`${s}-${i}`}
                    className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-sm"
                  >
                    {s}
                  </code>
                ))}
              </div>
            )}
          </div>
          <StatBar
            items={[
              `letters = ${result.letterCount}`,
              `${result.items.length.toLocaleString()} candidate${result.items.length === 1 ? '' : 's'}`,
              result.truncated ? `capped at ${CAP.toLocaleString()}` : false,
              'offline — not dictionary-validated',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
