'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

/*
 * A small offline JMESPath-style query engine supporting:
 *   identifiers          a.b.c
 *   index                a[0]  a[-1]
 *   wildcard projection   a[*].b   a.*
 *   slices               a[1:3]  a[::2]
 *   flatten              a[]
 *   filter expressions   a[?b=='x'] with == != < > <= >= && ||
 *                        and number/string/boolean/null literals.
 */

type Json = unknown;

interface Token {
  type:
    | 'ident'
    | 'dot'
    | 'star'
    | 'lbracket'
    | 'rbracket'
    | 'index'
    | 'slice'
    | 'flatten'
    | 'filter';
  value?: string;
  // For filter tokens, the raw expression text inside [? ... ].
  expr?: string;
  // For slice tokens.
  slice?: { start?: number; stop?: number; step?: number };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Tokenize a query path into an ordered list of operations. */
function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = query.length;

  const fail = (msg: string): never => {
    throw new Error(`${msg} (at position ${i})`);
  };

  while (i < n) {
    const c = query[i];
    if (c === undefined) break;

    if (c === '.') {
      i += 1;
      continue;
    }
    if (c === '*') {
      tokens.push({ type: 'star' });
      i += 1;
      continue;
    }
    if (c === '[') {
      // Determine bracket flavour.
      const close = query.indexOf(']', i);
      if (close === -1) fail('Unclosed "["');
      const inner = query.slice(i + 1, close);

      if (inner === '') {
        tokens.push({ type: 'flatten' });
        i = close + 1;
        continue;
      }
      if (inner === '*') {
        tokens.push({ type: 'star' });
        i = close + 1;
        continue;
      }
      if (inner.startsWith('?')) {
        tokens.push({ type: 'filter', expr: inner.slice(1).trim() });
        i = close + 1;
        continue;
      }
      if (inner.includes(':')) {
        const parts = inner.split(':');
        const toNum = (s: string | undefined): number | undefined => {
          if (s === undefined || s.trim() === '') return undefined;
          const v = Number(s);
          if (!Number.isFinite(v)) fail(`Invalid slice component "${s}"`);
          return v;
        };
        tokens.push({
          type: 'slice',
          slice: { start: toNum(parts[0]), stop: toNum(parts[1]), step: toNum(parts[2]) },
        });
        i = close + 1;
        continue;
      }
      // Numeric index.
      const idx = Number(inner);
      if (!Number.isInteger(idx)) fail(`Invalid array index "${inner}"`);
      tokens.push({ type: 'index', value: inner });
      i = close + 1;
      continue;
    }

    // Identifier: letters, digits, underscore, dash.
    const m = /^[A-Za-z_$][\w$-]*/.exec(query.slice(i));
    if (m && m[0]) {
      tokens.push({ type: 'ident', value: m[0] });
      i += m[0].length;
      continue;
    }

    fail(`Unexpected character "${c}"`);
  }
  return tokens;
}

// ---- Filter expression evaluation -------------------------------------

type Cmp = '==' | '!=' | '<=' | '>=' | '<' | '>';

interface Comparison {
  path: string;
  op: Cmp;
  literal: Json;
}

function parseLiteral(raw: string): Json {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2) ||
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith('`') && t.endsWith('`') && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  const num = Number(t);
  if (Number.isFinite(num) && t !== '') return num;
  // Bare word treated as a string literal for convenience.
  return t;
}

/** Resolve a simple dot path against an element (no wildcards inside filters). */
function getByPath(value: Json, path: string): Json {
  if (path === '@') return value;
  let cur: Json = value;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (isObject(cur)) {
      cur = cur[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function parseComparison(text: string): Comparison {
  const ops: Cmp[] = ['==', '!=', '<=', '>=', '<', '>'];
  for (const op of ops) {
    const idx = text.indexOf(op);
    if (idx !== -1) {
      const left = text.slice(0, idx).trim();
      const right = text.slice(idx + op.length).trim();
      if (!left) throw new Error('Filter is missing a left-hand field');
      return { path: left, op, literal: parseLiteral(right) };
    }
  }
  throw new Error(`Filter must contain a comparison operator: "${text}"`);
}

function compare(a: Json, op: Cmp, b: Json): boolean {
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return typeof a === 'number' && typeof b === 'number' ? a < b : String(a) < String(b);
    case '>':
      return typeof a === 'number' && typeof b === 'number' ? a > b : String(a) > String(b);
    case '<=':
      return typeof a === 'number' && typeof b === 'number' ? a <= b : String(a) <= String(b);
    case '>=':
      return typeof a === 'number' && typeof b === 'number' ? a >= b : String(a) >= String(b);
    default:
      return false;
  }
}

function evalFilter(expr: string, element: Json): boolean {
  // Split on || (lowest precedence), then && within each clause.
  const orClauses = expr.split('||');
  for (const orClause of orClauses) {
    const andTerms = orClause.split('&&');
    let allTrue = true;
    for (const term of andTerms) {
      const cmp = parseComparison(term.trim());
      const lhs = getByPath(element, cmp.path);
      if (!compare(lhs, cmp.op, cmp.literal)) {
        allTrue = false;
        break;
      }
    }
    if (allTrue) return true;
  }
  return false;
}

// ---- Token application -------------------------------------------------

function normalizeIndex(idx: number, len: number): number {
  return idx < 0 ? len + idx : idx;
}

function applySlice(arr: Json[], s: { start?: number; stop?: number; step?: number }): Json[] {
  const len = arr.length;
  const step = s.step ?? 1;
  if (step === 0) throw new Error('Slice step cannot be 0');
  const out: Json[] = [];
  if (step > 0) {
    const start = s.start === undefined ? 0 : Math.max(0, normalizeIndex(s.start, len));
    const stop = s.stop === undefined ? len : Math.min(len, normalizeIndex(s.stop, len));
    for (let i = start; i < stop; i += step) out.push(arr[i]);
  } else {
    const start = s.start === undefined ? len - 1 : normalizeIndex(s.start, len);
    const stop = s.stop === undefined ? -1 : normalizeIndex(s.stop, len);
    for (let i = Math.min(len - 1, start); i > stop; i += step) {
      if (i >= 0 && i < len) out.push(arr[i]);
    }
  }
  return out;
}

/**
 * Apply tokens left-to-right. `projecting` tracks whether the current value is
 * a projection (an array each of whose elements the remaining ops apply to).
 */
function evaluate(tokens: Token[], root: Json): Json {
  let current: Json = root;
  let projecting = false;

  const applyToOne = (value: Json, tok: Token): Json => {
    switch (tok.type) {
      case 'ident': {
        if (isObject(value)) return value[tok.value ?? ''];
        return undefined;
      }
      case 'index': {
        if (!Array.isArray(value)) return undefined;
        const idx = normalizeIndex(Number(tok.value), value.length);
        return value[idx];
      }
      case 'slice': {
        if (!Array.isArray(value)) return undefined;
        return applySlice(value, tok.slice ?? {});
      }
      case 'filter': {
        if (!Array.isArray(value)) return undefined;
        return value.filter((el) => evalFilter(tok.expr ?? '', el));
      }
      case 'flatten': {
        if (!Array.isArray(value)) return undefined;
        const out: Json[] = [];
        for (const el of value) {
          if (Array.isArray(el)) out.push(...el);
          else out.push(el);
        }
        return out;
      }
      // star/dot/lbracket/rbracket handled in main loop.
      case 'star':
      case 'dot':
      case 'lbracket':
      case 'rbracket':
        return value;
      default:
        return value;
    }
  };

  for (const tok of tokens) {
    if (tok.type === 'star') {
      // Begin a projection over array elements (or object values).
      let elems: Json[];
      if (Array.isArray(current)) elems = current;
      else if (isObject(current)) elems = Object.values(current);
      else elems = [];
      current = elems;
      projecting = true;
      continue;
    }

    if (tok.type === 'flatten') {
      // Flatten then continue projecting.
      const flat = applyToOne(current, tok);
      current = flat;
      projecting = true;
      continue;
    }

    if (projecting) {
      // Apply this op to each element, dropping nulls/undefined results.
      const arr = Array.isArray(current) ? current : [];
      const mapped: Json[] = [];
      for (const el of arr) {
        const r = applyToOne(el, tok);
        if (r !== null && r !== undefined) mapped.push(r);
      }
      current = mapped;
      // index/slice/filter keep projection semantics in JMESPath; we keep it on.
      continue;
    }

    current = applyToOne(current, tok);
  }

  return current;
}

export default function JmesPathLiteQueryTool() {
  const [query, setQuery] = useState('locations[?state=="WA"].name');
  const [pretty, setPretty] = useState(true);
  const [firstOnly, setFirstOnly] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: Json;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const q = query.trim();
      let result: Json;
      if (q === '' || q === '@') {
        result = doc;
      } else {
        const tokens = tokenize(q);
        result = evaluate(tokens, doc);
      }

      if (firstOnly && Array.isArray(result)) {
        result = result.length > 0 ? result[0] : null;
      }

      if (result === undefined) return 'null';
      return pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
    },
    [query, pretty, firstOnly],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[query, pretty, firstOnly]}
      inputLabel="JSON document"
      outputLabel="Query result"
      inputPlaceholder='{"locations": [...]}'
      sample={
        '{\n' +
        '  "locations": [\n' +
        '    {"name": "Seattle", "state": "WA"},\n' +
        '    {"name": "New York", "state": "NY"},\n' +
        '    {"name": "Bellevue", "state": "WA"}\n' +
        '  ]\n' +
        '}'
      }
      downloadName="query-result.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Query" hint="JMESPath-lite: a.b[0], a[*].b, a[?x=='y'], a[1:3], a[]" className="min-w-[260px] flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="a.b[?c=='x'].d"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Pretty">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
          <Field label="First match only">
            <Switch checked={firstOnly} onCheckedChange={setFirstOnly} />
          </Field>
        </>
      }
    />
  );
}
