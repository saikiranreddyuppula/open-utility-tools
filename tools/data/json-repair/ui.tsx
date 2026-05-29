'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Indent = '2' | '4' | 'tab' | 'min';

/**
 * Tolerant tokenizer that walks the input character-by-character and rewrites
 * lenient JSON5-ish syntax into strict JSON:
 *  - strips // and block comments
 *  - converts single-quoted and backtick strings to double-quoted
 *  - quotes bare/unquoted object keys
 *  - removes trailing commas before } or ]
 *  - normalizes Python/JS literals (None/True/False, NaN/Infinity)
 */
function repairJson(input: string): string {
  const src = input;
  const n = src.length;
  let out = '';
  let i = 0;

  // Track structural context so we know when a bareword is a key.
  const stack: Array<'{' | '['> = [];
  // Within an object, are we currently expecting a key?
  let expectKey = false;

  const peekNonSpace = (from: number): string => {
    let j = from;
    while (j < n) {
      const c = src[j];
      if (c === undefined) break;
      if (/\s/.test(c)) {
        j++;
        continue;
      }
      // skip comments while peeking
      if (c === '/' && src[j + 1] === '/') {
        while (j < n && src[j] !== '\n') j++;
        continue;
      }
      if (c === '/' && src[j + 1] === '*') {
        j += 2;
        while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
        j += 2;
        continue;
      }
      return c;
    }
    return '';
  };

  // Remove a trailing comma already written to `out` if the next real char closes.
  const dropTrailingComma = () => {
    let k = out.length - 1;
    while (k >= 0) {
      const ch = out[k];
      if (ch === undefined) break;
      if (/\s/.test(ch)) {
        k--;
        continue;
      }
      if (ch === ',') {
        out = out.slice(0, k) + out.slice(k + 1);
      }
      break;
    }
  };

  while (i < n) {
    const ch = src[i];
    if (ch === undefined) break;

    // Line comment.
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // Block comment.
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Whitespace — copy through.
    if (/\s/.test(ch)) {
      out += ch;
      i++;
      continue;
    }

    // Quoted strings (any of " ' `).
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let str = '';
      i++;
      while (i < n) {
        const c = src[i];
        if (c === undefined) break;
        if (c === '\\') {
          const next = src[i + 1];
          if (next === undefined) {
            str += '\\\\';
            i++;
            break;
          }
          if (next === quote && quote !== '"') {
            // Escaped same-quote in a single/back-quoted string -> literal.
            str += next;
            i += 2;
            continue;
          }
          str += '\\' + next;
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        if (c === '"') {
          // Bare double-quote inside a single/back-quoted string must be escaped.
          str += '\\"';
          i++;
          continue;
        }
        if (c === '\n' && quote !== '"') {
          // Newline inside a lenient string -> escape it.
          str += '\\n';
          i++;
          continue;
        }
        str += c;
        i++;
      }
      out += `"${str}"`;
      if (expectKey) expectKey = false;
      continue;
    }

    // Structural characters.
    if (ch === '{') {
      stack.push('{');
      expectKey = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '[') {
      stack.push('[');
      expectKey = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === '}' || ch === ']') {
      dropTrailingComma();
      stack.pop();
      const parent = stack[stack.length - 1];
      expectKey = false;
      out += ch;
      i++;
      // After a value closes, if its parent is an object, the next thing
      // (after a comma) will be a key.
      if (parent === '{') expectKey = false;
      continue;
    }
    if (ch === ':') {
      expectKey = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === ',') {
      // Drop trailing comma if the next real token closes a container.
      const next = peekNonSpace(i + 1);
      if (next === '}' || next === ']') {
        i++;
        continue;
      }
      out += ch;
      i++;
      if (stack[stack.length - 1] === '{') expectKey = true;
      continue;
    }

    // Bareword: an unquoted key, or a literal/number value.
    if (/[A-Za-z0-9_$+\-.]/.test(ch)) {
      let word = '';
      let j = i;
      while (j < n) {
        const c = src[j];
        if (c === undefined) break;
        if (/[A-Za-z0-9_$+\-.]/.test(c)) {
          word += c;
          j++;
        } else {
          break;
        }
      }
      i = j;

      if (expectKey) {
        // Unquoted object key -> quote it.
        out += `"${word}"`;
        expectKey = false;
        continue;
      }

      // Value position: normalize literals, otherwise pass through numbers,
      // and quote unknown barewords as strings.
      const lower = word.toLowerCase();
      if (lower === 'true' || lower === 'false' || lower === 'null') {
        out += lower;
      } else if (lower === 'none' || lower === 'nil' || lower === 'undefined') {
        out += 'null';
      } else if (lower === 'nan' || lower === 'infinity' || lower === '-infinity' || lower === '+infinity') {
        out += 'null';
      } else if (/^[+\-]?(\d+\.?\d*|\.\d+)([eE][+\-]?\d+)?$/.test(word)) {
        // Valid-ish number; strip leading + which JSON forbids.
        out += word.replace(/^\+/, '');
      } else {
        out += `"${word}"`;
      }
      continue;
    }

    // Anything else — copy through.
    out += ch;
    i++;
  }

  return out;
}

export default function JsonRepairTool() {
  const [indent, setIndent] = useState<Indent>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const repaired = repairJson(input);
      let parsed: unknown;
      try {
        parsed = JSON.parse(repaired);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Could not fully repair this input. After cleanup it still fails to parse: ${message}`,
        );
      }
      if (indent === 'min') return JSON.stringify(parsed);
      const space = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(parsed, null, space);
    },
    [indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent]}
      inputLabel="Broken JSON"
      outputLabel="Repaired JSON"
      inputPlaceholder="{ name: 'Ada', skills: ['math',], }"
      sample={"{\n  // a comment\n  name: 'Ada',\n  'age': 36,\n  active: True,\n  skills: ['math', 'code',],\n}"}
      downloadName="repaired.json"
      downloadMime="application/json"
      options={
        <Field label="Indent">
          <Tabs value={indent} onValueChange={(v) => setIndent(v as Indent)}>
            <TabsList>
              <TabsTrigger value="2">2</TabsTrigger>
              <TabsTrigger value="4">4</TabsTrigger>
              <TabsTrigger value="tab">Tab</TabsTrigger>
              <TabsTrigger value="min">Min</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
