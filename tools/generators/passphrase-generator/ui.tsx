'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';
import { generatePassphrase } from '@/lib/generators/password';

export default function PassphraseGeneratorTool() {
  const [words, setWords] = useState(5);
  const [sep, setSep] = useState('-');
  const [capitalize, setCapitalize] = useState(true);

  const generate = useCallback(
    () => generatePassphrase(words, sep || '-', capitalize),
    [words, sep, capitalize]
  );

  return (
    <GeneratorList
      generate={generate}
      deps={[words, sep, capitalize]}
      defaultCount={5}
      downloadName="passphrases.txt"
      label="Passphrases"
      options={
        <>
          <Field label="Words">
            <Input
              type="number"
              min={3}
              max={12}
              value={words}
              onChange={(e) => setWords(Math.max(3, Math.min(Number(e.target.value) || 5, 12)))}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Separator">
            <Input value={sep} onChange={(e) => setSep(e.target.value.slice(0, 1))} className="w-16 text-center font-mono" maxLength={1} />
          </Field>
          <Field label="Capitalize">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={capitalize} onCheckedChange={setCapitalize} id="cap" />
              <Label htmlFor="cap" className="text-xs text-muted-foreground">Title-Case</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
