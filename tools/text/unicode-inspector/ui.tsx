'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';

const enc = new TextEncoder();

export default function UnicodeInspectorTool() {
  const [input, setInput] = useState('Hé🌍!');

  const points = useMemo(() => {
    return Array.from(input).map((ch) => {
      const cp = ch.codePointAt(0)!;
      const bytes = Array.from(enc.encode(ch))
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      return {
        char: ch,
        hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
        dec: cp,
        utf8: bytes,
        escape: cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`,
      };
    });
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {points.length > 0 && (
        <Panel>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-2xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {['Char', 'Code point', 'Decimal', 'UTF-8 bytes', 'Escape'].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {points.map((p, i) => (
                  <tr key={i} className="border-t hover:bg-accent/40">
                    <td className="px-3 py-1 text-base">{p.char === ' ' ? '␣' : p.char}</td>
                    <td className="px-3 py-1">{p.hex}</td>
                    <td className="px-3 py-1 tabular">{p.dec}</td>
                    <td className="px-3 py-1 text-muted-foreground">{p.utf8}</td>
                    <td className="px-3 py-1 text-muted-foreground">{p.escape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatBar items={[`${points.length} code points`, `${enc.encode(input).length} UTF-8 bytes`]} />
        </Panel>
      )}
    </div>
  );
}
