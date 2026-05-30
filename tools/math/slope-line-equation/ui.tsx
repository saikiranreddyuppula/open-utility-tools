'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Approximate a real number as a simple fraction (denominator up to 10000). */
function toFraction(x: number): string {
  if (!Number.isFinite(x)) return '—';
  if (Number.isInteger(x)) return String(x);
  const sign = x < 0 ? -1 : 1;
  let val = Math.abs(x);
  let bestN = 1;
  let bestD = 1;
  let bestErr = Infinity;
  for (let d = 1; d <= 10000; d++) {
    const n = Math.round(val * d);
    const err = Math.abs(val - n / d);
    if (err < bestErr) {
      bestErr = err;
      bestN = n;
      bestD = d;
      if (err < 1e-12) break;
    }
  }
  const g = gcd(bestN, bestD);
  return `${sign < 0 ? '-' : ''}${bestN / g}/${bestD / g}`;
}

/** Format a coefficient*variable term with sign for an equation string. */
function term(coeff: number, varName: string, first: boolean): string {
  if (coeff === 0) return '';
  const sign = coeff < 0 ? '-' : '+';
  const abs = Math.abs(coeff);
  const mag = abs === 1 && varName !== '' ? '' : num(abs);
  if (first) {
    return `${coeff < 0 ? '-' : ''}${mag}${varName}`;
  }
  return ` ${sign} ${mag}${varName}`;
}

export default function SlopeLineEquationTool() {
  const [x1, setX1] = useState('1');
  const [y1, setY1] = useState('2');
  const [x2, setX2] = useState('4');
  const [y2, setY2] = useState('8');

  const result = useMemo(() => {
    const ax = Number(x1);
    const ay = Number(y1);
    const bx = Number(x2);
    const by = Number(y2);
    if (![ax, ay, bx, by].every((v) => Number.isFinite(v))) {
      return { error: 'Enter valid numbers for both points.' };
    }
    if (ax === bx && ay === by) {
      return { error: 'The two points are identical — a line is undefined.' };
    }

    const dx = bx - ax;
    const dy = by - ay;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const rows: { label: string; value: string }[] = [];

    if (dx === 0) {
      // Vertical line: x = ax
      rows.push({ label: 'Slope (m)', value: 'undefined (vertical)' });
      rows.push({ label: 'Equation', value: `x = ${num(ax)}` });
      rows.push({ label: 'x-intercept', value: num(ax) });
      rows.push({ label: 'y-intercept', value: 'none' });
      rows.push({ label: 'Angle of inclination', value: '90°' });
      rows.push({ label: 'Distance between points', value: num(distance) });
      return { rows, distance };
    }

    const m = dy / dx;
    const b = ay - m * ax;
    const angle = (Math.atan(m) * 180) / Math.PI;
    const xIntercept = m === 0 ? null : -b / m;

    // Standard form Ax + By = C with integer coefficients.
    // From y = mx + b => -mx + y = b. Use fraction approximation for m and b.
    // m = dy/dx already rational; A = dy, B = -dx scaled, C = dy*ax - dx*ay style.
    // Use A = -dy, B = dx so that A*x + B*y = -dy*ax + dx*ay = dx*ay - dy*ax.
    let A = -dy;
    let B = dx;
    let C = dx * ay - dy * ax;
    // Normalize to integers if inputs are integers; otherwise scale by common denom approx.
    if ([A, B, C].every((v) => Number.isInteger(v))) {
      const g = gcd(gcd(A, B), C === 0 ? gcd(A, B) : C);
      A /= g;
      B /= g;
      C /= g;
      if (A < 0 || (A === 0 && B < 0)) {
        A = -A;
        B = -B;
        C = -C;
      }
    }

    const standard = `${term(A, 'x', true)}${term(B, 'y', false)} = ${num(C)}`;
    const slopeIntercept =
      b === 0
        ? `y = ${num(m)}x`
        : `y = ${num(m)}x ${b < 0 ? '-' : '+'} ${num(Math.abs(b))}`;
    const pointSlope = `y - ${num(ay)} = ${num(m)}(x - ${num(ax)})`;

    rows.push({ label: 'Slope (m)', value: `${num(m)}  (= ${toFraction(m)})` });
    rows.push({ label: 'Angle of inclination', value: `${num(angle)}°` });
    rows.push({ label: 'Slope-intercept form', value: slopeIntercept });
    rows.push({ label: 'Point-slope form', value: pointSlope });
    rows.push({ label: 'Standard form', value: standard });
    rows.push({ label: 'y-intercept (b)', value: num(b) });
    rows.push({ label: 'x-intercept', value: xIntercept === null ? 'none (horizontal)' : num(xIntercept) });
    rows.push({ label: 'Distance between points', value: num(distance) });

    return { rows, distance };
  }, [x1, y1, x2, y2]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Point 1 — x₁">
            <Input value={x1} onChange={(e) => setX1(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Point 1 — y₁">
            <Input value={y1} onChange={(e) => setY1(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Point 2 — x₂">
            <Input value={x2} onChange={(e) => setX2(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Point 2 — y₂">
            <Input value={y2} onChange={(e) => setY2(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Line properties">
            <CopyButton value={() => result.rows.map((row) => `${row.label}: ${row.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`P₁ = (${x1}, ${y1})`, `P₂ = (${x2}, ${y2})`]} />
        </Panel>
      )}
    </div>
  );
}
