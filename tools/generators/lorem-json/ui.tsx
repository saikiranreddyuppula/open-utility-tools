'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { generateFake, FAKE_FIELDS } from '@/lib/generators/fake';

export default function MockDataTool() {
  const [count, setCount] = useState(10);
  const [fields, setFields] = useState<Record<string, boolean>>(
    Object.fromEntries(FAKE_FIELDS.map((f) => [f, true]))
  );
  const [out, setOut] = useState('');

  const regen = useCallback(() => {
    setOut(JSON.stringify(generateFake({ count: Math.max(1, Math.min(count, 1000)), fields }), null, 2));
  }, [count, fields]);

  useEffect(() => {
    regen();
  }, [regen]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Records">
          <Input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 1000)))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Fields">
          <div className="flex h-8 flex-wrap items-center gap-2.5">
            {FAKE_FIELDS.map((f) => (
              <label key={f} className="flex items-center gap-1 text-xs">
                <Switch
                  checked={fields[f]}
                  onCheckedChange={(v) => setFields((p) => ({ ...p, [f]: v }))}
                />
                {f}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex items-end">
          <Button size="sm" variant="secondary" onClick={regen}>
            <RefreshCw className="size-3.5" /> Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="JSON">
          <CopyButton value={() => out} disabled={!out} />
          <DownloadButton data={() => out} filename="mock-data.json" mime="application/json" disabled={!out} />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto p-3 font-mono text-xs">{out}</pre>
      </Panel>
    </div>
  );
}
