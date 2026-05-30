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

const SAMPLE = `{
  name: "Ada Lovelace",
  "role" => "engineer",
  :level => 3,
  salary: 95_000,
  ratio: 1.5,
  active: true,
  manager: nil,
  tags: [:ruby, "json", 2],
  address: { city: "London", zip: "EC1" }
}`;

type Tok =
  | { t: 'punct'; v: string }
  | { t: 'arrow' }
  | { t: 'colonKey'; v: string } // identifier immediately followed by ':' (key: shorthand)
  | { t: 'symbol'; v: string } // :name symbol
  | { t: 'string'; v: string }
  | { t: 'number'; v: number }
  | { t: 'ident'; v: string }; // true/false/nil

function tokenize(src: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i] ?? '';
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '=' && src[i + 1] === '>') {
      tokens.push({ t: 'arrow' });
      i += 2;
      continue;
    }
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ',') {
      tokens.push({ t: 'punct', v: ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
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
            else if (next === '#') str += '#';
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
      tokens.push({ t: 'string', v: str });
      continue;
    }
    // Symbol :name
    if (ch === ':' && /[A-Za-z_]/.test(src[i + 1] ?? '')) {
      i++;
      let name = '';
      while (i < n && /[A-Za-z0-9_?!]/.test(src[i] ?? '')) {
        name += src[i] ?? '';
        i++;
      }
      tokens.push({ t: 'symbol', v: name });
      continue;
    }
    // Number (with underscores), optional sign and decimal/exponent.
    if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9')) {
      let raw = '';
      while (i < n) {
        const c = src[i] ?? '';
        if ((c >= '0' && c <= '9') || c === '_' || c === '.' || c === '-' || c === '+' || c === 'e' || c === 'E') {
          raw += c;
          i++;
        } else break;
      }
      const cleaned = raw.replace(/_/g, '');
      const num = Number(cleaned);
      if (!Number.isFinite(num)) throw new Error(`Invalid number "${raw}".`);
      tokens.push({ t: 'number', v: num });
      continue;
    }
    // Identifier — could be key: shorthand or true/false/nil.
    if (/[A-Za-z_]/.test(ch)) {
      let name = '';
      while (i < n && /[A-Za-z0-9_?!]/.test(src[i] ?? '')) {
        name += src[i] ?? '';
        i++;
      }
      // Skip whitespace before checking for ':'
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
      if (src[j] === ':' && src[j + 1] !== ':') {
        // key: shorthand — consume the colon.
        i = j + 1;
        tokens.push({ t: 'colonKey', v: name });
        continue;
      }
      tokens.push({ t: 'ident', v: name });
      continue;
    }
    throw new Error(`Unexpected character "${ch}".`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Tok[]) {}

  private peek(): Tok | undefined {
    return this.tokens[this.pos];
  }
  private next(): Tok | undefined {
    return this.tokens[this.pos++];
  }

  parse(): unknown {
    const v = this.parseValue();
    return v;
  }

  private parseValue(): unknown {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of input.');
    if (tok.t === 'punct' && tok.v === '{') {
      this.next();
      return this.parseHash();
    }
    if (tok.t === 'punct' && tok.v === '[') {
      this.next();
      return this.parseArray();
    }
    if (tok.t === 'string') {
      this.next();
      return tok.v;
    }
    if (tok.t === 'number') {
      this.next();
      return tok.v;
    }
    if (tok.t === 'symbol') {
      this.next();
      return tok.v; // bare symbol value -> string
    }
    if (tok.t === 'ident') {
      this.next();
      if (tok.v === 'true') return true;
      if (tok.v === 'false') return false;
      if (tok.v === 'nil') return null;
      throw new Error(`Unexpected identifier "${tok.v}".`);
    }
    throw new Error('Unexpected token in value position.');
  }

  private parseArray(): unknown[] {
    const arr: unknown[] = [];
    for (;;) {
      const tok = this.peek();
      if (!tok) throw new Error("Expected ']' to close array.");
      if (tok.t === 'punct' && tok.v === ']') {
        this.next();
        break;
      }
      arr.push(this.parseValue());
      const sep = this.peek();
      if (sep && sep.t === 'punct' && sep.v === ',') {
        this.next();
        continue;
      }
      const end = this.peek();
      if (end && end.t === 'punct' && end.v === ']') {
        this.next();
        break;
      }
      throw new Error("Expected ',' or ']' in array.");
    }
    return arr;
  }

  private parseHash(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (;;) {
      const tok = this.peek();
      if (!tok) throw new Error("Expected '}' to close hash.");
      if (tok.t === 'punct' && tok.v === '}') {
        this.next();
        break;
      }
      const key = this.parseKey();
      obj[key] = this.parseValue();
      const sep = this.peek();
      if (sep && sep.t === 'punct' && sep.v === ',') {
        this.next();
        continue;
      }
      const end = this.peek();
      if (end && end.t === 'punct' && end.v === '}') {
        this.next();
        break;
      }
      throw new Error("Expected ',' or '}' in hash.");
    }
    return obj;
  }

  private parseKey(): string {
    const tok = this.next();
    if (!tok) throw new Error('Expected a hash key.');
    // key: shorthand — colon already consumed by tokenizer.
    if (tok.t === 'colonKey') return tok.v;
    // :sym => or "str" => or 'str' => or number =>
    let key: string;
    if (tok.t === 'symbol') key = tok.v;
    else if (tok.t === 'string') key = tok.v;
    else if (tok.t === 'number') key = String(tok.v);
    else if (tok.t === 'ident') key = tok.v;
    else throw new Error('Invalid hash key.');
    const arrow = this.next();
    if (!arrow || arrow.t !== 'arrow') {
      throw new Error(`Expected '=>' after key "${key}".`);
    }
    return key;
  }
}

export default function RubyHashToJsonTool() {
  const [pretty, setPretty] = useState(true);
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const tokens = tokenize(input);
      if (tokens.length === 0) throw new Error('No Ruby content found.');
      const parser = new Parser(tokens);
      const js = parser.parse();
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
      inputLabel="Ruby hash / array"
      outputLabel="JSON"
      inputPlaceholder="{ name: 'Ada', level: 3 }"
      sample={SAMPLE}
      downloadName="ruby-to-json.json"
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
