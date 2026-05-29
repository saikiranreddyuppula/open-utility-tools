'use client';

import { useCallback, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

const SAMPLE = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace', 'Heidi'].join('\n');

/** Returns a cryptographically strong integer in [0, max). */
function randomInt(max: number): number {
  if (max <= 0) return 0;
  // Rejection sampling on a 32-bit value to avoid modulo bias.
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

/** Draws `count` indices from [0, total). Unique unless allowRepeat. */
function drawIndices(total: number, count: number, allowRepeat: boolean): number[] {
  if (allowRepeat) {
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      out.push(randomInt(total));
    }
    return out;
  }
  // Partial Fisher–Yates shuffle for unique draws.
  const pool = Array.from({ length: total }, (_, i) => i);
  const n = Math.min(count, total);
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(total - i);
    const a = pool[i] ?? i;
    const b = pool[j] ?? j;
    pool[i] = b;
    pool[j] = a;
  }
  return pool.slice(0, n);
}

export default function RandomLinePickerTool() {
  const [text, setText] = useState<string>(SAMPLE);
  const [countRaw, setCountRaw] = useState<string>('1');
  const [allowRepeat, setAllowRepeat] = useState<boolean>(false);
  const [trim, setTrim] = useState<boolean>(true);
  const [picks, setPicks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => {
    const raw = text.split(/\r?\n/);
    const cleaned = trim ? raw.map((l) => l.trim()) : raw;
    return cleaned.filter((l) => l.length > 0);
  }, [text, trim]);

  const draw = useCallback(() => {
    setError(null);
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 1 || !Number.isInteger(count)) {
      setError('Enter a whole number of picks of at least 1.');
      setPicks([]);
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one non-empty line to pick from.');
      setPicks([]);
      return;
    }
    if (!allowRepeat && count > lines.length) {
      setError(
        `You asked for ${count} unique picks but there are only ${lines.length} lines. Enable repeats or reduce the count.`,
      );
      setPicks([]);
      return;
    }
    const indices = drawIndices(lines.length, count, allowRepeat);
    setPicks(indices.map((i) => lines[i] ?? ''));
  }, [countRaw, lines, allowRepeat]);

  const result = picks.join('\n');

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner error={error} />
      <Panel>
        <PanelHeader title="Options">
          <Button onClick={draw}>
            <Shuffle className="mr-2 h-4 w-4" />
            Draw
          </Button>
        </PanelHeader>
        <OptionsBar>
          <Field label="Number of picks">
            <Input
              type="number"
              min={1}
              value={countRaw}
              onChange={(e) => setCountRaw(e.target.value)}
              className="w-32"
            />
          </Field>
          <Field label="Allow repeats" hint="Same line can be drawn more than once">
            <div className="flex items-center gap-2">
              <Switch id="allow-repeat" checked={allowRepeat} onCheckedChange={setAllowRepeat} />
              <Label htmlFor="allow-repeat">{allowRepeat ? 'On' : 'Off'}</Label>
            </div>
          </Field>
          <Field label="Trim & skip blanks" hint="Ignore empty lines and surrounding spaces">
            <div className="flex items-center gap-2">
              <Switch id="trim" checked={trim} onCheckedChange={setTrim} />
              <Label htmlFor="trim">{trim ? 'On' : 'Off'}</Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Entries" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="One entry per line"
          className="min-h-[200px] font-mono text-sm"
          spellCheck={false}
        />
        <StatBar items={[`${lines.length} eligible line${lines.length === 1 ? '' : 's'}`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Result">
          <CopyButton value={result} />
        </PanelHeader>
        {picks.length > 0 ? (
          <ol className="list-decimal space-y-1 pl-6 font-mono text-sm">
            {picks.map((pick, i) => (
              <li key={`${i}-${pick}`} className="break-words">
                {pick}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Press Draw to pick random lines.</p>
        )}
        <StatBar items={[picks.length > 0 && `${picks.length} picked`]} />
      </Panel>
    </div>
  );
}
