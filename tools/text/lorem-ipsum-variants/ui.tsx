'use client';

import { useMemo, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Deterministic, seedable PRNG so output is reproducible for a given seed.
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

type ThemeKey = 'hipster' | 'corporate' | 'pirate' | 'tech' | 'bacon' | 'cat';
type Unit = 'words' | 'sentences' | 'paragraphs';

const THEMES: Record<ThemeKey, string[]> = {
  hipster: [
    'artisan', 'banjo', 'vinyl', 'kombucha', 'tousled', 'gentrify', 'biodiesel',
    'fixie', 'kale', 'mustache', 'tote', 'bag', 'cardigan', 'flannel', 'narwhal',
    'pour-over', 'cold-pressed', 'beard', 'organic', 'locavore', 'sustainable',
    'meditation', 'cronut', 'gluten-free', 'lo-fi', 'authentic', 'vegan', 'craft',
    'brunch', 'twee', 'mixtape', 'polaroid', 'typewriter', 'succulents', 'thundercats',
    'chambray', 'helvetica', 'umami', 'small-batch', 'bespoke', 'wayfarers', 'forage',
    'pickled', 'taxidermy', 'normcore', 'plaid', 'roof', 'party', 'hashtag', 'venmo',
  ],
  corporate: [
    'synergy', 'leverage', 'bandwidth', 'paradigm', 'scalable', 'holistic', 'pivot',
    'disrupt', 'streamline', 'optimize', 'deliverable', 'stakeholder', 'actionable',
    'value-add', 'low-hanging', 'fruit', 'circle', 'back', 'touch', 'base', 'ecosystem',
    'agile', 'roadmap', 'KPI', 'ROI', 'alignment', 'cross-functional', 'ideate',
    'monetize', 'frictionless', 'omnichannel', 'best-in-class', 'thought', 'leadership',
    'core', 'competency', 'go-to-market', 'mindshare', 'incentivize', 'operationalize',
    'bleeding-edge', 'wheelhouse', 'deep-dive', 'win-win', 'move', 'needle', 'granular',
    'empower', 'mission-critical', 'robust',
  ],
  pirate: [
    'ahoy', 'matey', 'avast', 'arrr', 'booty', 'doubloon', 'plunder', 'scallywag',
    'landlubber', 'grog', 'rum', 'parley', 'cutlass', 'galleon', 'mizzenmast', 'jolly',
    'roger', 'keelhaul', 'scurvy', 'kraken', 'bilge', 'rat', 'gangway', 'hornswaggle',
    'shiver', 'timbers', 'sea', 'dog', 'plank', 'cannon', 'crow', 'nest', 'spyglass',
    'treasure', 'maroon', 'buccaneer', 'corsair', 'swab', 'deck', 'pieces', 'eight',
    'aye', 'yo-ho-ho', 'bounty', 'mutiny', 'anchor', 'starboard', 'port', 'hearties',
  ],
  tech: [
    'refactor', 'kubernetes', 'docker', 'async', 'callback', 'closure', 'webhook',
    'middleware', 'endpoint', 'payload', 'idempotent', 'serverless', 'microservice',
    'latency', 'throughput', 'cache', 'mutex', 'deadlock', 'race', 'condition', 'commit',
    'rebase', 'merge', 'pipeline', 'deploy', 'rollback', 'feature-flag', 'observability',
    'telemetry', 'recursion', 'pointer', 'heap', 'stack', 'overflow', 'compiler',
    'linter', 'typescript', 'monad', 'lambda', 'tensor', 'gradient', 'token', 'embedding',
    'regex', 'kernel', 'thread', 'socket', 'protocol', 'schema',
  ],
  bacon: [
    'bacon', 'ribeye', 'brisket', 'pork', 'belly', 'pancetta', 'prosciutto', 'salami',
    'sausage', 'meatball', 'meatloaf', 'tenderloin', 'sirloin', 'chuck', 'flank', 'shank',
    'jerky', 'ham', 'hock', 'turkey', 'chicken', 'drumstick', 'short', 'ribs', 'ground',
    'round', 'kielbasa', 'bresaola', 'capicola', 'pastrami', 'cured', 'smoked', 'grilled',
    'frankfurter', 'andouille', 'chorizo', 'venison', 'beef', 'cow', 'pig', 'leberkas',
    'shankle', 'porchetta', 'spare', 'rump', 'fatback', 'strip', 'steak', 'cutlet', 'loin',
  ],
  cat: [
    'meow', 'purr', 'whiskers', 'nap', 'sunbeam', 'knock', 'cup', 'off', 'table', 'hiss',
    'scratch', 'kibble', 'hairball', 'pounce', 'zoomies', 'box', 'biscuit', 'loaf', 'paw',
    'tail', 'flick', 'litter', 'mouse', 'feather', 'string', 'laser', 'dot', 'window',
    'bird', 'judge', 'stare', 'ignore', 'human', 'feed', 'me', 'midnight', 'sprint',
    'curl', 'lap', 'kneading', 'chirp', 'tuna', 'salmon', 'cardboard', 'cozy', 'sleep',
    'sixteen', 'hours', 'majestic', 'fluffy',
  ],
};

const THEME_LABELS: Record<ThemeKey, string> = {
  hipster: 'Hipster Ipsum',
  corporate: 'Corporate Buzzword Ipsum',
  pirate: 'Pirate Ipsum',
  tech: 'Tech / Developer Ipsum',
  bacon: 'Bacon Ipsum',
  cat: 'Cat Ipsum',
};

function pick(words: string[], rnd: () => number): string {
  const idx = Math.floor(rnd() * words.length);
  return words[idx] ?? words[0] ?? 'lorem';
}

function buildSentence(
  words: string[],
  rnd: () => number,
  minLen: number,
  maxLen: number,
): string {
  const span = Math.max(0, maxLen - minLen);
  const len = minLen + Math.floor(rnd() * (span + 1));
  const parts: string[] = [];
  for (let i = 0; i < len; i++) parts.push(pick(words, rnd));
  // Occasionally insert commas for natural rhythm.
  const joined = parts
    .map((w, i) => (i > 0 && i < parts.length - 1 && rnd() < 0.12 ? `${w},` : w))
    .join(' ');
  const capped = joined.charAt(0).toUpperCase() + joined.slice(1);
  const endings = ['.', '.', '.', '!', '?'];
  const end = endings[Math.floor(rnd() * endings.length)] ?? '.';
  return capped + end;
}

export default function ThemedPlaceholderTextGenerator() {
  const [theme, setTheme] = useState<ThemeKey>('hipster');
  const [unit, setUnit] = useState<Unit>('paragraphs');
  const [amount, setAmount] = useState(3);
  const [minLen, setMinLen] = useState(6);
  const [maxLen, setMaxLen] = useState(14);
  const [startClassic, setStartClassic] = useState(true);
  const [wrapP, setWrapP] = useState(false);
  const [seed, setSeed] = useState('1');

  const lo = Math.min(minLen, maxLen);
  const hi = Math.max(minLen, maxLen);

  // A unique base seed per generated item so each block differs, yet stays
  // reproducible for a given seed input.
  const baseSeed = useMemo(() => {
    const n = Number(seed);
    if (Number.isFinite(n)) return Math.floor(Math.abs(n)) || 1;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }, [seed]);

  let callIndex = 0;

  const generate = (): string => {
    const words = THEMES[theme];
    const rnd = mulberry32(baseSeed + callIndex * 7919);
    callIndex += 1;

    if (unit === 'words') {
      const out: string[] = [];
      for (let i = 0; i < amount; i++) out.push(pick(words, rnd));
      if (startClassic) out.unshift('lorem', 'ipsum');
      const text = out.join(' ');
      return wrapP ? `<p>${text}</p>` : text;
    }

    const makeSentence = () => buildSentence(words, rnd, lo, hi);

    if (unit === 'sentences') {
      const sentences: string[] = [];
      for (let i = 0; i < amount; i++) sentences.push(makeSentence());
      let text = sentences.join(' ');
      if (startClassic) text = `Lorem ipsum ${text}`;
      return wrapP ? `<p>${text}</p>` : text;
    }

    // paragraphs
    const paras: string[] = [];
    for (let p = 0; p < amount; p++) {
      const sCount = 3 + Math.floor(rnd() * 4); // 3..6 sentences
      const sentences: string[] = [];
      for (let i = 0; i < sCount; i++) sentences.push(makeSentence());
      let para = sentences.join(' ');
      if (p === 0 && startClassic) para = `Lorem ipsum ${para}`;
      paras.push(wrapP ? `<p>${para}</p>` : para);
    }
    return paras.join(wrapP ? '\n' : '\n\n');
  };

  const unitMax = unit === 'words' ? 200 : unit === 'sentences' ? 30 : 12;
  const safeAmount = Math.min(amount, unitMax);

  return (
    <GeneratorList
      generate={generate}
      deps={[theme, unit, safeAmount, lo, hi, startClassic, wrapP, baseSeed]}
      defaultCount={1}
      maxCount={50}
      downloadName="placeholder-text.txt"
      label={`${THEME_LABELS[theme]} · ${safeAmount} ${unit}`}
      options={
        <>
          <Field label="Theme">
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hipster">Hipster Ipsum</SelectItem>
                <SelectItem value="corporate">Corporate Buzzword</SelectItem>
                <SelectItem value="pirate">Pirate Ipsum</SelectItem>
                <SelectItem value="tech">Tech / Developer</SelectItem>
                <SelectItem value="bacon">Bacon Ipsum</SelectItem>
                <SelectItem value="cat">Cat Ipsum</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Generate by">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paragraphs">Paragraphs</SelectItem>
                <SelectItem value="sentences">Sentences</SelectItem>
                <SelectItem value="words">Words</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Amount · ${safeAmount}`} className="min-w-44">
            <Slider
              value={[safeAmount]}
              min={1}
              max={unitMax}
              step={1}
              onValueChange={(v) => setAmount(v[0] ?? 1)}
              className="mt-2.5"
            />
          </Field>
          <Field label={`Sentence length · ${lo}–${hi}`} className="min-w-52">
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                value={[minLen]}
                min={3}
                max={20}
                step={1}
                onValueChange={(v) => setMinLen(v[0] ?? 6)}
              />
              <Slider
                value={[maxLen]}
                min={3}
                max={30}
                step={1}
                onValueChange={(v) => setMaxLen(v[0] ?? 14)}
              />
            </div>
          </Field>
          <Field label="Seed">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Start with Lorem ipsum">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={startClassic} onCheckedChange={setStartClassic} />
              <Label className="text-xs text-muted-foreground">classic opener</Label>
            </div>
          </Field>
          <Field label="Wrap in <p>">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={wrapP} onCheckedChange={setWrapP} />
              <Label className="text-xs text-muted-foreground">HTML tags</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
