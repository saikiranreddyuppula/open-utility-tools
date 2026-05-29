'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Units = 'metric' | 'imperial';

function classify(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  if (bmi < 35) return 'Obese (class I)';
  if (bmi < 40) return 'Obese (class II)';
  return 'Obese (class III)';
}

export default function BmiCalculatorTool() {
  const [units, setUnits] = useState<Units>('metric');
  // metric
  const [cm, setCm] = useState('175');
  const [kg, setKg] = useState('70');
  // imperial
  const [ft, setFt] = useState('5');
  const [inch, setInch] = useState('9');
  const [lb, setLb] = useState('154');

  const result = useMemo(() => {
    let heightM: number;
    let weightKg: number;

    if (units === 'metric') {
      const h = Number(cm);
      const w = Number(kg);
      if (!Number.isFinite(h) || !Number.isFinite(w)) return { error: 'Enter numeric height and weight.' };
      if (h <= 0 || w <= 0) return { error: 'Height and weight must be positive.' };
      heightM = h / 100;
      weightKg = w;
    } else {
      const f = Number(ft);
      const i = Number(inch);
      const w = Number(lb);
      if (!Number.isFinite(f) || !Number.isFinite(i) || !Number.isFinite(w)) {
        return { error: 'Enter numeric height and weight.' };
      }
      if (f < 0 || i < 0 || w <= 0) return { error: 'Height and weight must be positive.' };
      const totalInches = f * 12 + i;
      if (totalInches <= 0) return { error: 'Height must be greater than zero.' };
      heightM = totalInches * 0.0254;
      weightKg = w * 0.45359237;
    }

    if (heightM <= 0) return { error: 'Height must be greater than zero.' };
    const bmi = weightKg / (heightM * heightM);
    if (!Number.isFinite(bmi)) return { error: 'Could not compute BMI.' };
    return { bmi, category: classify(bmi) };
  }, [units, cm, kg, ft, inch, lb]);

  return (
    <Panel>
      <PanelHeader title="BMI Calculator" />
      <div className="space-y-4 p-4">
        <OptionsBar>
          <Field label="Units">
            <Tabs value={units} onValueChange={(v) => setUnits(v as Units)}>
              <TabsList>
                <TabsTrigger value="metric">Metric</TabsTrigger>
                <TabsTrigger value="imperial">Imperial</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        {units === 'metric' ? (
          <OptionsBar>
            <Field label="Height (cm)">
              <Input value={cm} onChange={(e) => setCm(e.target.value)} inputMode="decimal" placeholder="175" />
            </Field>
            <Field label="Weight (kg)">
              <Input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="70" />
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar>
            <Field label="Height (ft)">
              <Input value={ft} onChange={(e) => setFt(e.target.value)} inputMode="numeric" placeholder="5" />
            </Field>
            <Field label="Height (in)">
              <Input value={inch} onChange={(e) => setInch(e.target.value)} inputMode="decimal" placeholder="9" />
            </Field>
            <Field label="Weight (lb)">
              <Input value={lb} onChange={(e) => setLb(e.target.value)} inputMode="decimal" placeholder="154" />
            </Field>
          </OptionsBar>
        )}

        {'error' in result ? (
          <ErrorBanner error={result.error} />
        ) : (
          <div className="rounded-md border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Body Mass Index</p>
                <p className="text-2xl font-semibold tabular-nums">{result.bmi.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">{result.category}</p>
              </div>
              <CopyButton value={() => result.bmi.toFixed(1)} />
            </div>
            <StatBar
              items={[
                'Underweight < 18.5',
                'Normal 18.5–24.9',
                'Overweight 25–29.9',
                'Obese ≥ 30',
              ]}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
