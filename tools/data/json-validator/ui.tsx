'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

/** Derive a numeric character offset from a parser error message, if present. */
function extractPosition(message: string): number | null {
  // V8 / Node: "... at position 123" (optionally "(line X column Y)").
  const pos = /at position (\d+)/i.exec(message);
  if (pos && pos[1] !== undefined) {
    const n = Number(pos[1]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Some engines embed line/column directly in the message. */
function extractLineColumn(message: string): { line: number; column: number } | null {
  const m = /line (\d+) column (\d+)/i.exec(message);
  if (m && m[1] !== undefined && m[2] !== undefined) {
    const line = Number(m[1]);
    const column = Number(m[2]);
    if (Number.isFinite(line) && Number.isFinite(column)) return { line, column };
  }
  return null;
}

function lineColFromOffset(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const max = Math.min(offset, text.length);
  for (let i = 0; i < max; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function contextSnippet(text: string, line: number, column: number): string {
  const lines = text.split('\n');
  const target = lines[line - 1];
  if (target === undefined) return '';
  const caret = `${' '.repeat(Math.max(0, column - 1))}^`;
  return `\n\n  ${target}\n  ${caret}`;
}

export default function JsonValidatorTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    try {
      const parsed: unknown = JSON.parse(input);
      const type = Array.isArray(parsed)
        ? `array (${parsed.length} item${parsed.length === 1 ? '' : 's'})`
        : parsed === null
          ? 'null'
          : typeof parsed === 'object'
            ? `object (${Object.keys(parsed as Record<string, unknown>).length} key${
                Object.keys(parsed as Record<string, unknown>).length === 1 ? '' : 's'
              })`
            : typeof parsed;
      return `Valid JSON ✓\n\nRoot type: ${type}`;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      let line: number | null = null;
      let column: number | null = null;

      const offset = extractPosition(message);
      if (offset !== null) {
        const lc = lineColFromOffset(input, offset);
        line = lc.line;
        column = lc.column;
      } else {
        const lc = extractLineColumn(message);
        if (lc) {
          line = lc.line;
          column = lc.column;
        }
      }

      // Strip the engine-specific trailing position so we can present our own.
      const reason = message
        .replace(/\s*at position \d+.*$/i, '')
        .replace(/\s*in JSON at.*$/i, '')
        .replace(/^JSON\.parse:\s*/i, '')
        .trim();

      if (line !== null && column !== null) {
        const where = `line ${line}, column ${column}`;
        throw new Error(`Invalid JSON at ${where}: ${reason}${contextSnippet(input, line, column)}`);
      }
      throw new Error(`Invalid JSON: ${reason || message}`);
    }
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="Result"
      inputPlaceholder='{"name": "value"}'
      sample={'{\n  "name": "Ada",\n  "age": 36,\n  "skills": ["math", "code"]\n}'}
      downloadName="validation.txt"
    />
  );
}
