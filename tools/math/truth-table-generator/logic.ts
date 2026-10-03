/**
 * Boolean expression parser, truth tables, canonical forms, Quine-McCluskey + Petrick minimisation,
 * Karnaugh map layout and equivalence checking. Pure TypeScript, no dependencies.
 *
 * Conventions: for n variables the first variable is the most significant bit of the row / minterm number.
 */

// ---------------------------------------------------------------- AST

export type BinOp = 'and' | 'or' | 'xor' | 'nand' | 'nor' | 'xnor' | 'imp' | 'iff';

export type Expr =
  | { t: 'const'; v: boolean }
  | { t: 'var'; name: string }
  | { t: 'not'; a: Expr }
  | { t: 'bin'; op: BinOp; a: Expr; b: Expr };

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.name = 'ParseError';
    this.pos = pos;
  }
}

// ---------------------------------------------------------------- tokenizer

type TokKind = 'lp' | 'rp' | 'var' | 'const' | 'not' | 'prime' | 'end' | BinOp;

interface Token {
  k: TokKind;
  pos: number;
  text: string;
  v?: boolean;
}

const WORD_OPS: Record<string, TokKind> = {
  and: 'and',
  or: 'or',
  not: 'not',
  xor: 'xor',
  nand: 'nand',
  nor: 'nor',
  xnor: 'xnor',
  nxor: 'xnor',
  implies: 'imp',
  imp: 'imp',
  iff: 'iff',
};

const SYMBOLS: Record<string, TokKind> = {
  '&': 'and',
  '∧': 'and',
  '·': 'and',
  '*': 'and',
  '.': 'and',
  '|': 'or',
  '∨': 'or',
  '+': 'or',
  '!': 'not',
  '~': 'not',
  '¬': 'not',
  '^': 'xor',
  '⊕': 'xor',
  '⊻': 'xor',
  '↑': 'nand',
  '⊼': 'nand',
  '↓': 'nor',
  '⊽': 'nor',
  '⊙': 'xnor',
  '→': 'imp',
  '⇒': 'imp',
  '⊃': 'imp',
  '↔': 'iff',
  '⇔': 'iff',
  '≡': 'iff',
  "'": 'prime',
  '’': 'prime',
  '′': 'prime',
  '(': 'lp',
  '[': 'lp',
  '{': 'lp',
  ')': 'rp',
  ']': 'rp',
  '}': 'rp',
};

export interface ParseOptions {
  /** Treat juxtaposition as AND and split letter-only words into single-letter variables (AB = A AND B). */
  implicitAnd: boolean;
}

function tokenize(src: string, opts: ParseOptions): Token[] {
  const toks: Token[] = [];
  let i = 0;
  const n = src.length;
  const startsWith = (s: string) => src.startsWith(s, i);
  while (i < n) {
    const ch = src.charAt(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (startsWith('<->') || startsWith('<=>')) {
      toks.push({ k: 'iff', pos: i, text: src.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (startsWith('->') || startsWith('=>')) {
      toks.push({ k: 'imp', pos: i, text: src.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (startsWith('==')) {
      toks.push({ k: 'iff', pos: i, text: '==' });
      i += 2;
      continue;
    }
    if (startsWith('!=')) {
      toks.push({ k: 'xor', pos: i, text: '!=' });
      i += 2;
      continue;
    }
    if (startsWith('&&')) {
      toks.push({ k: 'and', pos: i, text: '&&' });
      i += 2;
      continue;
    }
    if (startsWith('||')) {
      toks.push({ k: 'or', pos: i, text: '||' });
      i += 2;
      continue;
    }
    const sym = SYMBOLS[ch];
    if (sym !== undefined) {
      toks.push({ k: sym, pos: i, text: ch });
      i++;
      continue;
    }
    if (ch === '0' || ch === '1') {
      if (/[0-9A-Za-z_]/.test(src.charAt(i + 1))) {
        let j = i;
        while (j < n && /[0-9A-Za-z_]/.test(src.charAt(j))) j++;
        throw new ParseError(`"${src.slice(i, j)}" is not valid: only 0 and 1 are constants, and names must start with a letter (position ${i + 1}).`, i);
      }
      toks.push({ k: 'const', pos: i, text: ch, v: ch === '1' });
      i++;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      throw new ParseError(`Unexpected digit "${ch}" at position ${i + 1}; only 0 and 1 are constants.`, i);
    }
    if (/[A-Za-z_À-ɏͰ-Ͽ]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_À-ɏͰ-Ͽ]/.test(src.charAt(j))) j++;
      const word = src.slice(i, j);
      const lower = word.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        toks.push({ k: 'const', pos: i, text: word, v: lower === 'true' });
      } else if (WORD_OPS[lower] !== undefined) {
        toks.push({ k: WORD_OPS[lower] as TokKind, pos: i, text: word });
      } else if (opts.implicitAnd && /^[A-Za-zͰ-Ͽ]+$/.test(word) && word.length > 1) {
        for (let k = 0; k < word.length; k++) toks.push({ k: 'var', pos: i + k, text: word.charAt(k) });
      } else {
        toks.push({ k: 'var', pos: i, text: word });
      }
      i = j;
      continue;
    }
    if (ch === '=') throw new ParseError(`Single "=" at position ${i + 1}; use "==" or "<->" for equivalence.`, i);
    if (ch === '<' || ch === '-') throw new ParseError(`Unexpected "${ch}" at position ${i + 1}; implication is "->" and equivalence is "<->".`, i);
    throw new ParseError(`Unexpected character "${ch}" at position ${i + 1}.`, i);
  }
  toks.push({ k: 'end', pos: n, text: '' });
  return toks;
}

// ---------------------------------------------------------------- parser

const MAX_DEPTH = 200;

class Parser {
  private p = 0;
  private depth = 0;
  constructor(
    private toks: Token[],
    private opts: ParseOptions
  ) {}

  private peek(): Token {
    return this.toks[this.p] as Token;
  }
  private next(): Token {
    const t = this.peek();
    if (t.k !== 'end') this.p++;
    return t;
  }

  parse(): Expr {
    if (this.peek().k === 'end') throw new ParseError('Enter an expression.', 0);
    const e = this.iff();
    const t = this.peek();
    if (t.k !== 'end') {
      if (t.k === 'rp') throw new ParseError(`Unmatched ")" at position ${t.pos + 1}.`, t.pos);
      throw new ParseError(
        `Unexpected "${t.text}" at position ${t.pos + 1}. ${t.k === 'var' || t.k === 'const' || t.k === 'lp' ? 'Put an operator between terms, or enable implicit AND for AB-style products.' : ''}`.trim(),
        t.pos
      );
    }
    return e;
  }

  private iff(): Expr {
    let a = this.imp();
    while (this.peek().k === 'iff') {
      this.next();
      a = { t: 'bin', op: 'iff', a, b: this.imp() };
    }
    return a;
  }

  private imp(): Expr {
    const a = this.or();
    if (this.peek().k === 'imp') {
      this.next();
      return { t: 'bin', op: 'imp', a, b: this.imp() };
    }
    return a;
  }

  private or(): Expr {
    let a = this.xor();
    for (;;) {
      const k = this.peek().k;
      if (k === 'or' || k === 'nor') {
        this.next();
        a = { t: 'bin', op: k, a, b: this.xor() };
      } else return a;
    }
  }

  private xor(): Expr {
    let a = this.and();
    for (;;) {
      const k = this.peek().k;
      if (k === 'xor' || k === 'xnor') {
        this.next();
        a = { t: 'bin', op: k, a, b: this.and() };
      } else return a;
    }
  }

  private startsOperand(k: TokKind): boolean {
    return k === 'var' || k === 'const' || k === 'lp' || k === 'not';
  }

  private and(): Expr {
    let a = this.unary();
    for (;;) {
      const k = this.peek().k;
      if (k === 'and' || k === 'nand') {
        this.next();
        a = { t: 'bin', op: k, a, b: this.unary() };
      } else if (this.opts.implicitAnd && this.startsOperand(k)) {
        a = { t: 'bin', op: 'and', a, b: this.unary() };
      } else return a;
    }
  }

  private unary(): Expr {
    if (++this.depth > MAX_DEPTH) throw new ParseError('Expression is nested too deeply.', this.peek().pos);
    try {
      const t = this.peek();
      if (t.k === 'not') {
        this.next();
        return { t: 'not', a: this.unary() };
      }
      let e = this.primary();
      while (this.peek().k === 'prime') {
        this.next();
        e = { t: 'not', a: e };
      }
      return e;
    } finally {
      this.depth--;
    }
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.k) {
      case 'var':
        return { t: 'var', name: t.text };
      case 'const':
        return { t: 'const', v: t.v === true };
      case 'lp': {
        const e = this.iff();
        const c = this.peek();
        if (c.k !== 'rp') throw new ParseError(`Missing ")" to close the "(" at position ${t.pos + 1}.`, t.pos);
        this.next();
        return e;
      }
      case 'end':
        throw new ParseError('The expression ends unexpectedly; an operand is missing.', t.pos);
      case 'rp':
        throw new ParseError(`Unexpected ")" at position ${t.pos + 1}; an operand is missing.`, t.pos);
      default:
        throw new ParseError(`Unexpected "${t.text}" at position ${t.pos + 1}; an operand (variable, 0/1 or "(") is expected.`, t.pos);
    }
  }
}

export function parseExpr(src: string, opts: ParseOptions = { implicitAnd: false }): Expr {
  return new Parser(tokenize(src, opts), opts).parse();
}

// ---------------------------------------------------------------- printing

export interface SymbolSet {
  not: (inner: string) => string;
  and: string;
  or: string;
  xor: string;
  nand: string;
  nor: string;
  xnor: string;
  imp: string;
  iff: string;
  t: string;
  f: string;
  variable: (name: string) => string;
}

export const UNICODE_SYMBOLS: SymbolSet = {
  not: (s) => `¬${s}`,
  and: '∧',
  or: '∨',
  xor: '⊕',
  nand: '⊼',
  nor: '⊽',
  xnor: '⊙',
  imp: '→',
  iff: '↔',
  t: '1',
  f: '0',
  variable: (n) => n,
};

export const LATEX_SYMBOLS: SymbolSet = {
  not: (s) => `\\lnot ${s}`,
  and: '\\land',
  or: '\\lor',
  xor: '\\oplus',
  nand: '\\uparrow',
  nor: '\\downarrow',
  xnor: '\\odot',
  imp: '\\rightarrow',
  iff: '\\leftrightarrow',
  t: '1',
  f: '0',
  variable: (n) => n.replace(/_/g, '\\_'),
};

function isAtom(e: Expr): boolean {
  return e.t === 'var' || e.t === 'const' || e.t === 'not';
}

function printInner(e: Expr, sym: SymbolSet): string {
  switch (e.t) {
    case 'const':
      return e.v ? sym.t : sym.f;
    case 'var':
      return sym.variable(e.name);
    case 'not': {
      const inner = printInner(e.a, sym);
      return sym.not(isAtom(e.a) ? inner : `(${inner})`);
    }
    case 'bin': {
      const a = printInner(e.a, sym);
      const b = printInner(e.b, sym);
      const wa = isAtom(e.a) ? a : `(${a})`;
      const wb = isAtom(e.b) ? b : `(${b})`;
      return `${wa} ${sym[e.op]} ${wb}`;
    }
  }
}

/** Fully parenthesised text; the outermost pair is omitted. */
export function toFullyParenthesised(e: Expr, sym: SymbolSet = UNICODE_SYMBOLS): string {
  return printInner(e, sym);
}

function exprKey(e: Expr): string {
  return printInner(e, UNICODE_SYMBOLS);
}

// ---------------------------------------------------------------- variables & evaluation

export function collectVariables(e: Expr, out: string[] = []): string[] {
  switch (e.t) {
    case 'var':
      if (!out.includes(e.name)) out.push(e.name);
      return out;
    case 'const':
      return out;
    case 'not':
      return collectVariables(e.a, out);
    case 'bin':
      collectVariables(e.a, out);
      return collectVariables(e.b, out);
  }
}

export function sortVariables(vars: string[]): string[] {
  return vars.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0));
}

export function evalBin(op: BinOp, a: boolean, b: boolean): boolean {
  switch (op) {
    case 'and':
      return a && b;
    case 'or':
      return a || b;
    case 'xor':
      return a !== b;
    case 'nand':
      return !(a && b);
    case 'nor':
      return !(a || b);
    case 'xnor':
      return a === b;
    case 'imp':
      return !a || b;
    case 'iff':
      return a === b;
  }
}

/** Evaluate with a name -> value assignment. */
export function evaluate(e: Expr, env: Record<string, boolean>): boolean {
  switch (e.t) {
    case 'const':
      return e.v;
    case 'var': {
      const v = env[e.name];
      if (v === undefined) throw new Error(`Variable ${e.name} has no value.`);
      return v;
    }
    case 'not':
      return !evaluate(e.a, env);
    case 'bin':
      return evalBin(e.op, evaluate(e.a, env), evaluate(e.b, env));
  }
}

type Fn = (m: number) => boolean;

/** Compile to a function of the row number (first variable = most significant bit). */
export function compileExpr(e: Expr, vars: string[]): Fn {
  const n = vars.length;
  const idx = new Map<string, number>();
  vars.forEach((v, k) => idx.set(v, k));
  const build = (x: Expr): Fn => {
    switch (x.t) {
      case 'const': {
        const v = x.v;
        return () => v;
      }
      case 'var': {
        const k = idx.get(x.name);
        if (k === undefined) throw new Error(`Unknown variable ${x.name}.`);
        const shift = n - 1 - k;
        return (m) => ((m >> shift) & 1) === 1;
      }
      case 'not': {
        const f = build(x.a);
        return (m) => !f(m);
      }
      case 'bin': {
        const fa = build(x.a);
        const fb = build(x.b);
        const op = x.op;
        return (m) => evalBin(op, fa(m), fb(m));
      }
    }
  };
  return build(e);
}

// ---------------------------------------------------------------- truth table

export const MAX_VARS = 12;
export const WARN_VARS = 8;

export interface TruthColumn {
  label: string;
  latex: string;
  /** 1 = true, 0 = false, 2 = don't care */
  values: Uint8Array;
  isResult: boolean;
}

export interface TruthTable {
  vars: string[];
  rows: number;
  /** Intermediate columns followed by the result column. */
  columns: TruthColumn[];
  result: Uint8Array;
}

function collectSubExprs(e: Expr, out: Map<string, Expr>): void {
  switch (e.t) {
    case 'var':
    case 'const':
      return;
    case 'not':
      collectSubExprs(e.a, out);
      break;
    case 'bin':
      collectSubExprs(e.a, out);
      collectSubExprs(e.b, out);
      break;
  }
  const key = exprKey(e);
  if (!out.has(key)) out.set(key, e);
}

export function buildTruthTable(e: Expr, vars: string[], withSubExpressions: boolean): TruthTable {
  const n = vars.length;
  if (n > MAX_VARS) throw new Error(`Too many variables (${n}); the limit is ${MAX_VARS}.`);
  const rows = 1 << n;
  const columns: TruthColumn[] = [];
  const rootKey = exprKey(e);
  if (withSubExpressions) {
    const subs = new Map<string, Expr>();
    collectSubExprs(e, subs);
    for (const [key, sub] of subs) {
      if (key === rootKey) continue;
      const f = compileExpr(sub, vars);
      const v = new Uint8Array(rows);
      for (let m = 0; m < rows; m++) v[m] = f(m) ? 1 : 0;
      columns.push({ label: key, latex: printInner(sub, LATEX_SYMBOLS), values: v, isResult: false });
    }
  }
  const f = compileExpr(e, vars);
  const result = new Uint8Array(rows);
  for (let m = 0; m < rows; m++) result[m] = f(m) ? 1 : 0;
  columns.push({ label: rootKey, latex: printInner(e, LATEX_SYMBOLS), values: result, isResult: true });
  return { vars, rows, columns, result };
}

/** Table defined by minterms and don't-cares (result column only). */
export function tableFromMinterms(vars: string[], minterms: number[], dontCares: number[]): TruthTable {
  const n = vars.length;
  if (n > MAX_VARS) throw new Error(`Too many variables (${n}); the limit is ${MAX_VARS}.`);
  const rows = 1 << n;
  const result = new Uint8Array(rows);
  for (const m of minterms) result[m] = 1;
  for (const m of dontCares) if (result[m] !== 1) result[m] = 2;
  return {
    vars,
    rows,
    columns: [{ label: 'F', latex: 'F', values: result, isResult: true }],
    result,
  };
}

export function rowBits(m: number, n: number): number[] {
  const out: number[] = [];
  for (let k = n - 1; k >= 0; k--) out.push((m >> k) & 1);
  return out;
}

// ---------------------------------------------------------------- export

export type ValueStyle = '01' | 'TF';

function cell(v: number, style: ValueStyle): string {
  if (v === 2) return 'X';
  return style === '01' ? String(v) : v === 1 ? 'T' : 'F';
}

export function tableToCsv(t: TruthTable, style: ValueStyle): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = [...t.vars, ...t.columns.map((c) => c.label)].map(q).join(',');
  const lines = [head];
  for (let m = 0; m < t.rows; m++) {
    const bits = rowBits(m, t.vars.length).map((b) => cell(b, style));
    lines.push([...bits, ...t.columns.map((c) => cell(c.values[m] as number, style))].join(','));
  }
  return lines.join('\n');
}

export function tableToMarkdown(t: TruthTable, style: ValueStyle): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const heads = [...t.vars, ...t.columns.map((c) => c.label)].map(esc);
  const lines = [`| ${heads.join(' | ')} |`, `| ${heads.map(() => ':-:').join(' | ')} |`];
  for (let m = 0; m < t.rows; m++) {
    const bits = rowBits(m, t.vars.length).map((b) => cell(b, style));
    lines.push(`| ${[...bits, ...t.columns.map((c) => cell(c.values[m] as number, style))].join(' | ')} |`);
  }
  return lines.join('\n');
}

export function tableToLatex(t: TruthTable, style: ValueStyle): string {
  const cols = t.vars.length + t.columns.length;
  const heads = [...t.vars.map((v) => `$${LATEX_SYMBOLS.variable(v)}$`), ...t.columns.map((c) => `$${c.latex}$`)];
  const lines = [`\\begin{tabular}{|${Array.from({ length: cols }, () => 'c').join('|')}|}`, '\\hline', `${heads.join(' & ')} \\\\ \\hline`];
  for (let m = 0; m < t.rows; m++) {
    const bits = rowBits(m, t.vars.length).map((b) => cell(b, style));
    lines.push(`${[...bits, ...t.columns.map((c) => cell(c.values[m] as number, style))].join(' & ')} \\\\`);
  }
  lines.push('\\hline', '\\end{tabular}');
  return lines.join('\n');
}

// ---------------------------------------------------------------- classification & canonical forms

export type Classification = 'tautology' | 'contradiction' | 'contingency';

export function classify(result: Uint8Array): Classification {
  let ones = 0;
  let zeros = 0;
  for (const v of result) {
    if (v === 1) ones++;
    else if (v === 0) zeros++;
  }
  if (zeros === 0 && ones > 0) return 'tautology';
  if (ones === 0) return 'contradiction';
  return 'contingency';
}

export function indicesOf(result: Uint8Array, value: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < result.length; m++) if (result[m] === value) out.push(m);
  return out;
}

export type FormStyle = 'prime' | 'symbols' | 'code';

interface Lit {
  v: number;
  neg: boolean;
}

function litText(name: string, neg: boolean, style: FormStyle): string {
  if (style === 'prime') return neg ? `${name}'` : name;
  if (style === 'symbols') return neg ? `¬${name}` : name;
  return neg ? `!${name}` : name;
}

function joinProduct(lits: string[], vars: string[], style: FormStyle): string {
  if (style === 'symbols') return lits.join(' ∧ ');
  if (style === 'code') return lits.join(' & ');
  const single = vars.every((v) => v.length === 1);
  return lits.join(single ? '' : '·');
}

function joinSum(lits: string[], style: FormStyle): string {
  if (style === 'symbols') return lits.join(' ∨ ');
  if (style === 'code') return lits.join(' | ');
  return lits.join(' + ');
}

export interface Implicant {
  value: number;
  mask: number;
}

function implicantLits(imp: Implicant, n: number): Lit[] {
  const out: Lit[] = [];
  for (let k = 0; k < n; k++) {
    const bit = n - 1 - k;
    if ((imp.mask >> bit) & 1) continue;
    out.push({ v: k, neg: ((imp.value >> bit) & 1) === 0 });
  }
  return out;
}

export function productText(imp: Implicant, vars: string[], style: FormStyle): string {
  const lits = implicantLits(imp, vars.length);
  if (lits.length === 0) return '1';
  return joinProduct(
    lits.map((l) => litText(vars[l.v] as string, l.neg, style)),
    vars,
    style
  );
}

/** Sum clause of a POS form for an implicant of the complement function. */
export function clauseText(imp: Implicant, vars: string[], style: FormStyle): string {
  const lits = implicantLits(imp, vars.length);
  if (lits.length === 0) return '0';
  const parts = lits.map((l) => litText(vars[l.v] as string, !l.neg, style));
  return joinSum(parts, style);
}

export function sopText(imps: Implicant[], vars: string[], style: FormStyle): string {
  if (imps.length === 0) return '0';
  const parts = imps.map((i) => productText(i, vars, style));
  return joinSum(parts, style);
}

export function posText(imps: Implicant[], vars: string[], style: FormStyle): string {
  if (imps.length === 0) return '1';
  const clauses = imps.map((i) => {
    const c = clauseText(i, vars, style);
    const multi = implicantLits(i, vars.length).length > 1;
    return multi ? `(${c})` : c;
  });
  if (style === 'symbols') return clauses.join(' ∧ ');
  if (style === 'code') return clauses.join(' & ');
  return clauses.join(vars.every((v) => v.length === 1) ? '' : '·');
}

export function canonicalSop(minterms: number[], vars: string[], style: FormStyle): string {
  return sopText(
    minterms.map((m) => ({ value: m, mask: 0 })),
    vars,
    style
  );
}

export function canonicalPos(maxterms: number[], vars: string[], style: FormStyle): string {
  return posText(
    maxterms.map((m) => ({ value: m, mask: 0 })),
    vars,
    style
  );
}

export function mintermNotation(minterms: number[], dc: number[]): string {
  const base = `Σm(${minterms.join(', ')})`;
  return dc.length > 0 ? `${base} + d(${dc.join(', ')})` : base;
}

export function maxtermNotation(maxterms: number[], dc: number[]): string {
  const base = `ΠM(${maxterms.join(', ')})`;
  return dc.length > 0 ? `${base} · d(${dc.join(', ')})` : base;
}

// ---------------------------------------------------------------- Quine-McCluskey + Petrick

export interface MinimizeResult {
  /** All prime implicants when they were enumerated, otherwise just the implicants used. */
  primes: Implicant[];
  /** True when `primes` lists every prime implicant. */
  primesComplete: boolean;
  essential: Implicant[];
  /** The chosen cover. */
  cover: Implicant[];
  /** Other covers of equal cost (exact mode only). */
  alternatives: Implicant[][];
  exact: boolean;
  note: string | null;
}

export const EXACT_MAX_VARS = 8;
const QM_WORK_SMALL = 2000000;
const QM_WORK_LARGE = 250000;
const MAX_PRIMES_LARGE = 2500;
const PETRICK_TERM_LIMIT = 4000;
const PETRICK_WORK_LIMIT = 3000000;
const COVER_BUILD_LIMIT = 4000000;
const DOMINANCE_LIMIT = 700;

function popcount(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>>= 1;
  }
  return c;
}

export function coversMinterm(imp: Implicant, m: number): boolean {
  return (m & ~imp.mask) === imp.value;
}

export function implicantMinterms(imp: Implicant, n: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 1 << n; m++) if (coversMinterm(imp, m)) out.push(m);
  return out;
}

function literalCount(imp: Implicant, n: number): number {
  return n - popcount(imp.mask);
}

/** Visit every cell of the cube (value, mask). */
function forEachCell(imp: Implicant, fn: (cell: number) => void): void {
  let sub = imp.mask;
  for (;;) {
    fn(imp.value | sub);
    if (sub === 0) break;
    sub = (sub - 1) & imp.mask;
  }
}

/**
 * All prime implicants of the function with the given on-set and don't-cares (Quine-McCluskey).
 * Returns null when more than `maxWork` merge steps would be needed.
 */
export function primeImplicants(onset: number[], dc: number[], n: number, maxWork = QM_WORK_SMALL): Implicant[] | null {
  const all = new Set<number>([...onset, ...dc]);
  if (all.size === 0) return [];
  const key = (v: number, m: number) => m * 4096 + v;
  let current = new Map<number, Implicant>();
  for (const m of all) current.set(key(m, 0), { value: m, mask: 0 });
  const primes: Implicant[] = [];
  let work = 0;
  while (current.size > 0) {
    const next = new Map<number, Implicant>();
    const used = new Set<number>();
    for (const [k, imp] of current) {
      for (let b = 0; b < n; b++) {
        const bit = 1 << b;
        if (imp.mask & bit || imp.value & bit) continue;
        const partnerKey = k + bit;
        if (current.has(partnerKey)) {
          used.add(k);
          used.add(partnerKey);
          const merged: Implicant = { value: imp.value, mask: imp.mask | bit };
          next.set(key(merged.value, merged.mask), merged);
        }
      }
      work++;
      if (work > maxWork) return null;
    }
    for (const [k, imp] of current) if (!used.has(k)) primes.push(imp);
    current = next;
  }
  return primes;
}

function costOf(set: Implicant[], n: number): [number, number] {
  return [set.length, set.reduce((s, i) => s + literalCount(i, n), 0)];
}

function betterCost(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function popBig(x: bigint): number {
  let c = 0;
  while (x > 0n) {
    if (x & 1n) c++;
    x >>= 1n;
  }
  return c;
}

function bitList(x: bigint): number[] {
  const out: number[] = [];
  for (let k = 0; x > 0n; k++, x >>= 1n) if (x & 1n) out.push(k);
  return out;
}

interface ExactOutcome {
  essential: Implicant[];
  cover: Implicant[];
  alternatives: Implicant[][];
}

/**
 * Exact minimum cover: essential primes, row/column dominance reduction, then Petrick's method on what is left.
 * Returns null when a size or work budget is exceeded.
 */
function exactCover(primes: Implicant[], on: number[], n: number): ExactOutcome | null {
  const idx = new Int32Array(1 << n).fill(-1);
  on.forEach((m, k) => {
    idx[m] = k;
  });
  const rowCols: number[][] = on.map(() => []);
  let built = 0;
  for (let j = 0; j < primes.length; j++) {
    const p = primes[j] as Implicant;
    let sub = p.mask;
    for (;;) {
      built++;
      const r = idx[p.value | sub] as number;
      if (r >= 0) (rowCols[r] as number[]).push(j);
      if (sub === 0) break;
      sub = (sub - 1) & p.mask;
    }
    if (built > COVER_BUILD_LIMIT) return null;
  }
  const selected = new Set<number>();
  const essentialIdx: number[] = [];
  for (const cols of rowCols) {
    if (cols.length === 1 && !selected.has(cols[0] as number)) {
      selected.add(cols[0] as number);
      essentialIdx.push(cols[0] as number);
    }
  }
  const essential = essentialIdx.map((j) => primes[j] as Implicant);
  const rowCovered = (r: number) => (rowCols[r] as number[]).some((j) => selected.has(j));
  let rows = on.map((_, r) => r).filter((r) => !rowCovered(r));
  if (rows.length === 0) return { essential, cover: essential.slice(), alternatives: [] };

  let cols = new Set<number>();
  for (const r of rows) for (const j of rowCols[r] as number[]) if (!selected.has(j)) cols.add(j);
  const lits = (j: number) => literalCount(primes[j] as Implicant, n);

  // reduction (essentials found late, row dominance, strict column dominance)
  if (rows.length <= DOMINANCE_LIMIT && cols.size <= DOMINANCE_LIMIT) {
    let changed = true;
    while (changed && rows.length > 0) {
      changed = false;
      const colArr = Array.from(cols);
      const colBit = new Map<number, bigint>();
      colArr.forEach((j, k) => colBit.set(j, 1n << BigInt(k)));
      const rowMask = new Map<number, bigint>();
      for (const r of rows) {
        let m = 0n;
        for (const j of rowCols[r] as number[]) {
          const b = colBit.get(j);
          if (b !== undefined) m |= b;
        }
        rowMask.set(r, m);
      }
      // essential
      for (const r of rows) {
        const m = rowMask.get(r) as bigint;
        if (m !== 0n && (m & (m - 1n)) === 0n) {
          const j = colArr[bitList(m)[0] as number] as number;
          selected.add(j);
          cols.delete(j);
          rows = rows.filter((x) => !(rowCols[x] as number[]).includes(j));
          changed = true;
          break;
        }
      }
      if (changed) continue;
      // row dominance: a row whose column set contains another row's set is covered for free
      const sorted = rows.slice().sort((x, y) => popBig(rowMask.get(x) as bigint) - popBig(rowMask.get(y) as bigint));
      const keep: number[] = [];
      const keepMasks: bigint[] = [];
      for (const r of sorted) {
        const m = rowMask.get(r) as bigint;
        if (keepMasks.some((k) => (k & m) === k)) {
          changed = true;
        } else {
          keep.push(r);
          keepMasks.push(m);
        }
      }
      rows = keep;
      if (changed) continue;
      // strict column dominance
      const rowBit = new Map<number, bigint>();
      rows.forEach((r, k) => rowBit.set(r, 1n << BigInt(k)));
      const colRowsMask = new Map<number, bigint>();
      for (const j of colArr) colRowsMask.set(j, 0n);
      for (const r of rows) {
        const rb = rowBit.get(r) as bigint;
        for (const j of rowCols[r] as number[]) {
          if (colRowsMask.has(j)) colRowsMask.set(j, (colRowsMask.get(j) as bigint) | rb);
        }
      }
      for (const j of colArr) {
        const mj = colRowsMask.get(j) as bigint;
        for (const k of colArr) {
          if (k === j || !cols.has(k) || !cols.has(j)) continue;
          const mk = colRowsMask.get(k) as bigint;
          if ((mj & mk) !== mj) continue;
          const strict = mj !== mk;
          if ((strict && lits(k) <= lits(j)) || (!strict && lits(k) < lits(j))) {
            cols.delete(j);
            changed = true;
            break;
          }
        }
      }
    }
    cols = new Set(Array.from(cols));
  }

  if (rows.length === 0) return { essential, cover: Array.from(selected).map((j) => primes[j] as Implicant), alternatives: [] };

  // Petrick on the remaining core
  const colArr = Array.from(cols);
  const colBit = new Map<number, bigint>();
  colArr.forEach((j, k) => colBit.set(j, 1n << BigInt(k)));
  let petrickRows: bigint[] = rows.map((r) => {
    let m = 0n;
    for (const j of rowCols[r] as number[]) {
      const b = colBit.get(j);
      if (b !== undefined) m |= b;
    }
    return m;
  });
  petrickRows = petrickRows.filter((m, i) => !petrickRows.some((o, k) => k !== i && (o & m) === o && (o !== m || k < i)));
  let terms: bigint[] = [0n];
  let work = 0;
  for (const row of petrickRows) {
    const choices = bitList(row).map((k) => 1n << BigInt(k));
    const next = new Set<bigint>();
    for (const t of terms) {
      if ((t & row) !== 0n) next.add(t);
      else for (const c of choices) next.add(t | c);
    }
    const arr = Array.from(next).sort((x, y) => popBig(x) - popBig(y));
    const out: bigint[] = [];
    for (const t of arr) {
      let covered = false;
      for (const o of out) {
        work++;
        if ((o & t) === o) {
          covered = true;
          break;
        }
      }
      if (!covered) out.push(t);
      if (work > PETRICK_WORK_LIMIT) return null;
    }
    terms = out;
    if (terms.length > PETRICK_TERM_LIMIT) return null;
  }
  const chosen = terms.map((t) => bitList(t).map((k) => colArr[k] as number));
  const base = Array.from(selected);
  const sets = chosen.map((c) => [...base, ...c].map((j) => primes[j] as Implicant));
  let best: [number, number] | null = null;
  for (const st of sets) {
    const c = costOf(st, n);
    if (best === null || betterCost(c, best) < 0) best = c;
  }
  if (best === null) return null;
  const bc = best;
  const winners = sets.filter((st) => betterCost(costOf(st, n), bc) === 0);
  const key = (st: Implicant[]) =>
    st
      .map((i) => i.mask * 4096 + i.value)
      .sort((x, y) => x - y)
      .join(',');
  winners.sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0));
  const [first, ...rest] = winners;
  return { essential, cover: first as Implicant[], alternatives: rest };
}

/** Greedy cover over an enumerated list of primes (used when the exact search is too large). */
function greedyOverPrimes(primes: Implicant[], on: number[], n: number): Implicant[] {
  const idx = new Int32Array(1 << n).fill(-1);
  on.forEach((m, k) => {
    idx[m] = k;
  });
  const rowCols: number[][] = on.map(() => []);
  const colRows: number[][] = primes.map(() => []);
  primes.forEach((p, j) => {
    forEachCell(p, (cell) => {
      const r = idx[cell] as number;
      if (r >= 0) {
        (rowCols[r] as number[]).push(j);
        (colRows[j] as number[]).push(r);
      }
    });
  });
  const score = colRows.map((rs) => rs.length);
  const covered = new Uint8Array(on.length);
  const used = new Uint8Array(primes.length);
  const cover: Implicant[] = [];
  let left = on.length;
  while (left > 0) {
    let best = -1;
    for (let j = 0; j < primes.length; j++) {
      if (used[j] || (score[j] as number) <= 0) continue;
      if (
        best < 0 ||
        (score[j] as number) > (score[best] as number) ||
        ((score[j] as number) === (score[best] as number) && literalCount(primes[j] as Implicant, n) < literalCount(primes[best] as Implicant, n))
      )
        best = j;
    }
    if (best < 0) break;
    used[best] = 1;
    cover.push(primes[best] as Implicant);
    for (const r of colRows[best] as number[]) {
      if (covered[r]) continue;
      covered[r] = 1;
      left--;
      for (const j of rowCols[r] as number[]) score[j] = (score[j] as number) - 1;
    }
  }
  return cover;
}

/** Fast heuristic for many variables: expand uncovered minterms into large implicants, then drop redundant ones. */
function expandCover(on: number[], dc: number[], n: number): Implicant[] {
  const care = new Uint8Array(1 << n);
  for (const m of on) care[m] = 1;
  for (const m of dc) if (care[m] === 0) care[m] = 2;
  const count = new Int32Array(1 << n);
  const cover: Implicant[] = [];
  for (const m0 of on) {
    if ((count[m0] as number) > 0) continue;
    let imp: Implicant = { value: m0, mask: 0 };
    for (;;) {
      let bestBit = -1;
      let bestScore = -1;
      for (let b = 0; b < n; b++) {
        const bit = 1 << b;
        if (imp.mask & bit) continue;
        // the new half of the cube: cells with bit flipped
        const half: Implicant = { value: (imp.value ^ bit) & ~imp.mask, mask: imp.mask };
        let ok = true;
        let score = 0;
        let sub = half.mask;
        for (;;) {
          const cell = half.value | sub;
          const c = care[cell] as number;
          if (c === 0) {
            ok = false;
            break;
          }
          if (c === 1 && (count[cell] as number) === 0) score++;
          if (sub === 0) break;
          sub = (sub - 1) & half.mask;
        }
        if (ok && score > bestScore) {
          bestScore = score;
          bestBit = b;
        }
      }
      if (bestBit < 0) break;
      const bit = 1 << bestBit;
      imp = { value: imp.value & ~bit, mask: imp.mask | bit };
    }
    cover.push(imp);
    forEachCell(imp, (cell) => {
      count[cell] = (count[cell] as number) + 1;
    });
  }
  // drop implicants whose on-cells are all covered elsewhere (largest first is kept)
  const order = cover.map((c, k) => k).sort((x, y) => literalCount(cover[y] as Implicant, n) - literalCount(cover[x] as Implicant, n));
  const dropped = new Set<number>();
  for (const k of order) {
    const imp = cover[k] as Implicant;
    let redundant = true;
    forEachCell(imp, (cell) => {
      if (redundant && care[cell] === 1 && (count[cell] as number) < 2) redundant = false;
    });
    if (redundant) {
      dropped.add(k);
      forEachCell(imp, (cell) => {
        count[cell] = (count[cell] as number) - 1;
      });
    }
  }
  return cover.filter((_, k) => !dropped.has(k));
}

/** Minimal sum-of-products cover (exact up to 8 variables, and beyond when the search stays small; otherwise greedy). */
export function minimize(onset: number[], dc: number[], n: number): MinimizeResult {
  const on = Array.from(new Set(onset)).sort((a, b) => a - b);
  if (on.length === 0) {
    return { primes: [], primesComplete: true, essential: [], cover: [], alternatives: [], exact: true, note: null };
  }
  const total = 1 << n;
  if (new Set([...on, ...dc]).size === total) {
    const all: Implicant = { value: 0, mask: total - 1 };
    return { primes: [all], primesComplete: true, essential: [all], cover: [all], alternatives: [], exact: true, note: null };
  }
  const small = n <= EXACT_MAX_VARS;
  const primes = primeImplicants(on, dc, n, small ? QM_WORK_SMALL : QM_WORK_LARGE);
  if (primes !== null && (small || primes.length <= MAX_PRIMES_LARGE)) {
    const r = exactCover(primes, on, n);
    if (r) {
      return { primes, primesComplete: true, essential: r.essential, cover: r.cover, alternatives: r.alternatives, exact: true, note: null };
    }
    const cover = greedyOverPrimes(primes, on, n);
    return {
      primes,
      primesComplete: true,
      essential: [],
      cover,
      alternatives: [],
      exact: false,
      note: 'The exact search grew too large, so a greedy cover is shown; it is valid but not guaranteed minimal.',
    };
  }
  const cover = expandCover(on, dc, n);
  return {
    primes: cover,
    primesComplete: false,
    essential: [],
    cover,
    alternatives: [],
    exact: false,
    note: `With more than ${EXACT_MAX_VARS} variables and a function this large, a greedy cover is used: it is valid and usually near-minimal, but not guaranteed minimal.`,
  };
}

export interface Minimal {
  sop: MinimizeResult;
  pos: MinimizeResult;
}

/** Minimal SOP (cover of the 1s) and minimal POS (cover of the 0s, complemented). */
export function minimalForms(result: Uint8Array, n: number): Minimal {
  const ones = indicesOf(result, 1);
  const zeros = indicesOf(result, 0);
  const dc = indicesOf(result, 2);
  return { sop: minimize(ones, dc, n), pos: minimize(zeros, dc, n) };
}

// ---------------------------------------------------------------- Karnaugh map

export const GRAY_1 = [0, 1];
export const GRAY_2 = [0, 1, 3, 2];

export interface KmapLayout {
  n: number;
  rowVars: string[];
  colVars: string[];
  rowCodes: number[];
  colCodes: number[];
  rowBits: number;
  colBits: number;
  /** minterm number at [row][col] */
  cells: number[][];
}

export function kmapLayout(vars: string[]): KmapLayout | null {
  const n = vars.length;
  if (n < 2 || n > 4) return null;
  const rb = n === 2 ? 1 : n === 3 ? 1 : 2;
  const cb = n - rb;
  const rowCodes = rb === 1 ? GRAY_1 : GRAY_2;
  const colCodes = cb === 1 ? GRAY_1 : GRAY_2;
  const cells = rowCodes.map((r) => colCodes.map((c) => (r << cb) | c));
  return { n, rowVars: vars.slice(0, rb), colVars: vars.slice(rb), rowCodes, colCodes, rowBits: rb, colBits: cb, cells };
}

export interface KmapPiece {
  r: number;
  c: number;
  h: number;
  w: number;
  openTop: boolean;
  openBottom: boolean;
  openLeft: boolean;
  openRight: boolean;
}

function cyclicInterval(positions: number[], size: number): { start: number; len: number } {
  const set = new Set(positions);
  if (set.size === size) return { start: 0, len: size };
  for (const p of positions) {
    if (!set.has((p - 1 + size) % size)) return { start: p, len: positions.length };
  }
  return { start: positions[0] as number, len: positions.length };
}

function segments(start: number, len: number, size: number): { s: number; l: number; wrapFirst: boolean; wrapSecond: boolean }[] {
  if (start + len <= size) return [{ s: start, l: len, wrapFirst: false, wrapSecond: false }];
  return [
    { s: start, l: size - start, wrapFirst: true, wrapSecond: false },
    { s: 0, l: start + len - size, wrapFirst: false, wrapSecond: true },
  ];
}

/** Rectangles (possibly split by wrap-around) covering an implicant on the K-map. */
export function implicantPieces(imp: Implicant, layout: KmapLayout): KmapPiece[] {
  const cbMask = (1 << layout.colBits) - 1;
  const rowVal = imp.value >> layout.colBits;
  const rowMask = imp.mask >> layout.colBits;
  const colVal = imp.value & cbMask;
  const colMask = imp.mask & cbMask;
  const rows: number[] = [];
  layout.rowCodes.forEach((code, r) => {
    if ((code & ~rowMask) === rowVal) rows.push(r);
  });
  const cols: number[] = [];
  layout.colCodes.forEach((code, c) => {
    if ((code & ~colMask) === colVal) cols.push(c);
  });
  if (rows.length === 0 || cols.length === 0) return [];
  const ri = cyclicInterval(rows, layout.rowCodes.length);
  const ci = cyclicInterval(cols, layout.colCodes.length);
  const rs = segments(ri.start, ri.len, layout.rowCodes.length);
  const cs = segments(ci.start, ci.len, layout.colCodes.length);
  const out: KmapPiece[] = [];
  for (const a of rs) {
    for (const b of cs) {
      out.push({
        r: a.s,
        c: b.s,
        h: a.l,
        w: b.l,
        openBottom: a.wrapFirst,
        openTop: a.wrapSecond,
        openRight: b.wrapFirst,
        openLeft: b.wrapSecond,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- equivalence

export const MAX_EQUIV_VARS = 20;

export interface EquivalenceResult {
  equivalent: boolean;
  vars: string[];
  /** Up to `limit` assignments where the expressions differ. */
  counterexamples: { assignment: Record<string, boolean>; a: boolean; b: boolean }[];
  differences: number;
  rows: number;
}

export function checkEquivalence(a: Expr, b: Expr, limit = 8): EquivalenceResult {
  const vars = sortVariables(collectVariables(b, collectVariables(a, [])));
  if (vars.length > MAX_EQUIV_VARS) throw new Error(`Too many variables (${vars.length}) for an exhaustive check; the limit is ${MAX_EQUIV_VARS}.`);
  const n = vars.length;
  const fa = compileExpr(a, vars);
  const fb = compileExpr(b, vars);
  const rows = 1 << n;
  const counterexamples: EquivalenceResult['counterexamples'] = [];
  let differences = 0;
  for (let m = 0; m < rows; m++) {
    const x = fa(m);
    const y = fb(m);
    if (x !== y) {
      differences++;
      if (counterexamples.length < limit) {
        const assignment: Record<string, boolean> = {};
        vars.forEach((v, k) => {
          assignment[v] = ((m >> (n - 1 - k)) & 1) === 1;
        });
        counterexamples.push({ assignment, a: x, b: y });
      }
    }
  }
  return { equivalent: differences === 0, vars, counterexamples, differences, rows };
}

// ---------------------------------------------------------------- minterm input

/** "0, 1, 5-7 9" -> sorted unique numbers; validates against 2^n. */
export function parseNumberList(text: string, n: number): number[] {
  const out = new Set<number>();
  const max = 1 << n;
  const cleaned = text.replace(/[Σ∑mMdD()]/g, ' ').trim();
  if (cleaned === '') return [];
  for (const tok of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(tok);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a > b) throw new Error(`Range "${tok}" runs backwards.`);
      if (b >= max) throw new Error(`${b} is out of range: with ${n} variables, numbers go from 0 to ${max - 1}.`);
      for (let k = a; k <= b; k++) out.add(k);
      continue;
    }
    if (!/^\d+$/.test(tok)) throw new Error(`"${tok}" is not a number.`);
    const v = Number(tok);
    if (v >= max) throw new Error(`${v} is out of range: with ${n} variables, numbers go from 0 to ${max - 1}.`);
    out.add(v);
  }
  return Array.from(out).sort((x, y) => x - y);
}

export function parseVariableList(text: string): string[] {
  const names = text.split(/[\s,;]+/).filter(Boolean);
  const seen = new Set<string>();
  for (const nm of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) throw new Error(`"${nm}" is not a valid variable name.`);
    if (seen.has(nm)) throw new Error(`Variable "${nm}" is listed twice.`);
    seen.add(nm);
  }
  return names;
}
