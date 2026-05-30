'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SAMPLE =
  'this is the FIRST sentence. here is another one! does the third END with a question? i think nasa and the usa are involved. i\'m sure i\'ll know soon.';

/** Capitalize the first alphabetic code point of a string. */
function capitalizeFirstAlpha(s: string): string {
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? '';
    if (/\p{L}/u.test(ch)) {
      chars[i] = ch.toUpperCase();
      return chars.join('');
    }
    // Skip leading whitespace, quotes, brackets, etc.
  }
  return s;
}

export default function SentenceCaseConverterTool() {
  const [allowlist, setAllowlist] = useState('NASA, USA, ID, OK, TV, FAQ');
  const [newlineStarts, setNewlineStarts] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      // 1. Lowercase everything.
      let text = input.toLowerCase();

      // 2. Split into sentences. A terminator is . ! ? optionally followed by
      //    closing quotes/brackets, then whitespace. We split while keeping the
      //    boundary so capitalization can be applied to each sentence start.
      // Capitalize after each terminator + (closing chars) + whitespace.
      const boundary = newlineStarts
        ? /([.!?]+["'”’)\]]*\s+|\n+)/g
        : /([.!?]+["'”’)\]]*\s+)/g;

      const pieces = text.split(boundary);
      // pieces alternates: [sentence, separator, sentence, separator, ...]
      const rebuilt: string[] = [];
      let expectSentence = true;
      for (const piece of pieces) {
        if (piece === undefined) continue;
        if (expectSentence) {
          rebuilt.push(capitalizeFirstAlpha(piece));
          expectSentence = false;
        } else {
          rebuilt.push(piece);
          expectSentence = true;
        }
      }
      text = rebuilt.join('');

      // 3. Always re-capitalize the standalone pronoun "i" and its contractions.
      text = text.replace(/\bi\b/g, 'I');
      text = text.replace(/\bi('m|'ll|'ve|'d|’m|’ll|’ve|’d)\b/gi, (_m, suf: string) => 'I' + suf);

      // 4. Force-uppercase any allowlisted acronyms (whole-word, case-insensitive).
      const words = allowlist
        .split(',')
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      for (const w of words) {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'gi');
        text = text.replace(re, w.toUpperCase());
      }

      return text;
    },
    [allowlist, newlineStarts]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[allowlist, newlineStarts]}
      inputLabel="Text"
      outputLabel="Sentence case"
      sample={SAMPLE}
      downloadName="sentence-case.txt"
      options={
        <>
          <Field label="Force-uppercase words (comma separated)" className="min-w-[280px] flex-1">
            <Input
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              placeholder="NASA, USA, ID"
            />
          </Field>
          <Field label="Newlines">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="sc-newline"
                checked={newlineStarts}
                onCheckedChange={(v) => setNewlineStarts(v === true)}
              />
              <Label htmlFor="sc-newline" className="text-xs font-normal">
                Capitalize after newline
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
