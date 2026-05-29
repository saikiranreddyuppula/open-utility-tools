'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'all' | 'paragraphs' | 'collapse';

const SAMPLE = `The quick brown fox
jumps over the
lazy dog.


A second paragraph
wraps across
several lines.`;

export default function RemoveLineBreaksTool() {
  const [mode, setMode] = useState<Mode>('all');
  const [joiner, setJoiner] = useState(' ');
  const [trimLines, setTrimLines] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      // Normalize CRLF / CR to LF first.
      const text = input.replace(/\r\n?/g, '\n');

      if (mode === 'all') {
        // Join every line with the chosen joiner.
        const lines = text.split('\n');
        const parts = trimLines ? lines.map((l) => l.trim()) : lines;
        return parts.join(joiner);
      }

      if (mode === 'paragraphs') {
        // Keep blank-line paragraph separations; join wrapped lines within
        // each paragraph using the joiner.
        const paragraphs = text.split(/\n[ \t]*\n+/);
        const joined = paragraphs.map((para) => {
          const lines = para.split('\n');
          const parts = trimLines ? lines.map((l) => l.trim()) : lines;
          return parts.filter((l) => l.length > 0 || !trimLines).join(joiner);
        });
        return joined.join('\n\n');
      }

      // collapse: keep line structure, but collapse runs of blank lines to one.
      const lines = text.split('\n');
      const out: string[] = [];
      let blankRun = false;
      for (const raw of lines) {
        const line = trimLines ? raw.trim() : raw;
        if (line.length === 0) {
          if (!blankRun) out.push('');
          blankRun = true;
        } else {
          out.push(line);
          blankRun = false;
        }
      }
      // Drop a leading/trailing blank produced by collapsing.
      while (out.length > 0 && out[0] === '') out.shift();
      while (out.length > 0 && out[out.length - 1] === '') out.pop();
      return out.join('\n');
    },
    [mode, joiner, trimLines]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, joiner, trimLines]}
      inputLabel="Text"
      outputLabel="Result"
      inputPlaceholder="Paste text with line breaks…"
      sample={SAMPLE}
      downloadName="no-line-breaks.txt"
      options={
        <div className="flex flex-col gap-4">
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="all">Join all</TabsTrigger>
                <TabsTrigger value="paragraphs">Keep paragraphs</TabsTrigger>
                <TabsTrigger value="collapse">Collapse blanks</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode !== 'collapse' && (
            <Field
              label="Join character"
              hint="Inserted between joined lines. Use a space, comma, etc."
            >
              <Input
                value={joiner}
                onChange={(e) => setJoiner(e.target.value)}
                placeholder="(space)"
              />
            </Field>
          )}
          <Field label="Trim each line">
            <div className="flex items-center gap-2">
              <Switch
                id="rlb-trim"
                checked={trimLines}
                onCheckedChange={setTrimLines}
              />
              <Label htmlFor="rlb-trim">Remove leading/trailing spaces</Label>
            </div>
          </Field>
        </div>
      }
    />
  );
}
