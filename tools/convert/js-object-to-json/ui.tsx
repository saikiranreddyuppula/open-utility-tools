'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `{
  // a relaxed JS object
  name: 'Ada',
  age: 36,
  active: true,
  roles: ['admin', 'dev',],
  meta: { created: "2020-01-01", note: 'has \\'quotes\\'' },
}`;

type Tok =
  | { t: 'punct'; v: string }
  | { t: 'string'; v: string }
  | { t: 'number'; v: string }
  | { t: 'ident'; v: string };

function isIdentStart(c: string): boolean {
  return /[A-Za-z_$]/.test(c);
}
function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

/** Tokenize a relaxed JS object literal, dropping comments. */
function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i] ?? '';
    // whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // line comment
    if (c === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // strings (single, double, backtick)
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let val = '';
      i++;
      while (i < n) {
        const ch = src[i] ?? '';
        if (ch === '\\') {
          const next = src[i + 1] ?? '';
          val += ch + next;
          i += 2;
          continue;
        }
        if (ch === quote) {
          i++;
          break;
        }
        val += ch;
        i++;
      }
      toks.push({ t: 'string', v: decodeJsString(val) });
      continue;
    }
    // number
    if (/[0-9]/.test(c) || (c === '-' && /[0-9.]/.test(src[i + 1] ?? '')) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let val = '';
      while (i < n && /[0-9eE+\-.xXa-fA-F]/.test(src[i] ?? '')) {
        val += src[i];
        i++;
      }
      toks.push({ t: 'number', v: val });
      continue;
    }
    // punctuation
    if ('{}[]:,'.includes(c)) {
      toks.push({ t: 'punct', v: c });
      i++;
      continue;
    }
    // identifier / keyword
    if (isIdentStart(c)) {
      let val = '';
      while (i < n && isIdentPart(src[i] ?? '')) {
        val += src[i];
        i++;
      }
      toks.push({ t: 'ident', v: val });
      continue;
    }
    throw new Error(`Unexpected character "${c}" at position ${i}`);
  }
  return toks;
}

/** Resolve escape sequences in a raw JS string body to actual characters. */
function decodeJsString(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i] ?? '';
    if (c !== '\\') {
      out += c;
      i++;
      continue;
    }
    const e = raw[i + 1] ?? '';
    switch (e) {
      case 'n':
        out += '\n';
        i += 2;
        break;
      case 't':
        out += '\t';
        i += 2;
        break;
      case 'r':
        out += '\r';
        i += 2;
        break;
      case 'b':
        out += '\b';
        i += 2;
        break;
      case 'f':
        out += '\f';
        i += 2;
        break;
      case 'v':
        out += '\v';
        i += 2;
        break;
      case '0':
        out += '\0';
        i += 2;
        break;
      case 'x': {
        const hex = raw.slice(i + 2, i + 4);
        const code = parseInt(hex, 16);
        out += Number.isFinite(code) ? String.fromCharCode(code) : '';
        i += 4;
        break;
      }
      case 'u': {
        if (raw[i + 2] === '{') {
          const end = raw.indexOf('}', i + 3);
          const hex = raw.slice(i + 3, end);
          const code = parseInt(hex, 16);
          out += Number.isFinite(code) ? String.fromCodePoint(code) : '';
          i = end + 1;
        } else {
          const hex = raw.slice(i + 2, i + 6);
          const code = parseInt(hex, 16);
          out += Number.isFinite(code) ? String.fromCharCode(code) : '';
          i += 6;
        }
        break;
      }
      case '\n':
        i += 2;
        break;
      default:
        out += e;
        i += 2;
        break;
    }
  }
  return out;
}

interface Parser {
  toks: Tok[];
  pos: number;
}

function peek(p: Parser): Tok | undefined {
  return p.toks[p.pos];
}
function next(p: Parser): Tok {
  const t = p.toks[p.pos];
  if (!t) throw new Error('Unexpected end of input');
  p.pos++;
  return t;
}

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

function parseValue(p: Parser): JsonVal {
  const t = peek(p);
  if (!t) throw new Error('Unexpected end of input');
  if (t.t === 'punct' && t.v === '{') return parseObject(p);
  if (t.t === 'punct' && t.v === '[') return parseArray(p);
  if (t.t === 'string') {
    next(p);
    return t.v;
  }
  if (t.t === 'number') {
    next(p);
    const num = Number(t.v);
    if (!Number.isFinite(num)) throw new Error(`Invalid number "${t.v}"`);
    return num;
  }
  if (t.t === 'ident') {
    next(p);
    if (t.v === 'true') return true;
    if (t.v === 'false') return false;
    if (t.v === 'null') return null;
    if (t.v === 'undefined') return null;
    if (t.v === 'NaN' || t.v === 'Infinity') throw new Error(`"${t.v}" is not valid JSON`);
    throw new Error(`Unexpected identifier "${t.v}"`);
  }
  throw new Error(`Unexpected token "${t.v}"`);
}

function parseObject(p: Parser): { [k: string]: JsonVal } {
  next(p); // {
  const obj: { [k: string]: JsonVal } = {};
  for (;;) {
    const t = peek(p);
    if (!t) throw new Error('Unterminated object');
    if (t.t === 'punct' && t.v === '}') {
      next(p);
      break;
    }
    if (t.t === 'punct' && t.v === ',') {
      next(p);
      continue;
    }
    // key
    let key: string;
    if (t.t === 'string' || t.t === 'ident') {
      key = t.v;
      next(p);
    } else if (t.t === 'number') {
      key = t.v;
      next(p);
    } else {
      throw new Error(`Expected object key but got "${t.v}"`);
    }
    const colon = next(p);
    if (!(colon.t === 'punct' && colon.v === ':')) throw new Error(`Expected ":" after key "${key}"`);
    obj[key] = parseValue(p);
  }
  return obj;
}

function parseArray(p: Parser): JsonVal[] {
  next(p); // [
  const arr: JsonVal[] = [];
  for (;;) {
    const t = peek(p);
    if (!t) throw new Error('Unterminated array');
    if (t.t === 'punct' && t.v === ']') {
      next(p);
      break;
    }
    if (t.t === 'punct' && t.v === ',') {
      next(p);
      continue;
    }
    arr.push(parseValue(p));
  }
  return arr;
}

export default function JsObjectToJsonTool() {
  const [indent, setIndent] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const toks = tokenize(input);
      if (toks.length === 0) throw new Error('No content to convert');
      const p: Parser = { toks, pos: 0 };
      const value = parseValue(p);
      if (p.pos < toks.length) {
        const extra = toks[p.pos];
        throw new Error(`Unexpected trailing token "${extra?.v ?? ''}"`);
      }
      return JSON.stringify(value, null, indent ? 2 : undefined);
    },
    [indent]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent]}
      inputLabel="JS object literal"
      outputLabel="JSON"
      inputPlaceholder="{ name: 'Ada', roles: ['admin',], }"
      sample={SAMPLE}
      downloadName="object.json"
      downloadMime="application/json"
      options={
        <Field label="Pretty-print">
          <div className="flex h-8 items-center gap-2">
            <Switch id="indent" checked={indent} onCheckedChange={setIndent} />
            <Label htmlFor="indent" className="text-xs text-muted-foreground">
              2-space indent
            </Label>
          </div>
        </Field>
      }
    />
  );
}
