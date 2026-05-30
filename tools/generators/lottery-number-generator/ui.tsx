'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Preset = 'powerball' | 'megamillions' | 'euromillions' | 'generic' | 'custom';

interface GameConfig {
  pick: number;   // count of main numbers
  pool: number;   // main pool 1..pool
  bonus: number;  // count of bonus numbers (0 = none)
  bonusPool: number;
}

const PRESETS: Record<Exclude<Preset, 'custom'>, GameConfig> = {
  powerball: { pick: 5, pool: 69, bonus: 1, bonusPool: 26 },
  megamillions: { pick: 5, pool: 70, bonus: 1, bonusPool: 25 },
  euromillions: { pick: 5, pool: 50, bonus: 2, bonusPool: 12 },
  generic: { pick: 6, pool: 49, bonus: 0, bonusPool: 0 },
};

/** Unbiased integer in [0, max) using rejection sampling. */
function randInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % max;
}

/** Pick `count` distinct numbers from 1..pool via partial Fisher-Yates. */
function pickDistinct(count: number, pool: number): number[] {
  const n = Math.min(count, pool);
  const arr = Array.from({ length: pool }, (_, i) => i + 1);
  for (let i = 0; i < n; i++) {
    const j = i + randInt(pool - i);
    const a = arr[i] ?? 0;
    const b = arr[j] ?? 0;
    arr[i] = b;
    arr[j] = a;
  }
  return arr.slice(0, n).sort((x, y) => x - y);
}

export default function LotteryNumberGeneratorTool() {
  const [preset, setPreset] = useState<Preset>('powerball');
  const [pick, setPick] = useState(6);
  const [pool, setPool] = useState(49);
  const [bonus, setBonus] = useState(0);
  const [bonusPool, setBonusPool] = useState(10);

  const config: GameConfig =
    preset === 'custom'
      ? { pick, pool, bonus, bonusPool }
      : PRESETS[preset];

  const generate = useCallback(() => {
    const main = pickDistinct(config.pick, config.pool).map((n) => n.toString().padStart(2, '0'));
    let line = main.join('  ');
    if (config.bonus > 0 && config.bonusPool > 0) {
      const extra = pickDistinct(config.bonus, config.bonusPool).map((n) => n.toString().padStart(2, '0'));
      line += `  +  ${extra.join(' ')}`;
    }
    return line;
  }, [config.pick, config.pool, config.bonus, config.bonusPool]);

  const isCustom = preset === 'custom';

  return (
    <GeneratorList
      generate={generate}
      deps={[preset, config.pick, config.pool, config.bonus, config.bonusPool]}
      defaultCount={5}
      maxCount={20}
      downloadName="lottery-numbers.txt"
      label="Quick picks"
      options={
        <>
          <Field label="Game">
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="powerball">Powerball (5/69 + 1/26)</SelectItem>
                <SelectItem value="megamillions">Mega Millions (5/70 + 1/25)</SelectItem>
                <SelectItem value="euromillions">EuroMillions (5/50 + 2/12)</SelectItem>
                <SelectItem value="generic">Generic (6/49)</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isCustom && (
            <>
              <Field label="Pick">
                <Input
                  type="number" min={1} max={20}
                  value={pick}
                  onChange={(e) => setPick(Math.max(1, Math.min(Number(e.target.value) || 1, 20)))}
                  className="w-20 font-mono"
                />
              </Field>
              <Field label="From pool">
                <Input
                  type="number" min={1} max={99}
                  value={pool}
                  onChange={(e) => setPool(Math.max(1, Math.min(Number(e.target.value) || 1, 99)))}
                  className="w-20 font-mono"
                />
              </Field>
              <Field label="Bonus">
                <Input
                  type="number" min={0} max={5}
                  value={bonus}
                  onChange={(e) => setBonus(Math.max(0, Math.min(Number(e.target.value) || 0, 5)))}
                  className="w-20 font-mono"
                />
              </Field>
              <Field label="Bonus pool">
                <Input
                  type="number" min={1} max={99}
                  value={bonusPool}
                  onChange={(e) => setBonusPool(Math.max(1, Math.min(Number(e.target.value) || 1, 99)))}
                  className="w-20 font-mono"
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
