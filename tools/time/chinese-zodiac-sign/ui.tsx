'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const ANIMALS: string[] = [
  'Rat',
  'Ox',
  'Tiger',
  'Rabbit',
  'Dragon',
  'Snake',
  'Horse',
  'Goat',
  'Monkey',
  'Rooster',
  'Dog',
  'Pig',
];

const ANIMAL_EMOJI: string[] = [
  '🐀',
  '🐂',
  '🐅',
  '🐇',
  '🐉',
  '🐍',
  '🐎',
  '🐐',
  '🐒',
  '🐓',
  '🐕',
  '🐖',
];

// Five elements indexed by floor((year-4) mod 10 / 2).
const ELEMENTS: string[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const HEAVENLY_STEMS: string[] = [
  'Jiǎ',
  'Yǐ',
  'Bǐng',
  'Dīng',
  'Wù',
  'Jǐ',
  'Gēng',
  'Xīn',
  'Rén',
  'Guǐ',
];

const EARTHLY_BRANCHES: string[] = [
  'Zǐ',
  'Chǒu',
  'Yín',
  'Mǎo',
  'Chén',
  'Sì',
  'Wǔ',
  'Wèi',
  'Shēn',
  'Yǒu',
  'Xū',
  'Hài',
];

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

interface Info {
  animal: string;
  emoji: string;
  element: string;
  polarity: string;
  cyclePos: number;
  stem: string;
  branch: string;
  combined: string;
}

type Result = { error: string } | { info: Info };

export default function ChineseZodiacSign() {
  const [yearStr, setYearStr] = useState<string>(
    new Date().getFullYear().toString(),
  );

  const result = useMemo<Result>(() => {
    const year = Number(yearStr);
    if (!Number.isFinite(year) || !Number.isInteger(year)) {
      return { error: 'Enter a whole calendar year, e.g. 1990.' };
    }
    if (year < -2697 || year > 9999) {
      return { error: 'Enter a year between -2697 and 9999.' };
    }

    const animalIdx = mod(year - 4, 12);
    const animal = ANIMALS[animalIdx] ?? 'Rat';
    const emoji = ANIMAL_EMOJI[animalIdx] ?? '';

    const stemIdx = mod(year - 4, 10);
    const element = ELEMENTS[Math.floor(stemIdx / 2)] ?? 'Wood';
    const polarity = mod(year, 2) === 0 ? 'Yang' : 'Yin';

    const branchIdx = mod(year - 4, 12);
    const stem = HEAVENLY_STEMS[stemIdx] ?? '';
    const branch = EARTHLY_BRANCHES[branchIdx] ?? '';

    // Sexagenary cycle position 1..60.
    const cyclePos = mod(year - 4, 60) + 1;

    return {
      info: {
        animal,
        emoji,
        element,
        polarity,
        cyclePos,
        stem,
        branch,
        combined: `${stem}${branch}`,
      },
    };
  }, [yearStr]);

  const ok = !('error' in result);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Chinese Zodiac Animal" />
        <OptionsBar>
          <Field label="Year">
            <Input
              type="number"
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value)}
              className="w-32 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                `${result.info.polarity} ${result.info.element} ${result.info.animal} ` +
                `(${result.info.combined}, cycle position ${result.info.cyclePos}/60)`
              }
            />
          </PanelHeader>
          <div className="flex items-center gap-4 p-4">
            <span className="text-5xl">{result.info.emoji}</span>
            <div>
              <div className="text-2xl font-semibold">
                {result.info.polarity} {result.info.element} {result.info.animal}
              </div>
              <div className="text-sm text-muted-foreground">
                Year of the {result.info.animal}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Animal', value: result.info.animal },
              { label: 'Element', value: result.info.element },
              { label: 'Yin / Yang', value: result.info.polarity },
              {
                label: 'Sexagenary cycle',
                value: `${result.info.combined} · ${result.info.cyclePos} of 60`,
              },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Heavenly stem: ${result.info.stem}`,
              `Earthly branch: ${result.info.branch}`,
            ]}
          />
          <div className="border-t p-3 text-xs text-muted-foreground">
            Note: this is an approximate by-Gregorian-year lookup. The Chinese New Year
            falls in late January or February, so people born in January or early
            February may belong to the previous year&apos;s animal.
          </div>
        </Panel>
      )}
    </div>
  );
}
