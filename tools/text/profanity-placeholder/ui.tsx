'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MaskStyle = 'asterisks' | 'first-letter' | 'token';

// A small, intentionally mild built-in list. Fully local; users can edit it.
const DEFAULT_WORDS = ['darn', 'heck', 'crap', 'damn', 'hell', 'dang', 'bloody', 'jerk'].join(', ');

const SAMPLE = 'Oh darn, this dang printer crapped out again. What the heck, that is just bloody annoying.';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskWord(word: string, style: MaskStyle, token: string, leak: boolean): string {
  const chars = [...word];
  switch (style) {
    case 'token':
      return token;
    case 'first-letter': {
      const first = chars[0] ?? '';
      const rest = '*'.repeat(Math.max(0, chars.length - 1));
      return first + rest;
    }
    case 'asterisks': {
      if (leak && chars.length >= 3) {
        const first = chars[0] ?? '';
        const last = chars[chars.length - 1] ?? '';
        return first + '*'.repeat(chars.length - 2) + last;
      }
      return '*'.repeat(chars.length);
    }
    default:
      return '*'.repeat(chars.length);
  }
}

export default function ProfanityPlaceholderTool() {
  const [wordList, setWordList] = useState(DEFAULT_WORDS);
  const [style, setStyle] = useState<MaskStyle>('asterisks');
  const [token, setToken] = useState('[redacted]');
  const [leak, setLeak] = useState(false);
  const [partial, setPartial] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const words = wordList
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      if (words.length === 0) return input;

      // Longest first so multi-word entries win over their substrings.
      const sorted = [...words].sort((a, b) => b.length - a.length);
      const escaped = sorted.map(escapeRegExp);
      const body = escaped.join('|');
      // Word-boundary match unless partial substring matching is enabled.
      const pattern = partial ? `(${body})` : `\\b(${body})\\b`;
      const re = new RegExp(pattern, 'giu');

      return input.replace(re, (match) => maskWord(match, style, token || '[redacted]', leak));
    },
    [wordList, style, token, leak, partial]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[wordList, style, token, leak, partial]}
      inputLabel="Text"
      outputLabel="Censored text"
      sample={SAMPLE}
      downloadName="censored.txt"
      options={
        <>
          <Field label="Word list (comma or newline separated)" className="min-w-[280px] flex-1">
            <Textarea
              value={wordList}
              onChange={(e) => setWordList(e.target.value)}
              spellCheck={false}
              className="h-20 font-mono text-xs"
              placeholder="word1, word2, ..."
            />
          </Field>
          <Field label="Mask style">
            <Select value={style} onValueChange={(v) => setStyle(v as MaskStyle)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asterisks">All asterisks (****)</SelectItem>
                <SelectItem value="first-letter">First letter + ***</SelectItem>
                <SelectItem value="token">Fixed token</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {style === 'token' && (
            <Field label="Token">
              <Textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                spellCheck={false}
                className="h-9 w-[140px] resize-none font-mono text-xs"
                placeholder="[redacted]"
              />
            </Field>
          )}
          {style === 'asterisks' && (
            <Field label="Leak letters">
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id="pf-leak"
                  checked={leak}
                  onCheckedChange={(v) => setLeak(v === true)}
                />
                <Label htmlFor="pf-leak" className="text-xs font-normal">
                  Keep first &amp; last
                </Label>
              </div>
            </Field>
          )}
          <Field label="Matching">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="pf-partial"
                checked={partial}
                onCheckedChange={(v) => setPartial(v === true)}
              />
              <Label htmlFor="pf-partial" className="text-xs font-normal">
                Match substrings
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
