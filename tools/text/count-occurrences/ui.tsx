'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';

export default function CountOccurrencesTool() {
  const [text, setText] = useState('');
  const [needle, setNeedle] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [ci, setCi] = useState(true);

  const { count, error } = useMemo(() => {
    if (!text || !needle) return { count: 0, error: null };
    try {
      const flags = `g${ci ? 'i' : ''}`;
      const pattern = useRegex ? needle : needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = text.match(new RegExp(pattern, flags));
      return { count: matches ? matches.length : 0, error: null };
    } catch (e) {
      return { count: 0, error: e instanceof Error ? e.message : 'Invalid regex' };
    }
  }, [text, needle, useRegex, ci]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Find" className="flex-1">
          <Input value={needle} onChange={(e) => setNeedle(e.target.value)} className="font-mono" placeholder="substring or regex" />
        </Field>
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs"><Switch checked={useRegex} onCheckedChange={setUseRegex} /> regex</label>
            <label className="flex items-center gap-1.5 text-xs"><Switch checked={ci} onCheckedChange={setCi} /> ignore case</label>
          </div>
        </Field>
      </OptionsBar>

      {error && <ErrorBanner error={error} />}

      <div className="rounded-lg border bg-card p-4 text-center">
        <span className="font-mono text-3xl font-semibold tabular">{count}</span>
        <span className="ml-2 text-sm text-muted-foreground">occurrence{count === 1 ? '' : 's'}</span>
      </div>

      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to search…"
          spellCheck={false}
          className="min-h-40 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>
    </div>
  );
}
