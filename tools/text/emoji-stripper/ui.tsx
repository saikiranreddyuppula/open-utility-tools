'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const SAMPLE = 'Hello 👋 world 🌍! Great job 👍🏽 team 👨‍👩‍👧‍👦 — see you 🇺🇸 soon ✨😀.';

// Match a full emoji unit, including ZWJ sequences, flags, skin-tone modifiers and
// variation selectors. Built without the \p{Emoji} property (too broad — matches digits)
// in favor of explicit pictographic ranges.
const EMOJI_CHAR =
  '(?:' +
  '[\\u{1F300}-\\u{1FAFF}]' + // misc symbols & pictographs, transport, supplemental, symbols-ext
  '|[\\u{1F000}-\\u{1F0FF}]' + // mahjong / dominoes / cards
  '|[\\u{2600}-\\u{27BF}]' + // misc symbols + dingbats
  '|[\\u{1F1E6}-\\u{1F1FF}]' + // regional indicators
  '|[\\u{2190}-\\u{21FF}]' + // arrows (with VS16)
  '|[\\u{2B00}-\\u{2BFF}]' + // misc symbols and arrows
  '|[\\u{2300}-\\u{23FF}]' + // misc technical (⌚ ⏰ etc.)
  '|[\\u{FE00}-\\u{FE0F}]' + // variation selectors
  '|[\\u{1F3FB}-\\u{1F3FF}]' + // skin-tone modifiers
  '|\\u{20E3}' + // combining keycap
  '|[\\u{0023}\\u{002A}\\u{0030}-\\u{0039}](?=\\u{FE0F}?\\u{20E3})' + // keycap bases
  ')';

function buildRegex(): RegExp {
  // A cluster: one or more emoji chars optionally joined with ZWJ (U+200D).
  const cluster = `${EMOJI_CHAR}(?:\\u{200D}${EMOJI_CHAR}|${EMOJI_CHAR})*`;
  return new RegExp(cluster, 'gu');
}

export default function EmojiStripperTool() {
  const [collapse, setCollapse] = useState(true);
  const [placeholder, setPlaceholder] = useState(false);
  const [token, setToken] = useState('[emoji]');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const re = buildRegex();
      let count = 0;
      let out = input.replace(re, () => {
        count += 1;
        return placeholder ? token : '';
      });
      if (collapse && !placeholder) {
        out = out
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/ +([,.!?;:])/g, '$1')
          .replace(/^[ \t]+|[ \t]+$/gm, '');
      }
      const summary = `# removed ${count} emoji`;
      return `${out}\n\n${summary}`;
    },
    [collapse, placeholder, token]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[collapse, placeholder, token]}
      inputLabel="Text"
      outputLabel="Cleaned"
      sample={SAMPLE}
      downloadName="no-emoji.txt"
      options={
        <>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={collapse}
                  disabled={placeholder}
                  onCheckedChange={(c) => setCollapse(c === true)}
                />{' '}
                collapse whitespace
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={placeholder} onCheckedChange={(c) => setPlaceholder(c === true)} />{' '}
                replace with token
              </label>
            </div>
          </Field>
          {placeholder && (
            <Field label="Placeholder">
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-32 font-mono"
                spellCheck={false}
              />
            </Field>
          )}
        </>
      }
    />
  );
}
