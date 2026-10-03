/**
 * JavaScript tokenizer, whitespace/comment minifier and beautifier.
 * Pure TypeScript, no dependencies, runs in the browser (and in bun/node for tests).
 *
 * The tokenizer classifies regex-vs-division and block-vs-object-literal while scanning
 * (it keeps a bracket stack), and annotates tokens with enough structure for the minifier
 * to preserve automatic-semicolon-insertion (ASI) semantics and for the beautifier to
 * lay code out sensibly. No identifier mangling is ever performed.
 */

export type TokType =
  | 'name'
  | 'num'
  | 'str'
  | 'tmpl'
  | 'regex'
  | 'punct'
  | 'lcomment'
  | 'bcomment'
  | 'hashbang';

export type BraceKind = 'block' | 'switch' | 'func' | 'class' | 'object';

export interface Token {
  type: TokType;
  value: string;
  start: number;
  end: number;
  /** Index in the token array. */
  idx: number;
  /** A line terminator occurs in the whitespace between the previous token and this one. */
  nl: boolean;
  /** Number of line terminators in that whitespace. */
  blank: number;
  /** name: previous significant token is `.` or `?.` (property access). */
  prop?: boolean;
  /** name: private identifier (#x). */
  priv?: boolean;
  tmpl?: 'full' | 'head' | 'middle' | 'tail';
  /** `{`/`}`: what the brace opens. */
  brace?: BraceKind;
  /** `{`/`}`: closing it ends a statement/declaration (no ASI separator is required afterwards). */
  stmtEnd?: boolean;
  /** `{`/`}` : body of a do..while loop. */
  doBody?: boolean;
  /** `(`/`)` */
  paren?: 'ctrl' | 'fnparams' | 'call' | 'group';
  ctrlKw?: string;
  colon?: 'ternary' | 'prop' | 'case' | 'label';
  postfix?: boolean;
  unary?: boolean;
  star?: 'fn' | 'yield' | 'method';
  /** Index of the matching bracket (set on both ends). */
  match?: number;
  /** `(` of function parameters: the function is a declaration / a method. */
  fnDecl?: boolean;
  method?: boolean;
  arrow?: boolean;
}

export class JsSyntaxError extends Error {
  line: number;
  column: number;
  offset: number;
  constructor(message: string, src: string, offset: number) {
    const { line, column } = lineCol(src, offset);
    super(`${message} (line ${line}, column ${column})`);
    this.name = 'JsSyntaxError';
    this.line = line;
    this.column = column;
    this.offset = offset;
  }
}

export function lineCol(src: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  const lim = Math.min(offset, src.length);
  for (let i = 0; i < lim; i++) {
    const c = src.charCodeAt(i);
    if (c === 10 || c === 0x2028 || c === 0x2029 || (c === 13 && src.charCodeAt(i + 1) !== 10)) {
      line++;
      last = i;
    }
  }
  return { line, column: offset - last };
}

// ---------------------------------------------------------------------------
// Character classes
// ---------------------------------------------------------------------------

const ID_START_RE = /[\p{ID_Start}$_]/u;
const ID_PART_RE = /[\p{ID_Continue}$\u200c\u200d]/u;

function isLineTerm(c: number): boolean {
  return c === 10 || c === 13 || c === 0x2028 || c === 0x2029;
}

function isWs(c: number): boolean {
  return (
    c === 32 ||
    c === 9 ||
    c === 11 ||
    c === 12 ||
    c === 160 ||
    c === 0xfeff ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000
  );
}

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

function isAsciiIdStart(c: number): boolean {
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 36 || c === 95;
}

function isAsciiIdPart(c: number): boolean {
  return isAsciiIdStart(c) || isDigit(c);
}

// ---------------------------------------------------------------------------
// Keyword tables
// ---------------------------------------------------------------------------

/** Words that cannot end an expression (so a following `/` starts a regex, a newline is no ASI hazard, ...). */
const NOT_VALUE_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do',
  'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'new', 'return', 'switch', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'await', 'of',
]);

/** After these words a `/` begins a regular expression literal. */
const REGEX_AFTER_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await',
  'case', 'do', 'else', 'extends', 'default',
]);

const CTRL_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);

/** Words after which a `{` starts an object literal (an expression) rather than a block. */
const EXPR_BEFORE_BRACE = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await',
  'case', 'extends', 'default', 'const', 'let', 'var', 'import', 'export',
]);

const RESTRICTED_WORDS = new Set(['return', 'break', 'continue', 'throw', 'yield']);

/** Words which, followed by `(`, get a space in the beautified output. */
const SPACE_BEFORE_PAREN = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'throw', 'typeof', 'void', 'delete',
  'new', 'in', 'of', 'instanceof', 'case', 'yield', 'await', 'async', 'function', 'else', 'do',
  'default', 'export', 'extends',
]);

const PUNCT4 = ['>>>='];
const PUNCT3 = ['...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??='];
const PUNCT2 = [
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '<<', '>>', '**',
];

// ---------------------------------------------------------------------------
// Token predicates shared by tokenizer, minifier and beautifier
// ---------------------------------------------------------------------------

function isPunct(t: Token | null | undefined, v: string): boolean {
  return !!t && t.type === 'punct' && t.value === v;
}

function isWord(t: Token | null | undefined, v: string): boolean {
  return !!t && t.type === 'name' && !t.prop && t.value === v;
}

/** Can this token be the last token of an expression? */
export function endsExpr(t: Token | null | undefined): boolean {
  if (!t) return false;
  switch (t.type) {
    case 'num':
    case 'str':
    case 'regex':
      return true;
    case 'tmpl':
      return t.tmpl === 'full' || t.tmpl === 'tail';
    case 'name':
      return !!t.prop || !NOT_VALUE_WORDS.has(t.value);
    case 'punct':
      if (t.value === ')' || t.value === ']') return true;
      if (t.value === '}') return !t.stmtEnd;
      if (t.value === '++' || t.value === '--') return !!t.postfix;
      return false;
    default:
      return false;
  }
}

interface Group {
  open: Token;
  /** 'paren' | 'bracket' | 'brace' | 'tmpl' */
  ch: 'paren' | 'bracket' | 'brace' | 'tmpl';
  ternary: number;
  expectCase: boolean;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

class Scanner {
  src: string;
  n: number;
  toks: Token[] = [];
  /** Significant (non-comment) tokens, for context lookups. */
  sig: Token[] = [];
  groups: Group[] = [];
  pendingFn: { decl: boolean } | null = null;
  fnBody: { decl: boolean; method: boolean } | null = null;
  pendingClass: { depth: number; decl: boolean } | null = null;

  constructor(src: string) {
    this.src = src;
    this.n = src.length;
    const root: Token = { type: 'punct', value: '', start: 0, end: 0, idx: -1, nl: false, blank: 0, brace: 'block' };
    this.groups.push({ open: root, ch: 'brace', ternary: 0, expectCase: false });
  }

  err(msg: string, pos: number): never {
    throw new JsSyntaxError(msg, this.src, pos);
  }

  get prev(): Token | null {
    return this.sig[this.sig.length - 1] ?? null;
  }

  top(): Group | null {
    return this.groups[this.groups.length - 1] ?? null;
  }

  run(): Token[] {
    const { src, n } = this;
    let i = 0;
    if (src.charCodeAt(0) === 35 && src.charCodeAt(1) === 33) {
      let j = 2;
      while (j < n && !isLineTerm(src.charCodeAt(j))) j++;
      this.push('hashbang', src.slice(0, j), 0, j, false, 0);
      i = j;
    }
    let nl = false;
    let blank = 0;
    while (i < n) {
      const c = src.charCodeAt(i);
      if (isLineTerm(c)) {
        if (c === 13 && src.charCodeAt(i + 1) === 10) i++;
        i++;
        nl = true;
        blank++;
        continue;
      }
      if (isWs(c)) {
        i++;
        continue;
      }
      // comments
      if (c === 47) {
        const d = src.charCodeAt(i + 1);
        if (d === 47) {
          let j = i + 2;
          while (j < n && !isLineTerm(src.charCodeAt(j))) j++;
          this.push('lcomment', src.slice(i, j), i, j, nl, blank);
          i = j;
          nl = false;
          blank = 0;
          continue;
        }
        if (d === 42) {
          const close = src.indexOf('*/', i + 2);
          if (close < 0) this.err('Unterminated comment', i);
          const j = close + 2;
          this.push('bcomment', src.slice(i, j), i, j, nl, blank);
          i = j;
          nl = false;
          blank = 0;
          continue;
        }
      }
      let end: number;
      if (c === 34 || c === 39) {
        end = this.scanString(i, c);
        this.push('str', src.slice(i, end), i, end, nl, blank);
      } else if (c === 96) {
        end = this.scanTemplate(i, 'start', nl, blank);
      } else if (c === 125 && this.top()?.ch === 'tmpl') {
        end = this.scanTemplate(i, 'cont', nl, blank);
      } else if (isDigit(c) || (c === 46 && isDigit(src.charCodeAt(i + 1)))) {
        end = this.scanNumber(i);
        this.push('num', src.slice(i, end), i, end, nl, blank);
      } else if (isAsciiIdStart(c) || c === 92 || c > 127 || (c === 35 && this.startsIdent(i + 1))) {
        const priv = c === 35;
        const idStart = priv ? i + 1 : i;
        if (!this.startsIdent(idStart)) {
          this.err(`Unexpected character ${JSON.stringify(src[i] ?? '')}`, i);
        }
        end = this.readIdent(idStart);
        const t = this.push('name', src.slice(i, end), i, end, nl, blank);
        if (priv) t.priv = true;
      } else if (c === 47) {
        const ra = this.regexAllowed();
        let done = false;
        end = i;
        if (ra !== 'no') {
          const r = this.scanRegex(i);
          if (r > 0) {
            end = r;
            this.push('regex', src.slice(i, r), i, r, nl, blank);
            done = true;
          } else if (ra === 'yes') {
            this.err('Unterminated regular expression literal', i);
          }
        }
        if (!done) {
          const v = src.charCodeAt(i + 1) === 61 ? '/=' : '/';
          end = i + v.length;
          this.push('punct', v, i, end, nl, blank);
        }
      } else {
        const v = this.readPunct(i);
        if (!v) this.err(`Unexpected character ${JSON.stringify(src[i] ?? '')}`, i);
        end = i + v.length;
        this.push('punct', v, i, end, nl, blank);
      }
      i = end;
      nl = false;
      blank = 0;
    }
    const g = this.top();
    if (g && g.ch === 'tmpl') this.err('Unterminated template literal', g.open.start);
    return this.toks;
  }

  private startsIdent(i: number): boolean {
    const c = this.src.charCodeAt(i);
    if (isAsciiIdStart(c)) return true;
    if (c === 92) return this.src.charCodeAt(i + 1) === 117;
    if (c > 127) {
      const cp = this.src.codePointAt(i);
      return cp !== undefined && ID_START_RE.test(String.fromCodePoint(cp));
    }
    return false;
  }

  private readIdent(i: number): number {
    const { src, n } = this;
    let j = i;
    while (j < n) {
      const c = src.charCodeAt(j);
      if (isAsciiIdPart(c)) {
        j++;
      } else if (c === 92 && src.charCodeAt(j + 1) === 117) {
        if (src.charCodeAt(j + 2) === 123) {
          const close = src.indexOf('}', j + 3);
          if (close < 0) this.err('Invalid Unicode escape sequence', j);
          j = close + 1;
        } else {
          j += 6;
        }
      } else if (c > 127) {
        const cp = src.codePointAt(j);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        if (ID_PART_RE.test(ch)) j += ch.length;
        else break;
      } else break;
    }
    return Math.min(j, n);
  }

  private readPunct(i: number): string | null {
    const { src } = this;
    const s4 = src.substr(i, 4);
    if (PUNCT4.includes(s4)) return s4;
    const s3 = s4.slice(0, 3);
    if (PUNCT3.includes(s3)) return s3;
    const s2 = s4.slice(0, 2);
    if (PUNCT2.includes(s2)) {
      if (s2 === '?.' && isDigit(src.charCodeAt(i + 2))) return '?';
      return s2;
    }
    const c = s4.charAt(0);
    if ('{}()[];,<>+-*/%&|^!~?:=.@#'.includes(c)) return c;
    return null;
  }

  private scanString(i: number, quote: number): number {
    const { src, n } = this;
    let j = i + 1;
    while (j < n) {
      const c = src.charCodeAt(j);
      if (c === quote) return j + 1;
      if (c === 92) {
        const d = src.charCodeAt(j + 1);
        j += d === 13 && src.charCodeAt(j + 2) === 10 ? 3 : 2;
        continue;
      }
      if (c === 10 || c === 13) break;
      j++;
    }
    this.err('Unterminated string literal', i);
  }

  private scanNumber(i: number): number {
    const { src, n } = this;
    let j = i;
    const c = src.charCodeAt(j);
    const d = src.charCodeAt(j + 1) | 32;
    if (c === 48 && (d === 120 || d === 98 || d === 111)) {
      j += 2;
      while (j < n && (isAsciiIdPart(src.charCodeAt(j)) && src.charCodeAt(j) !== 36)) j++;
      return j;
    }
    while (j < n && (isDigit(src.charCodeAt(j)) || src.charCodeAt(j) === 95)) j++;
    if (src.charCodeAt(j) === 110) return j + 1; // BigInt
    if (src.charCodeAt(j) === 46) {
      j++;
      while (j < n && (isDigit(src.charCodeAt(j)) || src.charCodeAt(j) === 95)) j++;
    }
    const e = src.charCodeAt(j) | 32;
    if (e === 101) {
      let k = j + 1;
      const s = src.charCodeAt(k);
      if (s === 43 || s === 45) k++;
      if (isDigit(src.charCodeAt(k))) {
        j = k;
        while (j < n && (isDigit(src.charCodeAt(j)) || src.charCodeAt(j) === 95)) j++;
      }
    }
    return j;
  }

  /** Returns end index of the regex literal starting at i, or -1 if it is not terminated on this line. */
  private scanRegex(i: number): number {
    const { src, n } = this;
    let j = i + 1;
    let inClass = false;
    while (j < n) {
      const c = src.charCodeAt(j);
      if (isLineTerm(c)) return -1;
      if (c === 92) {
        j += 2;
        continue;
      }
      if (c === 91) inClass = true;
      else if (c === 93) inClass = false;
      else if (c === 47 && !inClass) {
        j++;
        while (j < n) {
          const f = src.charCodeAt(j);
          if (isAsciiIdPart(f)) j++;
          else if (f > 127) {
            const cp = src.codePointAt(j);
            const ch = cp === undefined ? '' : String.fromCodePoint(cp);
            if (ch && ID_PART_RE.test(ch)) j += ch.length;
            else break;
          } else break;
        }
        return j;
      }
      j++;
    }
    return -1;
  }

  /**
   * Scans a template chunk. `mode` 'start' begins at a backtick, 'cont' at the `}` closing a `${` substitution.
   * Pushes the token and updates the group stack. Returns the end offset.
   */
  private scanTemplate(i: number, mode: 'start' | 'cont', nl: boolean, blank: number): number {
    const { src, n } = this;
    let j = i + 1;
    while (j < n) {
      const c = src.charCodeAt(j);
      if (c === 92) {
        j += 2;
        continue;
      }
      if (c === 96) {
        j++;
        const tail = mode === 'cont';
        const t = this.push('tmpl', src.slice(i, j), i, j, nl, blank);
        t.tmpl = tail ? 'tail' : 'full';
        if (tail) this.groups.pop();
        return j;
      }
      if (c === 36 && src.charCodeAt(j + 1) === 123) {
        j += 2;
        const t = this.push('tmpl', src.slice(i, j), i, j, nl, blank);
        if (mode === 'start') {
          t.tmpl = 'head';
          this.groups.push({ open: t, ch: 'tmpl', ternary: 0, expectCase: false });
        } else {
          t.tmpl = 'middle';
          const g = this.top();
          if (g) {
            g.open = t;
            g.ternary = 0;
          }
        }
        return j;
      }
      j++;
    }
    this.err('Unterminated template literal', i);
  }

  private regexAllowed(): 'yes' | 'maybe' | 'no' {
    const p = this.prev;
    if (!p) return 'yes';
    switch (p.type) {
      case 'num':
      case 'str':
      case 'regex':
        return 'no';
      case 'tmpl':
        return p.tmpl === 'head' || p.tmpl === 'middle' ? 'yes' : 'no';
      case 'name':
        if (p.prop) return 'no';
        return REGEX_AFTER_WORDS.has(p.value) ? 'yes' : 'no';
      case 'punct':
        switch (p.value) {
          case ')':
            return p.paren === 'ctrl' ? 'maybe' : 'no';
          case ']':
            return 'no';
          case '}':
            return p.stmtEnd ? 'maybe' : 'no';
          case '++':
          case '--':
            return p.postfix ? 'no' : 'yes';
          default:
            return 'yes';
        }
      default:
        return 'yes';
    }
  }

  private push(type: TokType, value: string, start: number, end: number, nl: boolean, blank: number): Token {
    const t: Token = { type, value, start, end, idx: this.toks.length, nl, blank };
    this.toks.push(t);
    if (type === 'lcomment' || type === 'bcomment' || type === 'hashbang') return t;
    // Template tokens are annotated by the caller, so observe() runs lazily on the next push.
    this.observe(t);
    this.sig.push(t);
    return t;
  }

  // ---- context tracking ----------------------------------------------------

  /** Is a statement allowed to begin right after `p` (given that a newline separated them or not)? */
  private stmtStartAfter(p: Token | null, nl: boolean): boolean {
    if (!p) return true;
    if (p.type === 'punct') {
      switch (p.value) {
        case ';':
          return true;
        case '{':
          return p.brace !== 'object';
        case '}':
          return !!p.stmtEnd || nl;
        case ')':
          return p.paren === 'ctrl' || nl;
        case ':':
          return p.colon === 'case' || p.colon === 'label' || nl;
        default:
          return nl && endsExpr(p);
      }
    }
    if (p.type === 'name') {
      if (!p.prop && (p.value === 'else' || p.value === 'do' || p.value === 'try' || p.value === 'finally')) {
        return true;
      }
      if (!p.prop && p.value === 'export') return true;
      if (!p.prop && p.value === 'default') {
        const pp = this.sig[this.sig.length - 2];
        return isWord(pp, 'export');
      }
      return nl && endsExpr(p);
    }
    return nl && endsExpr(p);
  }

  private observe(t: Token): void {
    const prev = this.prev;
    // The body of a function must follow its parameter list directly.
    if (this.fnBody && !(t.type === 'punct' && t.value === '{')) this.fnBody = null;
    switch (t.type) {
      case 'name':
        this.observeName(t, prev);
        break;
      case 'punct':
        this.observePunct(t, prev);
        break;
      default:
        break;
    }
  }

  private observeName(t: Token, prev: Token | null): void {
    if (prev && prev.type === 'punct' && (prev.value === '.' || prev.value === '?.')) {
      t.prop = true;
      return;
    }
    const v = t.value;
    if (v === 'function') {
      let base = prev;
      let nl = t.nl;
      if (isWord(prev, 'async')) {
        base = this.sig[this.sig.length - 2] ?? null;
        nl = prev ? prev.nl : false;
      }
      this.pendingFn = { decl: this.stmtStartAfter(base, nl) };
    } else if (v === 'class') {
      this.pendingClass = { depth: this.groups.length, decl: this.stmtStartAfter(prev, t.nl) };
    } else if (v === 'case' || v === 'default') {
      const g = this.top();
      if (g && g.ch === 'brace' && g.open.brace === 'switch' && this.stmtStartAfter(prev, t.nl)) {
        g.expectCase = true;
      }
    }
  }

  private observePunct(t: Token, prev: Token | null): void {
    const v = t.value;
    switch (v) {
      case '(': {
        this.openParen(t, prev);
        return;
      }
      case ')': {
        const g = this.popGroup('paren', t);
        if (g) {
          t.paren = g.open.paren;
          t.ctrlKw = g.open.ctrlKw;
          if (g.open.paren === 'fnparams') {
            this.fnBody = { decl: !!g.open.fnDecl, method: !!g.open.method };
          }
        }
        return;
      }
      case '[':
        this.groups.push({ open: t, ch: 'bracket', ternary: 0, expectCase: false });
        return;
      case ']':
        this.popGroup('bracket', t);
        return;
      case '{':
        this.openBrace(t, prev);
        return;
      case '}': {
        const g = this.popGroup('brace', t);
        if (g) {
          t.brace = g.open.brace;
          t.stmtEnd = g.open.stmtEnd;
          t.doBody = g.open.doBody;
        }
        return;
      }
      case '?': {
        const g = this.top();
        if (g) g.ternary++;
        return;
      }
      case ':': {
        const g = this.top();
        if (g && g.ternary > 0) {
          g.ternary--;
          t.colon = 'ternary';
        } else if (g && g.ch === 'brace' && g.open.brace === 'object') {
          t.colon = 'prop';
        } else if (g && (g.ch === 'paren' || g.ch === 'bracket' || g.ch === 'tmpl')) {
          t.colon = 'prop';
        } else if (g && g.expectCase) {
          g.expectCase = false;
          t.colon = 'case';
        } else {
          t.colon = 'label';
        }
        return;
      }
      case '=>':
        t.arrow = true;
        return;
      case '++':
      case '--':
        t.postfix = !!prev && endsExpr(prev) && !t.nl;
        return;
      case '+':
      case '-':
        t.unary = !(prev && endsExpr(prev));
        return;
      case '!':
      case '~':
        t.unary = true;
        return;
      case '*': {
        if (isWord(prev, 'function')) t.star = 'fn';
        else if (isWord(prev, 'yield')) t.star = 'yield';
        else {
          const g = this.top();
          if (g && g.ch === 'brace' && (g.open.brace === 'class' || g.open.brace === 'object')) {
            const ok =
              !prev ||
              prev === g.open ||
              (prev.type === 'punct' && (prev.value === ',' || prev.value === ';' || prev.value === '}')) ||
              isWord(prev, 'static') ||
              isWord(prev, 'async');
            if (ok) t.star = 'method';
          }
        }
        return;
      }
      default:
        return;
    }
  }

  private popGroup(ch: Group['ch'], close: Token): Group | null {
    for (let k = this.groups.length - 1; k >= 1; k--) {
      const g = this.groups[k];
      if (!g) continue;
      if (g.ch === ch) {
        this.groups.length = k;
        g.open.match = close.idx;
        close.match = g.open.idx;
        return g;
      }
      if (g.ch === 'tmpl') break; // never cross a template boundary
    }
    return null;
  }

  private openParen(t: Token, prev: Token | null): void {
    let kind: Token['paren'] = 'group';
    const pp = this.sig[this.sig.length - 2];
    if (
      prev &&
      prev.type === 'name' &&
      !prev.prop &&
      CTRL_WORDS.has(prev.value) &&
      !(pp && pp.type === 'punct' && (pp.value === '.' || pp.value === '?.'))
    ) {
      kind = 'ctrl';
      t.ctrlKw = prev.value === 'while' && isPunct(pp, '}') && pp?.doBody ? 'dowhile' : prev.value;
    } else if (isWord(prev, 'await') && isWord(pp, 'for')) {
      kind = 'ctrl';
      t.ctrlKw = 'for';
    } else if (this.pendingFn) {
      kind = 'fnparams';
      t.fnDecl = this.pendingFn.decl;
      this.pendingFn = null;
    } else if (this.isMethodParen(prev)) {
      kind = 'fnparams';
      t.method = true;
    } else if (prev && endsExpr(prev) && !(prev.type === 'name' && !prev.prop && SPACE_BEFORE_PAREN.has(prev.value))) {
      kind = 'call';
    }
    t.paren = kind;
    this.groups.push({ open: t, ch: 'paren', ternary: 0, expectCase: false });
  }

  private isMethodParen(prev: Token | null): boolean {
    const g = this.top();
    if (!g || g.ch !== 'brace' || !prev) return false;
    const kind = g.open.brace;
    if (kind !== 'class' && kind !== 'object') return false;
    let nameIdx = this.sig.length - 1;
    if (isPunct(prev, ']')) {
      // computed key: find the matching "["
      const open = prev.match !== undefined ? this.toks[prev.match] : undefined;
      if (!open) return false;
      nameIdx = this.sig.indexOf(open);
      if (nameIdx < 0) return false;
    } else if (!(prev.type === 'name' || prev.type === 'str' || prev.type === 'num')) {
      return false;
    }
    let q = nameIdx - 1;
    // skip modifiers
    while (q >= 0) {
      const m = this.sig[q];
      if (!m) break;
      if (m.type === 'name' && !m.prop && ['static', 'async', 'get', 'set'].includes(m.value) && q > 0) {
        const before = this.sig[q - 1];
        // `get`/`set`/`static`/`async` are only modifiers if they are not themselves the previous member's tail
        if (before && (before === g.open || isPunct(before, ',') || isPunct(before, ';') || isPunct(before, '}') ||
            (before.type === 'name' && ['static', 'async'].includes(before.value)) || endsExpr(before) || isPunct(before, '*'))) {
          q--;
          continue;
        }
        break;
      }
      if (m.type === 'punct' && m.value === '*' && m.star === 'method') {
        q--;
        continue;
      }
      break;
    }
    const before = q >= 0 ? this.sig[q] : undefined;
    if (!before) return false;
    if (before === g.open) return true;
    if (kind === 'object') return isPunct(before, ',');
    // class body: after the previous member
    if (isPunct(before, ';') || isPunct(before, '}')) return true;
    if (isPunct(before, '{')) return false;
    return endsExpr(before) || (before.type === 'name' && ['static', 'async', 'get', 'set'].includes(before.value));
  }

  private openBrace(t: Token, prev: Token | null): void {
    let kind: BraceKind = 'block';
    let stmtEnd = true;
    const nl = t.nl;
    if (this.pendingClass && this.groups.length === this.pendingClass.depth) {
      kind = 'class';
      stmtEnd = this.pendingClass.decl;
      this.pendingClass = null;
    } else if (this.fnBody) {
      kind = 'block';
      stmtEnd = this.fnBody.decl || this.fnBody.method;
      t.method = this.fnBody.method;
      kind = 'func';
      this.fnBody = null;
    } else if (!prev) {
      kind = 'block';
    } else if (isPunct(prev, ')') && prev.paren === 'ctrl') {
      kind = prev.ctrlKw === 'switch' ? 'switch' : 'block';
    } else if (isPunct(prev, '=>')) {
      kind = 'func';
      stmtEnd = false;
    } else if (nl && endsExpr(prev)) {
      kind = 'block';
    } else if (prev.type === 'name' && !prev.prop) {
      const w = prev.value;
      if (w === 'else' || w === 'try' || w === 'finally') kind = 'block';
      else if (w === 'do') {
        kind = 'block';
        t.doBody = true;
      } else if (w === 'static' && this.top()?.open.brace === 'class') kind = 'block';
      else if (EXPR_BEFORE_BRACE.has(w)) {
        kind = 'object';
        stmtEnd = false;
      } else kind = 'block';
    } else if (prev.type === 'punct') {
      switch (prev.value) {
        case ':':
          if (prev.colon === 'case' || prev.colon === 'label') kind = 'block';
          else {
            kind = 'object';
            stmtEnd = false;
          }
          break;
        case ';':
        case '{':
        case '}':
        case ')':
        case ']':
          kind = 'block';
          break;
        default:
          kind = 'object';
          stmtEnd = false;
          break;
      }
    } else if (prev.type === 'tmpl' && (prev.tmpl === 'head' || prev.tmpl === 'middle')) {
      kind = 'object';
      stmtEnd = false;
    }
    t.brace = kind;
    t.stmtEnd = stmtEnd;
    this.groups.push({ open: t, ch: 'brace', ternary: 0, expectCase: false });
  }
}

export function tokenize(src: string): Token[] {
  return new Scanner(src).run();
}

// ---------------------------------------------------------------------------
// Minifier
// ---------------------------------------------------------------------------

export interface MinifyOptions {
  /** Keep `/*! ... *\/` and `@license` / `@preserve` block comments. */
  keepLicense: boolean;
}

function firstCh(t: Token): string {
  return t.value.charAt(0);
}

function lastCh(t: Token): string {
  return t.value.charAt(t.value.length - 1);
}

function wordEnd(t: Token): boolean {
  return t.type === 'name' || t.type === 'num' || t.type === 'regex';
}

function wordStart(t: Token): boolean {
  return t.type === 'name' || t.type === 'num';
}

function startsNew(t: Token): boolean {
  switch (t.type) {
    case 'name':
      return !(!t.prop && (t.value === 'in' || t.value === 'instanceof' || t.value === 'of'));
    case 'num':
    case 'str':
    case 'regex':
      return true;
    case 'tmpl':
      return t.tmpl === 'full' || t.tmpl === 'head';
    case 'punct':
      return ['(', '[', '{', '+', '-', '++', '--', '!', '~', '/', '/=', '@', '#'].includes(t.value);
    default:
      return false;
  }
}

/** Would removing the newline between p and t (which were separated by one) change the program? */
export function newlineMatters(p: Token, t: Token): boolean {
  if (p.type === 'punct') {
    if (p.value === ';' || p.value === '{') return false;
    if (p.value === '}' && p.stmtEnd) return false;
    if (p.value === ')' && (p.paren === 'ctrl' || p.paren === 'fnparams')) return false;
  }
  if (p.type === 'name' && !p.prop && RESTRICTED_WORDS.has(p.value)) {
    return !(isPunct(t, ';') || isPunct(t, '}'));
  }
  if (!endsExpr(p)) return false;
  if (wordEnd(p) && wordStart(t)) return true; // a space is needed here anyway, so keep the newline instead
  return startsNew(t);
}

/** Would two punctuators written back to back be read as one longer punctuator? */
function fusesPunct(a: string, b: string): boolean {
  const s = a + b;
  for (const group of [PUNCT4, PUNCT3, PUNCT2]) {
    const len = group[0]?.length ?? 0;
    if (len > a.length && group.includes(s.slice(0, len))) return true;
  }
  return false;
}

/** Characters that must stay apart so two tokens do not fuse into a different token. */
function collides(p: Token, t: Token): boolean {
  const a = lastCh(p);
  const b = firstCh(t);
  if (wordEnd(p) && wordStart(t)) return true;
  if (a === '+' && b === '+') return true;
  if (a === '-' && b === '-') return true;
  if (a === '/' && (b === '/' || b === '*')) return true;
  if (p.type === 'punct' && t.type === 'punct' && fusesPunct(p.value, t.value)) return true;
  if (p.type === 'punct' && p.value === '.' && (t.type === 'num' || t.value === '.')) return true;
  if (p.type === 'num' && /^[0-9][0-9_]*$/.test(p.value) && t.type === 'punct' && t.value === '.') return true;
  if (a === '<' && b === '!') return true;
  if (a === '-' && p.value.endsWith('--') && b === '>') return true;
  if (p.type === 'punct' && p.value === '/' && t.type === 'regex') return true;
  return false;
}

function isLicenseComment(v: string): boolean {
  return v.startsWith('/*!') || /@(license|preserve|cc_on)\b/i.test(v);
}

export function minify(src: string, opts: Partial<MinifyOptions> = {}): string {
  const keepLicense = opts.keepLicense !== false;
  const toks = tokenize(src);
  const out: string[] = [];
  let prev: Token | null = null;
  let pendingNl = false;
  let afterLicense = false;
  /** Depth of "(" groups: semicolons inside belong to `for (;;)` headers. */
  const stack: string[] = [];

  const nextSig = (from: number): Token | null => {
    for (let k = from; k < toks.length; k++) {
      const x = toks[k];
      if (x && x.type !== 'lcomment' && x.type !== 'bcomment') return x;
    }
    return null;
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t) continue;
    if (t.nl) pendingNl = true;
    if (t.type === 'lcomment') {
      pendingNl = true;
      continue;
    }
    if (t.type === 'bcomment') {
      const multi = /[\n\r\u2028\u2029]/.test(t.value);
      if (keepLicense && isLicenseComment(t.value)) {
        if (pendingNl || multi) {
          if (out.length) out.push('\n');
          out.push(t.value);
          prev = null;
          afterLicense = true;
          pendingNl = true;
        } else {
          out.push(t.value);
          afterLicense = true;
        }
      } else if (multi) {
        pendingNl = true;
      }
      continue;
    }
    if (t.type === 'hashbang') {
      out.push(t.value, '\n');
      pendingNl = false;
      continue;
    }

    if (t.type === 'punct') {
      if (t.value === '(' || t.value === '[') stack.push(t.value);
      else if (t.value === ')' || t.value === ']') stack.pop();
      else if (t.value === '{') stack.push('{');
      else if (t.value === '}') stack.pop();
    }
    if (t.type === 'tmpl') {
      if (t.tmpl === 'head') stack.push('${');
      else if (t.tmpl === 'tail') stack.pop();
    }

    // Semicolon elimination: only where it is provably redundant.
    if (t.type === 'punct' && t.value === ';' && stack[stack.length - 1] !== '(') {
      const nx = nextSig(i + 1);
      if (prev && prev.type === 'punct' && prev.value === ';') {
        continue; // empty statement after a terminator
      }
      if (prev && prev.type === 'punct' && prev.value === '{' && prev.brace !== 'object') {
        continue; // `{;` -> `{`
      }
      if (prev && prev.type === 'punct' && prev.value === '}' && prev.stmtEnd) {
        continue; // `};` after a declaration or block is an empty statement
      }
      if (nx && nx.type === 'punct' && nx.value === '}' && prev && !emptyStatementBody(prev)) {
        continue; // last statement of a block needs no terminator
      }
    }

    if (prev) {
      let sep = '';
      if (pendingNl && newlineMatters(prev, t)) sep = '\n';
      else if (collides(prev, t)) sep = ' ';
      if (sep) out.push(sep);
    } else if (afterLicense && pendingNl) {
      out.push('\n');
    }
    afterLicense = false;
    out.push(t.value);
    prev = t;
    pendingNl = false;
  }
  return out.join('');
}

/** `;` directly after these tokens is an empty statement serving as the body of a control statement. */
function emptyStatementBody(prev: Token): boolean {
  if (prev.type === 'punct') {
    if (prev.value === ')' && prev.paren === 'ctrl') return true;
    if (prev.value === ':') return true;
  }
  if (prev.type === 'name' && !prev.prop && (prev.value === 'else' || prev.value === 'do')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Beautifier
// ---------------------------------------------------------------------------

export interface BeautifyOptions {
  /** 2 or 4 spaces, or 'tab'. */
  indent: 2 | 4 | 'tab';
  /** 'collapse' keeps `{` on the same line, 'expand' puts block braces on their own line. */
  braceStyle: 'collapse' | 'expand';
  /** Maximum number of consecutive blank lines preserved (0 removes them all). */
  maxBlankLines: number;
  /** Pad the inside of parentheses: `( a, b )`. */
  spaceInParens: boolean;
  keepComments: boolean;
  /** Soft line width: arrays, objects and argument lists that fit stay on one line. */
  printWidth: number;
}

export const DEFAULT_BEAUTIFY: BeautifyOptions = {
  indent: 2,
  braceStyle: 'collapse',
  maxBlankLines: 1,
  spaceInParens: false,
  keepComments: true,
  printWidth: 80,
};

/** Drop comments, carrying their newline information over to the next token. */
function stripComments(toks: Token[]): Token[] {
  const out: Token[] = [];
  let carryNl = false;
  let carryBlank = 0;
  for (const t of toks) {
    if (t.type === 'lcomment' || t.type === 'bcomment') {
      if (t.nl) carryNl = true;
      carryBlank = Math.max(carryBlank, t.blank);
      if (t.type === 'lcomment' || /[\n\r\u2028\u2029]/.test(t.value)) carryNl = true;
      continue;
    }
    if (carryNl || carryBlank) {
      out.push({ ...t, nl: t.nl || carryNl, blank: Math.max(t.blank, carryBlank) });
    } else {
      out.push(t);
    }
    carryNl = false;
    carryBlank = 0;
  }
  return out;
}

/** Re-number tokens and fix `match` pointers after tokens were removed. */
function reindex(toks: Token[]): Token[] {
  const map = new Map<number, number>();
  toks.forEach((t, i) => map.set(t.idx, i));
  return toks.map((t, i) => {
    const c: Token = { ...t, idx: i };
    if (t.match !== undefined) {
      const m = map.get(t.match);
      if (m !== undefined) c.match = m;
      else delete c.match;
    }
    return c;
  });
}

const BINARY_PUNCT = new Set([
  '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '**', '&', '|', '^',
  '&&', '||', '??', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%=', '**=', '&=', '|=', '^=', '<<=',
  '>>=', '>>>=', '&&=', '||=', '??=', '=>',
]);

function isBinaryOp(t: Token): boolean {
  if (t.type === 'punct') {
    if (t.value === '+' || t.value === '-') return !t.unary;
    if (t.value === '*') return t.star === undefined;
    return BINARY_PUNCT.has(t.value);
  }
  return t.type === 'name' && !t.prop && (t.value === 'in' || t.value === 'instanceof');
}

function isOpener(t: Token): boolean {
  return t.type === 'punct' && (t.value === '(' || t.value === '[' || t.value === '{');
}

function isCloser(t: Token): boolean {
  return t.type === 'punct' && (t.value === ')' || t.value === ']' || t.value === '}');
}

/** Does a space belong between consecutive significant tokens p and t in a flat, single-line layout? */
function spaceBetween(p: Token, t: Token, o: BeautifyOptions): boolean {
  if (collides(p, t)) return true;
  // template pieces glue to their substitutions
  if (t.type === 'tmpl' && (t.tmpl === 'middle' || t.tmpl === 'tail')) return false;
  if (p.type === 'tmpl' && (p.tmpl === 'head' || p.tmpl === 'middle')) return false;

  if (p.type === 'punct') {
    switch (p.value) {
      case '(':
        return o.spaceInParens && !isPunct(t, ')');
      case '[':
        return false;
      case '{':
        return !isPunct(t, '}');
      case '.':
      case '?.':
        return false;
      case ',':
        return true;
      case ';':
        return !(isPunct(t, ';') || isPunct(t, ')'));
      case '!':
      case '~':
      case '...':
      case '@':
      case '#':
        return false;
      case '++':
      case '--':
        if (!p.postfix) return false;
        break;
      case '+':
      case '-':
        if (p.unary) return false;
        break;
      case '*':
        if (p.star === 'method') return false;
        if (p.star === 'fn' || p.star === 'yield') return true;
        break;
      default:
        break;
    }
  }

  if (t.type === 'tmpl') return !endsExpr(p); // tagged template: tag`...`
  if (t.type === 'punct') {
    switch (t.value) {
      case ',':
      case ';':
      case '.':
      case '?.':
      case ']':
        return false;
      case ')':
        return o.spaceInParens && !isPunct(p, '(');
      case '}':
        return !isPunct(p, '{');
      case '(': {
        if (p.type === 'name') return !p.prop && SPACE_BEFORE_PAREN.has(p.value);
        if (p.type === 'punct') {
          if (p.value === ')' || p.value === ']') return false;
          if (p.value === '}') return !!p.stmtEnd;
          if (p.value === '++' || p.value === '--') return false;
          return true;
        }
        if (p.type === 'str' || p.type === 'num' || p.type === 'regex') return false;
        return true;
      }
      case '[':
        return !endsExpr(p);
      case ':':
        return t.colon === 'ternary';
      case '++':
      case '--':
        return !t.postfix;
      case '*':
        return !(t.star === 'fn' || t.star === 'yield');
      default:
        return true;
    }
  }
  return true;
}

class Out {
  private lines: string[] = [];
  cur = '';
  started = false;
  want = 0;
  sp = false;
  readonly unit: string;
  readonly tabWidth: number;
  readonly maxBlank: number;
  constructor(o: BeautifyOptions) {
    this.unit = o.indent === 'tab' ? '\t' : ' '.repeat(o.indent);
    this.tabWidth = o.indent === 'tab' ? 4 : o.indent;
    this.maxBlank = o.maxBlankLines;
  }
  nl(n = 1): void {
    if (n > this.want) this.want = n;
  }
  /** Column the next token would start at (ignoring any queued line break). */
  column(): number {
    if (this.want > 0 || !this.started) return 0;
    const nlPos = this.cur.lastIndexOf('\n');
    let col = this.cur.length - (nlPos + 1);
    if (nlPos < 0 && this.unit === '\t') {
      const lead = /^\t*/.exec(this.cur);
      col += (lead ? lead[0].length : 0) * (this.tabWidth - 1);
    }
    return col + (this.sp ? 1 : 0);
  }
  put(text: string, level: number): void {
    if (this.want > 0 && (this.started || this.lines.length > 0)) {
      if (this.started) this.lines.push(this.cur);
      const blanks = Math.min(this.want - 1, this.maxBlank);
      for (let k = 0; k < blanks; k++) this.lines.push('');
      this.cur = '';
      this.started = false;
    }
    this.want = 0;
    if (!this.started) {
      this.cur = this.unit.repeat(Math.max(0, level)) + text;
      this.started = true;
    } else {
      this.cur += (this.sp ? ' ' : '') + text;
    }
    this.sp = false;
  }
  result(): string {
    const all = this.started ? [...this.lines, this.cur] : this.lines;
    return all.join('\n');
  }
}

type FrameKind = 'program' | 'block' | 'switch' | 'class' | 'object' | 'array' | 'paren' | 'tmpl';

interface Frame {
  kind: FrameKind;
  open: Token | null;
  /** The group's content is laid out over several lines. */
  expanded: boolean;
  /** Arrays of plain values wrap like text instead of one element per line. */
  fill: boolean;
  /** Inside a template substitution: never break lines. */
  inline: boolean;
  empty: boolean;
  caseOpen: boolean;
  /** Indent level of the line the group opens on. */
  base: number;
  savedLvl: number;
  savedCont: number;
}

class Formatter {
  toks: Token[];
  o: BeautifyOptions;
  out: Out;
  frames: Frame[] = [];
  /** Block nesting level. */
  lvl = 0;
  /** Extra indent (0 or 1) for continuation lines of the current statement. */
  cont = 0;
  /** Prefix sums: flat width of tokens and count of "must break" constructs. */
  W: number[] = [];
  F: number[] = [];
  /** Previous significant token that was written. */
  p: Token | null = null;
  /** An inline block comment was just written: keep a space after it. */
  inlineComment = false;
  /** A comment was written since the last significant token. */
  commentSinceP = false;

  constructor(toks: Token[], o: BeautifyOptions) {
    this.toks = toks;
    this.o = o;
    this.out = new Out(o);
  }

  top(): Frame {
    return this.frames[this.frames.length - 1] as Frame;
  }

  private isSigAt(k: number): boolean {
    const t = this.toks[k];
    return !!t && t.type !== 'lcomment' && t.type !== 'bcomment';
  }

  private nextSig(k: number): Token | null {
    for (let j = k + 1; j < this.toks.length; j++) {
      if (this.isSigAt(j)) return this.toks[j] ?? null;
    }
    return null;
  }

  private prevSig(k: number): Token | null {
    for (let j = k - 1; j >= 0; j--) {
      if (this.isSigAt(j)) return this.toks[j] ?? null;
    }
    return null;
  }

  private prepare(): void {
    const { toks, o } = this;
    this.W = new Array<number>(toks.length + 1).fill(0);
    this.F = new Array<number>(toks.length + 1).fill(0);
    let prev: Token | null = null;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i] as Token;
      let w = t.value.length;
      let f = 0;
      if (t.type === 'lcomment') {
        f = 1;
      } else if (t.type === 'bcomment') {
        if (/[\n\r\u2028\u2029]/.test(t.value)) f = 1;
      } else {
        if (prev && spaceBetween(prev, t, o)) w += 1;
        if (t.type === 'tmpl' && /[\n\r\u2028\u2029]/.test(t.value)) f = 1;
        if (t.type === 'punct' && t.value === '{' && t.match !== undefined) {
          const nonEmpty = toks[i + 1]?.idx !== t.match;
          if (nonEmpty && t.brace !== 'object') f = 1;
          else if (nonEmpty && t.brace === 'object') {
            const nx = this.nextSig(i);
            if (nx && nx.nl) f = 1; // an object written over several lines in the source stays expanded
          }
        }
        prev = t;
      }
      this.W[i + 1] = (this.W[i] ?? 0) + w;
      this.F[i + 1] = (this.F[i] ?? 0) + f;
    }
  }

  private flatWidth(open: number, close: number): number {
    const t = this.toks[open] as Token;
    const p = this.prevSig(open);
    const lead = p && spaceBetween(p, t, this.o) ? 1 : 0;
    return (this.W[close + 1] ?? 0) - (this.W[open] ?? 0) - lead;
  }

  private forced(open: number, close: number): boolean {
    return (this.F[close + 1] ?? 0) - (this.F[open] ?? 0) > 0;
  }

  private statementLevel(f: Frame): boolean {
    return f.kind === 'program' || f.kind === 'block' || f.kind === 'switch' || f.kind === 'class';
  }

  run(): string {
    this.prepare();
    this.frames.push({
      kind: 'program', open: null, expanded: true, fill: false, inline: false, empty: false,
      caseOpen: false, base: 0, savedLvl: 0, savedCont: 0,
    });
    for (let i = 0; i < this.toks.length; i++) {
      const t = this.toks[i] as Token;
      if (t.type === 'lcomment' || t.type === 'bcomment') {
        this.comment(t, i);
      } else if (t.type === 'hashbang') {
        this.out.put(t.value, 0);
        this.out.nl(1);
      } else {
        this.token(t, i);
      }
    }
    const res = this.out.result();
    return res.length ? res + '\n' : '';
  }

  // -- comments ---------------------------------------------------------------

  private reindentBlockComment(text: string, level: number): string {
    const lines = text.split(/\r\n|[\n\r\u2028\u2029]/);
    if (lines.length < 2) return text;
    const rest = lines.slice(1);
    if (!rest.every((l) => /^\s*\*/.test(l))) return lines.join('\n');
    const ind = this.out.unit.repeat(Math.max(0, level));
    return [lines[0], ...rest.map((l) => `${ind} ${l.trim()}`)].join('\n');
  }

  private comment(c: Token, i: number): void {
    const out = this.out;
    const f = this.top();
    const p = this.p;
    let level = this.lvl + this.cont;
    const isLine = c.type === 'lcomment';
    // a comment right before `case`/`default` belongs to the label, not to the previous case body
    if (f.kind === 'switch' && f.caseOpen) {
      const nx = this.nextSig(i);
      if (nx && nx.type === 'name' && !nx.prop && (nx.value === 'case' || nx.value === 'default')) level -= 1;
    }
    let text = isLine ? c.value.replace(/\s+$/, '') : c.value;
    if (!isLine && /[\n\r\u2028\u2029]/.test(text)) text = this.reindentBlockComment(text, level);
    const wasOpener = !!p && f.open === p && !this.commentSinceP;
    this.commentSinceP = true;

    if (f.inline) {
      if (p && !isOpener(p)) out.sp = true;
      out.put(text, level);
      if (isLine) out.nl(1);
      else this.inlineComment = true;
      return;
    }
    const own = c.nl || !p;
    const next = this.toks[i + 1];
    if (own) {
      if (out.started) out.nl(wasOpener ? 1 : this.breaks(c.blank));
      out.put(text, level);
      if (isLine || (next && next.nl)) out.nl(1);
      else this.inlineComment = true;
      return;
    }
    // trailing comment: stays on the line of the previous token
    const pending = out.want;
    out.want = 0;
    if (p && (isLine || !(isPunct(p, '(') || isPunct(p, '[')))) out.sp = true;
    out.put(text, level);
    if (isLine) out.nl(1);
    else if (pending > 0) out.nl(pending);
    else this.inlineComment = true;
  }

  // -- tokens -----------------------------------------------------------------

  private token(t: Token, i: number): void {
    const out = this.out;
    const p = this.p;

    if (isCloser(t) || (t.type === 'tmpl' && (t.tmpl === 'middle' || t.tmpl === 'tail'))) {
      this.closeToken(t);
      return;
    }

    let f = this.top();
    if (p && t.type === 'name' && !t.prop && (t.value === 'case' || t.value === 'default') && f.kind === 'switch') {
      const nx = this.nextSig(i);
      if (t.value === 'case' || isPunct(nx, ':')) {
        if (f.caseOpen) {
          this.lvl -= 1;
          f.caseOpen = false;
        }
        out.nl(isPunct(p, '{') ? 1 : this.breaks(t.blank));
        this.cont = 0;
      }
    }

    if (p) this.separate(p, t, f);
    out.put(t.value, this.lvl + this.cont);
    this.p = t;
    this.commentSinceP = false;

    if (t.type === 'tmpl' && t.tmpl === 'head') {
      this.frames.push({
        kind: 'tmpl', open: t, expanded: false, fill: false, inline: true, empty: false,
        caseOpen: false, base: this.lvl + this.cont, savedLvl: this.lvl, savedCont: this.cont,
      });
      return;
    }
    if (t.type !== 'punct') return;
    if (t.value === '(' || t.value === '[' || t.value === '{') {
      this.openFrame(t, i);
      return;
    }
    f = this.top();
    if (f.inline) return;
    if (t.value === ':' && t.colon === 'case' && f.kind === 'switch') {
      const nx = this.nextSig(i);
      f.caseOpen = !isPunct(nx, '{');
      if (f.caseOpen) {
        this.lvl += 1;
        out.nl(1);
      }
      this.cont = 0;
    } else if (t.value === ';' && this.statementLevel(f)) {
      out.nl(1);
      this.cont = 0;
    }
  }

  private openFrame(t: Token, i: number): void {
    const out = this.out;
    const o = this.o;
    const parent = this.top();
    const close = t.match;
    const empty = close !== undefined && this.toks[i + 1]?.idx === close;
    const level = this.lvl + this.cont;
    const frame: Frame = {
      kind: 'paren', open: t, expanded: false, fill: false, inline: parent.inline, empty,
      caseOpen: false, base: level, savedLvl: this.lvl, savedCont: this.cont,
    };
    const startCol = out.column() - t.value.length;
    const fitsFlat = (): boolean => close !== undefined && startCol + this.flatWidth(i, close) + 2 <= o.printWidth;
    if (t.value === '(') {
      frame.kind = 'paren';
      if (!empty && !frame.inline && close !== undefined && t.paren !== 'ctrl') {
        // wrap long argument lists one per line, but leave short ones alone (long call chains stay as written)
        if (
          !this.forced(i, close) &&
          !fitsFlat() &&
          this.flatWidth(i, close) > Math.floor(o.printWidth * 0.4) &&
          this.hasTopLevelComma(i, close)
        ) {
          frame.expanded = true;
        }
      }
    } else if (t.value === '[') {
      frame.kind = 'array';
      if (!empty && !frame.inline && close !== undefined) {
        if (this.forced(i, close)) frame.expanded = true;
        else if (!fitsFlat()) {
          frame.expanded = true;
          frame.fill = this.simpleElements(i, close);
        }
      }
    } else {
      const kind = t.brace ?? 'block';
      if (kind === 'object') {
        frame.kind = 'object';
        if (!empty && !frame.inline && close !== undefined) {
          if (this.forced(i, close) || !fitsFlat()) frame.expanded = true;
        }
      } else {
        frame.kind = kind === 'switch' ? 'switch' : kind === 'class' ? 'class' : 'block';
        frame.expanded = !empty && !frame.inline;
      }
    }
    this.frames.push(frame);
    if (frame.expanded) {
      this.lvl = level + 1;
      this.cont = 0;
      out.nl(1);
    }
  }

  private hasTopLevelComma(open: number, close: number): boolean {
    let depth = 0;
    for (let k = open + 1; k < close; k++) {
      const t = this.toks[k];
      if (!t) continue;
      if (t.type === 'tmpl') {
        if (t.tmpl === 'head') depth++;
        else if (t.tmpl === 'tail') depth--;
        continue;
      }
      if (t.type !== 'punct') continue;
      if (t.value === '(' || t.value === '[' || t.value === '{') depth++;
      else if (t.value === ')' || t.value === ']' || t.value === '}') depth--;
      else if (t.value === ',' && depth === 0) return true;
    }
    return false;
  }

  /** Array of plain literals / identifiers, which can be wrapped like text. */
  private simpleElements(open: number, close: number): boolean {
    let k = open + 1;
    let expect = true;
    while (k < close) {
      let t = this.toks[k];
      if (!t || t.type === 'lcomment' || t.type === 'bcomment') return false;
      if (expect) {
        if (t.type === 'punct' && (t.value === '-' || t.value === '+')) {
          k++;
          t = this.toks[k];
        }
        if (!t || !(t.type === 'num' || t.type === 'str' || (t.type === 'name' && endsExpr(t)))) return false;
        expect = false;
      } else {
        if (!isPunct(t, ',')) return false;
        expect = true;
      }
      k++;
    }
    return true;
  }

  private closeToken(t: Token): void {
    const out = this.out;
    const o = this.o;
    const isTmpl = t.type === 'tmpl';
    const want: FrameKind[] = isTmpl
      ? ['tmpl']
      : t.value === ')'
        ? ['paren']
        : t.value === ']'
          ? ['array']
          : ['block', 'switch', 'class', 'object'];
    // tolerate unbalanced input: discard frames until one of the right kind is found
    let k = this.frames.length - 1;
    while (k > 0 && !want.includes((this.frames[k] as Frame).kind)) k--;
    if (k <= 0) {
      if (this.p && spaceBetween(this.p, t, o)) out.sp = true;
      out.put(t.value, this.lvl + this.cont);
      this.p = t;
      return;
    }
    this.frames.length = k + 1;
    const f = this.frames.pop() as Frame;

    if (isTmpl && t.tmpl === 'middle') {
      // closes one substitution and opens the next: same frame stays
      this.frames.push(f);
      out.sp = false;
      out.put(t.value, this.lvl + this.cont);
      this.p = t;
      return;
    }
    if (f.caseOpen) this.lvl -= 1;
    if (f.expanded) {
      out.nl(1);
      out.sp = false;
      out.put(t.value, f.base);
    } else {
      out.sp = !f.empty && !isTmpl && !!this.p && spaceBetween(this.p, t, o);
      if (this.inlineComment) {
        this.inlineComment = false;
        out.sp = t.value === '}';
      }
      out.put(t.value, this.lvl + this.cont);
    }
    this.lvl = f.savedLvl;
    this.cont = f.savedCont;
    this.p = t;
    if (t.type === 'punct' && t.value === '}' && t.stmtEnd && !f.inline) this.cont = 0;
  }

  /** Decide the whitespace between p and t (mutates `out`). */
  private separate(p: Token, t: Token, f: Frame): void {
    const out = this.out;
    const o = this.o;
    let space = spaceBetween(p, t, o);
    const afterInline = this.inlineComment;
    if (afterInline) {
      this.inlineComment = false;
      if (!isCloser(t) && !isPunct(t, ',') && !isPunct(t, ';')) space = true;
    }
    if (f.inline) {
      out.sp = space;
      return;
    }
    if (afterInline && !t.nl && out.want === 0) {
      out.sp = space;
      return;
    }
    const stmt = this.statementLevel(f);
    let nl = 0;
    let cont = this.cont;

    // 1. breaks that follow particular tokens
    if (p.type === 'punct') {
      if (p.value === '}' && p.stmtEnd && stmt) {
        const elseLike = t.type === 'name' && !t.prop && (t.value === 'else' || t.value === 'catch' || t.value === 'finally');
        const doWhile = !!p.doBody && isWord(t, 'while');
        if (!((elseLike && o.braceStyle === 'collapse') || doWhile) &&
            !(isCloser(t) || isPunct(t, ',') || isPunct(t, ';') || isPunct(t, '.') || isPunct(t, '?.'))) {
          nl = 1;
          cont = 0;
        }
      } else if (p.value === ',' && f.expanded && (f.kind === 'object' || f.kind === 'array' || f.kind === 'paren')) {
        if (!f.fill) nl = 1;
        else {
          const nx2 = isPunct(t, '-') || isPunct(t, '+') ? 1 : 0;
          const width = t.value.length + (nx2 ? 1 : 0);
          if (out.column() + 1 + width + 1 > o.printWidth) nl = 1;
        }
      }
    }
    // 2. line breaks that exist in the source and matter (ASI) or that we preserve (chains, operators)
    if (nl === 0 && t.nl && stmt) {
      if (newlineMatters(p, t)) {
        nl = 1;
        cont = this.continues(t) ? Math.max(cont, 1) : 0;
      } else if (this.preservable(p, t) || this.bracelessBody(p, t) || isPunct(p, ',')) {
        nl = 1;
        cont = Math.max(cont, 1);
      }
    }
    // 3. brace style
    if (o.braceStyle === 'expand' && stmt) {
      if (isPunct(t, '{') && t.brace && t.brace !== 'object' && !isPunct(p, '=>')) nl = Math.max(nl, 1);
      else if (isPunct(p, '}') && p.stmtEnd && t.type === 'name' && !t.prop &&
        (t.value === 'else' || t.value === 'catch' || t.value === 'finally')) nl = 1;
    }

    const breaking = nl > 0 || out.want > 0;
    if (breaking) {
      if (nl > 0) out.nl(nl);
      if (t.blank >= 2 && o.maxBlankLines > 0 && this.canHaveBlank(p, f, cont)) out.nl(this.breaks(t.blank));
      this.cont = cont;
      out.sp = false;
    } else {
      out.sp = space;
    }
  }

  /** Number of line breaks to request before a token that was preceded by `blank` newlines in the source. */
  private breaks(blank: number): number {
    return 1 + Math.min(Math.max(blank - 1, 0), this.o.maxBlankLines);
  }

  private canHaveBlank(p: Token, f: Frame, cont: number): boolean {
    if (f.open === p && !this.commentSinceP) return false;
    if (isPunct(p, '(') || isPunct(p, '[')) return false;
    if (this.statementLevel(f)) return cont === 0;
    return f.expanded && isPunct(p, ',');
  }

  /** Is the token a continuation of an expression (no ASI), when found at the start of a line? */
  private continues(t: Token): boolean {
    if (t.type === 'punct') {
      return ['(', '[', '+', '-', '/', '/=', '.', '?.', '?', ':'].includes(t.value) || isBinaryOp(t);
    }
    if (t.type === 'tmpl') return true;
    return t.type === 'name' && !t.prop && (t.value === 'in' || t.value === 'instanceof');
  }

  /** `if (x)` / `else` followed by a newline and a statement without braces. */
  private bracelessBody(p: Token, t: Token): boolean {
    if (isPunct(t, '{')) return false;
    if (isPunct(p, ')') && p.paren === 'ctrl') return p.ctrlKw !== 'dowhile';
    return p.type === 'name' && !p.prop && (p.value === 'else' || p.value === 'do');
  }

  private preservable(p: Token, t: Token): boolean {
    if (t.type === 'punct') {
      if (t.value === '.' || t.value === '?.' || t.value === '?') return true;
      if (t.value === ':' && t.colon === 'ternary') return true;
      if (isBinaryOp(t)) return true;
    }
    if (t.type === 'name' && !t.prop && (t.value === 'in' || t.value === 'instanceof')) return true;
    if (p.type === 'punct') {
      if (isBinaryOp(p)) return true;
      if (p.value === '?' || (p.value === ':' && p.colon === 'ternary')) return true;
    }
    return false;
  }
}

export function beautify(src: string, options: Partial<BeautifyOptions> = {}): string {
  const o: BeautifyOptions = { ...DEFAULT_BEAUTIFY, ...options };
  o.maxBlankLines = Math.max(0, Math.min(10, Math.floor(o.maxBlankLines)));
  let toks = tokenize(src);
  if (!o.keepComments) toks = stripComments(toks);
  toks = reindex(toks);
  return new Formatter(toks, o).run();
}

// ---------------------------------------------------------------------------
// Helpers for the UI
// ---------------------------------------------------------------------------

export function byteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}
