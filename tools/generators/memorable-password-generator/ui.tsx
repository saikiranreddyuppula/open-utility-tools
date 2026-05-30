'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const WORDS: string[] = [
  'apple', 'amber', 'anchor', 'arrow', 'autumn', 'badger', 'banana', 'beacon', 'birch', 'blossom',
  'bottle', 'breeze', 'bridge', 'bronze', 'butter', 'cactus', 'candle', 'canyon', 'carbon', 'castle',
  'cedar', 'cherry', 'cinder', 'cliff', 'clover', 'cobalt', 'comet', 'copper', 'coral', 'cosmos',
  'cotton', 'crystal', 'dawn', 'delta', 'diamond', 'dolphin', 'dragon', 'dune', 'eagle', 'ember',
  'falcon', 'feather', 'fern', 'forest', 'fossil', 'galaxy', 'garden', 'garnet', 'ginger', 'glacier',
  'granite', 'harbor', 'harvest', 'hazel', 'hollow', 'honey', 'ivory', 'jade', 'jasmine', 'jungle',
  'kettle', 'lagoon', 'lantern', 'laurel', 'lemon', 'lichen', 'lily', 'lotus', 'lunar', 'maple',
  'marble', 'meadow', 'meteor', 'mango', 'mint', 'misty', 'monsoon', 'mosaic', 'nebula', 'nectar',
  'oasis', 'ocean', 'olive', 'onyx', 'opal', 'orchid', 'otter', 'pebble', 'pepper', 'pine',
  'planet', 'pollen', 'poppy', 'prairie', 'quartz', 'quiver', 'rabbit', 'rapids', 'raven', 'ridge',
  'river', 'robin', 'rocket', 'rust', 'saffron', 'sage', 'sahara', 'salmon', 'sapling', 'shadow',
  'shell', 'silver', 'spark', 'spruce', 'storm', 'summit', 'sunset', 'sylvan', 'tango', 'tundra',
  'turtle', 'valley', 'velvet', 'violet', 'walnut', 'willow', 'winter', 'zephyr',
];

const SYMBOLS = '!@#$%&*?+=';

type Caps = 'lower' | 'capitalize' | 'upper' | 'random';
type Sep = 'dash' | 'dot' | 'underscore' | 'space' | 'none';
type Placement = 'end' | 'start' | 'between';

const SEP_CHAR: Record<Sep, string> = {
  dash: '-', dot: '.', underscore: '_', space: ' ', none: '',
};

/** Unbiased integer in [0, max). */
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

function pickWord(): string {
  return WORDS[randInt(WORDS.length)] ?? 'word';
}

function applyCaps(word: string, caps: Caps): string {
  switch (caps) {
    case 'lower':
      return word.toLowerCase();
    case 'upper':
      return word.toUpperCase();
    case 'capitalize':
      return word.charAt(0).toUpperCase() + word.slice(1);
    case 'random':
      return randInt(2) === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1);
    default:
      return word;
  }
}

function entropyBits(
  wordCount: number,
  caps: Caps,
  digits: number,
  useSymbol: boolean,
): number {
  let bits = wordCount * Math.log2(WORDS.length);
  if (caps === 'random') bits += wordCount; // 1 bit per word for case choice
  if (digits > 0) bits += digits * Math.log2(10);
  if (useSymbol) bits += Math.log2(SYMBOLS.length);
  return Math.round(bits);
}

export default function MemorablePasswordGeneratorTool() {
  const [wordCount, setWordCount] = useState(3);
  const [sep, setSep] = useState<Sep>('dash');
  const [caps, setCaps] = useState<Caps>('capitalize');
  const [digits, setDigits] = useState(2);
  const [useSymbol, setUseSymbol] = useState(true);
  const [placement, setPlacement] = useState<Placement>('end');

  const generate = useCallback(() => {
    const sepChar = SEP_CHAR[sep];
    const words = Array.from({ length: wordCount }, () => applyCaps(pickWord(), caps));

    const numBlock = digits > 0
      ? Array.from({ length: digits }, () => randInt(10).toString()).join('')
      : '';
    const sym = useSymbol ? (SYMBOLS[randInt(SYMBOLS.length)] ?? '!') : '';
    const extra = `${numBlock}${sym}`;

    if (extra && placement === 'between' && words.length > 0) {
      const pos = 1 + randInt(words.length - 1 < 1 ? 1 : words.length - 1);
      words.splice(Math.min(pos, words.length), 0, extra);
      return words.join(sepChar);
    }

    const joined = words.join(sepChar);
    if (!extra) return joined;
    if (placement === 'start') return `${extra}${sepChar}${joined}`;
    return `${joined}${sepChar}${extra}`;
  }, [wordCount, sep, caps, digits, useSymbol, placement]);

  const bits = entropyBits(wordCount, caps, digits, useSymbol);

  return (
    <GeneratorList
      generate={generate}
      deps={[wordCount, sep, caps, digits, useSymbol, placement]}
      defaultCount={8}
      maxCount={100}
      downloadName="memorable-passwords.txt"
      label={`Passwords (~${bits} bits)`}
      options={
        <>
          <Field label="Words">
            <Input
              type="number" min={2} max={6}
              value={wordCount}
              onChange={(e) => setWordCount(Math.max(2, Math.min(Number(e.target.value) || 2, 6)))}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dash">Dash -</SelectItem>
                <SelectItem value="dot">Dot .</SelectItem>
                <SelectItem value="underscore">Underscore _</SelectItem>
                <SelectItem value="space">Space</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Case">
            <Select value={caps} onValueChange={(v) => setCaps(v as Caps)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lower">lowercase</SelectItem>
                <SelectItem value="capitalize">Capitalize</SelectItem>
                <SelectItem value="upper">UPPERCASE</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Digits">
            <Input
              type="number" min={0} max={4}
              value={digits}
              onChange={(e) => setDigits(Math.max(0, Math.min(Number(e.target.value) || 0, 4)))}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Symbol">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={useSymbol} onCheckedChange={setUseSymbol} id="sym" />
              <Label htmlFor="sym" className="text-xs text-muted-foreground">Add one</Label>
            </div>
          </Field>
          <Field label="Place extras">
            <Select value={placement} onValueChange={(v) => setPlacement(v as Placement)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="end">At end</SelectItem>
                <SelectItem value="start">At start</SelectItem>
                <SelectItem value="between">Between</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
