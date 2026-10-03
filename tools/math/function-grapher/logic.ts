/**
 * Function grapher core: a safe expression parser (tokenizer -> AST -> JS closures,
 * never eval / new Function), adaptive curve sampling, and numeric analysis
 * (roots, extrema, intersections, integrals, tables). Pure TypeScript.
 */

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class ParseError extends Error {
  pos: number;
  len: number;
  constructor(message: string, pos: number, len = 1) {
    super(message);
    this.name = 'ParseError';
    this.pos = pos;
    this.len = Math.max(1, len);
  }
}

/** "message (position N)" plus a caret line for display. */
export function describeError(src: string, e: ParseError): { text: string; caret: string } {
  const pos = Math.min(Math.max(0, e.pos), src.length);
  return {
    text: `${e.message} (position ${pos + 1})`,
    caret: `${src}\n${' '.repeat(pos)}${'^'.repeat(Math.min(e.len, Math.max(1, src.length - pos)))}`,
  };
}

/* ------------------------------------------------------------------ */
/* Math helpers                                                        */
/* ------------------------------------------------------------------ */

const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Gamma function for real arguments (poles at 0, -1, -2, ... return NaN). */
export function gammaFn(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === Infinity) return Infinity;
  if (x === -Infinity) return NaN;
  if (Number.isInteger(x)) {
    if (x <= 0) return NaN;
    if (x > 171) return Infinity;
    let r = 1;
    for (let i = 2; i < x; i++) r *= i;
    return r;
  }
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  if (x > 171.7) return Infinity;
  const xm = x - 1;
  let a = LANCZOS_C[0] as number;
  const t = xm + LANCZOS_G + 0.5;
  for (let i = 1; i < 9; i++) a += (LANCZOS_C[i] as number) / (xm + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, xm + 0.5) * Math.exp(-t) * a;
}

/** n! extended to reals via gamma(n + 1); negative integers are undefined. */
export function factorial(n: number): number {
  if (Number.isNaN(n)) return NaN;
  if (Number.isInteger(n)) {
    if (n < 0) return NaN;
    return gammaFn(n + 1);
  }
  return gammaFn(n + 1);
}

/** Best rational approximation p/q (q <= maxDen) of x via continued fractions. */
function rational(x: number, maxDen = 1000, tol = 1e-9): [number, number] | null {
  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let b = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    if (Math.abs(x - h1 / k1) < tol * Math.max(1, Math.abs(x))) return [h1, k1];
    const frac = b - a;
    if (frac < 1e-14) break;
    b = 1 / frac;
  }
  return k1 > 0 && Math.abs(x - h1 / k1) < tol * Math.max(1, Math.abs(x)) ? [h1, k1] : null;
}

/** Real-valued power: negative bases with odd-denominator rational exponents give real roots. */
export function rpow(a: number, b: number): number {
  if (a >= 0 || Number.isInteger(b) || Number.isNaN(a) || Number.isNaN(b)) return Math.pow(a, b);
  if (!Number.isFinite(b)) return Math.pow(a, b);
  const fr = rational(b);
  if (fr && fr[1] % 2 === 1) {
    const r = Math.pow(-a, b);
    return Math.abs(fr[0]) % 2 === 0 ? r : -r;
  }
  return NaN;
}

function modFn(a: number, b: number): number {
  if (b === 0) return NaN;
  return a - b * Math.floor(a / b);
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

type Tok =
  | { t: 'num'; v: number; pos: number; end: number }
  | { t: 'id'; name: string; pos: number; end: number }
  | { t: 'op'; v: string; pos: number; end: number }
  | { t: 'eof'; pos: number; end: number };

interface FnDef {
  min: number;
  max: number;
  impl: (...a: number[]) => number;
}

const FUNCTIONS: Record<string, FnDef> = {
  sin: { min: 1, max: 1, impl: Math.sin },
  cos: { min: 1, max: 1, impl: Math.cos },
  tan: { min: 1, max: 1, impl: Math.tan },
  sec: { min: 1, max: 1, impl: (x) => 1 / Math.cos(x) },
  csc: { min: 1, max: 1, impl: (x) => 1 / Math.sin(x) },
  cot: { min: 1, max: 1, impl: (x) => 1 / Math.tan(x) },
  asin: { min: 1, max: 1, impl: Math.asin },
  acos: { min: 1, max: 1, impl: Math.acos },
  atan: { min: 1, max: 1, impl: Math.atan },
  atan2: { min: 2, max: 2, impl: Math.atan2 },
  sinh: { min: 1, max: 1, impl: Math.sinh },
  cosh: { min: 1, max: 1, impl: Math.cosh },
  tanh: { min: 1, max: 1, impl: Math.tanh },
  asinh: { min: 1, max: 1, impl: Math.asinh },
  acosh: { min: 1, max: 1, impl: Math.acosh },
  atanh: { min: 1, max: 1, impl: Math.atanh },
  sqrt: { min: 1, max: 1, impl: Math.sqrt },
  cbrt: { min: 1, max: 1, impl: Math.cbrt },
  abs: { min: 1, max: 1, impl: Math.abs },
  exp: { min: 1, max: 1, impl: Math.exp },
  ln: { min: 1, max: 1, impl: Math.log },
  log: { min: 1, max: 2, impl: (a, b) => (b === undefined ? Math.log10(a) : Math.log(b) / Math.log(a)) },
  log10: { min: 1, max: 1, impl: Math.log10 },
  log2: { min: 1, max: 1, impl: Math.log2 },
  floor: { min: 1, max: 1, impl: Math.floor },
  ceil: { min: 1, max: 1, impl: Math.ceil },
  round: { min: 1, max: 1, impl: Math.round },
  sign: { min: 1, max: 1, impl: Math.sign },
  trunc: { min: 1, max: 1, impl: Math.trunc },
  gamma: { min: 1, max: 1, impl: gammaFn },
  min: { min: 1, max: 64, impl: (...a) => Math.min(...a) },
  max: { min: 1, max: 64, impl: (...a) => Math.max(...a) },
  mod: { min: 2, max: 2, impl: modFn },
};

const FN_ALIASES: Record<string, string> = {
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  sgn: 'sign',
  lg: 'log10',
  fact: 'gamma',
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: 2 * Math.PI,
  e: Math.E,
};

/** Identifiers that carry meaning (functions, constants, theta). */
const KNOWN_WORDS = [
  ...Object.keys(FUNCTIONS),
  ...Object.keys(FN_ALIASES),
  'pi',
  'tau',
  'theta',
].sort((a, b) => b.length - a.length);

const LETTER = /[A-Za-zπτθ]/;
const DIGIT = /[0-9]/;

function canonicalName(w: string): string {
  if (w === 'π') return 'pi';
  if (w === 'τ') return 'tau';
  if (w === 'θ') return 'theta';
  return FN_ALIASES[w] ?? w;
}

function isFunctionName(n: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS, n);
}

/** Split a run of letters into known words and single letters. */
function splitWord(word: string, pos: number, followedByParen: boolean): Tok[] {
  const lower = word;
  if (isFunctionName(canonicalName(lower)) || lower in CONSTANTS || lower === 'theta') {
    return [{ t: 'id', name: canonicalName(lower), pos, end: pos + word.length }];
  }
  const pieces: Tok[] = [];
  let i = 0;
  let anyKnown = false;
  while (i < word.length) {
    let matched: string | null = null;
    for (const k of KNOWN_WORDS) {
      if (word.startsWith(k, i)) {
        matched = k;
        break;
      }
    }
    if (matched) {
      anyKnown = true;
      pieces.push({ t: 'id', name: canonicalName(matched), pos: pos + i, end: pos + i + matched.length });
      i += matched.length;
    } else {
      const ch = word.charAt(i);
      pieces.push({ t: 'id', name: canonicalName(ch), pos: pos + i, end: pos + i + 1 });
      i += 1;
    }
  }
  if (!anyKnown && (word.length > 3 || (followedByParen && word.length > 1))) {
    if (followedByParen) throw new ParseError(`Unknown function '${word}'`, pos, word.length);
    throw new ParseError(`Unknown name '${word}'`, pos, word.length);
  }
  return pieces;
}

export const MAX_EXPR_LENGTH = 1500;
const MAX_NESTING = 120;

export function tokenize(src: string): Tok[] {
  if (src.length > MAX_EXPR_LENGTH) throw new ParseError(`Expression is too long (limit ${MAX_EXPR_LENGTH} characters)`, MAX_EXPR_LENGTH, 1);
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charAt(i);
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ') {
      i++;
      continue;
    }
    if (DIGIT.test(c) || (c === '.' && DIGIT.test(src.charAt(i + 1)))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      const text = m ? m[0] : c;
      // "2e" followed by a non-digit is 2 times e, handled because the regex requires digits after e.
      const v = Number(text);
      if (!Number.isFinite(v)) throw new ParseError(`Number '${text}' is too large`, i, text.length);
      toks.push({ t: 'num', v, pos: i, end: i + text.length });
      i += text.length;
      continue;
    }
    if (LETTER.test(c)) {
      let j = i;
      while (j < n && LETTER.test(src.charAt(j))) j++;
      let word = src.slice(i, j);
      // names that end in digits: atan2, log2, log10
      let k = j;
      while (k < n && DIGIT.test(src.charAt(k))) k++;
      if (k > j) {
        const withDigits = word + src.slice(j, k);
        if (isFunctionName(withDigits)) {
          toks.push({ t: 'id', name: withDigits, pos: i, end: k });
          i = k;
          continue;
        }
        // "log10" style where letters end with a known prefix: check suffix of word
        for (const base of ['atan', 'log']) {
          if (word.endsWith(base) && isFunctionName(base + src.slice(j, k))) {
            const head = word.slice(0, word.length - base.length);
            if (head) for (const t of splitWord(head, i, false)) toks.push(t);
            toks.push({ t: 'id', name: base + src.slice(j, k), pos: i + head.length, end: k });
            word = '';
            i = k;
            break;
          }
        }
        if (word === '') continue;
      }
      let q = j;
      while (q < n && src.charAt(q) === ' ') q++;
      for (const t of splitWord(word, i, src.charAt(q) === '(')) toks.push(t);
      i = j;
      continue;
    }
    switch (c) {
      case '+':
      case '-':
      case '/':
      case '!':
      case '(':
      case ')':
      case ',':
      case '^':
        toks.push({ t: 'op', v: c, pos: i, end: i + 1 });
        i++;
        continue;
      case '*':
        if (src.charAt(i + 1) === '*') {
          toks.push({ t: 'op', v: '^', pos: i, end: i + 2 });
          i += 2;
        } else {
          toks.push({ t: 'op', v: '*', pos: i, end: i + 1 });
          i++;
        }
        continue;
      case '−':
      case '–':
        toks.push({ t: 'op', v: '-', pos: i, end: i + 1 });
        i++;
        continue;
      case '×':
      case '·':
      case '⋅':
        toks.push({ t: 'op', v: '*', pos: i, end: i + 1 });
        i++;
        continue;
      case '÷':
        toks.push({ t: 'op', v: '/', pos: i, end: i + 1 });
        i++;
        continue;
      case '²':
        toks.push({ t: 'op', v: '^', pos: i, end: i + 1 }, { t: 'num', v: 2, pos: i, end: i + 1 });
        i++;
        continue;
      case '³':
        toks.push({ t: 'op', v: '^', pos: i, end: i + 1 }, { t: 'num', v: 3, pos: i, end: i + 1 });
        i++;
        continue;
      case '√':
        toks.push({ t: 'id', name: 'sqrt', pos: i, end: i + 1 });
        i++;
        continue;
      default:
        throw new ParseError(`Unexpected character '${c}'`, i, 1);
    }
  }
  toks.push({ t: 'eof', pos: n, end: n });
  return toks;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export type Node =
  | { k: 'num'; v: number }
  | { k: 'name'; name: string; pos: number; len: number }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'fact'; a: Node }
  | { k: 'call'; fn: string; args: Node[] };

export interface Parsed {
  ast: Node;
  /** Identifier names used that are neither functions nor constants (e.g. x, a, theta). */
  names: string[];
}

class Parser {
  private i = 0;
  private depth = 0;
  readonly names: string[] = [];
  constructor(
    private readonly toks: Tok[],
    private readonly src: string
  ) {}

  private peek(): Tok {
    return this.toks[this.i] as Tok;
  }
  private next(): Tok {
    const t = this.toks[this.i] as Tok;
    if (t.t !== 'eof') this.i++;
    return t;
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }

  parseAll(): Node {
    if (this.peek().t === 'eof') throw new ParseError('Enter an expression', 0, 1);
    const n = this.sum();
    const t = this.peek();
    if (t.t !== 'eof') {
      if (t.t === 'op' && t.v === ')') throw new ParseError("Unexpected ')'", t.pos, 1);
      if (t.t === 'op' && t.v === ',') throw new ParseError("Unexpected ','", t.pos, 1);
      throw new ParseError('Unexpected input', t.pos, t.end - t.pos);
    }
    return n;
  }

  private sum(): Node {
    if (++this.depth > MAX_NESTING) throw new ParseError('Expression is nested too deeply', this.peek().pos, 1);
    try {
      return this.sumInner();
    } finally {
      this.depth--;
    }
  }

  private sumInner(): Node {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.next();
        if (this.peek().t === 'eof') throw new ParseError(`Expected an expression after '${t.v}'`, t.pos, 1);
        const right = this.term();
        left = { k: 'bin', op: t.v, a: left, b: right };
      } else return left;
    }
  }

  /** Does the next token start an implicit-multiplication operand? */
  private startsOperand(prevWasNumber: boolean): boolean {
    const t = this.peek();
    if (t.t === 'num') return !prevWasNumber;
    if (t.t === 'id') return true;
    if (t.t === 'op' && t.v === '(') return true;
    return false;
  }

  private term(): Node {
    let left = this.unary();
    let prevNum = left.k === 'num';
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.next();
        if (this.peek().t === 'eof') throw new ParseError(`Expected an expression after '${t.v}'`, t.pos, 1);
        const right = this.unary();
        left = { k: 'bin', op: t.v, a: left, b: right };
        prevNum = right.k === 'num';
      } else if (this.startsOperand(prevNum)) {
        const right = this.unary();
        left = { k: 'bin', op: '*', a: left, b: right };
        prevNum = right.k === 'num';
      } else if (t.t === 'num' && prevNum) {
        throw new ParseError('Unexpected number (missing operator?)', t.pos, t.end - t.pos);
      } else return left;
    }
  }

  private unary(): Node {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.next();
      if (this.peek().t === 'eof') throw new ParseError(`Expected an expression after '${t.v}'`, t.pos, 1);
      if (++this.depth > MAX_NESTING) throw new ParseError('Expression is nested too deeply', t.pos, 1);
      try {
        const a = this.unary();
        return t.v === '-' ? { k: 'neg', a } : a;
      } finally {
        this.depth--;
      }
    }
    return this.power();
  }

  private power(): Node {
    const base = this.postfix();
    if (this.isOp('^')) {
      const op = this.next();
      if (this.peek().t === 'eof') throw new ParseError("Expected an exponent after '^'", op.pos, 1);
      const exp = this.unary();
      return { k: 'bin', op: '^', a: base, b: exp };
    }
    return base;
  }

  private postfix(): Node {
    let n = this.primary();
    while (this.isOp('!')) {
      this.next();
      n = { k: 'fact', a: n };
    }
    return n;
  }

  /** Argument of a function written without parentheses: sin x, sin 2x, sin cos x. */
  private bareArgument(fnTok: Tok & { t: 'id' }): Node {
    const t = this.peek();
    if (t.t === 'id' && isFunctionName(t.name)) return this.primary();
    if (!(t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))) {
      throw new ParseError(`'${fnTok.name}' needs an argument, e.g. ${fnTok.name}(x)`, fnTok.pos, fnTok.end - fnTok.pos);
    }
    let left = this.power();
    for (;;) {
      const nt = this.peek();
      const startsPlain = nt.t === 'num' || (nt.t === 'id' && !isFunctionName(nt.name)) || (nt.t === 'op' && nt.v === '(');
      if (startsPlain && !(nt.t === 'num' && left.k === 'num')) {
        left = { k: 'bin', op: '*', a: left, b: this.power() };
      } else return left;
    }
  }

  private primary(): Node {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      if (this.isOp(')')) throw new ParseError('Empty parentheses', t.pos, 2);
      const inner = this.sum();
      if (!this.isOp(')')) {
        const nt = this.peek();
        if (nt.t === 'eof') throw new ParseError(`Missing ')' to close the '(' at position ${t.pos + 1}`, t.pos, 1);
        throw new ParseError(`Expected ')' or an operator`, nt.pos, Math.max(1, nt.end - nt.pos));
      }
      this.next();
      return inner;
    }
    if (t.t === 'id') {
      if (isFunctionName(t.name)) return this.functionCall(t);
      if (t.name in CONSTANTS) return { k: 'num', v: CONSTANTS[t.name] as number };
      if (!this.names.includes(t.name)) this.names.push(t.name);
      return { k: 'name', name: t.name, pos: t.pos, len: t.end - t.pos };
    }
    if (t.t === 'eof') throw new ParseError('Unexpected end of expression', Math.max(0, this.src.length - 1), 1);
    if (t.t === 'op' && t.v === ')') throw new ParseError("Unexpected ')'", t.pos, 1);
    if (t.t === 'op' && t.v === ',') throw new ParseError("Unexpected ','", t.pos, 1);
    throw new ParseError(`Unexpected '${t.t === 'op' ? t.v : ''}'`, t.pos, t.end - t.pos);
  }

  private functionCall(fnTok: Tok & { t: 'id' }): Node {
    const def = FUNCTIONS[fnTok.name] as FnDef;
    // sin^2(x) style power applied to the call
    let outerExp: Node | null = null;
    if (this.isOp('^')) {
      const caret = this.next();
      const sign = this.isOp('-');
      if (sign) this.next();
      const et = this.peek();
      let e: Node;
      if (et.t === 'num') {
        this.next();
        e = { k: 'num', v: et.v };
      } else if (et.t === 'op' && et.v === '(') {
        e = this.primary();
      } else throw new ParseError("Expected an exponent after '^'", caret.pos, 1);
      outerExp = sign ? { k: 'neg', a: e } : e;
    }
    let args: Node[];
    if (this.isOp('(')) {
      const open = this.next();
      args = [];
      if (this.isOp(')')) {
        throw new ParseError(`'${fnTok.name}' needs an argument`, fnTok.pos, fnTok.end - fnTok.pos);
      }
      for (;;) {
        args.push(this.sum());
        if (this.isOp(',')) {
          this.next();
          continue;
        }
        break;
      }
      if (!this.isOp(')')) {
        const nt = this.peek();
        if (nt.t === 'eof') throw new ParseError(`Missing ')' to close the '(' at position ${open.pos + 1}`, open.pos, 1);
        throw new ParseError(`Expected ',' or ')'`, nt.pos, Math.max(1, nt.end - nt.pos));
      }
      this.next();
    } else {
      args = [this.bareArgument(fnTok)];
    }
    if (args.length < def.min || args.length > def.max) {
      const want = def.min === def.max ? `${def.min}` : def.max >= 64 ? `at least ${def.min}` : `${def.min} to ${def.max}`;
      throw new ParseError(
        `${fnTok.name} takes ${want} argument${def.min === 1 && def.max === 1 ? '' : 's'}, got ${args.length}`,
        fnTok.pos,
        fnTok.end - fnTok.pos
      );
    }
    const call: Node = { k: 'call', fn: fnTok.name, args };
    return outerExp ? { k: 'bin', op: '^', a: call, b: outerExp } : call;
  }
}

/** Parse an expression into an AST. Throws ParseError. */
export function parseExpression(src: string): Parsed {
  const toks = tokenize(src);
  const p = new Parser(toks, src);
  const ast = p.parseAll();
  return { ast, names: p.names };
}

/* ------------------------------------------------------------------ */
/* Compiler (AST -> closure)                                           */
/* ------------------------------------------------------------------ */

export type Fn1 = (x: number) => number;

function hasFree(n: Node, free: ReadonlySet<string>): boolean {
  switch (n.k) {
    case 'num':
      return false;
    case 'name':
      return free.has(n.name);
    case 'neg':
    case 'fact':
      return hasFree(n.a, free);
    case 'bin':
      return hasFree(n.a, free) || hasFree(n.b, free);
    case 'call':
      return n.args.some((a) => hasFree(a, free));
  }
}

function comp(n: Node, free: ReadonlySet<string>, params: Readonly<Record<string, number>>): Fn1 {
  if (!hasFree(n, free)) {
    // constant subtree: evaluate once
    const v = evalConst(n, params);
    return () => v;
  }
  switch (n.k) {
    case 'num': {
      const v = n.v;
      return () => v;
    }
    case 'name':
      return (x) => x;
    case 'neg': {
      const a = comp(n.a, free, params);
      return (x) => -a(x);
    }
    case 'fact': {
      const a = comp(n.a, free, params);
      return (x) => factorial(a(x));
    }
    case 'bin': {
      const a = comp(n.a, free, params);
      const b = comp(n.b, free, params);
      switch (n.op) {
        case '+':
          return (x) => a(x) + b(x);
        case '-':
          return (x) => a(x) - b(x);
        case '*':
          return (x) => a(x) * b(x);
        case '/':
          return (x) => a(x) / b(x);
        case '^':
          return (x) => rpow(a(x), b(x));
      }
      return () => NaN;
    }
    case 'call': {
      const def = FUNCTIONS[n.fn] as FnDef;
      const args = n.args.map((a) => comp(a, free, params));
      const impl = def.impl;
      if (args.length === 1) {
        const a0 = args[0] as Fn1;
        return (x) => impl(a0(x));
      }
      if (args.length === 2) {
        const a0 = args[0] as Fn1;
        const a1 = args[1] as Fn1;
        return (x) => impl(a0(x), a1(x));
      }
      return (x) => impl(...args.map((f) => f(x)));
    }
  }
}

function evalConst(n: Node, params: Readonly<Record<string, number>>): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'name': {
      const v = params[n.name];
      if (v === undefined) throw new ParseError(`Unknown variable '${n.name}'`, n.pos, n.len);
      return v;
    }
    case 'neg':
      return -evalConst(n.a, params);
    case 'fact':
      return factorial(evalConst(n.a, params));
    case 'bin': {
      const a = evalConst(n.a, params);
      const b = evalConst(n.b, params);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return rpow(a, b);
      }
      return NaN;
    }
    case 'call': {
      const def = FUNCTIONS[n.fn] as FnDef;
      return def.impl(...n.args.map((a) => evalConst(a, params)));
    }
  }
}

function checkNames(n: Node, free: ReadonlySet<string>, params: Readonly<Record<string, number>>, freeHint: string): void {
  switch (n.k) {
    case 'name':
      if (!free.has(n.name) && params[n.name] === undefined) {
        const hint = n.name === 'x' || n.name === 'y' || n.name === 't' || n.name === 'theta' ? ` (this row uses ${freeHint})` : '';
        throw new ParseError(`Unknown variable '${n.name === 'theta' ? 'θ' : n.name}'${hint}`, n.pos, n.len);
      }
      return;
    case 'neg':
    case 'fact':
      checkNames(n.a, free, params, freeHint);
      return;
    case 'bin':
      checkNames(n.a, free, params, freeHint);
      checkNames(n.b, free, params, freeHint);
      return;
    case 'call':
      for (const a of n.args) checkNames(a, free, params, freeHint);
      return;
    case 'num':
      return;
  }
}

/** Letters that can never be slider parameters (coordinates). */
export const RESERVED_PARAM_NAMES = new Set(['x', 'y']);

/**
 * Bind a parsed expression: `freeVars` are the names that stand for the plotted
 * variable, `params` supplies values for the remaining names. Throws ParseError
 * when a name is unresolved.
 */
export function bindExpression(
  parsed: Parsed,
  freeVars: readonly string[],
  params: Readonly<Record<string, number>>
): Fn1 {
  const free = new Set(freeVars);
  const hint = freeVars.length === 0 ? 'no variable' : freeVars[0] === 'theta' ? 'θ' : (freeVars[0] as string);
  const usable: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) if (!RESERVED_PARAM_NAMES.has(k) && !free.has(k)) usable[k] = v;
  checkNames(parsed.ast, free, usable, hint);
  return comp(parsed.ast, free, usable);
}

/** Names in `parsed` that should become slider parameters for the given free variables. */
export function paramNames(parsed: Parsed, freeVars: readonly string[]): string[] {
  const free = new Set(freeVars);
  return parsed.names.filter((n) => n.length === 1 && n !== 'e' && !RESERVED_PARAM_NAMES.has(n) && !free.has(n));
}

/** Compile `src` in one go (for tests / constants). */
export function compileExpression(
  src: string,
  freeVars: readonly string[] = ['x'],
  params: Readonly<Record<string, number>> = {}
): Fn1 {
  return bindExpression(parseExpression(src), freeVars, params);
}

/* ------------------------------------------------------------------ */
/* Row compilation                                                     */
/* ------------------------------------------------------------------ */

export type RowMode = 'y' | 'polar' | 'param' | 'vline';

export interface RowInput {
  mode: RowMode;
  expr: string;
  expr2: string;
  tMin: string;
  tMax: string;
}

export interface RowError {
  field: 'expr' | 'expr2' | 'range';
  error: ParseError;
  src: string;
}

export interface CompiledRow {
  mode: RowMode;
  f?: Fn1;
  fx?: Fn1;
  fy?: Fn1;
  c?: number;
  t0: number;
  t1: number;
}

const Y_PREFIX = /^\s*(?:y|f\s*\(\s*x\s*\)|f)\s*=(?!=)\s*/i;
const X_PREFIX = /^\s*x\s*=(?!=)\s*/i;
const R_PREFIX = /^\s*r\s*(?:\(\s*(?:θ|theta|t)\s*\))?\s*=(?!=)\s*/i;
const XT_PREFIX = /^\s*x\s*(?:\(\s*t\s*\))?\s*=(?!=)\s*/i;
const YT_PREFIX = /^\s*y\s*(?:\(\s*t\s*\))?\s*=(?!=)\s*/i;

function stripPrefix(src: string, re: RegExp): { text: string; offset: number } {
  const m = re.exec(src);
  if (!m) return { text: src, offset: 0 };
  return { text: src.slice(m[0].length), offset: m[0].length };
}

function parseWithOffset(src: string, re: RegExp): { parsed: Parsed; offset: number } {
  const { text, offset } = stripPrefix(src, re);
  try {
    return { parsed: parseExpression(text), offset };
  } catch (e) {
    if (e instanceof ParseError) throw new ParseError(e.message, e.pos + offset, e.len);
    throw e;
  }
}

export interface RowAnalysis {
  /** Slider parameter names used by this row. */
  names: string[];
  error: RowError | null;
}

interface RowParse {
  mode: RowMode;
  a?: Parsed;
  aOff?: number;
  b?: Parsed;
  bOff?: number;
  free: string[];
}

function parseRow(row: RowInput): RowParse {
  if (row.mode === 'param') {
    const a = tryParse(row.expr, XT_PREFIX, 'expr');
    const b = tryParse(row.expr2, YT_PREFIX, 'expr2');
    return { mode: 'param', a: a.parsed, aOff: a.offset, b: b.parsed, bOff: b.offset, free: ['t'] };
  }
  if (row.mode === 'polar') {
    const a = tryParse(row.expr, R_PREFIX, 'expr');
    return { mode: 'polar', a: a.parsed, aOff: a.offset, free: ['theta', 't'] };
  }
  if (row.mode === 'vline') {
    const a = tryParse(row.expr, X_PREFIX, 'expr');
    return { mode: 'vline', a: a.parsed, aOff: a.offset, free: [] };
  }
  // y = f(x); an "x = c" input is treated as a vertical line
  if (X_PREFIX.test(row.expr) && !Y_PREFIX.test(row.expr)) {
    const a = tryParse(row.expr, X_PREFIX, 'expr');
    return { mode: 'vline', a: a.parsed, aOff: a.offset, free: [] };
  }
  const a = tryParse(row.expr, Y_PREFIX, 'expr');
  return { mode: 'y', a: a.parsed, aOff: a.offset, free: ['x'] };
}

class RowFailure extends Error {
  constructor(public readonly info: RowError) {
    super(info.error.message);
  }
}

function tryParse(src: string, re: RegExp, field: 'expr' | 'expr2'): { parsed: Parsed; offset: number } {
  try {
    return parseWithOffset(src, re);
  } catch (e) {
    if (e instanceof ParseError) throw new RowFailure({ field, error: e, src });
    throw e;
  }
}

/** Parse a row and report which slider parameters it needs (or the first error). */
export function analyzeRow(row: RowInput): RowAnalysis {
  try {
    const p = parseRow(row);
    const names: string[] = [];
    for (const part of [p.a, p.b]) {
      if (!part) continue;
      for (const n of paramNames(part, p.free)) if (!names.includes(n)) names.push(n);
    }
    // range expressions may not use parameters (constants only)
    return { names, error: null };
  } catch (e) {
    if (e instanceof RowFailure) return { names: [], error: e.info };
    throw e;
  }
}

function constantValue(src: string, field: 'range', fallback: number): number {
  const s = src.trim();
  if (s === '') return fallback;
  try {
    const f = compileExpression(s, [], {});
    return f(0);
  } catch (e) {
    if (e instanceof ParseError) throw new RowFailure({ field, error: e, src });
    throw e;
  }
}

/** Compile a row into evaluators; errors are returned, never thrown. */
export function compileRow(
  row: RowInput,
  params: Readonly<Record<string, number>>
): { ok: true; row: CompiledRow } | { ok: false; error: RowError } {
  try {
    const p = parseRow(row);
    const bindPart = (part: Parsed, off: number, src: string, field: 'expr' | 'expr2'): Fn1 => {
      try {
        return bindExpression(part, p.free, params);
      } catch (e) {
        if (e instanceof ParseError) throw new RowFailure({ field, error: new ParseError(e.message, e.pos + off, e.len), src });
        throw e;
      }
    };
    const defaultRange = row.mode === 'polar' ? [0, 2 * Math.PI] : [0, 2 * Math.PI];
    let t0 = defaultRange[0] as number;
    let t1 = defaultRange[1] as number;
    if (row.mode === 'polar' || row.mode === 'param') {
      t0 = constantValue(row.tMin, 'range', t0);
      t1 = constantValue(row.tMax, 'range', t1);
      if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
        throw new RowFailure({ field: 'range', error: new ParseError('Parameter range must be finite numbers', 0, 1), src: row.tMin });
      }
      if (!(t1 > t0)) {
        throw new RowFailure({ field: 'range', error: new ParseError('The range must have min < max', 0, 1), src: row.tMax });
      }
    }
    if (p.mode === 'param') {
      const fx = bindPart(p.a as Parsed, p.aOff ?? 0, row.expr, 'expr');
      const fy = bindPart(p.b as Parsed, p.bOff ?? 0, row.expr2, 'expr2');
      return { ok: true, row: { mode: 'param', fx, fy, t0, t1 } };
    }
    if (p.mode === 'polar') {
      const f = bindPart(p.a as Parsed, p.aOff ?? 0, row.expr, 'expr');
      return { ok: true, row: { mode: 'polar', f, t0, t1 } };
    }
    if (p.mode === 'vline') {
      const f = bindPart(p.a as Parsed, p.aOff ?? 0, row.expr, 'expr');
      const c = f(0);
      if (!Number.isFinite(c)) {
        throw new RowFailure({ field: 'expr', error: new ParseError('x = c needs a finite number', 0, 1), src: row.expr });
      }
      return { ok: true, row: { mode: 'vline', c, t0, t1 } };
    }
    const f = bindPart(p.a as Parsed, p.aOff ?? 0, row.expr, 'expr');
    return { ok: true, row: { mode: 'y', f, t0, t1 } };
  } catch (e) {
    if (e instanceof RowFailure) return { ok: false, error: e.info };
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* View + sampling                                                     */
/* ------------------------------------------------------------------ */

export interface Bounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/** Flat polyline [x0, y0, x1, y1, ...]; a (NaN, NaN) pair is a pen-up break. */
export type Polyline = number[];

const MAX_POINTS = 120_000;

export interface SampleOptions {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

class PolyBuilder {
  pts: number[] = [];
  lastBreak = true;
  emit(x: number, y: number): void {
    this.pts.push(x, y);
    this.lastBreak = false;
  }
  brk(): void {
    if (!this.lastBreak && this.pts.length > 0) {
      this.pts.push(NaN, NaN);
      this.lastBreak = true;
    }
  }
}

/** Adaptive sampling of y = f(x) over [xmin, xmax] for the given view. */
export function sampleFunction(f: Fn1, b: Bounds, opt: SampleOptions): Polyline {
  const { width, height } = opt;
  const xspan = b.xmax - b.xmin;
  const yspan = b.ymax - b.ymin;
  if (!(xspan > 0) || !(yspan > 0) || width < 2 || height < 2) return [];
  const sxp = width / xspan;
  const syp = height / yspan;
  const pad = 2 / sxp;
  const x0 = b.xmin - pad;
  const x1 = b.xmax + pad;
  const N = Math.max(8, Math.ceil(2 * width) + 2);
  const out = new PolyBuilder();
  const MAXD = 16;
  let budget = 160_000;

  const safe = (x: number): number => {
    const v = f(x);
    return typeof v === 'number' ? v : NaN;
  };
  const fin = (v: number) => Number.isFinite(v);
  const offScreen = (ya: number, yb: number) => (ya > b.ymax + yspan * 2 && yb > b.ymax + yspan * 2) || (ya < b.ymin - yspan * 2 && yb < b.ymin - yspan * 2);

  const refine = (xa: number, ya: number, xb: number, yb: number, depth: number): void => {
    const fa = fin(ya);
    const fb = fin(yb);
    if (!fa && !fb) {
      out.brk();
      return;
    }
    if (fa !== fb) {
      // domain edge between a finite and a non-finite end: bisect to locate it
      let g = fa ? xa : xb;
      let gy = fa ? ya : yb;
      let bad = fa ? xb : xa;
      for (let i = 0; i < 60; i++) {
        const m = (g + bad) / 2;
        if (m === g || m === bad) break;
        const ym = safe(m);
        budget--;
        if (fin(ym)) {
          g = m;
          gy = ym;
        } else bad = m;
      }
      if (fa) {
        out.emit(g, gy);
        out.brk();
      } else {
        out.brk();
        out.emit(g, gy);
        out.emit(xb, yb);
      }
      return;
    }
    const xm = (xa + xb) / 2;
    const narrow = (xb - xa) * sxp <= 0.05;
    if (depth >= MAXD || budget <= 0 || xm === xa || xm === xb) {
      // a jump that survives maximal refinement is a discontinuity: lift the pen
      if (narrow && Math.abs(yb - ya) * syp > 3) out.brk();
      out.emit(xb, yb);
      return;
    }
    const ym = safe(xm);
    budget--;
    if (!fin(ym)) {
      refine(xa, ya, xm, ym, depth + 1);
      refine(xm, ym, xb, yb, depth + 1);
      return;
    }
    if (offScreen(ya, yb) && offScreen(ym, ym)) {
      out.emit(xb, yb);
      return;
    }
    const dev = Math.abs(ym - (ya + yb) / 2) * syp;
    const wpx = (xb - xa) * sxp;
    if (dev > 0.2 && wpx > 0.01) {
      refine(xa, ya, xm, ym, depth + 1);
      refine(xm, ym, xb, yb, depth + 1);
    } else if (wpx <= 0.01 && Math.abs(yb - ya) * syp > 3) {
      out.brk();
      out.emit(xb, yb);
    } else {
      out.emit(xm, ym);
      out.emit(xb, yb);
    }
  };

  let prevX = x0;
  let prevY = safe(prevX);
  if (fin(prevY)) out.emit(prevX, prevY);
  for (let i = 1; i <= N; i++) {
    const xi = x0 + ((x1 - x0) * i) / N;
    const yi = safe(xi);
    budget--;
    refine(prevX, prevY, xi, yi, 0);
    prevX = xi;
    prevY = yi;
    if (out.pts.length > MAX_POINTS * 2) break;
  }
  return out.pts;
}

/** Adaptive sampling of a parametric curve (x(t), y(t)), t in [t0, t1]. */
export function sampleParametric(
  fx: Fn1,
  fy: Fn1,
  t0: number,
  t1: number,
  b: Bounds,
  opt: SampleOptions
): Polyline {
  const { width, height } = opt;
  const xspan = b.xmax - b.xmin;
  const yspan = b.ymax - b.ymin;
  if (!(xspan > 0) || !(yspan > 0) || !(t1 > t0)) return [];
  const sxp = width / xspan;
  const syp = height / yspan;
  const N = Math.max(240, Math.ceil(width * 0.75));
  const out = new PolyBuilder();
  const MAXD = 14;
  let budget = 120_000;
  const big = 4 * (width + height);

  const pt = (t: number): [number, number] => [fx(t), fy(t)];
  const fin2 = (p: [number, number]) => Number.isFinite(p[0]) && Number.isFinite(p[1]);

  const refine = (ta: number, pa: [number, number], tb: number, pb: [number, number], depth: number): void => {
    const fa = fin2(pa);
    const fb = fin2(pb);
    if (!fa && !fb) {
      out.brk();
      return;
    }
    if (fa !== fb) {
      let g = fa ? ta : tb;
      let gp = fa ? pa : pb;
      let bad = fa ? tb : ta;
      for (let i = 0; i < 50; i++) {
        const m = (g + bad) / 2;
        if (m === g || m === bad) break;
        const pm = pt(m);
        budget--;
        if (fin2(pm)) {
          g = m;
          gp = pm;
        } else bad = m;
      }
      if (fa) {
        out.emit(gp[0], gp[1]);
        out.brk();
      } else {
        out.brk();
        out.emit(gp[0], gp[1]);
        out.emit(pb[0], pb[1]);
      }
      return;
    }
    const lenPx = Math.hypot((pb[0] - pa[0]) * sxp, (pb[1] - pa[1]) * syp);
    const tm = (ta + tb) / 2;
    if (depth >= MAXD || budget <= 0 || tm === ta || tm === tb) {
      if (lenPx > big) out.brk();
      out.emit(pb[0], pb[1]);
      return;
    }
    const pm = pt(tm);
    budget--;
    if (!fin2(pm)) {
      refine(ta, pa, tm, pm, depth + 1);
      refine(tm, pm, tb, pb, depth + 1);
      return;
    }
    // deviation of the midpoint from the chord, in pixels
    const ax = pa[0] * sxp;
    const ay = pa[1] * syp;
    const bx = pb[0] * sxp;
    const by = pb[1] * syp;
    const mx = pm[0] * sxp;
    const my = pm[1] * syp;
    const dx = bx - ax;
    const dy = by - ay;
    const clen = Math.hypot(dx, dy);
    const dev = clen > 0 ? Math.abs((mx - ax) * dy - (my - ay) * dx) / clen : Math.hypot(mx - ax, my - ay);
    const offscreen =
      (pa[0] < b.xmin - xspan && pb[0] < b.xmin - xspan && pm[0] < b.xmin - xspan) ||
      (pa[0] > b.xmax + xspan && pb[0] > b.xmax + xspan && pm[0] > b.xmax + xspan) ||
      (pa[1] < b.ymin - yspan && pb[1] < b.ymin - yspan && pm[1] < b.ymin - yspan) ||
      (pa[1] > b.ymax + yspan && pb[1] > b.ymax + yspan && pm[1] > b.ymax + yspan);
    if (!offscreen && (dev > 0.25 || lenPx > 8) && lenPx > 0.05) {
      refine(ta, pa, tm, pm, depth + 1);
      refine(tm, pm, tb, pb, depth + 1);
    } else {
      out.emit(pm[0], pm[1]);
      out.emit(pb[0], pb[1]);
    }
  };

  let tp = t0;
  let pp = pt(tp);
  if (fin2(pp)) out.emit(pp[0], pp[1]);
  for (let i = 1; i <= N; i++) {
    const ti = t0 + ((t1 - t0) * i) / N;
    const pi = pt(ti);
    budget--;
    refine(tp, pp, ti, pi, 0);
    tp = ti;
    pp = pi;
    if (out.pts.length > MAX_POINTS * 2) break;
  }
  return out.pts;
}

/** Polar r = f(theta) as a parametric curve. */
export function samplePolar(f: Fn1, t0: number, t1: number, b: Bounds, opt: SampleOptions): Polyline {
  return sampleParametric(
    (t) => f(t) * Math.cos(t),
    (t) => f(t) * Math.sin(t),
    t0,
    t1,
    b,
    opt
  );
}

/**
 * Clip a segment to a rectangle (Liang-Barsky). Returns null when fully outside,
 * otherwise the clipped endpoints [x0, y0, x1, y1].
 */
export function clipSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number
): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let i = 0; i < 4; i++) {
    const pi = p[i] as number;
    const qi = q[i] as number;
    if (pi === 0) {
      if (qi < 0) return null;
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/** Robust y-range of a set of samples: ignores asymptote blow-ups via Tukey fences. */
export function robustRange(values: number[]): [number, number] | null {
  const v = values.filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor(p * (v.length - 1))))] as number;
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  let lo = v[0] as number;
  let hi = v[v.length - 1] as number;
  if (iqr > 0) {
    const fl = q1 - 6 * iqr;
    const fh = q3 + 6 * iqr;
    const inside = v.filter((y) => y >= fl && y <= fh);
    lo = inside[0] ?? lo;
    hi = inside[inside.length - 1] ?? hi;
  } else if (hi - lo > 0) {
    // mostly constant with outliers
    const med = q(0.5);
    const kept = v.filter((y) => Math.abs(y - med) <= 1e3 * Math.max(1, Math.abs(med)));
    lo = kept[0] ?? lo;
    hi = kept[kept.length - 1] ?? hi;
  }
  return [lo, hi];
}

/** 1-2-5 tick values covering [min, max]. */
export function niceTicks(min: number, max: number, target = 8): { ticks: number[]; step: number } {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [], step: 1 };
  const raw = (max - min) / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
  const first = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = first, i = 0; v <= max + step * 1e-9 && i < 2000; v += step, i++) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return { ticks, step };
}

/** Format a tick label given the tick step. */
export function tickLabel(v: number, step: number): string {
  if (v === 0) return '0';
  const av = Math.abs(v);
  if (av >= 1e6 || av < 1e-4) {
    return v.toExponential(Math.max(0, Math.min(6, Math.ceil(Math.log10(av / step)) )) ).replace('e+', 'e').replace(/\.?0+e/, 'e');
  }
  const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toFixed(decimals);
}

/** Compact number formatting for readouts. */
export function fmtNum(v: number, sig = 6): string {
  if (Number.isNaN(v)) return 'undefined';
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '-∞';
  if (v === 0) return '0';
  const av = Math.abs(v);
  if (Number.isInteger(v) && av < 1e15) return String(v);
  if (av >= 1e9 || av < 1e-5) return v.toExponential(sig - 1).replace(/\.?0+e/, 'e').replace('e+', 'e');
  const s = v.toPrecision(sig);
  return s.includes('e') ? String(Number(s)) : s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/* ------------------------------------------------------------------ */
/* Numeric analysis                                                    */
/* ------------------------------------------------------------------ */

/** Brent's method on a bracket [a, b] with f(a) * f(b) <= 0. */
export function brent(f: Fn1, a: number, b: number, tol = 1e-14, maxIt = 200): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return NaN;
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let i = 0; i < maxIt; i++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return b;
}

export interface RootOptions {
  samples?: number;
}

/** Real roots of f in [a, b]: sign changes (Brent) plus tangent (double) roots. */
export function findRoots(f: Fn1, a: number, b: number, opt: RootOptions = {}): number[] {
  if (!(b > a)) return [];
  const N = opt.samples ?? 4000;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N;
    xs.push(x);
    ys.push(f(x));
  }
  let scale = 0;
  for (const y of ys) if (Number.isFinite(y) && Math.abs(y) > scale) scale = Math.abs(y);
  const zeroTol = 1e-12 * Math.max(scale, 1e-300);
  const roots: number[] = [];
  const add = (r: number) => {
    if (!Number.isFinite(r)) return;
    const tol = 1e-9 * Math.max(1, Math.abs(r), (b - a) / N);
    if (!roots.some((q) => Math.abs(q - r) < tol)) roots.push(r);
  };
  for (let i = 0; i < N; i++) {
    const ya = ys[i] as number;
    const yb = ys[i + 1] as number;
    const xa = xs[i] as number;
    const xb = xs[i + 1] as number;
    if (ya === 0 && Number.isFinite(ya)) {
      add(xa);
      continue;
    }
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) continue;
    if (ya * yb < 0) {
      const r = brent(f, xa, xb);
      const fr = f(r);
      if (Number.isFinite(r) && (Math.abs(fr) < Math.min(Math.abs(ya), Math.abs(yb)) || Math.abs(fr) <= zeroTol)) add(r);
    }
  }
  if (ys[N] === 0) add(xs[N] as number);
  // tangent roots: local minimum of |f| that touches zero without a sign change
  const absf: Fn1 = (x) => Math.abs(f(x));
  for (let i = 1; i < N; i++) {
    const y0 = ys[i - 1] as number;
    const y1 = ys[i] as number;
    const y2 = ys[i + 1] as number;
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    if (y0 * y1 <= 0 || y1 * y2 <= 0) continue;
    const a0 = Math.abs(y0);
    const a1 = Math.abs(y1);
    const a2 = Math.abs(y2);
    if (a1 < a0 && a1 <= a2) {
      // golden-section search for the minimum of |f|
      let lo = xs[i - 1] as number;
      let hi = xs[i + 1] as number;
      const gr = (Math.sqrt(5) - 1) / 2;
      let c1 = hi - gr * (hi - lo);
      let c2 = lo + gr * (hi - lo);
      let f1 = absf(c1);
      let f2 = absf(c2);
      for (let k = 0; k < 120 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); k++) {
        if (f1 < f2) {
          hi = c2;
          c2 = c1;
          f2 = f1;
          c1 = hi - gr * (hi - lo);
          f1 = absf(c1);
        } else {
          lo = c1;
          c1 = c2;
          f1 = f2;
          c2 = lo + gr * (hi - lo);
          f2 = absf(c2);
        }
      }
      const xm = (lo + hi) / 2;
      const fm = absf(xm);
      const scale = Math.max(a0, a1, a2);
      if (fm < 1e-9 * Math.max(1e-3, scale) && fm < 1e-9) add(xm);
    }
  }
  return roots.sort((p, q) => p - q);
}

export interface Extremum {
  x: number;
  y: number;
  kind: 'min' | 'max';
}

/** 5-point numeric derivative. */
export function derivative(f: Fn1, x: number, h: number): number {
  return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
}

/** Local extrema of f on [a, b] from sign changes of the numeric derivative. */
export function findExtrema(f: Fn1, a: number, b: number, opt: RootOptions = {}): Extremum[] {
  if (!(b > a)) return [];
  const N = opt.samples ?? 4000;
  const step = (b - a) / N;
  const hOf = (x: number) => Math.min(step / 4, 1e-3 * Math.max(1, Math.abs(x)));
  const d: Fn1 = (x) => derivative(f, x, hOf(x));
  const xs: number[] = [];
  const ds: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = a + step * i;
    xs.push(x);
    ds.push(d(x));
  }
  const out: Extremum[] = [];
  for (let i = 0; i < N; i++) {
    const da = ds[i] as number;
    const db = ds[i + 1] as number;
    if (!Number.isFinite(da) || !Number.isFinite(db)) continue;
    const dPrev = i > 0 ? (ds[i - 1] as number) : NaN;
    if (da * db < 0 || (da === 0 && db !== 0 && dPrev * db < 0)) {
      const xa = xs[i] as number;
      const xb = xs[i + 1] as number;
      const x = da === 0 ? xa : brent(d, xa, xb, 1e-13);
      if (!Number.isFinite(x)) continue;
      const y = f(x);
      if (!Number.isFinite(y)) continue;
      // reject jump discontinuities (derivative sign flip where f itself jumps)
      const yl = f(x - step * 0.5);
      const yr = f(x + step * 0.5);
      if (!Number.isFinite(yl) || !Number.isFinite(yr)) continue;
      const scale = Math.max(Math.abs(y), Math.abs(yl), Math.abs(yr), 1e-12);
      if (Math.abs(yl - y) > 0.5 * scale && Math.abs(yr - y) > 0.5 * scale && Math.abs(yl - yr) > 0.5 * scale) continue;
      const kind: 'min' | 'max' = da < 0 || (da === 0 && db > 0) ? 'min' : 'max';
      // require a true turning point: neighbours lie on the same side
      if (kind === 'min' ? !(yl >= y - 1e-12 * scale && yr >= y - 1e-12 * scale) : !(yl <= y + 1e-12 * scale && yr <= y + 1e-12 * scale)) continue;
      if (!out.some((e) => Math.abs(e.x - x) < 1e-7 * Math.max(1, Math.abs(x)))) out.push({ x, y, kind });
    }
  }
  return out.sort((p, q) => p.x - q.x);
}

export interface Intersection {
  x: number;
  y: number;
}

/** Intersections of two curves y = f(x) and y = g(x) on [a, b]. */
export function findIntersections(f: Fn1, g: Fn1, a: number, b: number, opt: RootOptions = {}): Intersection[] {
  const h: Fn1 = (x) => f(x) - g(x);
  return findRoots(h, a, b, opt).map((x) => ({ x, y: (f(x) + g(x)) / 2 }));
}

export interface IntegralResult {
  value: number;
  /** Estimated absolute error. */
  error: number;
  converged: boolean;
  /** Set when the integrand is undefined / infinite somewhere. */
  problem: string | null;
}

/** Adaptive Simpson integral of f over [a, b] (a > b gives a negative result). */
export function integrate(f: Fn1, a: number, b: number, tol = 1e-10): IntegralResult {
  if (a === b) return { value: 0, error: 0, converged: true, problem: null };
  let sign = 1;
  if (a > b) {
    [a, b] = [b, a];
    sign = -1;
  }
  const w = b - a;
  const nudge = w * 1e-12;
  let evals = 0;
  let sawBad = false;
  const ev = (x: number): number => {
    evals++;
    const v = f(x);
    if (!Number.isFinite(v)) {
      sawBad = true;
      return 0;
    }
    return v;
  };
  const evEnd = (x: number, dir: 1 | -1): number => {
    let v = f(x);
    evals++;
    if (!Number.isFinite(v)) v = f(x + dir * nudge);
    evals++;
    if (!Number.isFinite(v)) {
      sawBad = true;
      return 0;
    }
    return v;
  };
  let unconverged = false;
  let errTotal = 0;
  const simpson = (fa: number, fm: number, fb: number, h: number) => (h / 6) * (fa + 4 * fm + fb);
  const rec = (xa: number, fa: number, xb: number, fb: number, fm: number, whole: number, eps: number, depth: number): number => {
    const xm = (xa + xb) / 2;
    const xl = (xa + xm) / 2;
    const xr = (xm + xb) / 2;
    const fl = ev(xl);
    const fr = ev(xr);
    const left = simpson(fa, fl, fm, xm - xa);
    const right = simpson(fm, fr, fb, xb - xm);
    const delta = left + right - whole;
    if (depth <= 0 || evals > 4_000_000) {
      unconverged = unconverged || Math.abs(delta) > 15 * eps;
      errTotal += Math.abs(delta) / 15;
      return left + right + delta / 15;
    }
    if (Math.abs(delta) <= 15 * eps && depth < 44) {
      errTotal += Math.abs(delta) / 15;
      return left + right + delta / 15;
    }
    return rec(xa, fa, xm, fm, fl, left, eps / 2, depth - 1) + rec(xm, fm, xb, fb, fr, right, eps / 2, depth - 1);
  };
  // initial subdivision into 16 panels avoids missing narrow features
  const P = 16;
  let total = 0;
  const xsP: number[] = [];
  for (let i = 0; i <= P; i++) xsP.push(a + (w * i) / P);
  let fPrev = evEnd(a, 1);
  for (let i = 0; i < P; i++) {
    const xa = xsP[i] as number;
    const xb = xsP[i + 1] as number;
    const fb = i === P - 1 ? evEnd(b, -1) : ev(xb);
    const xm = (xa + xb) / 2;
    const fm = ev(xm);
    const whole = simpson(fPrev, fm, fb, xb - xa);
    total += rec(xa, fPrev, xb, fb, fm, whole, tol * (xb - xa) / w, 48);
    fPrev = fb;
  }
  return {
    value: sign * total,
    error: errTotal,
    converged: !unconverged && !sawBad,
    problem: sawBad ? 'The function is undefined (NaN or infinite) at some points of the interval, so the result may be wrong.' : null,
  };
}

export interface TableRow {
  x: number;
  y: number;
}

/** Values of f at start, start + step, ... <= end (capped). */
export function valueTable(f: Fn1, start: number, end: number, step: number, cap = 5000): TableRow[] {
  const rows: TableRow[] = [];
  if (!(step > 0) || !Number.isFinite(start) || !Number.isFinite(end)) return rows;
  const n = Math.floor((end - start) / step + 1e-9);
  for (let i = 0; i <= n && i < cap; i++) {
    const x = Number((start + i * step).toPrecision(14));
    rows.push({ x, y: f(x) });
  }
  return rows;
}

export function tableCsv(rows: TableRow[]): string {
  return ['x,y', ...rows.map((r) => `${r.x},${Number.isFinite(r.y) ? Number(r.y.toPrecision(15)) : ''}`)].join('\n');
}

/* ------------------------------------------------------------------ */
/* Shareable state (URL hash)                                          */
/* ------------------------------------------------------------------ */

export interface HashRow {
  m: RowMode;
  e: string;
  e2?: string;
  a?: string;
  b?: string;
  /** 0 = hidden */
  v?: 0 | 1;
  c?: string;
}

export interface HashParam {
  v: number;
  lo: number;
  hi: number;
  s: number;
}

export interface HashState {
  v: 1;
  r: HashRow[];
  p: Record<string, HashParam>;
  w?: [number, number, number, number];
  q?: 0 | 1;
}

function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeHashState(state: HashState): string {
  return toB64Url(JSON.stringify(state));
}

const MODES: RowMode[] = ['y', 'polar', 'param', 'vline'];

/** Decode and sanitise a hash payload; returns null when it is not valid. */
export function decodeHashState(payload: string): HashState | null {
  try {
    const raw: unknown = JSON.parse(fromB64Url(payload));
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1 || !Array.isArray(o.r)) return null;
    const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.slice(0, max) : '');
    const rows: HashRow[] = [];
    for (const item of o.r.slice(0, 8)) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      const m = MODES.includes(it.m as RowMode) ? (it.m as RowMode) : 'y';
      const row: HashRow = { m, e: str(it.e) };
      if (m === 'param') row.e2 = str(it.e2);
      if (m === 'param' || m === 'polar') {
        row.a = str(it.a, 40);
        row.b = str(it.b, 40);
      }
      if (it.v === 0) row.v = 0;
      if (typeof it.c === 'string' && /^(p[0-7]|#[0-9a-fA-F]{6})$/.test(it.c)) row.c = it.c;
      rows.push(row);
    }
    if (rows.length === 0) return null;
    const params: Record<string, HashParam> = {};
    if (o.p && typeof o.p === 'object') {
      for (const [k, v] of Object.entries(o.p as Record<string, unknown>)) {
        if (!/^[A-Za-z]$/.test(k) || !v || typeof v !== 'object') continue;
        const pv = v as Record<string, unknown>;
        const num = (z: unknown, d: number) => (typeof z === 'number' && Number.isFinite(z) ? z : d);
        const lo = num(pv.lo, -5);
        const hi = num(pv.hi, 5);
        params[k] = { v: num(pv.v, 1), lo: Math.min(lo, hi), hi: Math.max(lo, hi), s: Math.abs(num(pv.s, 0.1)) || 0.1 };
      }
    }
    const out: HashState = { v: 1, r: rows, p: params };
    if (Array.isArray(o.w) && o.w.length === 4 && o.w.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      const w = o.w as [number, number, number, number];
      if (w[1] > w[0] && w[3] > w[2]) out.w = w;
    }
    if (o.q === 0 || o.q === 1) out.q = o.q;
    return out;
  } catch {
    return null;
  }
}
