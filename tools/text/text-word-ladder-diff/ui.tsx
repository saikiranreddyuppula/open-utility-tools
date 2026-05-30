'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

// Split into word tokens, keeping a separate "key" for comparison.
function tokenize(text: string): string[] {
  // Words and whitespace runs as separate tokens so spacing is preserved.
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function normalize(tok: string, ignoreCase: boolean, ignorePunct: boolean): string {
  let k = tok;
  if (ignorePunct) k = k.replace(/[^\p{L}\p{N}\s]/gu, '');
  if (ignoreCase) k = k.toLowerCase();
  return k;
}

interface Op {
  kind: 'eq' | 'del' | 'ins';
  tok: string;
}

// LCS-based diff over token key arrays.
function diffTokens(a: string[], b: string[], ka: string[], kb: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    const rowI = dp[i];
    const rowI1 = dp[i + 1];
    if (!rowI || !rowI1) continue;
    for (let j = m - 1; j >= 0; j -= 1) {
      if ((ka[i] ?? '') === (kb[j] ?? '')) {
        rowI[j] = (rowI1[j + 1] ?? 0) + 1;
      } else {
        rowI[j] = Math.max(rowI1[j] ?? 0, rowI[j + 1] ?? 0);
      }
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if ((ka[i] ?? '') === (kb[j] ?? '')) {
      ops.push({ kind: 'eq', tok: b[j] ?? '' });
      i += 1;
      j += 1;
    } else {
      const down = dp[i + 1]?.[j] ?? 0;
      const right = dp[i]?.[j + 1] ?? 0;
      if (down >= right) {
        ops.push({ kind: 'del', tok: a[i] ?? '' });
        i += 1;
      } else {
        ops.push({ kind: 'ins', tok: b[j] ?? '' });
        j += 1;
      }
    }
  }
  while (i < n) {
    ops.push({ kind: 'del', tok: a[i] ?? '' });
    i += 1;
  }
  while (j < m) {
    ops.push({ kind: 'ins', tok: b[j] ?? '' });
    j += 1;
  }
  return ops;
}

export default function WordDiffTool() {
  const [original, setOriginal] = useState(
    'The quick brown fox jumps over the lazy dog.'
  );
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignorePunct, setIgnorePunct] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!original.trim() && !input.trim()) return '';
      const a = tokenize(original);
      const b = tokenize(input);
      const ka = a.map((t) => normalize(t, ignoreCase, ignorePunct));
      const kb = b.map((t) => normalize(t, ignoreCase, ignorePunct));
      const ops = diffTokens(a, b, ka, kb);

      let added = 0;
      let removed = 0;
      const parts: string[] = [];
      for (const op of ops) {
        if (op.kind === 'eq') {
          parts.push(op.tok);
        } else if (op.kind === 'del') {
          if (op.tok.trim().length > 0) removed += 1;
          parts.push(`[-${op.tok}-]`);
        } else {
          if (op.tok.trim().length > 0) added += 1;
          parts.push(`{+${op.tok}+}`);
        }
      }
      const header = `# +${added} added · -${removed} removed`;
      return `${header}\n${parts.join('')}`;
    },
    [original, ignoreCase, ignorePunct]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[original, ignoreCase, ignorePunct]}
      inputLabel="Revised text"
      outputLabel="Inline diff"
      sample={'The quick brown fox leaps over a lazy dog!'}
      downloadName="word-diff.txt"
      options={
        <>
          <Field label="Original text" className="min-w-[280px] flex-1">
            <Textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              spellCheck={false}
              className="h-20 font-mono text-xs"
              placeholder="Paste the original text here…"
            />
          </Field>
          <Field label="Ignore case">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={ignoreCase} onCheckedChange={setIgnoreCase} id="wd-case" />
              <Label htmlFor="wd-case" className="text-xs text-muted-foreground">
                Case-insensitive
              </Label>
            </div>
          </Field>
          <Field label="Ignore punctuation">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={ignorePunct} onCheckedChange={setIgnorePunct} id="wd-punct" />
              <Label htmlFor="wd-punct" className="text-xs text-muted-foreground">
                Strip symbols
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
