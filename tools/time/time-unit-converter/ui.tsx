'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Unit = 'ns' | 'us' | 'ms' | 's' | 'min' | 'h' | 'd';

interface UnitDef {
  key: Unit;
  label: string;
  // nanoseconds per one unit
  ns: number;
}

const UNITS: UnitDef[] = [
  { key: 'ns', label: 'Nanoseconds', ns: 1 },
  { key: 'us', label: 'Microseconds', ns: 1e3 },
  { key: 'ms', label: 'Milliseconds', ns: 1e6 },
  { key: 's', label: 'Seconds', ns: 1e9 },
  { key: 'min', label: 'Minutes', ns: 6e10 },
  { key: 'h', label: 'Hours', ns: 3.6e12 },
  { key: 'd', label: 'Days', ns: 8.64e13 },
];

function formatNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) {
    return n.toExponential(6);
  }
  // Trim trailing zeros from a fixed representation
  const fixed = n.toFixed(9);
  return fixed.replace(/\.?0+$/, '');
}

export default function TimeUnitConverterTool() {
  const [unit, setUnit] = useState<Unit>('s');

  const transform = useCallback(
    (input: string) => {
      const raw = input.trim();
      if (!raw) return '';
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new Error('Enter a valid number.');
      }
      const source = UNITS.find((u) => u.key === unit);
      if (!source) throw new Error('Unknown source unit.');
      const baseNs = n * source.ns;

      const lines = UNITS.map((u) => {
        const converted = baseNs / u.ns;
        return `${u.label.padEnd(13)} ${formatNumber(converted)}`;
      });
      return lines.join('\n');
    },
    [unit],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[unit]}
      inputLabel="Value"
      outputLabel="Conversions"
      inputPlaceholder="90"
      sample="90"
      downloadName="time-conversions.txt"
      options={
        <Field label="From unit">
          <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.key} value={u.key}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
