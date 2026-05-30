'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Scope = 'single' | 'full';

// RFC 6901: '~' -> '~0', '/' -> '~1'. Order matters on decode.
function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

export default function JsonPointerEscapeTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [scope, setScope] = useState<Scope>('full');
  const [uriFragment, setUriFragment] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      if (mode === 'encode') {
        if (scope === 'single') {
          // Each input line is one raw key -> one escaped token.
          return input
            .split('\n')
            .map((line) => escapeToken(line))
            .join('\n');
        }
        // Full pointer: each non-empty line is a key segment; assemble.
        const segments = input.split('\n').filter((l) => l.length > 0);
        const pointer = segments.map((s) => `/${escapeToken(s)}`).join('');
        if (uriFragment) {
          // URI-fragment form: prepend # and percent-encode per RFC 6901 §6.
          return `#${pointer
            .split('/')
            .map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg)))
            .join('/')}`;
        }
        return pointer;
      }

      // decode
      let s = input.trim();
      if (uriFragment && s.startsWith('#')) {
        s = decodeURIComponent(s.slice(1));
      } else if (uriFragment) {
        s = decodeURIComponent(s);
      }

      if (scope === 'single') {
        return input
          .split('\n')
          .map((line) => unescapeToken(line))
          .join('\n');
      }

      // Full pointer: "" => whole document (no segments). Split on '/'.
      if (s === '') return '';
      if (!s.startsWith('/')) {
        throw new Error('A full JSON Pointer must be empty or start with "/".');
      }
      const parts = s.split('/').slice(1); // drop leading empty segment
      return parts.map((p) => unescapeToken(p)).join('\n');
    },
    [mode, scope, uriFragment],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, scope, uriFragment]}
      inputLabel={
        mode === 'encode'
          ? scope === 'full'
            ? 'Keys (one per line)'
            : 'Raw keys (one per line)'
          : scope === 'full'
            ? 'JSON Pointer'
            : 'Escaped tokens (one per line)'
      }
      outputLabel={
        mode === 'encode'
          ? scope === 'full'
            ? 'JSON Pointer'
            : 'Escaped tokens'
          : 'Raw keys (one per line)'
      }
      sample={mode === 'encode' ? 'foo\na/b\nc~d\n ' : '/foo/a~1b/c~0d'}
      downloadName="json-pointer.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Scope">
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full pointer</SelectItem>
                <SelectItem value="single">Single token (per line)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {scope === 'full' && (
            <Field label="URI-fragment form (#…)">
              <Switch checked={uriFragment} onCheckedChange={setUriFragment} />
            </Field>
          )}
        </>
      }
    />
  );
}
