'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SAMPLE =
  'The cat sat on the mat. The cat saw a rat near the mat. A clever rat ran past the curious cat and vanished beneath the worn wooden floor.';

interface Row {
  label: string;
  value: string;
  note: string;
}

type Result =
  | { error: string }
  | {
      tokens: number;
      types: number;
      ttr: number;
      rttr: number;
      cttr: number;
      herdanC: number;
      hapax: number;
      hapaxPct: number;
    };

export default function LexicalDiversityCalculatorTool() {
  const [text, setText] = useState(SAMPLE);
  const [ignoreCase, setIgnoreCase] = useState(true);

  const result = useMemo<Result>(() => {
    const raw = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
    const tokensArr = raw.map((w) => (ignoreCase ? w.toLowerCase() : w));
    const N = tokensArr.length;
    if (N === 0) return { error: 'Enter some text to analyze.' };
    const counts = new Map<string, number>();
    for (const t of tokensArr) counts.set(t, (counts.get(t) ?? 0) + 1);
    const V = counts.size;
    let hapax = 0;
    for (const c of counts.values()) if (c === 1) hapax += 1;
    const ttr = V / N;
    const rttr = V / Math.sqrt(N);
    const cttr = V / Math.sqrt(2 * N);
    const herdanC = N > 1 && V > 1 ? Math.log(V) / Math.log(N) : 0;
    return {
      tokens: N,
      types: V,
      ttr,
      rttr,
      cttr,
      herdanC,
      hapax,
      hapaxPct: (hapax / V) * 100,
    };
  }, [text, ignoreCase]);

  const rows: Row[] =
    'error' in result
      ? []
      : [
          { label: 'Tokens (N)', value: String(result.tokens), note: 'Total running words' },
          { label: 'Types (V)', value: String(result.types), note: 'Distinct words' },
          { label: 'Type-Token Ratio', value: result.ttr.toFixed(4), note: 'V / N — higher = richer (length-sensitive)' },
          { label: 'Root TTR (Guiraud)', value: result.rttr.toFixed(4), note: 'V / √N — less length-sensitive' },
          { label: 'Corrected TTR', value: result.cttr.toFixed(4), note: 'V / √(2N)' },
          { label: "Herdan's C", value: result.herdanC.toFixed(4), note: 'log V / log N' },
          { label: 'Hapax legomena', value: String(result.hapax), note: 'Words occurring exactly once' },
          { label: 'Hapax %', value: `${result.hapaxPct.toFixed(1)}%`, note: 'Share of vocabulary used once' },
        ];

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Options" className="gap-2">
          <div className="flex items-center gap-2">
            <Checkbox id="ldc-case" checked={ignoreCase} onCheckedChange={(v) => setIgnoreCase(v === true)} />
            <Label htmlFor="ldc-case" className="text-xs font-normal">Ignore case</Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to measure vocabulary richness…"
          spellCheck={false}
          className="min-h-[150px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Diversity metrics">
            <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-44 shrink-0 text-sm">{r.label}</span>
                <span className="w-24 shrink-0 font-mono text-sm">{r.value}</span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{r.note}</span>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[`${result.tokens} tokens`, `${result.types} types`, `TTR ${result.ttr.toFixed(3)}`]}
          />
        </Panel>
      )}
    </div>
  );
}
