'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function WhitespaceCleanerTool() {
  const [trimLines, setTrimLines] = useState(true);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [collapseBlank, setCollapseBlank] = useState(true);
  const [tabsToSpaces, setTabsToSpaces] = useState(false);
  const [stripAllBlank, setStripAllBlank] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let out = input.replace(/\r\n/g, '\n');
      if (tabsToSpaces) out = out.replace(/\t/g, '  ');
      let lines = out.split('\n');
      if (trimLines) lines = lines.map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''));
      if (collapseSpaces) lines = lines.map((l) => l.replace(/[ \t]{2,}/g, ' '));
      out = lines.join('\n');
      if (stripAllBlank) out = out.replace(/^\s*\n/gm, '');
      else if (collapseBlank) out = out.replace(/\n{3,}/g, '\n\n');
      return out.trim();
    },
    [trimLines, collapseSpaces, collapseBlank, tabsToSpaces, stripAllBlank]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[trimLines, collapseSpaces, collapseBlank, tabsToSpaces, stripAllBlank]}
      sample={'  hello    world  \n\n\n\n   foo\tbar  \n  '}
      downloadName="cleaned.txt"
      options={
        <Field label="Clean">
          <div className="flex h-8 flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={trimLines} onCheckedChange={setTrimLines} /> trim lines
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={collapseSpaces} onCheckedChange={setCollapseSpaces} /> collapse spaces
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={collapseBlank} onCheckedChange={setCollapseBlank} /> collapse blank
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={stripAllBlank} onCheckedChange={setStripAllBlank} /> drop blank
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={tabsToSpaces} onCheckedChange={setTabsToSpaces} /> tabs→spaces
            </label>
          </div>
        </Field>
      }
    />
  );
}
