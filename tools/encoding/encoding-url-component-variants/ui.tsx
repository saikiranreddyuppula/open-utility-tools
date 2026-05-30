'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'encode' | 'decode';

interface Variant {
  key: string;
  label: string;
  note: string;
  run: (s: string, dir: Dir) => string;
}

// escape() / unescape() are deprecated globals; type-cast access.
const legacyEscape = (globalThis as unknown as { escape: (s: string) => string }).escape;
const legacyUnescape = (globalThis as unknown as { unescape: (s: string) => string }).unescape;

const VARIANTS: Variant[] = [
  {
    key: 'encodeURI',
    label: 'encodeURI',
    note: "Preserves A-Za-z0-9 ; , / ? : @ & = + $ - _ . ! ~ * ' ( ) #",
    run: (s, dir) => (dir === 'encode' ? encodeURI(s) : decodeURI(s)),
  },
  {
    key: 'encodeURIComponent',
    label: 'encodeURIComponent',
    note: "Preserves only A-Za-z0-9 - _ . ! ~ * ' ( )",
    run: (s, dir) => (dir === 'encode' ? encodeURIComponent(s) : decodeURIComponent(s)),
  },
  {
    key: 'escape',
    label: 'escape (legacy)',
    note: 'Uses %uXXXX for non-ASCII. Deprecated; avoid for new code.',
    run: (s, dir) => (dir === 'encode' ? legacyEscape(s) : legacyUnescape(s)),
  },
];

export default function UrlComponentVariants() {
  const [input, setInput] = useState('https://example.com/path?q=hello world & café=naïve#sec');
  const [dir, setDir] = useState<Dir>('encode');

  const results = useMemo(() => {
    if (!input) return { rows: [] as Array<{ key: string; label: string; note: string; value: string; error?: string }> };
    const rows = VARIANTS.map((v) => {
      try {
        return { key: v.key, label: v.label, note: v.note, value: v.run(input, dir) };
      } catch (e) {
        return {
          key: v.key,
          label: v.label,
          note: v.note,
          value: '',
          error: e instanceof Error ? e.message : 'Failed (malformed input for decode).',
        };
      }
    });
    return { rows };
  }, [input, dir]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <div className="p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            rows={4}
            placeholder={dir === 'encode' ? 'Text / URL to encode…' : 'Percent-encoded text to decode…'}
            className="font-mono text-sm"
          />
        </div>
      </Panel>

      {results.rows.map((r) => (
        <Panel key={r.key}>
          <PanelHeader title={r.label}>
            {!r.error && <CopyButton value={() => r.value} />}
          </PanelHeader>
          {r.error ? (
            <div className="p-3">
              <ErrorBanner error={r.error} />
            </div>
          ) : (
            <>
              <div className="break-all p-3 font-mono text-sm">{r.value || '(empty)'}</div>
              <StatBar items={[r.note]} />
            </>
          )}
        </Panel>
      ))}
    </div>
  );
}
