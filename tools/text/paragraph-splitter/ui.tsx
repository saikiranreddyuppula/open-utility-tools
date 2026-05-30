'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'split' | 'join';

const SAMPLE = [
  'The quick brown fox jumps over the lazy dog. This is a paragraph that',
  'has been hard-wrapped across several physical lines for display in a',
  'narrow editor window.',
  '',
  'This is a second paragraph. It is also wrapped onto multiple lines but',
  'should be joined back into a single line by the join mode.',
].join('\n');

/** Split text into paragraph blocks. A boundary is a blank line, unless
 *  singleNewline is set, in which case every newline starts a paragraph. */
function splitParagraphs(input: string, singleNewline: boolean): string[] {
  if (singleNewline) {
    return input.split(/\r?\n/);
  }
  // Split on one or more blank lines.
  return input.split(/\r?\n[ \t]*\r?\n+/);
}

export default function ParagraphSplitterTool() {
  const [mode, setMode] = useState<Mode>('join');
  const [singleNewline, setSingleNewline] = useState(false);
  const [blankCount, setBlankCount] = useState('1');
  const [trim, setTrim] = useState(true);
  const [collapseBlanks, setCollapseBlanks] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const normalized = input.replace(/\r\n/g, '\n');

      if (mode === 'split') {
        const sep = (() => {
          const n = Number(blankCount);
          const count = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 1;
          return '\n' + '\n'.repeat(count);
        })();
        const paras = splitParagraphs(normalized, singleNewline)
          .map((p) => (trim ? p.trim() : p))
          .filter((p) => p.length > 0);
        return paras.join(sep);
      }

      // Join mode: collapse single newlines within a paragraph to spaces,
      // while keeping blank-line paragraph breaks intact.
      let text = normalized;
      if (collapseBlanks) {
        // Reduce runs of 2+ newlines to exactly two (one blank line).
        text = text.replace(/\n{3,}/g, '\n\n');
      }
      const blocks = text.split(/\n[ \t]*\n+/);
      const joined = blocks
        .map((block) => {
          const oneLine = block
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .join(' ');
          return trim ? oneLine.trim() : oneLine;
        })
        .filter((b) => b.length > 0);
      return joined.join('\n\n');
    },
    [mode, singleNewline, blankCount, trim, collapseBlanks]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, singleNewline, blankCount, trim, collapseBlanks]}
      inputLabel="Text"
      outputLabel={mode === 'split' ? 'Separated paragraphs' : 'Joined paragraphs'}
      sample={SAMPLE}
      downloadName="paragraphs.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="join">Join wrapped lines</SelectItem>
                <SelectItem value="split">Split paragraphs</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {mode === 'split' && (
            <>
              <Field label="Boundary">
                <div className="flex h-9 items-center gap-2">
                  <Checkbox
                    id="ps-single"
                    checked={singleNewline}
                    onCheckedChange={(v) => setSingleNewline(v === true)}
                  />
                  <Label htmlFor="ps-single" className="text-xs font-normal">
                    Single newline = new para
                  </Label>
                </div>
              </Field>
              <Field label="Blank lines between">
                <Input
                  value={blankCount}
                  onChange={(e) => setBlankCount(e.target.value)}
                  className="w-[90px]"
                  inputMode="numeric"
                />
              </Field>
            </>
          )}

          {mode === 'join' && (
            <Field label="Blank lines">
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id="ps-collapse"
                  checked={collapseBlanks}
                  onCheckedChange={(v) => setCollapseBlanks(v === true)}
                />
                <Label htmlFor="ps-collapse" className="text-xs font-normal">
                  Collapse multiple
                </Label>
              </div>
            </Field>
          )}

          <Field label="Trim">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="ps-trim"
                checked={trim}
                onCheckedChange={(v) => setTrim(v === true)}
              />
              <Label htmlFor="ps-trim" className="text-xs font-normal">
                Trim each paragraph
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
