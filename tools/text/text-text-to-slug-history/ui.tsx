'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Output = 'mapping' | 'slugs';

function slugify(title: string, sep: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, sep);
  return s || 'untitled';
}

export default function SlugDisambiguatorTool() {
  const [sep, setSep] = useState('-');
  const [skipBlank, setSkipBlank] = useState(true);
  const [output, setOutput] = useState<Output>('mapping');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const sepChar = sep.slice(0, 1) || '-';
      const lines = input.split('\n');
      const seen = new Map<string, number>();
      const rows: { title: string; slug: string }[] = [];

      for (const raw of lines) {
        const title = raw;
        if (skipBlank && title.trim().length === 0) continue;
        const base = slugify(title, sepChar);
        const count = seen.get(base) ?? 0;
        const slug = count === 0 ? base : `${base}${sepChar}${count + 1}`;
        seen.set(base, count + 1);
        rows.push({ title: title.trim(), slug });
      }

      if (rows.length === 0) return '';
      if (output === 'slugs') return rows.map((r) => r.slug).join('\n');

      const titleWidth = Math.min(
        40,
        Math.max(5, ...rows.map((r) => (r.title || '(blank)').length))
      );
      return rows
        .map((r) => `${(r.title || '(blank)').padEnd(titleWidth)}  →  ${r.slug}`)
        .join('\n');
    },
    [sep, skipBlank, output]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sep, skipBlank, output]}
      inputLabel="Titles (one per line)"
      outputLabel="Unique slugs"
      sample={
        'Hello World\nHello World\nGetting Started\nHello, World!\nGetting Started\nAbout Us'
      }
      downloadName="slugs.txt"
      options={
        <>
          <Field label="Separator">
            <Input
              value={sep}
              onChange={(e) => setSep(e.target.value.slice(0, 1))}
              maxLength={1}
              className="w-16 text-center font-mono"
            />
          </Field>
          <Field label="Output">
            <Tabs value={output} onValueChange={(v) => setOutput(v as Output)}>
              <TabsList>
                <TabsTrigger value="mapping">Title → slug</TabsTrigger>
                <TabsTrigger value="slugs">Slugs only</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Skip blank lines">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={skipBlank} onCheckedChange={setSkipBlank} id="slug-blank" />
              <Label htmlFor="slug-blank" className="text-xs text-muted-foreground">
                Ignore empties
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
