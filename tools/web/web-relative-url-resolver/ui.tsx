'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SAMPLE = [
  '../img/logo.png',
  './styles/main.css',
  '?page=2',
  '#section-3',
  '//cdn.example.com/lib.js',
  '/absolute/path',
  'https://other.example.org/full',
].join('\n');

export default function RelativeUrlResolverTool() {
  const [base, setBase] = useState('https://example.com/docs/guide/intro.html?x=1#top');
  const [breakdown, setBreakdown] = useState(true);

  const transform = useMemo(
    () => (input: string) => {
      const baseTrim = base.trim();
      if (!baseTrim) throw new Error('Enter a base URL.');
      let baseUrl: URL;
      try {
        baseUrl = new URL(baseTrim);
      } catch {
        throw new Error('Base URL is invalid. Include a scheme, e.g. https://');
      }

      const lines = input.split('\n');
      const out: string[] = [];

      for (const raw of lines) {
        const ref = raw.trim();
        if (ref === '') {
          out.push('');
          continue;
        }
        try {
          const resolved = new URL(ref, baseUrl.href);
          if (breakdown) {
            out.push(`${ref}`);
            out.push(`  → ${resolved.href}`);
            out.push(
              `     scheme=${resolved.protocol.replace(/:$/, '')} host=${resolved.host || '(none)'} path=${resolved.pathname || '/'} query=${resolved.search || '(none)'} frag=${resolved.hash || '(none)'}`,
            );
          } else {
            out.push(resolved.href);
          }
        } catch {
          out.push(`${ref}`);
          out.push('  ⚠ could not resolve (malformed reference)');
        }
      }

      return out.join('\n');
    },
    [base, breakdown],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Base URL" className="min-w-[300px] flex-1">
        <Input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="https://example.com/docs/page.html"
          className="font-mono"
          spellCheck={false}
        />
      </Field>
      <Field label="Show component breakdown">
        <Switch checked={breakdown} onCheckedChange={setBreakdown} />
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[base, breakdown]}
      inputLabel="Relative references (one per line)"
      outputLabel="Resolved"
      inputPlaceholder="../img/a.png&#10;?q=1&#10;#top"
      sample={SAMPLE}
      downloadName="resolved-urls.txt"
      options={options}
    />
  );
}
