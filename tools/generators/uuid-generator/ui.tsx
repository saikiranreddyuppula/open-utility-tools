'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';
import { uuidV4, uuidV7 } from '@/lib/generators/ids';

export default function UuidGeneratorTool() {
  const [version, setVersion] = useState<'v4' | 'v7'>('v4');
  const [upper, setUpper] = useState(false);
  const [braces, setBraces] = useState(false);

  const generate = useCallback(() => {
    let u = version === 'v4' ? uuidV4() : uuidV7();
    if (upper) u = u.toUpperCase();
    if (braces) u = `{${u}}`;
    return u;
  }, [version, upper, braces]);

  return (
    <GeneratorList
      generate={generate}
      deps={[version, upper, braces]}
      downloadName="uuids.txt"
      label="UUIDs"
      options={
        <>
          <Field label="Version">
            <Tabs value={version} onValueChange={(v) => setVersion(v as 'v4' | 'v7')}>
              <TabsList>
                <TabsTrigger value="v4">v4</TabsTrigger>
                <TabsTrigger value="v7">v7</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Uppercase">
            <div className="flex h-8 items-center gap-2">
              <Switch id="uc" checked={upper} onCheckedChange={setUpper} />
              <Label htmlFor="uc" className="text-xs text-muted-foreground">
                A–F
              </Label>
            </div>
          </Field>
          <Field label="Braces">
            <div className="flex h-8 items-center gap-2">
              <Switch id="br" checked={braces} onCheckedChange={setBraces} />
              <Label htmlFor="br" className="text-xs text-muted-foreground">
                {'{…}'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
