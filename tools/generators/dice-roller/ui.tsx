'use client';

import { useCallback, useState } from 'react';
import { Dices, CircleDot } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(a: T): T;
}
const webcrypto = (globalThis as unknown as { crypto: RandomSource }).crypto;

function rollDie(sides: number): number {
  const max = Math.floor(0xffffffff / sides) * sides;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    webcrypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= max);
  return (x % sides) + 1;
}

const DICE = [4, 6, 8, 10, 12, 20, 100];

export default function DiceRollerTool() {
  const [sides, setSides] = useState(6);
  const [count, setCount] = useState(2);
  const [rolls, setRolls] = useState<number[]>([]);
  const [coins, setCoins] = useState<string[]>([]);

  const roll = useCallback(() => {
    setRolls(Array.from({ length: Math.max(1, Math.min(count, 50)) }, () => rollDie(sides)));
  }, [sides, count]);

  const flip = useCallback(() => {
    setCoins(Array.from({ length: Math.max(1, Math.min(count, 50)) }, () => (rollDie(2) === 1 ? 'Heads' : 'Tails')));
  }, [count]);

  const total = rolls.reduce((a, b) => a + b, 0);
  const heads = coins.filter((c) => c === 'Heads').length;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Sides">
          <Select value={String(sides)} onValueChange={(v) => setSides(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DICE.map((d) => <SelectItem key={d} value={String(d)}>d{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Count">
          <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 50)))} className="w-20 font-mono" />
        </Field>
        <div className="flex items-end gap-2">
          <Button size="sm" onClick={roll}><Dices className="size-3.5" /> Roll dice</Button>
          <Button size="sm" variant="secondary" onClick={flip}><CircleDot className="size-3.5" /> Flip coins</Button>
        </div>
      </OptionsBar>

      {rolls.length > 0 && (
        <Panel>
          <PanelHeader title={`${rolls.length}d${sides}`} />
          <div className="flex flex-wrap gap-2 p-3">
            {rolls.map((r, i) => (
              <span key={i} className="flex size-10 items-center justify-center rounded-md border bg-card font-mono text-lg font-semibold tabular">{r}</span>
            ))}
          </div>
          <StatBar items={[`total ${total}`, `avg ${(total / rolls.length).toFixed(1)}`, `min ${Math.min(...rolls)}`, `max ${Math.max(...rolls)}`]} />
        </Panel>
      )}

      {coins.length > 0 && (
        <Panel>
          <PanelHeader title="Coin flips" />
          <div className="flex flex-wrap gap-2 p-3">
            {coins.map((c, i) => (
              <span key={i} className={`flex h-8 items-center rounded-md border px-2.5 font-mono text-xs ${c === 'Heads' ? 'bg-primary/10 text-foreground' : 'bg-muted'}`}>{c}</span>
            ))}
          </div>
          <StatBar items={[`${heads} heads`, `${coins.length - heads} tails`]} />
        </Panel>
      )}
    </div>
  );
}
