'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type CategoryKey =
  | 'smileys'
  | 'animals'
  | 'food'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

type Sep = 'none' | 'space' | 'comma';

const EMOJI: Record<CategoryKey, string[]> = {
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '😉', '😊',
    '😍', '😘', '😜', '🤔', '😐', '😴', '😎', '🥳', '😭', '😡',
    '🤩', '😇', '🤗', '🤯', '🥰',
  ],
  animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🦄', '🐝', '🦋', '🐢',
    '🐙', '🦀', '🐬', '🦉', '🦓',
  ],
  food: [
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝',
    '🍅', '🥑', '🌽', '🍕', '🍔', '🌮', '🍣', '🍩', '🍪', '🍰',
    '🍫', '🍿', '☕', '🍺', '🥗',
  ],
  travel: [
    '🚗', '🚕', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚲', '🛵', '✈️',
    '🚀', '🚁', '⛵', '🚢', '🚂', '🗺️', '🗽', '🗼', '🏰', '⛰️',
    '🏖️', '🏝️', '🌋', '🎡', '🎢',
  ],
  objects: [
    '⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '📷', '📸', '🎥', '📺',
    '🔋', '💡', '🔦', '📚', '✏️', '🖊️', '📎', '📌', '✂️', '🔑',
    '🔒', '🔨', '🧰', '🔬', '🧪',
  ],
  symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '✨', '⭐', '🌟',
    '⚡', '🔥', '💧', '☀️', '🌈', '✅', '❌', '⚠️', '♻️', '➕',
    '➖', '✔️', '❓', '❗', '💯',
  ],
  flags: [
    '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🇺🇸', '🇬🇧', '🇨🇦', '🇩🇪', '🇫🇷',
    '🇮🇳', '🇯🇵', '🇨🇳', '🇧🇷', '🇮🇹', '🇪🇸', '🇰🇷', '🇲🇽', '🇦🇺', '🇿🇦',
    '🇳🇱', '🇸🇪', '🇨🇭', '🇷🇺', '🇦🇷',
  ],
};

const CATEGORY_ORDER: CategoryKey[] = [
  'smileys',
  'animals',
  'food',
  'travel',
  'objects',
  'symbols',
  'flags',
];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  smileys: 'Smileys',
  animals: 'Animals',
  food: 'Food',
  travel: 'Travel',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};

/** Unbiased index in [0, n) via rejection sampling on a 32-bit value. */
function randIndex(n: number): number {
  if (n <= 1) return 0;
  const limit = Math.floor(4294967296 / n) * n;
  const a = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(a);
    v = a[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function codepoints(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0);
      return cp === undefined ? '?' : `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    })
    .join(' ');
}

export default function RandomEmojiPicker() {
  const [enabled, setEnabled] = useState<Record<CategoryKey, boolean>>({
    smileys: true,
    animals: true,
    food: true,
    travel: false,
    objects: false,
    symbols: false,
    flags: false,
  });
  const [count, setCount] = useState('20');
  const [allowDup, setAllowDup] = useState(true);
  const [showCodepoints, setShowCodepoints] = useState(false);
  const [sep, setSep] = useState<Sep>('space');
  const [seed, setSeed] = useState(0);

  const result = useMemo(() => {
    void seed;
    const pool: string[] = CATEGORY_ORDER.filter((k) => enabled[k]).flatMap(
      (k) => EMOJI[k],
    );
    if (pool.length === 0) return { error: 'Select at least one category.' };
    const requested = Math.min(200, Math.max(1, Math.round(Number(count) || 1)));
    const n = allowDup ? requested : Math.min(requested, pool.length);

    const picks: string[] = [];
    if (allowDup) {
      for (let i = 0; i < n; i += 1) {
        picks.push(pool[randIndex(pool.length)] ?? '❓');
      }
    } else {
      const bag = [...pool];
      for (let i = 0; i < n && bag.length > 0; i += 1) {
        const idx = randIndex(bag.length);
        const taken = bag.splice(idx, 1)[0];
        picks.push(taken ?? '❓');
      }
    }
    return { picks, poolSize: pool.length, capped: !allowDup && requested > pool.length };
  }, [enabled, count, allowDup, seed]);

  const joined = useMemo(() => {
    if ('error' in result) return '';
    const glue = sep === 'space' ? ' ' : sep === 'comma' ? ', ' : '';
    return result.picks.join(glue);
  }, [result, sep]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Categories" className="min-w-[260px]">
          <div className="flex h-9 flex-wrap items-center gap-x-3 gap-y-1">
            {CATEGORY_ORDER.map((k) => (
              <label key={k} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={enabled[k]}
                  onCheckedChange={(c) =>
                    setEnabled((prev) => ({ ...prev, [k]: c === true }))
                  }
                />
                {CATEGORY_LABEL[k]}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Count" className="w-24">
          <Input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Separator">
          <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="space">Space</SelectItem>
              <SelectItem value="comma">Comma</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Duplicates">
          <div className="flex h-9 items-center gap-2">
            <Switch id="emoji-dup" checked={allowDup} onCheckedChange={setAllowDup} />
            <Label htmlFor="emoji-dup" className="text-xs">
              Allow
            </Label>
          </div>
        </Field>
        <Field label="Codepoints">
          <div className="flex h-9 items-center gap-2">
            <Switch
              id="emoji-cp"
              checked={showCodepoints}
              onCheckedChange={setShowCodepoints}
            />
            <Label htmlFor="emoji-cp" className="text-xs">
              Show list
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Emoji">
            <CopyButton value={() => joined} label="Copy all" disabled={!joined} />
            <DownloadButton data={() => joined} filename="emoji.txt" disabled={!joined} />
          </PanelHeader>
          <div className="break-words p-4 text-2xl leading-relaxed">{joined}</div>
          {showCodepoints && (
            <div className="max-h-[300px] divide-y overflow-auto border-t">
              {result.picks.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                    {i + 1}
                  </span>
                  <span className="w-8 shrink-0 text-lg">{e}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {codepoints(e)}
                  </code>
                  <CopyButton value={e} size="icon-sm" />
                </div>
              ))}
            </div>
          )}
          <StatBar
            items={[
              `${result.picks.length} emoji`,
              `pool: ${result.poolSize}`,
              result.capped && 'capped to pool (no duplicates)',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
