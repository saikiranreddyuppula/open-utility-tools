'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Action = 'indent' | 'dedent' | 'tabs2spaces' | 'spaces2tabs';

function expandLeadingTabs(line: string, width: number): string {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  const lead = line.slice(0, i);
  const rest = line.slice(i);
  const expanded = lead.replace(/\t/g, ' '.repeat(width));
  return expanded + rest;
}

function collapseLeadingSpaces(line: string, width: number): string {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  const lead = line.slice(0, i);
  const rest = line.slice(i);
  // normalize any tabs in lead to spaces first, then group into tabs
  const asSpaces = lead.replace(/\t/g, ' '.repeat(width));
  const tabs = '\t'.repeat(Math.floor(asSpaces.length / width));
  const remainder = ' '.repeat(asSpaces.length % width);
  return tabs + remainder + rest;
}

function indentLine(line: string, unit: string, count: number): string {
  if (line.length === 0) return line;
  return unit.repeat(count) + line;
}

function dedentLine(line: string, unit: string, count: number): string {
  let result = line;
  for (let i = 0; i < count; i += 1) {
    if (result.startsWith(unit)) {
      result = result.slice(unit.length);
    } else if (unit === '\t' && result.startsWith(' ')) {
      // tolerate a leading space when removing a tab level
      result = result.replace(/^ +/, (m) => m.slice(Math.min(m.length, 1)));
    } else {
      break;
    }
  }
  return result;
}

export default function IndentText() {
  const [action, setAction] = useState<Action>('indent');
  const [useTabs, setUseTabs] = useState(false);
  const [widthStr, setWidthStr] = useState('2');
  const [levelStr, setLevelStr] = useState('1');
  const [skipBlank, setSkipBlank] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const width = Number(widthStr);
      if (!Number.isFinite(width) || width < 1) {
        throw new Error('Width must be a positive number.');
      }
      const w = Math.floor(width);
      const level = Number(levelStr);
      if (!Number.isFinite(level) || level < 0) {
        throw new Error('Levels must be a non-negative number.');
      }
      const lv = Math.floor(level);
      const unit = useTabs ? '\t' : ' '.repeat(w);

      return input
        .split('\n')
        .map((line) => {
          const isBlank = line.trim().length === 0;
          if (skipBlank && isBlank && (action === 'indent' || action === 'dedent')) {
            return line;
          }
          switch (action) {
            case 'indent':
              return indentLine(line, unit, lv);
            case 'dedent':
              return dedentLine(line, unit, lv);
            case 'tabs2spaces':
              return expandLeadingTabs(line, w);
            case 'spaces2tabs':
              return collapseLeadingSpaces(line, w);
            default:
              return line;
          }
        })
        .join('\n');
    },
    [action, useTabs, widthStr, levelStr, skipBlank],
  );

  const showWidth = useTabs ? action === 'tabs2spaces' || action === 'spaces2tabs' : true;
  const showLevel = action === 'indent' || action === 'dedent';
  const showTabsToggle = action === 'indent' || action === 'dedent';

  return (
    <TextToolLayout
      transform={transform}
      deps={[action, useTabs, widthStr, levelStr, skipBlank]}
      inputLabel="Text"
      outputLabel="Result"
      inputPlaceholder="Paste code or text…"
      sample={'function hi() {\n\treturn 1;\n}'}
      downloadName="indented.txt"
      options={
        <>
          <Field label="Action">
            <Tabs value={action} onValueChange={(v) => setAction(v as Action)}>
              <TabsList>
                <TabsTrigger value="indent">Indent</TabsTrigger>
                <TabsTrigger value="dedent">Dedent</TabsTrigger>
                <TabsTrigger value="tabs2spaces">Tabs→Spaces</TabsTrigger>
                <TabsTrigger value="spaces2tabs">Spaces→Tabs</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {showLevel ? (
            <Field label="Levels">
              <Input
                type="number"
                min={0}
                value={levelStr}
                onChange={(e) => setLevelStr(e.target.value)}
                className="w-20"
              />
            </Field>
          ) : null}
          {showWidth ? (
            <Field label="Width" hint="spaces per tab / indent">
              <Input
                type="number"
                min={1}
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                className="w-20"
              />
            </Field>
          ) : null}
          {showTabsToggle ? (
            <div className="flex items-center gap-2">
              <Checkbox id="usetabs" checked={useTabs} onCheckedChange={(v) => setUseTabs(Boolean(v))} />
              <Label htmlFor="usetabs">Use tabs</Label>
            </div>
          ) : null}
          {showLevel ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="skipblank"
                checked={skipBlank}
                onCheckedChange={(v) => setSkipBlank(Boolean(v))}
              />
              <Label htmlFor="skipblank">Skip blank lines</Label>
            </div>
          ) : null}
        </>
      }
    />
  );
}
