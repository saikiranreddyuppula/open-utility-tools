'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Mode = 'teams' | 'perGroup';

interface Team {
  name: string;
  members: string[];
}

const SAMPLE = ['Ava', 'Ben', 'Chloe', 'Diego', 'Esha', 'Finn', 'Grace', 'Hiro', 'Ivy', 'Jonas', 'Kira', 'Leo', 'Mara'].join('\n');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Crypto-seeded Fisher-Yates shuffle returning a new array. */
function shuffle(input: string[]): string[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const rand = new Uint32Array(1);
    wc.getRandomValues(rand);
    const j = (rand[0] ?? 0) % (i + 1);
    const tmp = arr[i] ?? '';
    arr[i] = arr[j] ?? '';
    arr[j] = tmp;
  }
  return arr;
}

function teamLabel(index: number): string {
  // Team A, B, … Z, then AA, AB, …
  let n = index;
  let label = '';
  do {
    label = (LETTERS[n % 26] ?? 'A') + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Team ${label}`;
}

export default function TeamShuffler() {
  const [raw, setRaw] = useState(SAMPLE);
  const [mode, setMode] = useState<Mode>('teams');
  const [value, setValue] = useState('3');
  const [showLeftover, setShowLeftover] = useState(true);
  const [seed, setSeed] = useState(0); // bump to re-roll

  const result = useMemo<{ teams: Team[]; total: number; leftover: string[] } | { error: string }>(() => {
    void seed;
    const names = raw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (names.length === 0) return { error: 'Enter at least one name (one per line).' };

    const v = Number.parseInt(value, 10);
    if (!Number.isFinite(v) || v < 1) return { error: 'Enter a positive whole number.' };

    const shuffled = shuffle(names);

    if (mode === 'teams') {
      const k = Math.min(v, shuffled.length);
      const teams: Team[] = Array.from({ length: k }, (_, i) => ({ name: teamLabel(i), members: [] }));
      // Round-robin so team sizes differ by at most 1.
      shuffled.forEach((person, i) => {
        const team = teams[i % k];
        if (team) team.members.push(person);
      });
      return { teams, total: names.length, leftover: [] };
    }

    // perGroup: chunk sequentially; last group may be smaller.
    const size = v;
    const teams: Team[] = [];
    for (let i = 0; i < shuffled.length; i += size) {
      teams.push({ name: teamLabel(teams.length), members: shuffled.slice(i, i + size) });
    }
    const last = teams[teams.length - 1];
    const leftover = last && last.members.length < size ? last.members.slice() : [];
    return { teams, total: names.length, leftover };
  }, [raw, mode, value, seed]);

  const copyText = useMemo(() => {
    if ('error' in result) return '';
    return result.teams
      .map((t) => `${t.name} (${t.members.length}):\n${t.members.map((m) => `  - ${m}`).join('\n')}`)
      .join('\n\n');
  }, [result]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Names (one per line)">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" />
            Re-roll
          </Button>
        </PanelHeader>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          rows={6}
          className="font-mono text-sm"
        />
        <OptionsBar>
          <Field label="Split by">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="teams">Number of teams</TabsTrigger>
                <TabsTrigger value="perGroup">People per group</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={mode === 'teams' ? 'Teams' : 'Per group'}>
            <Input
              type="number"
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Highlight leftover">
            <Switch checked={showLeftover} onCheckedChange={setShowLeftover} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${result.teams.length} group${result.teams.length === 1 ? '' : 's'}`}>
            <CopyButton value={() => copyText} label="Copy all" />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.teams.map((t) => (
              <div key={t.name} className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{t.members.length}</span>
                </div>
                <ul className="space-y-1">
                  {t.members.map((m, i) => (
                    <li key={`${m}-${i}`} className="text-sm">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {showLeftover && result.leftover.length > 0 ? (
            <div className="px-3 pb-3">
              <span className="text-xs text-muted-foreground">
                Leftover (smaller final group): {result.leftover.join(', ')}
              </span>
            </div>
          ) : null}
          <StatBar
            items={[
              `${result.total} names`,
              `${result.teams.length} groups`,
              mode === 'teams' ? 'round-robin balanced' : 'sequential chunks',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
