'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { UNIT_CATEGORIES, convertUnit } from '@/lib/math/units';

export default function UnitConverterTool() {
  const [catId, setCatId] = useState('length');
  const cat = UNIT_CATEGORIES.find((c) => c.id === catId)!;

  const [fromId, setFromId] = useState('m');
  const [toId, setToId] = useState('ft');
  const [value, setValue] = useState('1');

  const from = cat.units.find((u) => u.id === fromId) ?? cat.units[0]!;
  const to = cat.units.find((u) => u.id === toId) ?? cat.units[1] ?? cat.units[0]!;

  const result = useMemo(() => {
    const n = Number(value);
    if (value.trim() === '' || isNaN(n)) return '';
    const r = convertUnit(n, from, to);
    return (Math.round(r * 1e8) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });
  }, [value, from, to]);

  const onCat = (id: string) => {
    setCatId(id);
    const c = UNIT_CATEGORIES.find((x) => x.id === id)!;
    setFromId(c.units[0]!.id);
    setToId(c.units[1]?.id ?? c.units[0]!.id);
  };

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
  };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Quantity">
          <Select value={catId} onValueChange={onCat}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <Panel>
        <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-end">
          <Field label="From" className="flex-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              className="font-mono"
            />
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cat.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button variant="ghost" size="icon" onClick={swap} className="mb-1 self-center" title="Swap">
            <ArrowRightLeft className="size-4" />
          </Button>

          <Field label="To" className="flex-1">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-muted/40 px-2.5 font-mono text-sm">
              <span className="flex-1 truncate">{result || '—'}</span>
              <CopyButton value={result} size="icon-sm" disabled={!result} />
            </div>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cat.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Panel>
    </div>
  );
}
