'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

// Map A-Z, a-z, 0-9 by Unicode code-point offset for each math-alphanumeric style.
function styler(upperBase: number, lowerBase: number, digitBase?: number) {
  return (text: string) =>
    Array.from(text)
      .map((ch) => {
        const c = ch.charCodeAt(0);
        if (c >= 65 && c <= 90) return String.fromCodePoint(upperBase + (c - 65));
        if (c >= 97 && c <= 122) return String.fromCodePoint(lowerBase + (c - 97));
        if (digitBase && c >= 48 && c <= 57) return String.fromCodePoint(digitBase + (c - 48));
        return ch;
      })
      .join('');
}

const STYLES: { name: string; fn: (s: string) => string }[] = [
  { name: 'Bold', fn: styler(0x1d400, 0x1d41a, 0x1d7ce) },
  { name: 'Italic', fn: styler(0x1d434, 0x1d44e) },
  { name: 'Bold Italic', fn: styler(0x1d468, 0x1d482) },
  { name: 'Script', fn: styler(0x1d49c, 0x1d4b6) },
  { name: 'Fraktur', fn: styler(0x1d504, 0x1d51e) },
  { name: 'Monospace', fn: styler(0x1d670, 0x1d68a, 0x1d7f6) },
  { name: 'Double-struck', fn: styler(0x1d538, 0x1d552, 0x1d7d8) },
  { name: 'Sans-serif', fn: styler(0x1d5a0, 0x1d5ba, 0x1d7e2) },
  {
    name: 'Circled',
    fn: (s: string) =>
      Array.from(s)
        .map((ch) => {
          const c = ch.charCodeAt(0);
          if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + (c - 65));
          if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + (c - 97));
          return ch;
        })
        .join(''),
  },
  {
    name: 'Strikethrough',
    fn: (s: string) => Array.from(s).map((ch) => ch + '̶').join(''),
  },
];

export default function FancyTextTool() {
  const [input, setInput] = useState('Hello World 123');
  const outputs = useMemo(() => STYLES.map((s) => ({ name: s.name, text: s.fn(input) })), [input]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-16 resize-y rounded-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>
      <Panel>
        <div className="divide-y">
          {outputs.map((o) => (
            <div key={o.name} className="flex items-center gap-3 px-3 py-2">
              <span className="w-28 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{o.name}</span>
              <span className="min-w-0 flex-1 truncate text-base">{o.text}</span>
              <CopyButton value={o.text} size="icon-sm" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
