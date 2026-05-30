'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = 'A man, a plan, a canal: Panama';

function normalize(
  text: string,
  ignoreCase: boolean,
  ignoreSpaces: boolean,
  ignorePunct: boolean
): string {
  let s = text;
  if (ignorePunct) {
    // Strip diacritics, then drop anything that is not a letter or digit.
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/[^\p{L}\p{N}\s]/gu, '');
  }
  if (ignoreSpaces) s = s.replace(/\s+/g, '');
  if (ignoreCase) s = s.toLowerCase();
  return s;
}

function reverse(s: string): string {
  return Array.from(s).reverse().join('');
}

function isPalin(s: string): boolean {
  return s.length > 0 && s === reverse(s);
}

// Longest palindromic substring via expand-around-center (operates on the normalized string).
function longestPalindrome(s: string): { sub: string; len: number } {
  const chars = Array.from(s);
  const n = chars.length;
  if (n === 0) return { sub: '', len: 0 };
  let bestStart = 0;
  let bestLen = 1;
  const expand = (lo: number, hi: number) => {
    let l = lo;
    let r = hi;
    while (l >= 0 && r < n && chars[l] === chars[r]) {
      l--;
      r++;
    }
    const len = r - l - 1;
    if (len > bestLen) {
      bestLen = len;
      bestStart = l + 1;
    }
  };
  for (let i = 0; i < n; i++) {
    expand(i, i);
    expand(i, i + 1);
  }
  return { sub: chars.slice(bestStart, bestStart + bestLen).join(''), len: bestLen };
}

export default function PalindromeChecker() {
  const [text, setText] = useState(SAMPLE);
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [ignoreSpaces, setIgnoreSpaces] = useState(true);
  const [ignorePunct, setIgnorePunct] = useState(true);

  const result = useMemo(() => {
    const raw = text.trim();
    if (!raw) return { error: 'Enter some text to analyze.' };

    const norm = normalize(text, ignoreCase, ignoreSpaces, ignorePunct);
    if (norm.length === 0) return { error: 'Nothing left to compare after normalization.' };

    const whole = isPalin(norm);

    // Word scan: each word individually, normalized the same way.
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const palinWords: string[] = [];
    const seen = new Set<string>();
    for (const w of words) {
      const nw = normalize(w, ignoreCase, ignoreSpaces, ignorePunct);
      if (nw.length >= 2 && isPalin(nw) && !seen.has(nw)) {
        seen.add(nw);
        palinWords.push(w);
      }
    }

    const longest = longestPalindrome(norm);

    return {
      whole,
      norm,
      reversed: reverse(norm),
      palinWords,
      longest,
      wordCount: words.length,
    };
  }, [text, ignoreCase, ignoreSpaces, ignorePunct]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={4}
            className="font-mono"
            placeholder="Enter text to check…"
          />
        </div>
        <OptionsBar className="rounded-none border-x-0 border-b-0">
          <Field label="Ignore case">
            <div className="flex h-8 items-center gap-2">
              <Switch id="ic" checked={ignoreCase} onCheckedChange={setIgnoreCase} />
              <Label htmlFor="ic" className="text-xs text-muted-foreground">
                A = a
              </Label>
            </div>
          </Field>
          <Field label="Ignore spaces">
            <div className="flex h-8 items-center gap-2">
              <Switch id="is" checked={ignoreSpaces} onCheckedChange={setIgnoreSpaces} />
              <Label htmlFor="is" className="text-xs text-muted-foreground">
                Drop whitespace
              </Label>
            </div>
          </Field>
          <Field label="Ignore punctuation">
            <div className="flex h-8 items-center gap-2">
              <Switch id="ip" checked={ignorePunct} onCheckedChange={setIgnorePunct} />
              <Label htmlFor="ip" className="text-xs text-muted-foreground">
                Letters &amp; digits only
              </Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                [
                  `Palindrome: ${result.whole ? 'YES' : 'NO'}`,
                  `Normalized: ${result.norm}`,
                  `Longest palindromic substring: "${result.longest.sub}" (${result.longest.len})`,
                  `Palindromic words: ${result.palinWords.join(', ') || '(none)'}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div
              className={
                result.whole
                  ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium'
                  : 'rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium'
              }
            >
              {result.whole
                ? 'This text IS a palindrome (after normalization).'
                : 'This text is NOT a palindrome.'}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  Normalized
                </div>
                <code className="break-all font-mono text-sm">{result.norm || '—'}</code>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  Reversed
                </div>
                <code className="break-all font-mono text-sm">{result.reversed || '—'}</code>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                  Longest palindromic substring
                </span>
                <CopyButton value={result.longest.sub} size="icon-sm" />
              </div>
              <code className="break-all font-mono text-sm">
                {result.longest.sub || '—'}{' '}
                <span className="text-muted-foreground">({result.longest.len} chars)</span>
              </code>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Palindromic words ({result.palinWords.length})
              </div>
              {result.palinWords.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {result.palinWords.map((w, i) => (
                    <code
                      key={`${w}-${i}`}
                      className="rounded bg-background px-1.5 py-0.5 font-mono text-xs"
                    >
                      {w}
                    </code>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No multi-letter palindrome words.</span>
              )}
            </div>
          </div>
          <StatBar
            items={[
              `verdict = ${result.whole ? 'palindrome' : 'not'}`,
              `words = ${result.wordCount}`,
              `longest = ${result.longest.len}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
