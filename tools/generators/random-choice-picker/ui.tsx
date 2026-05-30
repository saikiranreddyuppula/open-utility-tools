'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const SAMPLE = 'Alice\nBob\nCarol\nDave\nErin\nFrank';

/** Unbiased index in [0, n). */
function randIndex(n: number): number {
  if (n <= 0) return 0;
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randIndex(i + 1);
    const tmp = a[i];
    const aj = a[j];
    if (tmp !== undefined && aj !== undefined) {
      a[i] = aj;
      a[j] = tmp;
    }
  }
  return a;
}

export default function RandomChoicePickerTool() {
  const [raw, setRaw] = useState(SAMPLE);
  const [pickCount, setPickCount] = useState(1);
  const [replacement, setReplacement] = useState(false);
  const [trimBlank, setTrimBlank] = useState(true);
  const [dedupe, setDedupe] = useState(false);
  const [showShuffle, setShowShuffle] = useState(false);
  const [nonce, setNonce] = useState(0);

  const choices = useMemo(() => {
    // Split on newlines first; if a line contains commas treat them as separate items.
    let items: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.includes(',')) {
        for (const part of line.split(',')) items.push(part);
      } else {
        items.push(line);
      }
    }
    items = items.map((s) => s.trim());
    if (trimBlank) items = items.filter((s) => s.length > 0);
    if (dedupe) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const it of items) {
        const key = it.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(it);
      }
      items = out;
    }
    return items;
  }, [raw, trimBlank, dedupe]);

  const result = useMemo(() => {
    void nonce;
    const n = choices.length;
    if (n === 0) return { error: 'Add at least one choice.' };
    const k = Math.max(1, pickCount);
    if (!replacement && k > n) {
      return { error: `Cannot pick ${k} unique items from ${n} choices (enable replacement).` };
    }

    let picks: string[] = [];
    if (replacement) {
      for (let i = 0; i < k; i++) {
        picks.push(choices[randIndex(n)] ?? '');
      }
    } else {
      picks = shuffled(choices).slice(0, k);
    }

    const order = showShuffle ? shuffled(choices) : null;
    return { picks, order, n };
  }, [choices, pickCount, replacement, showShuffle, nonce]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Choices (one per line or comma-separated)" />
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          rows={6}
          className="rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
          placeholder="Apple, Banana, Cherry"
        />
      </Panel>

      <OptionsBar>
        <Field label="Pick how many">
          <Input
            type="number"
            min={1}
            value={pickCount}
            onChange={(e) => setPickCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="With replacement">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={replacement} onCheckedChange={setReplacement} id="rep" />
            <Label htmlFor="rep" className="text-xs text-muted-foreground">
              allow repeats
            </Label>
          </div>
        </Field>
        <Field label="Trim blanks">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={trimBlank} onCheckedChange={setTrimBlank} id="tb" />
            <Label htmlFor="tb" className="text-xs text-muted-foreground">
              drop empty
            </Label>
          </div>
        </Field>
        <Field label="Dedupe">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={dedupe} onCheckedChange={setDedupe} id="dd" />
            <Label htmlFor="dd" className="text-xs text-muted-foreground">
              case-insensitive
            </Label>
          </div>
        </Field>
        <Field label="Full shuffle">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={showShuffle} onCheckedChange={setShowShuffle} id="sh" />
            <Label htmlFor="sh" className="text-xs text-muted-foreground">
              show ordering
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setNonce((x) => x + 1)}>
            <RefreshCw className="size-3.5" /> Pick again
          </Button>
        </div>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title={result.picks.length === 1 ? 'Picked' : `Picked ${result.picks.length}`}>
              <CopyButton value={() => result.picks.join('\n')} disabled={result.picks.length === 0} />
            </PanelHeader>
            <div className="flex flex-wrap gap-2 p-3">
              {result.picks.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md border bg-primary/10 px-3 py-1.5 text-sm font-medium"
                >
                  {p || '(blank)'}
                </span>
              ))}
            </div>
            <StatBar items={[`from ${result.n} choices`, replacement ? 'with replacement' : 'unique']} />
          </Panel>

          {showShuffle && result.order && (
            <Panel>
              <PanelHeader title="Full shuffled order">
                <CopyButton value={() => (result.order ?? []).join('\n')} />
              </PanelHeader>
              <div className="max-h-[320px] divide-y overflow-auto">
                {result.order.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="w-10 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                      {i + 1}
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-xs">{item || '(blank)'}</code>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
