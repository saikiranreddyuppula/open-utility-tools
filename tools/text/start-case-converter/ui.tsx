'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { TextToolLayout } from '@/components/tools/text-tool';

function upperFirst(token: string, unicode: boolean): string {
  if (token.length === 0) return token;
  const first = token[0] ?? '';
  const up = unicode ? first.toLocaleUpperCase() : first.toUpperCase();
  return up + token.slice(1);
}

// Capitalize the first character of each "segment" while keeping the rest.
function capitalizeSegments(word: string, splitHyphens: boolean, unicode: boolean): string {
  if (!splitHyphens) return upperFirst(word, unicode);
  // Keep the separators (- and ') in place while capitalizing each segment.
  return word.replace(/[^-']+/g, (seg) => upperFirst(seg, unicode));
}

export default function StartCaseConverterTool() {
  const [collapse, setCollapse] = useState(false);
  const [splitHyphens, setSplitHyphens] = useState(false);
  const [unicode, setUnicode] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let text = input;
      if (collapse) {
        // Collapse runs of spaces/tabs to a single space, preserving newlines.
        text = text
          .split('\n')
          .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
          .join('\n');
      }
      // Split keeping whitespace tokens so spacing is preserved exactly.
      return text
        .split(/(\s+)/)
        .map((tok) =>
          /^\s+$/.test(tok) || tok.length === 0
            ? tok
            : capitalizeSegments(tok, splitHyphens, unicode),
        )
        .join('');
    },
    [collapse, splitHyphens, unicode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[collapse, splitHyphens, unicode]}
      inputLabel="Text"
      outputLabel="Start Case"
      inputPlaceholder="the QUICK brown fox…"
      sample={'the QUICK brown-fox jumps over the lazy dog'}
      downloadName="start-case.txt"
      options={
        <>
          <Field label="Collapse spaces" hint="Multiple spaces → one">
            <Switch checked={collapse} onCheckedChange={setCollapse} />
          </Field>
          <Field label="Split hyphens/apostrophes" hint="Capitalize each segment">
            <Switch checked={splitHyphens} onCheckedChange={setSplitHyphens} />
          </Field>
          <Field label="Unicode-aware" hint="Use locale uppercasing">
            <Switch checked={unicode} onCheckedChange={setUnicode} />
          </Field>
        </>
      }
    />
  );
}
