'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Dir = 'escape' | 'unescape';

function escapeUnicode(input: string, all: boolean, useBraces: boolean): string {
  let out = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    const isAscii = cp <= 0x7f;
    if (!all && isAscii) {
      out += ch;
      continue;
    }
    if (cp > 0xffff) {
      if (useBraces) {
        out += `\\u{${cp.toString(16)}}`;
      } else {
        // emit a surrogate pair
        const high = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
        const low = ((cp - 0x10000) % 0x400) + 0xdc00;
        out += `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
      }
    } else {
      out += `\\u${cp.toString(16).padStart(4, '0')}`;
    }
  }
  return out;
}

function unescapeUnicode(input: string): string {
  // \u{1F600}, \uXXXX, and \xXX
  return input.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g, (_m, braces, four, two) => {
    const hex: string = braces ?? four ?? two ?? '';
    const cp = parseInt(hex, 16);
    if (!Number.isFinite(cp) || cp > 0x10ffff) return _m;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return _m;
    }
  });
}

export default function UnicodeEscapeTool() {
  const [dir, setDir] = useState<Dir>('escape');
  const [all, setAll] = useState(false);
  const [useBraces, setUseBraces] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return dir === 'escape' ? escapeUnicode(input, all, useBraces) : unescapeUnicode(input);
    },
    [dir, all, useBraces]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, all, useBraces]}
      inputLabel={dir === 'escape' ? 'Text' : 'Escaped'}
      outputLabel={dir === 'escape' ? 'Escaped' : 'Text'}
      sample={dir === 'escape' ? 'Café — 日本語 😀' : 'Caf\\u00e9 \\u2014 \\u65e5\\u672c\\u8a9e \\u{1f600}'}
      downloadName="unicode.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="escape">Escape</TabsTrigger>
                <TabsTrigger value="unescape">Unescape</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'escape' && (
            <>
              <Field label="Escape all">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="all" checked={all} onCheckedChange={setAll} />
                  <Label htmlFor="all" className="text-xs text-muted-foreground">
                    incl. ASCII
                  </Label>
                </div>
              </Field>
              <Field label="Astral form">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="braces" checked={useBraces} onCheckedChange={setUseBraces} />
                  <Label htmlFor="braces" className="text-xs text-muted-foreground">
                    {'\\u{...}'}
                  </Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
