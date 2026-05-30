'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TagSource = 'manual' | 'sequential' | 'words' | 'date';

const WORDS = [
  'shop',
  'news',
  'social',
  'bank',
  'work',
  'dev',
  'signup',
  'spam',
  'deals',
  'forum',
  'app',
  'cloud',
  'team',
  'family',
  'travel',
  'games',
];

/** Insert dots into a username in every combination, then sample up to `limit`. */
function dotPermutations(user: string, limit: number): string[] {
  const n = user.length;
  if (n <= 1) return [user];
  // Cap gap count so 2^gaps stays a safe positive 32-bit int.
  const gaps = Math.min(n - 1, 24); // possible dot positions between chars
  const total = 1 << gaps; // 2^gaps combinations
  const out: string[] = [];
  const cap = Math.min(total, Math.max(1, limit));
  // Evenly sample distinct gap-bitmasks across [0, total) for variety.
  const step = total <= cap ? 1 : Math.floor(total / cap);
  const seen = new Set<string>();
  for (let k = 0, mask = 0; out.length < cap && mask < total; k += 1, mask += step) {
    let s = '';
    for (let i = 0; i < n; i += 1) {
      s += user[i] ?? '';
      if (i < n - 1 && (mask & (1 << i)) !== 0) s += '.';
    }
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export default function EmailAliasGeneratorTool() {
  const [email, setEmail] = useState('john.doe@gmail.com');
  const [usePlus, setUsePlus] = useState(true);
  const [useDots, setUseDots] = useState(true);
  const [useCatchAll, setUseCatchAll] = useState(false);
  const [tagSource, setTagSource] = useState<TagSource>('words');
  const [manualTags, setManualTags] = useState('newsletter\nshopping\nbanking');
  const [variants, setVariants] = useState(10);
  const [lowercase, setLowercase] = useState(true);

  const safeVariants = Number.isFinite(variants)
    ? Math.min(200, Math.max(1, Math.floor(variants)))
    : 10;

  const result = useMemo(() => {
    const raw = email.trim();
    const at = raw.indexOf('@');
    if (at <= 0 || at === raw.length - 1) {
      return { kind: 'error' as const, error: 'Enter a valid email like user@domain.com.' };
    }
    let user = raw.slice(0, at);
    let domain = raw.slice(at + 1);
    if (lowercase) {
      user = user.toLowerCase();
      domain = domain.toLowerCase();
    }
    // strip any existing +tag from the user part
    const plusIdx = user.indexOf('+');
    const baseUser = plusIdx >= 0 ? user.slice(0, plusIdx) : user;

    const aliases: string[] = [];

    if (usePlus) {
      let tags: string[] = [];
      if (tagSource === 'manual') {
        tags = manualTags
          .split(/[\n,]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (tagSource === 'sequential') {
        tags = Array.from({ length: safeVariants }, (_, i) => String(i + 1).padStart(2, '0'));
      } else if (tagSource === 'words') {
        tags = Array.from({ length: safeVariants }, (_, i) => WORDS[i % WORDS.length] ?? `tag${i}`);
      } else {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        tags = Array.from(
          { length: safeVariants },
          (_, i) => `${y}${m}${d}-${String(i + 1).padStart(2, '0')}`
        );
      }
      for (const t of tags.slice(0, safeVariants)) {
        const tag = lowercase ? t.toLowerCase() : t;
        aliases.push(`${baseUser}+${tag}@${domain}`);
      }
    }

    if (useDots) {
      const perms = dotPermutations(baseUser, safeVariants);
      for (const p of perms) {
        const a = `${p}@${domain}`;
        if (!aliases.includes(a)) aliases.push(a);
      }
    }

    if (useCatchAll) {
      const prefixes = ['info', 'hello', 'contact', 'me', 'mail'];
      for (const pre of prefixes.slice(0, Math.min(prefixes.length, safeVariants))) {
        aliases.push(`${pre}.${baseUser}@${domain}`);
      }
    }

    if (aliases.length === 0) {
      return { kind: 'error' as const, error: 'Enable at least one alias strategy.' };
    }

    return { kind: 'list' as const, aliases, baseUser, domain };
  }, [email, usePlus, useDots, useCatchAll, tagSource, manualTags, safeVariants, lowercase]);

  const allText = result.kind === 'list' ? result.aliases.join('\n') : '';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Base email" className="min-w-[240px] flex-1">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-mono"
            placeholder="user@domain.com"
          />
        </Field>
        <Field label="Variants">
          <Input
            type="number"
            min={1}
            max={200}
            value={Number.isFinite(variants) ? variants : 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              setVariants(Number.isFinite(n) ? Math.min(200, Math.max(1, Math.floor(n))) : 1);
            }}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Tag source">
          <Select value={tagSource} onValueChange={(v) => setTagSource(v as TagSource)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="words">Word list</SelectItem>
              <SelectItem value="sequential">Sequential</SelectItem>
              <SelectItem value="date">Date-based</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={usePlus} onCheckedChange={setUsePlus} id="plus" />
          <Label htmlFor="plus" className="text-xs text-muted-foreground">
            Plus tags
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={useDots} onCheckedChange={setUseDots} id="dots" />
          <Label htmlFor="dots" className="text-xs text-muted-foreground">
            Gmail dot trick
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={useCatchAll} onCheckedChange={setUseCatchAll} id="catch" />
          <Label htmlFor="catch" className="text-xs text-muted-foreground">
            Catch-all prefixes
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={lowercase} onCheckedChange={setLowercase} id="lc" />
          <Label htmlFor="lc" className="text-xs text-muted-foreground">
            Lowercase
          </Label>
        </label>
      </OptionsBar>

      {usePlus && tagSource === 'manual' && (
        <Panel>
          <PanelHeader title="Manual tags (one per line or comma-separated)" />
          <Textarea
            value={manualTags}
            onChange={(e) => setManualTags(e.target.value)}
            spellCheck={false}
            className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      )}

      {result.kind === 'error' ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Aliases">
            <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
            <DownloadButton data={() => allText} filename="email-aliases.txt" disabled={!allText} />
          </PanelHeader>
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.aliases.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{a}</code>
                <CopyButton value={a} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${result.aliases.length.toLocaleString()} aliases`, `@${result.domain}`]} />
        </Panel>
      )}
    </div>
  );
}
