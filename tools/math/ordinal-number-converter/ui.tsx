'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

const ONES: string[] = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS: string[] = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];
const SCALES: string[] = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];

function suffix(n: bigint): string {
  const abs = n < 0n ? -n : n;
  const last2 = Number(abs % 100n);
  if (last2 >= 11 && last2 <= 13) return 'th';
  const last1 = Number(abs % 10n);
  if (last1 === 1) return 'st';
  if (last1 === 2) return 'nd';
  if (last1 === 3) return 'rd';
  return 'th';
}

function threeDigitWords(n: number): string {
  // n in [0, 999]
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    const h = ONES[hundreds];
    if (h) parts.push(`${h} hundred`);
  }
  if (rest > 0) {
    if (rest < 20) {
      const w = ONES[rest];
      if (w) parts.push(w);
    } else {
      const t = TENS[Math.floor(rest / 10)];
      const o = ONES[rest % 10];
      if (t && o) parts.push(`${t}-${o}`);
      else if (t) parts.push(t);
      else if (o) parts.push(o);
    }
  }
  return parts.join(' ');
}

function cardinalWords(n: bigint): string {
  if (n === 0n) return 'zero';
  const neg = n < 0n;
  let v = neg ? -n : n;
  const groups: number[] = [];
  while (v > 0n) {
    groups.push(Number(v % 1000n));
    v /= 1000n;
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i] ?? 0;
    if (g === 0) continue;
    const gw = threeDigitWords(g);
    const scale = SCALES[i] ?? '';
    words.push(scale ? `${gw} ${scale}` : gw);
  }
  const joined = words.join(' ').trim();
  return neg ? `negative ${joined}` : joined;
}

const ORDINAL_SPECIAL: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

const TENS_ORDINAL: Record<string, string> = {
  twenty: 'twentieth',
  thirty: 'thirtieth',
  forty: 'fortieth',
  fifty: 'fiftieth',
  sixty: 'sixtieth',
  seventy: 'seventieth',
  eighty: 'eightieth',
  ninety: 'ninetieth',
};

function ordinalWords(card: string): string {
  if (card === 'zero') return 'zeroth';
  // Operate on the very last word/segment of the cardinal phrase.
  const segments = card.split(' ');
  const lastIdx = segments.length - 1;
  const last = segments[lastIdx] ?? '';

  // Hyphenated like "twenty-one" -> "twenty-first"
  if (last.includes('-')) {
    const hp = last.split('-');
    const head = hp[0] ?? '';
    const tail = hp[1] ?? '';
    const tailOrd = ORDINAL_SPECIAL[tail] ?? (tail ? `${tail}th` : '');
    segments[lastIdx] = head ? `${head}-${tailOrd}` : tailOrd;
    return segments.join(' ');
  }

  // Plain tens like "twenty" -> "twentieth"
  const tensOrd = TENS_ORDINAL[last];
  if (tensOrd) {
    segments[lastIdx] = tensOrd;
    return segments.join(' ');
  }

  // Special single words
  const specialOrd = ORDINAL_SPECIAL[last];
  if (specialOrd) {
    segments[lastIdx] = specialOrd;
    return segments.join(' ');
  }

  // Words ending in "y" (none here besides handled tens), generic + th
  if (last.endsWith('y')) {
    segments[lastIdx] = `${last.slice(0, -1)}ieth`;
    return segments.join(' ');
  }

  segments[lastIdx] = `${last}th`;
  return segments.join(' ');
}

interface Row {
  input: string;
  short: string;
  words: string;
  error?: string;
}

export default function OrdinalNumberConverterTool() {
  const [text, setText] = useState('1\n2\n3\n11\n21\n42\n100\n1000000');

  const result = useMemo<{ rows: Row[]; error: string | null }>(() => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return { rows: [], error: 'Enter one or more integers (one per line).' };
    if (lines.length > 500) return { rows: [], error: 'Limit to 500 numbers at a time.' };

    const rows: Row[] = [];
    for (const line of lines) {
      if (!/^[+-]?\d+$/.test(line)) {
        rows.push({ input: line, short: '', words: '', error: 'not an integer' });
        continue;
      }
      let n: bigint;
      try {
        n = BigInt(line);
      } catch {
        rows.push({ input: line, short: '', words: '', error: 'parse error' });
        continue;
      }
      const sfx = suffix(n);
      const short = `${n.toString()}${sfx}`;
      const words = ordinalWords(cardinalWords(n));
      rows.push({ input: line, short, words });
    }
    return { rows, error: null };
  }, [text]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Numbers (one per line)" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-[140px] font-mono"
            placeholder="21"
          />
        </div>
      </Panel>

      {result.error ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${result.rows.length} converted`}>
            <CopyButton
              value={() =>
                result.rows
                  .map((r) => (r.error ? `${r.input}: ${r.error}` : `${r.short}\t${r.words}`))
                  .join('\n')
              }
            />
          </PanelHeader>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Input</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Short</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Spelled out</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, idx) => (
                  <tr key={`${r.input}-${idx}`} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.input}</td>
                    {r.error ? (
                      <td className="px-3 py-1.5 text-destructive" colSpan={3}>{r.error}</td>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 font-mono">{r.short}</td>
                        <td className="px-3 py-1.5">{r.words}</td>
                        <td className="px-3 py-1.5 text-right">
                          <CopyButton value={`${r.short} (${r.words})`} size="icon-sm" />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatBar items={[`${result.rows.length} numbers`, 'Rule: 11/12/13 → th; else 1→st, 2→nd, 3→rd, else th']} />
        </Panel>
      )}
    </div>
  );
}
