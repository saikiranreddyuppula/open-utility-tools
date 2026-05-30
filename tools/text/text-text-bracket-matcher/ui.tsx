'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';

const SAMPLE = `function greet(name) {
  const parts = [name, "world"];
  return \`Hello, \${parts.join(" ")}!\`;
}`;

const OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
};
const CLOSE_TO_OPEN: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<',
};

export default function BracketQuoteBalanceChecker() {
  const [checkAngle, setCheckAngle] = useState(false);
  const [checkQuotes, setCheckQuotes] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      type Frame = { char: string; line: number; col: number };
      const stack: Frame[] = [];
      const counts: Record<string, number> = {
        '()': 0,
        '[]': 0,
        '{}': 0,
        '<>': 0,
      };

      let line = 1;
      let col = 0;
      let inQuote: string | null = null;
      let quoteStart: { line: number; col: number } | null = null;
      let firstError: string | null = null;

      const isOpen = (ch: string): boolean => {
        if (ch === '<') return checkAngle;
        return ch === '(' || ch === '[' || ch === '{';
      };
      const isClose = (ch: string): boolean => {
        if (ch === '>') return checkAngle;
        return ch === ')' || ch === ']' || ch === '}';
      };

      const chars = [...input];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i] ?? '';
        if (ch === '\n') {
          line += 1;
          col = 0;
          continue;
        }
        col += 1;

        if (inQuote) {
          if (ch === '\\') {
            // skip the escaped next char (consume one more)
            i += 1;
            col += 1;
            continue;
          }
          if (ch === inQuote) {
            inQuote = null;
            quoteStart = null;
          }
          continue;
        }

        if (checkQuotes && (ch === '"' || ch === "'" || ch === '`')) {
          inQuote = ch;
          quoteStart = { line, col };
          continue;
        }

        if (isOpen(ch)) {
          stack.push({ char: ch, line, col });
          continue;
        }
        if (isClose(ch)) {
          const expectedOpen = CLOSE_TO_OPEN[ch];
          const top = stack.pop();
          if (!top) {
            if (!firstError) {
              firstError = `Unexpected closing "${ch}" at line ${line}, col ${col} (nothing open).`;
            }
            continue;
          }
          if (top.char !== expectedOpen) {
            if (!firstError) {
              const want = OPEN_TO_CLOSE[top.char] ?? '?';
              firstError = `Mismatched bracket at line ${line}, col ${col}: found "${ch}" but expected "${want}" to close "${top.char}" opened at line ${top.line}, col ${top.col}.`;
            }
            continue;
          }
          const pair = `${top.char}${ch}`;
          if (pair in counts) counts[pair] = (counts[pair] ?? 0) + 1;
        }
      }

      if (!firstError && inQuote && quoteStart) {
        firstError = `Unterminated quote ${inQuote} opened at line ${quoteStart.line}, col ${quoteStart.col}.`;
      }
      if (!firstError && stack.length > 0) {
        const top = stack[0]!;
        const want = OPEN_TO_CLOSE[top.char] ?? '?';
        firstError = `Unclosed "${top.char}" opened at line ${top.line}, col ${top.col} (expected "${want}").`;
      }

      const verdict = firstError ? 'UNBALANCED' : 'BALANCED';
      const summaryLines = [
        `Verdict: ${verdict}`,
        firstError ? `Problem: ${firstError}` : 'All brackets and quotes match.',
        '',
        'Matched pairs:',
        `  ( )  : ${counts['()'] ?? 0}`,
        `  [ ]  : ${counts['[]'] ?? 0}`,
        `  { }  : ${counts['{}'] ?? 0}`,
      ];
      if (checkAngle) summaryLines.push(`  < >  : ${counts['<>'] ?? 0}`);

      return summaryLines.join('\n');
    },
    [checkAngle, checkQuotes]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[checkAngle, checkQuotes]}
      inputLabel="Text or code"
      outputLabel="Balance report"
      sample={SAMPLE}
      downloadName="bracket-report.txt"
      options={
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={checkQuotes}
                onCheckedChange={(v) => setCheckQuotes(v === true)}
              />
              Check quotes
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={checkAngle}
                onCheckedChange={(v) => setCheckAngle(v === true)}
              />
              Check angle brackets &lt; &gt;
            </label>
          </div>
        </Field>
      }
    />
  );
}
