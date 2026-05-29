'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Separator = 'hyphen' | 'underscore' | 'dot';

const SEP_CHAR: Record<Separator, string> = {
  hyphen: '-',
  underscore: '_',
  dot: '.',
};

function escapeForCharClass(ch: string): string {
  return ch.replace(/[-\\^\]]/g, '\\$&');
}

function slugify(
  line: string,
  sep: string,
  lower: boolean,
  stripAccents: boolean,
  maxLen: number,
): string {
  let text = line;
  if (stripAccents) {
    // Decompose accented chars, then drop combining diacritical marks.
    text = text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }
  if (lower) {
    text = text.toLowerCase();
  }
  // Replace any run of non-alphanumeric characters with the separator.
  text = text.replace(/[^a-zA-Z0-9]+/g, sep);
  // Trim leading/trailing separators.
  const escaped = escapeForCharClass(sep);
  text = text.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g'), '');
  if (maxLen > 0 && text.length > maxLen) {
    text = text.slice(0, maxLen).replace(new RegExp(`[${escaped}]+$`, 'g'), '');
  }
  return text;
}

export default function SlugTool() {
  const [separator, setSeparator] = useState<Separator>('hyphen');
  const [lower, setLower] = useState(true);
  const [stripAccents, setStripAccents] = useState(true);
  const [maxLen, setMaxLen] = useState('0');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const sep = SEP_CHAR[separator];
      const parsed = Number(maxLen);
      const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
      return input
        .split('\n')
        .map((line) => slugify(line, sep, lower, stripAccents, limit))
        .join('\n');
    },
    [separator, lower, stripAccents, maxLen],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[separator, lower, stripAccents, maxLen]}
      inputLabel="Titles (one per line)"
      outputLabel="Slugs"
      inputPlaceholder={'My First Blog Post!\nCafé del Mar — 2024'}
      sample={'10 Tips for Better Sleep\nCafé del Mar — Summer Mix\nHello, World! (Part 2)'}
      downloadName="slugs.txt"
      options={
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Separator">
            <Tabs value={separator} onValueChange={(v) => setSeparator(v as Separator)}>
              <TabsList>
                <TabsTrigger value="hyphen">Hyphen -</TabsTrigger>
                <TabsTrigger value="underscore">Underscore _</TabsTrigger>
                <TabsTrigger value="dot">Dot .</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Max length (0 = none)">
            <Input
              type="number"
              min={0}
              value={maxLen}
              onChange={(e) => setMaxLen(e.target.value)}
              className="w-28"
            />
          </Field>
          <Field label="Lowercase">
            <Switch checked={lower} onCheckedChange={setLower} />
          </Field>
          <Field label="Strip accents">
            <Switch checked={stripAccents} onCheckedChange={setStripAccents} />
          </Field>
        </div>
      }
    />
  );
}
