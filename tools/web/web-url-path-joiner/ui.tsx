'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TrailingPolicy = 'keep' | 'add' | 'strip';

const SAMPLE = ['api', '/v2/', '../v3', 'users', '.', '42'].join('\n');

/** RFC 3986 §5.2.4 "remove dot segments" on a path string. */
function removeDotSegments(path: string): string {
  const input = path;
  let rest = input;
  const out: string[] = [];

  while (rest.length > 0) {
    if (rest.startsWith('../')) {
      rest = rest.slice(3);
    } else if (rest.startsWith('./')) {
      rest = rest.slice(2);
    } else if (rest === '/.' || rest.startsWith('/./')) {
      rest = '/' + rest.slice(rest === '/.' ? 2 : 3);
    } else if (rest === '/..' || rest.startsWith('/../')) {
      rest = '/' + rest.slice(rest === '/..' ? 3 : 4);
      // pop last segment from output
      const lastSlash = out.join('').lastIndexOf('/');
      if (lastSlash >= 0) {
        const joined = out.join('').slice(0, lastSlash);
        out.length = 0;
        if (joined) out.push(joined);
      } else {
        out.length = 0;
      }
    } else if (rest === '.' || rest === '..') {
      rest = '';
    } else {
      // move first path segment (incl. leading slash) to output
      const nextSlash = rest.indexOf('/', 1);
      const seg = nextSlash === -1 ? rest : rest.slice(0, nextSlash);
      out.push(seg);
      rest = nextSlash === -1 ? '' : rest.slice(nextSlash);
    }
  }
  return out.join('');
}

export default function UrlPathJoinerTool() {
  const [base, setBase] = useState('https://example.com/api/?token=abc#frag');
  const [trailing, setTrailing] = useState<TrailingPolicy>('keep');
  const [encode, setEncode] = useState(false);

  const transform = useMemo(
    () => (input: string) => {
      const baseTrim = base.trim();
      if (!baseTrim) throw new Error('Enter a base URL or path.');

      const segments = input
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '');

      // Detect absolute URL base vs. bare path.
      let scheme = '';
      let host = '';
      let query = '';
      let fragment = '';
      let basePath = '';

      const schemeMatch = baseTrim.match(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i);
      let remainder = baseTrim;
      if (schemeMatch && schemeMatch[1] !== undefined && schemeMatch[2] !== undefined) {
        host = schemeMatch[1];
        remainder = schemeMatch[2];
      }

      // Split off fragment then query from the remainder.
      const hashIdx = remainder.indexOf('#');
      if (hashIdx >= 0) {
        fragment = remainder.slice(hashIdx);
        remainder = remainder.slice(0, hashIdx);
      }
      const qIdx = remainder.indexOf('?');
      if (qIdx >= 0) {
        query = remainder.slice(qIdx);
        remainder = remainder.slice(0, qIdx);
      }
      basePath = remainder;

      // Join base path with segments using single slashes.
      let joined = basePath;
      for (const seg of segments) {
        if (joined === '' || joined.endsWith('/')) {
          joined += seg.replace(/^\/+/, '');
        } else {
          joined += '/' + seg.replace(/^\/+/, '');
        }
      }

      // Collapse duplicate slashes (path portion only; host already separated).
      joined = joined.replace(/\/{2,}/g, '/');

      // Resolve dot-segments.
      let normalizedPath = removeDotSegments(joined);
      if (host && !normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
      }

      // Trailing-slash policy.
      const isRoot = normalizedPath === '/' || normalizedPath === '';
      if (!isRoot) {
        if (trailing === 'add' && !normalizedPath.endsWith('/')) {
          normalizedPath += '/';
        } else if (trailing === 'strip' && normalizedPath.endsWith('/')) {
          normalizedPath = normalizedPath.replace(/\/+$/, '');
        }
      }

      // Optional percent-encoding of unsafe path chars (preserve / already there).
      if (encode) {
        normalizedPath = normalizedPath
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/');
      }

      const full = `${host}${normalizedPath}${query}${fragment}`;

      const lines: string[] = [];
      lines.push(full);
      lines.push('');
      lines.push('--- Breakdown ---');
      lines.push(`scheme/host: ${host || '(relative path)'}`);
      lines.push(`path:        ${normalizedPath || '(empty)'}`);
      lines.push(`query:       ${query || '(none)'}`);
      lines.push(`fragment:    ${fragment || '(none)'}`);

      return lines.join('\n');
    },
    [base, trailing, encode],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Base URL or path" className="min-w-[280px] flex-1">
        <Input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="https://example.com/api"
          className="font-mono"
          spellCheck={false}
        />
      </Field>
      <Field label="Trailing slash" className="min-w-[150px]">
        <Select value={trailing} onValueChange={(v) => setTrailing(v as TrailingPolicy)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep">Keep as-is</SelectItem>
            <SelectItem value="add">Add</SelectItem>
            <SelectItem value="strip">Strip</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Percent-encode path">
        <Switch checked={encode} onCheckedChange={setEncode} />
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[base, trailing, encode]}
      inputLabel="Path segments (one per line)"
      outputLabel="Joined URL"
      inputPlaceholder="v2&#10;../v3&#10;users"
      sample={SAMPLE}
      downloadName="joined-url.txt"
      options={options}
    />
  );
}
