'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';

const NBSP = String.fromCharCode(0x00a0);

export default function WhitespaceVisualizerTool() {
  const [showSpace, setShowSpace] = useState(true);
  const [showTab, setShowTab] = useState(true);
  const [showNewline, setShowNewline] = useState(true);
  const [showNbsp, setShowNbsp] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      // Detect line-ending style before rewriting.
      const crlf = (input.match(/\r\n/g) ?? []).length;
      const lfOnly = (input.match(/(?<!\r)\n/g) ?? []).length;
      const crOnly = (input.match(/\r(?!\n)/g) ?? []).length;
      const styles: string[] = [];
      if (crlf > 0) styles.push(`CRLF x${crlf}`);
      if (lfOnly > 0) styles.push(`LF x${lfOnly}`);
      if (crOnly > 0) styles.push(`CR x${crOnly}`);
      const styleCount = (crlf > 0 ? 1 : 0) + (lfOnly > 0 ? 1 : 0) + (crOnly > 0 ? 1 : 0);
      const endingLabel =
        styleCount === 0
          ? 'none'
          : styleCount > 1
            ? `mixed (${styles.join(', ')})`
            : (styles[0] ?? 'none');

      // Trailing-whitespace lines (split on any newline style).
      const rawLines = input.split(/\r\n|\r|\n/);
      const trailRe = new RegExp(`[ \\t${NBSP}]$`);
      let trailingLines = 0;
      for (const line of rawLines) {
        if (trailRe.test(line)) trailingLines += 1;
      }

      // Counts.
      let spaces = 0;
      let tabs = 0;
      let nbsps = 0;
      for (const ch of input) {
        if (ch === ' ') spaces += 1;
        else if (ch === '\t') tabs += 1;
        else if (ch === NBSP) nbsps += 1;
      }
      const newlines = crlf + lfOnly + crOnly;

      // Build annotated rendering. Process per code unit so CRLF is handled together.
      let out = '';
      for (let i = 0; i < input.length; i += 1) {
        const ch = input[i] ?? '';
        if (ch === '\r') {
          const next = input[i + 1] ?? '';
          if (next === '\n') {
            out += showNewline ? '␍␊\n' : '\r\n';
            i += 1; // consumed the paired \n
          } else {
            out += showNewline ? '␍\n' : '\r';
          }
          continue;
        }
        if (ch === '\n') {
          out += showNewline ? '¶\n' : '\n';
          continue;
        }
        if (ch === '\t') {
          out += showTab ? '→\t' : '\t';
          continue;
        }
        if (ch === ' ') {
          out += showSpace ? '·' : ' ';
          continue;
        }
        if (ch === NBSP) {
          out += showNbsp ? '⍽' : NBSP;
          continue;
        }
        out += ch;
      }

      const summary = [
        '--- Summary ---',
        `Line endings: ${endingLabel}`,
        `Spaces: ${spaces}`,
        `Tabs: ${tabs}`,
        `Newlines: ${newlines}`,
        `Non-breaking spaces: ${nbsps}`,
        `Lines with trailing whitespace: ${trailingLines}`,
      ].join('\n');

      return `${out}\n\n${summary}`;
    },
    [showSpace, showTab, showNewline, showNbsp]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[showSpace, showTab, showNewline, showNbsp]}
      inputLabel="Text"
      outputLabel="Visualized"
      sample={'function  hi() {\n\treturn  42;   \n}\ntrailing spaces above'}
      downloadName="whitespace.txt"
      options={
        <>
          <Field label="Spaces (mid-dot)">
            <div className="flex h-8 items-center">
              <Switch checked={showSpace} onCheckedChange={setShowSpace} />
            </div>
          </Field>
          <Field label="Tabs (arrow)">
            <div className="flex h-8 items-center">
              <Switch checked={showTab} onCheckedChange={setShowTab} />
            </div>
          </Field>
          <Field label="Newlines (pilcrow)">
            <div className="flex h-8 items-center">
              <Switch checked={showNewline} onCheckedChange={setShowNewline} />
            </div>
          </Field>
          <Field label="Non-breaking space">
            <div className="flex h-8 items-center">
              <Switch checked={showNbsp} onCheckedChange={setShowNbsp} />
            </div>
          </Field>
        </>
      }
    />
  );
}
