'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Layout = 'lines' | 'commas';

const SAMPLE = `Big shoutout to @AdaLovelace and @ada_lovelace! 🎉
Trading $AAPL and $TSLA today. Read more at https://example.com/post?id=1 and http://news.example.org.
#coding #CODING #webdev — follow @ada_lovelace for tips.`;

function collect(text: string, re: RegExp, stripSymbol: boolean, ciDedupe: boolean): string[] {
  const seen = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw) continue;
    const value = stripSymbol ? raw.replace(/^[@#$]/, '') : raw;
    const key = ciDedupe ? value.toLowerCase() : value;
    if (!seen.has(key)) seen.set(key, value);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

export default function MentionExtractorTool() {
  const [ciDedupe, setCiDedupe] = useState(true);
  const [stripSymbol, setStripSymbol] = useState(false);
  const [layout, setLayout] = useState<Layout>('lines');

  return (
    <TextToolLayout
      deps={[ciDedupe, stripSymbol, layout]}
      transform={(input) => {
        if (!input.trim()) return '';

        const mentions = collect(input, /\B@[A-Za-z0-9_]+/g, stripSymbol, ciDedupe);
        const hashtags = collect(input, /\B#[A-Za-z0-9_]+/g, stripSymbol, ciDedupe);
        const cashtags = collect(input, /\B\$[A-Za-z][A-Za-z.]{0,9}\b/g, stripSymbol, ciDedupe);
        const urls = collect(input, /https?:\/\/[^\s<>"')\]]+/g, false, ciDedupe);

        const join = (items: string[]) =>
          layout === 'commas' ? items.join(', ') : items.join('\n');

        const sections: string[] = [];
        const add = (title: string, items: string[]) => {
          sections.push(`# ${title} (${items.length})`);
          sections.push(items.length ? join(items) : '(none)');
          sections.push('');
        };
        add('Mentions', mentions);
        add('Hashtags', hashtags);
        add('Cashtags', cashtags);
        add('URLs', urls);
        return sections.join('\n').trimEnd();
      }}
      inputLabel="Social text"
      outputLabel="Extracted tokens"
      sample={SAMPLE}
      downloadName="extracted.txt"
      options={
        <>
          <Field label="Case-insensitive dedupe">
            <Switch checked={ciDedupe} onCheckedChange={setCiDedupe} />
          </Field>
          <Field label="Strip leading symbol">
            <Switch checked={stripSymbol} onCheckedChange={setStripSymbol} />
          </Field>
          <Field label="Layout">
            <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lines">One per line</SelectItem>
                <SelectItem value="commas">Comma-separated</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
