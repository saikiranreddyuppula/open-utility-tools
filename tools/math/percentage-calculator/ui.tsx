'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function Row({
  children,
  result,
}: {
  children: React.ReactNode;
  result: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3">
      <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">{children}</div>
      <div className="font-mono text-sm font-semibold tabular text-primary">{result}</div>
    </div>
  );
}

const fmt = (n: number | null) =>
  n == null || !isFinite(n) ? '—' : (Math.round(n * 1e6) / 1e6).toLocaleString();

export default function PercentageCalculatorTool() {
  const [a1, setA1] = useState('15');
  const [a2, setA2] = useState('200');
  const [b1, setB1] = useState('30');
  const [b2, setB2] = useState('150');
  const [c1, setC1] = useState('120');
  const [c2, setC2] = useState('150');

  const inp = (v: string, set: (s: string) => void) => (
    <Input
      value={v}
      onChange={(e) => set(e.target.value)}
      type="number"
      className="h-8 w-24 font-mono"
    />
  );

  const pa = num(a1);
  const pb = num(a2);
  const r1 = pa != null && pb != null ? (pa / 100) * pb : null;

  const qa = num(b1);
  const qb = num(b2);
  const r2 = qa != null && qb != null && qb !== 0 ? (qa / qb) * 100 : null;

  const sa = num(c1);
  const sb = num(c2);
  const r3 = sa != null && sb != null && sa !== 0 ? ((sb - sa) / sa) * 100 : null;

  return (
    <Panel>
      <PanelHeader title="Percentage calculations" />
      <div className="divide-y">
        <Row result={fmt(r1)}>
          What is {inp(a1, setA1)} % of {inp(a2, setA2)}?
        </Row>
        <Row result={r2 == null ? '—' : `${fmt(r2)} %`}>
          {inp(b1, setB1)} is what % of {inp(b2, setB2)}?
        </Row>
        <Row result={r3 == null ? '—' : `${r3 >= 0 ? '+' : ''}${fmt(r3)} %`}>
          % change from {inp(c1, setC1)} to {inp(c2, setC2)}
        </Row>
      </div>
    </Panel>
  );
}
