'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DupePolicy = 'none' | 'first' | 'last';

const SAMPLE = [
  'HTTP://Example.COM:80/a/./b/../c/?b=2&a=1&a=3#frag',
  'https://example.org:443/path/',
  'https://example.com/%7Euser/page?empty=&q=hi',
].join('\n');

interface Opts {
  sortParams: boolean;
  stripTrailingSlash: boolean;
  stripFragment: boolean;
  dropEmptyQuery: boolean;
  dedupe: DupePolicy;
}

function normalize(raw: string, opts: Opts): string {
  const u = new URL(raw); // throws on invalid

  // WHATWG already lowercases scheme + host and resolves dot-segments.
  // Strip default ports (URL keeps :port only when non-default already, but be safe).
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }

  // Query handling.
  const entries = Array.from(u.searchParams.entries());
  let processed = entries;

  if (opts.dedupe !== 'none') {
    const seen = new Map<string, string>();
    if (opts.dedupe === 'first') {
      for (const [k, v] of entries) {
        if (!seen.has(k)) seen.set(k, v);
      }
    } else {
      for (const [k, v] of entries) seen.set(k, v);
    }
    processed = Array.from(seen.entries());
  }

  if (opts.sortParams) {
    processed = [...processed].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
  }

  const sp = new URLSearchParams();
  for (const [k, v] of processed) {
    if (opts.dropEmptyQuery && v === '') continue;
    sp.append(k, v);
  }
  const queryStr = sp.toString();
  u.search = queryStr ? `?${queryStr}` : '';

  if (opts.stripFragment) u.hash = '';

  let href = u.href;

  if (opts.stripTrailingSlash) {
    // Only strip trailing slash on the path, not on the root host.
    href = href.replace(
      /^([a-z][a-z0-9+.-]*:\/\/[^/]+)(\/[^?#]*?)\/(?=$|[?#])/i,
      '$1$2',
    );
  }

  return href;
}

export default function UrlNormalizerTool() {
  const [sortParams, setSortParams] = useState(true);
  const [stripTrailingSlash, setStripTrailingSlash] = useState(false);
  const [stripFragment, setStripFragment] = useState(false);
  const [dropEmptyQuery, setDropEmptyQuery] = useState(false);
  const [dedupe, setDedupe] = useState<DupePolicy>('none');

  const transform = useMemo(
    () => (input: string) => {
      if (!input.trim()) return '';
      const opts: Opts = {
        sortParams,
        stripTrailingSlash,
        stripFragment,
        dropEmptyQuery,
        dedupe,
      };
      const out: string[] = [];
      for (const raw of input.split('\n')) {
        const line = raw.trim();
        if (line === '') {
          out.push('');
          continue;
        }
        try {
          const normalized = normalize(line, opts);
          if (normalized === line) {
            out.push(`= ${normalized}`);
          } else {
            out.push(normalized);
          }
        } catch {
          out.push(`⚠ invalid URL: ${line}`);
        }
      }
      return out.join('\n');
    },
    [sortParams, stripTrailingSlash, stripFragment, dropEmptyQuery, dedupe],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Sort query params">
        <Switch checked={sortParams} onCheckedChange={setSortParams} />
      </Field>
      <Field label="Strip trailing slash">
        <Switch checked={stripTrailingSlash} onCheckedChange={setStripTrailingSlash} />
      </Field>
      <Field label="Strip fragment">
        <Switch checked={stripFragment} onCheckedChange={setStripFragment} />
      </Field>
      <Field label="Drop empty query values">
        <Switch checked={dropEmptyQuery} onCheckedChange={setDropEmptyQuery} />
      </Field>
      <Field label="Duplicate params" className="min-w-[150px]">
        <Select value={dedupe} onValueChange={(v) => setDedupe(v as DupePolicy)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keep all</SelectItem>
            <SelectItem value="first">Keep first</SelectItem>
            <SelectItem value="last">Keep last</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sortParams, stripTrailingSlash, stripFragment, dropEmptyQuery, dedupe]}
      inputLabel="URLs (one per line)"
      outputLabel="Normalized (= means unchanged)"
      inputPlaceholder="https://Example.com/a/../b?z=1&a=2"
      sample={SAMPLE}
      downloadName="normalized-urls.txt"
      options={options}
    />
  );
}
