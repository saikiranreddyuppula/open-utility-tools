'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'escape' | 'unescape';

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  cent: '¢',
  pound: '£',
  euro: '€',
  yen: '¥',
  sect: '§',
  para: '¶',
  middot: '·',
  bull: '•',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  dagger: '†',
  Dagger: '‡',
};

function escape(text: string, allNonAscii: boolean): string {
  // Order matters: ampersand first.
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  if (allNonAscii) {
    // Escape every code point above ASCII (0x7F) to a numeric reference.
    let acc = '';
    for (const ch of out) {
      const cp = ch.codePointAt(0) ?? 0;
      acc += cp > 0x7f ? `&#${cp};` : ch;
    }
    out = acc;
  }
  return out;
}

function unescape(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const digits = isHex ? body.slice(2) : body.slice(1);
      const code = parseInt(digits, isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED[body];
    return named ?? match;
  });
}

export default function HtmlEscapeUnescapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [allNonAscii, setAllNonAscii] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'escape' ? escape(input, allNonAscii) : unescape(input);
    },
    [mode, allNonAscii],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, allNonAscii]}
      inputLabel={mode === 'escape' ? 'Text' : 'HTML entities'}
      outputLabel={mode === 'escape' ? 'Escaped' : 'Decoded text'}
      sample={
        mode === 'escape'
          ? 'if (a < b && c > d) { say("it\'s fine"); }'
          : 'if (a &lt; b &amp;&amp; c &gt; d) { say(&quot;it&#39;s fine&quot;); } &mdash; done &#x263a;'
      }
      downloadName="output.txt"
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
            <Field label="Escape all non-ASCII">
              <Switch checked={allNonAscii} onCheckedChange={setAllNonAscii} />
            </Field>
          )}
        </>
      }
    />
  );
}
