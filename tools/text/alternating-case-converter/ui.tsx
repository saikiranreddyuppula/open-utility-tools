'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'altLower' | 'altUpper' | 'inverse' | 'random';

const SAMPLE = 'You really think anyone is going to take this seriously?';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

export default function AlternatingCaseTool() {
  const [mode, setMode] = useState<Mode>('altLower');
  const [seed, setSeed] = useState('42');
  const [prob, setProb] = useState(50);

  return (
    <TextToolLayout
      deps={[mode, seed, prob]}
      transform={(input) => {
        if (!input) return '';
        const chars = Array.from(input);

        if (mode === 'inverse') {
          return chars
            .map((ch) =>
              ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase(),
            )
            .join('');
        }

        if (mode === 'random') {
          const seedN = Number(seed);
          if (!Number.isFinite(seedN) || !Number.isInteger(seedN)) {
            throw new Error('Seed must be an integer.');
          }
          const rng = mulberry32(seedN);
          const threshold = prob / 100;
          return chars
            .map((ch) => {
              if (!isLetter(ch)) return ch;
              return rng() < threshold ? ch.toUpperCase() : ch.toLowerCase();
            })
            .join('');
        }

        // Alternating modes: advance toggle only on letters.
        let upperNext = mode === 'altUpper';
        return chars
          .map((ch) => {
            if (!isLetter(ch)) return ch;
            const out = upperNext ? ch.toUpperCase() : ch.toLowerCase();
            upperNext = !upperNext;
            return out;
          })
          .join('');
      }}
      inputLabel="Text"
      outputLabel="Result"
      sample={SAMPLE}
      downloadName="cased.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="altLower">Alternating (start lower)</SelectItem>
                <SelectItem value="altUpper">Alternating (start upper)</SelectItem>
                <SelectItem value="inverse">Inverse (swap case)</SelectItem>
                <SelectItem value="random">Random case (seeded)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'random' && (
            <>
              <Field label="Seed">
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  inputMode="numeric"
                  className="w-24"
                />
              </Field>
              <Field label={`Uppercase probability: ${prob}%`} className="min-w-[200px]">
                <Slider
                  value={[prob]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setProb(v[0] ?? 50)}
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
