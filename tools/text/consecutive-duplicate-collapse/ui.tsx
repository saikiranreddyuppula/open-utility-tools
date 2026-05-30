'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';

type Show = 'all' | 'repeated' | 'unique';

const SAMPLE = `apple
apple
banana
banana
banana
cherry
apple
apple`;

interface Run {
  line: string;
  count: number;
}

export default function ConsecutiveDuplicateCollapseTool() {
  const [ci, setCi] = useState(false);
  const [showCount, setShowCount] = useState(false);
  const [show, setShow] = useState<Show>('all');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lines = input.replace(/\r\n?/g, '\n').split('\n');
      const key = (s: string) => (ci ? s.toLowerCase() : s);

      const runs: Run[] = [];
      for (const line of lines) {
        const last = runs[runs.length - 1];
        if (last !== undefined && key(last.line) === key(line)) {
          last.count += 1;
        } else {
          runs.push({ line, count: 1 });
        }
      }

      let kept: Run[];
      if (show === 'repeated') kept = runs.filter((r) => r.count > 1);
      else if (show === 'unique') kept = runs.filter((r) => r.count === 1);
      else kept = runs;

      const body = kept
        .map((r) => (showCount ? `${String(r.count).padStart(7, ' ')} ${r.line}` : r.line))
        .join('\n');

      const collapsed = lines.length - runs.length;
      const summary = `# ${lines.length} lines → ${runs.length} runs (${collapsed} duplicate line${collapsed === 1 ? '' : 's'} collapsed)`;
      return body === '' ? summary : `${body}\n\n${summary}`;
    },
    [ci, showCount, show]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[ci, showCount, show]}
      inputLabel="Lines"
      outputLabel="Collapsed"
      sample={SAMPLE}
      downloadName="uniq.txt"
      options={
        <>
          <Field label="Show">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="show"
                  checked={show === 'all'}
                  onChange={() => setShow('all')}
                />
                all
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="show"
                  checked={show === 'repeated'}
                  onChange={() => setShow('repeated')}
                />
                only repeated
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="show"
                  checked={show === 'unique'}
                  onChange={() => setShow('unique')}
                />
                only unique
              </label>
            </div>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={ci} onCheckedChange={(c) => setCi(c === true)} /> ignore case
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={showCount} onCheckedChange={(c) => setShowCount(c === true)} /> prefix count (uniq -c)
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
