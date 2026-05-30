'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

type Mode = 'escape' | 'unescape';

// Standard JS RegExp metacharacters that need escaping to match literally.
const META_RE = /[.*+?^${}()|[\]\\]/g;

function escape(input: string, escapeSlash: boolean, whitespace: boolean): string {
  let out = input.replace(META_RE, '\\$&');
  if (escapeSlash) out = out.replace(/\//g, '\\/');
  if (whitespace) {
    out = out
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }
  return out;
}

function unescape(input: string): string {
  // Remove a single backslash before any escaped char. Handle common
  // whitespace escapes (\t \r \n) first, then strip the backslash from any
  // backslash-escaped character.
  return input.replace(/\\([\s\S])/g, (_m, ch: string) => {
    if (ch === 't') return '\t';
    if (ch === 'r') return '\r';
    if (ch === 'n') return '\n';
    return ch;
  });
}

export default function RegexEscapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [escapeSlash, setEscapeSlash] = useState(false);
  const [whitespace, setWhitespace] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'escape' ? escape(input, escapeSlash, whitespace) : unescape(input);
    },
    [mode, escapeSlash, whitespace]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, escapeSlash, whitespace]}
      inputLabel={mode === 'escape' ? 'Plain text' : 'Escaped pattern'}
      outputLabel={mode === 'escape' ? 'Literal regex pattern' : 'Plain text'}
      sample={mode === 'escape' ? 'Price: $19.99 (50% off?) — see [details].' : 'Price: \\$19\\.99 \\(50% off\\?\\) — see \\[details\\]\\.'}
      downloadName="regex-pattern.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="escape">Escape</TabsTrigger>
                <TabsTrigger value="unescape">Unescape</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'escape' && (
            <>
              <Field label="Escape /">
                <Switch checked={escapeSlash} onCheckedChange={setEscapeSlash} />
              </Field>
              <Field label="Whitespace → \t\n">
                <Switch checked={whitespace} onCheckedChange={setWhitespace} />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
