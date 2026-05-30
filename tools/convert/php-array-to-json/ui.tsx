'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type PhpValue =
  | { kind: 'array'; entries: { key: PhpValue | null; value: PhpValue }[] }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'null' };

interface Token {
  type: 'punct' | 'arrow' | 'string' | 'number' | 'word';
  value: string;
}

const SAMPLE = `array(
  'name' => 'Ada Lovelace',
  'age' => 36,
  'active' => true,
  'scores' => array(98, 76.5, 100),
  'meta' => ['role' => 'engineer', 'level' => null],
)`;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i] ?? '';
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    // Comments: // ... , # ... , /* ... */
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '=' && src[i + 1] === '>') {
      tokens.push({ type: 'arrow', value: '=>' });
      i += 2;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === ',' || ch === ';') {
      tokens.push({ type: 'punct', value: ch });
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = '';
      while (i < n) {
        const c = src[i] ?? '';
        if (c === '\\') {
          const next = src[i + 1] ?? '';
          if (quote === '"') {
            if (next === 'n') str += '\n';
            else if (next === 't') str += '\t';
            else if (next === 'r') str += '\r';
            else if (next === '"') str += '"';
            else if (next === '\\') str += '\\';
            else if (next === '$') str += '$';
            else str += next;
          } else {
            if (next === "'") str += "'";
            else if (next === '\\') str += '\\';
            else str += '\\' + next;
          }
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        str += c;
        i++;
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }
    if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9') || ch === '.') {
      let num = '';
      while (i < n) {
        const c = src[i] ?? '';
        if ((c >= '0' && c <= '9') || c === '.' || c === '-' || c === '+' || c === 'e' || c === 'E') {
          num += c;
          i++;
        } else break;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }
    // Word: array, true, false, null, return, etc.
    let word = '';
    while (i < n) {
      const c = src[i] ?? '';
      if (/[A-Za-z_]/.test(c)) {
        word += c;
        i++;
      } else break;
    }
    if (word === '') {
      throw new Error(`Unexpected character "${ch}" at position ${i}.`);
    }
    tokens.push({ type: 'word', value: word });
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): PhpValue {
    // Skip leading "return".
    const first = this.peek();
    if (first && first.type === 'word' && first.value.toLowerCase() === 'return') {
      this.next();
    }
    const value = this.parseValue();
    return value;
  }

  private parseValue(): PhpValue {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of input.');

    if (tok.type === 'word') {
      const w = tok.value.toLowerCase();
      if (w === 'array') {
        this.next();
        const open = this.next();
        if (!open || open.value !== '(') throw new Error("Expected '(' after array.");
        return this.parseArrayBody(')');
      }
      if (w === 'true') {
        this.next();
        return { kind: 'bool', value: true };
      }
      if (w === 'false') {
        this.next();
        return { kind: 'bool', value: false };
      }
      if (w === 'null') {
        this.next();
        return { kind: 'null' };
      }
      throw new Error(`Unexpected identifier "${tok.value}".`);
    }
    if (tok.type === 'punct' && tok.value === '[') {
      this.next();
      return this.parseArrayBody(']');
    }
    if (tok.type === 'string') {
      this.next();
      return { kind: 'string', value: tok.value };
    }
    if (tok.type === 'number') {
      this.next();
      const num = Number(tok.value);
      if (!Number.isFinite(num)) throw new Error(`Invalid number "${tok.value}".`);
      return { kind: 'number', value: num };
    }
    throw new Error(`Unexpected token "${tok.value}".`);
  }

  private parseArrayBody(closer: string): PhpValue {
    const entries: { key: PhpValue | null; value: PhpValue }[] = [];
    for (;;) {
      const tok = this.peek();
      if (!tok) throw new Error(`Expected "${closer}" to close array.`);
      if (tok.type === 'punct' && tok.value === closer) {
        this.next();
        break;
      }
      const first = this.parseValue();
      const maybeArrow = this.peek();
      if (maybeArrow && maybeArrow.type === 'arrow') {
        this.next();
        const value = this.parseValue();
        entries.push({ key: first, value });
      } else {
        entries.push({ key: null, value: first });
      }
      const sep = this.peek();
      if (sep && sep.type === 'punct' && sep.value === ',') {
        this.next();
        continue;
      }
      const end = this.peek();
      if (end && end.type === 'punct' && end.value === closer) {
        this.next();
        break;
      }
      throw new Error(`Expected ',' or '${closer}' in array.`);
    }
    return { kind: 'array', entries };
  }
}

function keyToJsonKey(key: PhpValue): string {
  if (key.kind === 'string') return key.value;
  if (key.kind === 'number') return String(key.value);
  if (key.kind === 'bool') return key.value ? '1' : '0';
  if (key.kind === 'null') return '';
  throw new Error('Array keys cannot be arrays.');
}

function toJs(value: PhpValue): unknown {
  switch (value.kind) {
    case 'string':
      return value.value;
    case 'number':
      return value.value;
    case 'bool':
      return value.value;
    case 'null':
      return null;
    case 'array': {
      // Decide list vs object: all keys null OR sequential integer keys 0..n-1.
      const allBare = value.entries.every((e) => e.key === null);
      if (allBare) {
        return value.entries.map((e) => toJs(e.value));
      }
      // Check for sequential integer keys.
      let expected = 0;
      let isSeqInt = true;
      for (const e of value.entries) {
        if (e.key === null) {
          // bare entry within keyed array — treat as next integer index.
          expected++;
          continue;
        }
        if (e.key.kind === 'number' && Number.isInteger(e.key.value) && e.key.value === expected) {
          expected++;
        } else {
          isSeqInt = false;
          break;
        }
      }
      if (isSeqInt) {
        return value.entries.map((e) => toJs(e.value));
      }
      const obj: Record<string, unknown> = {};
      let autoIdx = 0;
      for (const e of value.entries) {
        if (e.key === null) {
          obj[String(autoIdx)] = toJs(e.value);
          autoIdx++;
        } else {
          if (e.key.kind === 'number' && Number.isInteger(e.key.value) && e.key.value >= autoIdx) {
            autoIdx = e.key.value + 1;
          }
          obj[keyToJsonKey(e.key)] = toJs(e.value);
        }
      }
      return obj;
    }
    default:
      throw new Error('Unknown value kind.');
  }
}

export default function PhpArrayToJsonTool() {
  const [pretty, setPretty] = useState(true);
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const tokens = tokenize(input);
      if (tokens.length === 0) throw new Error('No PHP array content found.');
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const js = toJs(ast);
      if (!pretty) return JSON.stringify(js);
      const space = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(js, null, space);
    },
    [pretty, indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[pretty, indent]}
      inputLabel="PHP array"
      outputLabel="JSON"
      inputPlaceholder="array('key' => 'value', ...)"
      sample={SAMPLE}
      downloadName="php-to-json.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Output">
            <Switch checked={pretty} onCheckedChange={setPretty} />
            <span className="text-2xs text-muted-foreground">{pretty ? 'Pretty' : 'Minified'}</span>
          </Field>
          {pretty && (
            <Field label="Indent">
              <Select value={indent} onValueChange={(v) => setIndent(v as '2' | '4' | 'tab')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      }
    />
  );
}
