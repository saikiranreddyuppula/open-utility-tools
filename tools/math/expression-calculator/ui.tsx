'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { evaluateExpression } from '@/lib/math/expr';

const EXAMPLES = ['(2 + 3) * 4', 'sqrt(2)', 'sin(pi / 6)', '2 ^ 10', 'max(3, 7, 2)', 'log(1000)'];

export default function ExpressionCalculatorTool() {
  const [expr, setExpr] = useState('(2 + 3) * 4 - sqrt(16)');

  const { result, error } = useMemo(() => {
    if (!expr.trim()) return { result: null, error: null };
    try {
      return { result: evaluateExpression(expr), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Invalid' };
    }
  }, [expr]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="(2 + 3) * 4"
        className="h-12 font-mono text-lg"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setExpr(ex)}
            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBanner error={error} />
      ) : result !== null ? (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={String(result)} />
          </PanelHeader>
          <div className="p-5 text-center">
            <span className="font-mono text-3xl font-semibold tabular">
              {Number.isFinite(result) ? +result.toPrecision(12) : String(result)}
            </span>
          </div>
        </Panel>
      ) : null}
      <p className="px-1 text-2xs text-muted-foreground">
        Functions: sin cos tan sqrt cbrt abs ln log log2 exp floor ceil round min max pow · constants: pi e tau
      </p>
    </div>
  );
}
