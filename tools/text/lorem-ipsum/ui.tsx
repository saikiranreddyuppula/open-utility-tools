'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { generateLorem, type LoremOptions } from '@/lib/generators/lorem';

export default function LoremIpsumTool() {
  const [unit, setUnit] = useState<LoremOptions['unit']>('paragraphs');
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [out, setOut] = useState('');

  const regen = useCallback(() => {
    setOut(generateLorem({ unit, count, startWithLorem }));
  }, [unit, count, startWithLorem]);

  useEffect(() => {
    regen();
  }, [regen]);

  const words = out.trim() ? out.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Unit">
          <Tabs value={unit} onValueChange={(v) => setUnit(v as LoremOptions['unit'])}>
            <TabsList>
              <TabsTrigger value="paragraphs">Paragraphs</TabsTrigger>
              <TabsTrigger value="sentences">Sentences</TabsTrigger>
              <TabsTrigger value="words">Words</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 100)))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Start with Lorem">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={startWithLorem} onCheckedChange={setStartWithLorem} />
            <Label className="text-xs text-muted-foreground">classic opener</Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Lorem ipsum">
          <Button variant="ghost" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
          <CopyButton value={out} disabled={!out} />
        </PanelHeader>
        <Textarea
          value={out}
          readOnly
          className="min-h-48 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${words.toLocaleString()} words · ${out.length.toLocaleString()} chars`]} />
      </Panel>
    </div>
  );
}
