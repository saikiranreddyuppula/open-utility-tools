'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

const SAMPLE = `item,price,qty,discount
Widget,9.99,3,2
Gadget,19.5,1,0
Gizmo,4.25,10,5`;

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function serializeField(field: string, delimiter: string): string {
  if (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// ----- Safe arithmetic expression evaluator (no eval) -----

type Tok =
  | { t: 'num'; v: number }
  | { t: 'col'; v: string }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'comma' }
  | { t: 'lparen' }
  | { t: 'rparen' };

const FUNCS = new Set(['round', 'abs', 'min', 'max', 'floor', 'ceil']);

function tokenize(expr: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_ .]/.test(c);
  while (i < expr.length) {
    const c = expr[i] ?? '';
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i] ?? '')) {
        num += expr[i];
        i++;
      }
      const n = Number(num);
      if (!Number.isFinite(n)) throw new Error(`Invalid number "${num}"`);
      tokens.push({ t: 'num', v: n });
      continue;
    }
    if (c === '.') {
      // leading-dot decimal like .5
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i] ?? '')) {
        num += expr[i];
        i++;
      }
      const n = Number(num);
      if (!Number.isFinite(n)) throw new Error(`Invalid number "${num}"`);
      tokens.push({ t: 'num', v: n });
      continue;
    }
    if ('+-*/%'.includes(c)) {
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ t: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ t: 'rparen' });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ t: 'comma' });
      i++;
      continue;
    }
    if (c === '`') {
      // backtick-quoted column name (allows any chars / spaces)
      i++;
      let name = '';
      while (i < expr.length && expr[i] !== '`') {
        name += expr[i];
        i++;
      }
      if (expr[i] !== '`') throw new Error('Unterminated `column` reference');
      i++;
      tokens.push({ t: 'col', v: name.trim() });
      continue;
    }
    if (isIdentStart(c)) {
      let name = '';
      while (i < expr.length && isIdent(expr[i] ?? '')) {
        name += expr[i];
        i++;
      }
      const trimmed = name.trim();
      // function only if immediately followed by '('
      let j = i;
      while (j < expr.length && (expr[j] === ' ' || expr[j] === '\t')) j++;
      if (FUNCS.has(trimmed.toLowerCase()) && expr[j] === '(') {
        tokens.push({ t: 'fn', v: trimmed.toLowerCase() });
      } else {
        tokens.push({ t: 'col', v: trimmed });
      }
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

const PREC: Record<string, number> = { '+': 2, '-': 2, '*': 3, '/': 3, '%': 3, 'u-': 4 };

// Convert to RPN via shunting-yard. Returns a compiled list of ops.
type RpnItem =
  | { k: 'num'; v: number }
  | { k: 'col'; v: string }
  | { k: 'op'; v: string }
  | { k: 'fn'; v: string; argc: number };

function toRpn(tokens: Tok[]): RpnItem[] {
  const output: RpnItem[] = [];
  const ops: ({ t: 'op'; v: string } | { t: 'fn'; v: string } | { t: 'lparen' })[] = [];
  const argCount: number[] = [];
  let prev: Tok | null = null;

  for (const tok of tokens) {
    if (tok.t === 'num') {
      output.push({ k: 'num', v: tok.v });
    } else if (tok.t === 'col') {
      output.push({ k: 'col', v: tok.v });
    } else if (tok.t === 'fn') {
      ops.push({ t: 'fn', v: tok.v });
      argCount.push(1);
    } else if (tok.t === 'comma') {
      while (ops.length > 0 && ops[ops.length - 1]?.t !== 'lparen') {
        const op = ops.pop();
        if (op && op.t === 'op') output.push({ k: 'op', v: op.v });
        else if (op && op.t === 'fn') output.push({ k: 'fn', v: op.v, argc: 1 });
      }
      if (argCount.length > 0) argCount[argCount.length - 1] = (argCount[argCount.length - 1] ?? 1) + 1;
    } else if (tok.t === 'op') {
      // detect unary minus/plus
      const isUnary =
        prev === null || prev.t === 'op' || prev.t === 'lparen' || prev.t === 'comma';
      const opName = isUnary && tok.v === '-' ? 'u-' : isUnary && tok.v === '+' ? 'u+' : tok.v;
      if (opName === 'u+') {
        prev = tok;
        continue; // unary plus is a no-op
      }
      const prec = PREC[opName] ?? 2;
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (!top || top.t === 'lparen') break;
        if (top.t === 'fn') {
          output.push({ k: 'fn', v: top.v, argc: 1 });
          ops.pop();
          continue;
        }
        const topPrec = PREC[top.v] ?? 0;
        if (topPrec >= prec && opName !== 'u-') {
          output.push({ k: 'op', v: top.v });
          ops.pop();
        } else break;
      }
      ops.push({ t: 'op', v: opName });
    } else if (tok.t === 'lparen') {
      ops.push({ t: 'lparen' });
    } else if (tok.t === 'rparen') {
      while (ops.length > 0 && ops[ops.length - 1]?.t !== 'lparen') {
        const op = ops.pop();
        if (op && op.t === 'op') output.push({ k: 'op', v: op.v });
      }
      if (ops.length === 0) throw new Error('Mismatched parentheses');
      ops.pop(); // remove lparen
      const beforeParen = ops[ops.length - 1];
      if (beforeParen && beforeParen.t === 'fn') {
        const argc = argCount.pop() ?? 1;
        output.push({ k: 'fn', v: beforeParen.v, argc });
        ops.pop();
      }
    }
    prev = tok;
  }
  while (ops.length > 0) {
    const op = ops.pop();
    if (!op) break;
    if (op.t === 'lparen') throw new Error('Mismatched parentheses');
    if (op.t === 'op') output.push({ k: 'op', v: op.v });
    else if (op.t === 'fn') output.push({ k: 'fn', v: op.v, argc: 1 });
  }
  return output;
}

function evalRpn(rpn: RpnItem[], lookup: (col: string) => number): number {
  const stack: number[] = [];
  for (const item of rpn) {
    if (item.k === 'num') stack.push(item.v);
    else if (item.k === 'col') stack.push(lookup(item.v));
    else if (item.k === 'op') {
      if (item.v === 'u-') {
        const a = stack.pop() ?? 0;
        stack.push(-a);
        continue;
      }
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      switch (item.v) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(a / b); break;
        case '%': stack.push(a % b); break;
        default: throw new Error(`Unknown operator ${item.v}`);
      }
    } else {
      const args: number[] = [];
      for (let k = 0; k < item.argc; k++) args.unshift(stack.pop() ?? 0);
      switch (item.v) {
        case 'round': stack.push(Math.round(args[0] ?? 0)); break;
        case 'abs': stack.push(Math.abs(args[0] ?? 0)); break;
        case 'floor': stack.push(Math.floor(args[0] ?? 0)); break;
        case 'ceil': stack.push(Math.ceil(args[0] ?? 0)); break;
        case 'min': stack.push(Math.min(...args)); break;
        case 'max': stack.push(Math.max(...args)); break;
        default: throw new Error(`Unknown function ${item.v}`);
      }
    }
  }
  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0] ?? NaN;
}

export default function CsvColumnMath() {
  const [colName, setColName] = useState('total');
  const [expr, setExpr] = useState('price * qty - discount');
  const [decimals, setDecimals] = useState('2');
  const [afterCol, setAfterCol] = useState('');
  const [delim, setDelim] = useState<DelimKey>('comma');

  return (
    <TextToolLayout
      deps={[colName, expr, decimals, afterCol, delim]}
      sample={SAMPLE}
      inputLabel="CSV (first row = header)"
      outputLabel="CSV + computed column"
      downloadName="computed.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.trim()) return '';
        if (!expr.trim()) throw new Error('Enter an expression, e.g. price * qty');
        const d = DELIMS[delim];
        const rows = parseCSV(input, d);
        const headerRow = rows[0];
        if (!headerRow) return '';
        const header = headerRow.map((h) => h.trim());

        const rpn = toRpn(tokenize(expr));
        // Validate referenced columns up front.
        for (const item of rpn) {
          if (item.k === 'col' && !header.includes(item.v)) {
            throw new Error(`Unknown column "${item.v}". Available: ${header.join(', ')}`);
          }
        }

        const decN = Math.max(0, Math.min(Number(decimals) || 0, 12));
        const insertAt = afterCol.trim()
          ? header.indexOf(afterCol.trim()) + 1
          : header.length;
        const pos = insertAt > 0 ? insertAt : header.length;

        const out: string[] = [];
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          let value: string;
          if (r === 0) {
            value = colName;
          } else {
            try {
              const result = evalRpn(rpn, (col) => {
                const idx = header.indexOf(col);
                const raw = (row[idx] ?? '').trim();
                const n = Number(raw);
                if (raw === '' || !Number.isFinite(n)) throw new Error('non-numeric');
                return n;
              });
              value = Number.isFinite(result) ? result.toFixed(decN) : '';
            } catch {
              value = ''; // non-numeric cell → empty result for this row
            }
          }
          const cells = [...row];
          cells.splice(pos, 0, value);
          out.push(cells.map((c) => serializeField(c, d)).join(d));
        }
        return out.join('\n');
      }}
      options={
        <>
          <Field label="New column name">
            <Input value={colName} onChange={(e) => setColName(e.target.value)} className="w-32" />
          </Field>
          <Field label="Expression" hint="use header names; backticks for spaces" className="min-w-72 flex-1">
            <Input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="price * qty - discount"
              className="font-mono"
            />
          </Field>
          <Field label="Decimals" hint="0-12">
            <Input value={decimals} onChange={(e) => setDecimals(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
          <Field label="Insert after column" hint="blank = append">
            <Input value={afterCol} onChange={(e) => setAfterCol(e.target.value)} placeholder="(append)" className="w-36 font-mono" />
          </Field>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="semicolon">Semicolon</SelectItem>
                <SelectItem value="pipe">Pipe</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
