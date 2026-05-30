'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

// Build a readable polynomial string from coefficients (highest degree first).
function polyToString(coeffs: number[]): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const power = deg - i;
    const abs = Math.abs(c);
    const sign = c < 0 ? '−' : '+';
    let term: string;
    if (power === 0) term = `${abs}`;
    else if (power === 1) term = abs === 1 ? 'x' : `${abs}x`;
    else term = abs === 1 ? `x^${power}` : `${abs}x^${power}`;
    parts.push(parts.length === 0 ? `${c < 0 ? '−' : ''}${term}` : ` ${sign} ${term}`);
  });
  return parts.length === 0 ? '0' : parts.join('');
}

// Horner evaluation: result = ((c0*x + c1)*x + c2)...
function horner(coeffs: number[], x: number): number {
  let acc = 0;
  for (const c of coeffs) {
    acc = acc * x + c;
  }
  return acc;
}

// Derivative coefficients (highest degree first).
function derivative(coeffs: number[]): number[] {
  const deg = coeffs.length - 1;
  if (deg <= 0) return [0];
  const out: number[] = [];
  for (let i = 0; i < coeffs.length - 1; i++) {
    const power = deg - i;
    const c = coeffs[i] ?? 0;
    out.push(c * power);
  }
  return out;
}

export default function PolynomialEvaluator() {
  const [coeffStr, setCoeffStr] = useState('1, -3, 2');
  const [xStr, setXStr] = useState('2');

  const result = useMemo(() => {
    const raw = coeffStr.split(',').map((s) => s.trim());
    const nonEmpty = raw.filter((s) => s !== '');
    if (nonEmpty.length === 0) {
      return { error: 'Enter at least one coefficient (highest degree first).' };
    }
    const coeffs: number[] = [];
    for (const s of nonEmpty) {
      const v = Number(s);
      if (!Number.isFinite(v)) {
        return { error: `Invalid coefficient: "${s}".` };
      }
      coeffs.push(v);
    }
    if (coeffs.length > 200) {
      return { error: 'Keep the polynomial to at most 200 coefficients.' };
    }

    const x = Number(xStr.trim());
    if (xStr.trim() === '' || !Number.isFinite(x)) {
      return { error: 'Enter a valid value for x.' };
    }

    const deriv = derivative(coeffs);
    const px = horner(coeffs, x);
    const dpx = horner(deriv, x);

    return {
      polyStr: polyToString(coeffs),
      derivStr: polyToString(deriv),
      degree: coeffs.length - 1,
      px,
      dpx,
      x,
    };
  }, [coeffStr, xStr]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="Coefficients (highest degree first, comma-separated)">
              <Input
                value={coeffStr}
                onChange={(e) => setCoeffStr(e.target.value)}
                className="w-72 font-mono"
                placeholder="1, -3, 2"
              />
            </Field>
            <Field label="x">
              <Input
                value={xStr}
                onChange={(e) => setXStr(e.target.value)}
                inputMode="decimal"
                className="w-28 font-mono"
              />
            </Field>
          </OptionsBar>
        </Panel>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'P(x)', value: result.polyStr },
    { label: `P(${fmt(result.x)})`, value: fmt(result.px) },
    { label: "P'(x) derivative", value: result.derivStr },
    { label: `P'(${fmt(result.x)})`, value: fmt(result.dpx) },
  ];

  const copy = [
    `P(x) = ${result.polyStr}`,
    `P(${fmt(result.x)}) = ${fmt(result.px)}`,
    `P'(x) = ${result.derivStr}`,
    `P'(${fmt(result.x)}) = ${fmt(result.dpx)}`,
  ].join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Coefficients (highest degree first, comma-separated)">
            <Input
              value={coeffStr}
              onChange={(e) => setCoeffStr(e.target.value)}
              className="w-72 font-mono"
              placeholder="1, -3, 2"
            />
          </Field>
          <Field label="x">
            <Input
              value={xStr}
              onChange={(e) => setXStr(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Evaluation & derivative">
          <CopyButton value={() => copy} />
        </PanelHeader>
        <div className="grid grid-cols-1 gap-3 p-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="shrink-0 text-sm text-muted-foreground">{row.label}</span>
              <span className="flex min-w-0 items-start gap-2 font-mono text-sm">
                <span className="break-all text-right">{row.value}</span>
                <CopyButton value={row.value} size="icon-sm" />
              </span>
            </div>
          ))}
        </div>
        <StatBar items={[`Degree: ${result.degree}`, `x = ${fmt(result.x)}`, "Horner's method"]} />
      </Panel>
    </div>
  );
}
