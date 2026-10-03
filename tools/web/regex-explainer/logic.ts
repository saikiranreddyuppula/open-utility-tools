/**
 * ECMAScript (ES2024 + Annex B + ES2025 modifiers / duplicate named groups) regular-expression
 * parser, plain-English explainer and heuristic linter. Pure TypeScript, no DOM.
 */

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export interface Span0 {
  start: number;
  end: number;
}

export type CharEscape = 'none' | 'control' | 'hex' | 'unicode' | 'identity' | 'octal' | 'null' | 'cx';

export interface CharNode extends Span0 {
  type: 'Char';
  cp: number;
  escape: CharEscape;
  inClass: boolean;
}
export interface DotNode extends Span0 {
  type: 'Dot';
}
export interface ClassEscapeNode extends Span0 {
  type: 'ClassEscape';
  kind: 'd' | 'D' | 'w' | 'W' | 's' | 'S';
}
export interface PropertyNode extends Span0 {
  type: 'Property';
  negated: boolean;
  name: string;
  value?: string;
}
export interface AssertionNode extends Span0 {
  type: 'Assertion';
  kind: 'start' | 'end' | 'wordBoundary' | 'notWordBoundary';
}
export interface BackrefNode extends Span0 {
  type: 'Backref';
  index?: number;
  name?: string;
}
export interface ClassRangeNode extends Span0 {
  type: 'Range';
  from: CharNode;
  to: CharNode;
}
export interface ClassStringsNode extends Span0 {
  type: 'ClassStrings';
  strings: string[];
}
export type ClassItem = CharNode | ClassRangeNode | ClassEscapeNode | PropertyNode | ClassNode | ClassStringsNode;
export interface ClassNode extends Span0 {
  type: 'Class';
  negated: boolean;
  /** Set operation between items (v flag only; `union` otherwise). */
  op: 'union' | 'intersection' | 'subtraction';
  items: ClassItem[];
  vMode: boolean;
  nested: boolean;
}
export type GroupKind =
  | 'capture'
  | 'named'
  | 'noncapture'
  | 'lookahead'
  | 'neg-lookahead'
  | 'lookbehind'
  | 'neg-lookbehind'
  | 'modifiers';
export interface GroupNode extends Span0 {
  type: 'Group';
  kind: GroupKind;
  index?: number;
  name?: string;
  modifiers?: { add: string; remove: string };
  body: Disjunction;
  /** End offset of the opening token, e.g. after `(?<year>`. */
  openEnd: number;
  /** Offset of the closing parenthesis. */
  closeAt: number;
}
export interface QuantifiedNode extends Span0 {
  type: 'Quantified';
  atom: Atom;
  min: number;
  max: number;
  lazy: boolean;
  quantStart: number;
}
export type Atom =
  | CharNode
  | DotNode
  | ClassEscapeNode
  | PropertyNode
  | GroupNode
  | BackrefNode
  | ClassNode;
export type Term = Atom | AssertionNode | QuantifiedNode;
export interface Alternative extends Span0 {
  type: 'Alternative';
  terms: Term[];
}
export interface Disjunction extends Span0 {
  type: 'Disjunction';
  alternatives: Alternative[];
  pipes: number[];
}

export interface GroupInfo {
  index: number;
  name?: string;
  start: number;
  end: number;
  source: string;
}

export class RegexSyntaxError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'RegexSyntaxError';
    this.position = position;
  }
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export interface RegexFlags {
  d: boolean;
  g: boolean;
  i: boolean;
  m: boolean;
  s: boolean;
  u: boolean;
  v: boolean;
  y: boolean;
}

export interface FlagInfo {
  flag: string;
  name: string;
  description: string;
}

export const FLAG_INFO: Record<string, { name: string; description: string }> = {
  d: { name: 'hasIndices', description: 'Match indices: results also carry the start/end offsets of every capture group (match.indices).' },
  g: { name: 'global', description: 'Find all matches instead of stopping after the first one.' },
  i: { name: 'ignoreCase', description: 'Case-insensitive matching.' },
  m: { name: 'multiline', description: '^ and $ match at the start and end of every line, not just of the whole input.' },
  s: { name: 'dotAll', description: '"." also matches line breaks (\\n, \\r, \\u2028, \\u2029).' },
  u: { name: 'unicode', description: 'Unicode mode: match by code point, enable \\p{…} and \\u{…}, and use stricter syntax rules.' },
  v: { name: 'unicodeSets', description: 'Enhanced Unicode mode (superset of u): set operations ([A--B], [A&&B]), nested classes, \\q{…} strings and properties of strings.' },
  y: { name: 'sticky', description: 'Match only at lastIndex (the match must start exactly where the previous one ended).' },
};

export function parseFlags(flags: string): { ok: true; flags: RegexFlags } | { ok: false; error: string } {
  const out: RegexFlags = { d: false, g: false, i: false, m: false, s: false, u: false, v: false, y: false };
  for (const ch of flags) {
    if (!(ch in out)) return { ok: false, error: `Invalid flag "${ch}" (valid flags: d g i m s u v y)` };
    const k = ch as keyof RegexFlags;
    if (out[k]) return { ok: false, error: `Duplicate flag "${ch}"` };
    out[k] = true;
  }
  if (out.u && out.v) return { ok: false, error: 'Flags "u" and "v" cannot be combined' };
  return { ok: true, flags: out };
}

/** Parse `/pattern/flags` (or a bare pattern). */
export function parseRegexInput(input: string): { pattern: string; flags: string | null; literal: boolean } {
  if (input.startsWith('/') && input.length >= 2) {
    let inClass = false;
    for (let i = 1; i < input.length; i++) {
      const c = input[i];
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '\n' || c === '\r') break;
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        const flags = input.slice(i + 1);
        if (/^[dgimsuvy]*$/.test(flags)) return { pattern: input.slice(1, i), flags, literal: true };
        break;
      }
    }
  }
  return { pattern: input, flags: null, literal: false };
}

// ---------------------------------------------------------------------------
// Unicode helpers
// ---------------------------------------------------------------------------

const SYNTAX_CHARS = '^$\\.*+?()[]{}|';
const CLASS_SET_SYNTAX = '()[]{}/-\\|';
const CLASS_SET_RESERVED_PUNCT = '&-!#%,:;<=>@`~';
const CLASS_SET_DOUBLE = '&!#$%*+,.:;<=>?@^`~';
const PROPS_OF_STRINGS = new Set([
  'Basic_Emoji',
  'Emoji_Keycap_Sequence',
  'RGI_Emoji_Modifier_Sequence',
  'RGI_Emoji_Flag_Sequence',
  'RGI_Emoji_Tag_Sequence',
  'RGI_Emoji_ZWJ_Sequence',
  'RGI_Emoji',
]);

let vSupported: boolean | null = null;
export function runtimeSupportsV(): boolean {
  if (vSupported === null) {
    try {
      new RegExp('', 'v');
      vSupported = true;
    } catch {
      vSupported = false;
    }
  }
  return vSupported;
}

const propCache = new Map<string, boolean>();
function isValidProperty(name: string, value: string | undefined, negated: boolean, vMode: boolean): boolean {
  const body = value === undefined ? name : `${name}=${value}`;
  const flags = vMode && runtimeSupportsV() ? 'v' : 'u';
  const key = `${negated ? 'P' : 'p'}|${flags}|${body}`;
  const cached = propCache.get(key);
  if (cached !== undefined) return cached;
  let ok: boolean;
  try {
    new RegExp(`\\${negated ? 'P' : 'p'}{${body}}`, flags);
    ok = true;
  } catch {
    ok = false;
  }
  propCache.set(key, ok);
  return ok;
}

const ID_START = /^[\p{ID_Start}$_]$/u;
const ID_CONT = /^[\p{ID_Continue}$‌‍]$/u;

function isHex(c: string | undefined): boolean {
  return c !== undefined && /^[0-9a-fA-F]$/.test(c);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface PathEntry {
  id: number;
  alt: number;
}

interface ParseOutput {
  ast: Disjunction;
  groups: GroupInfo[];
  groupCount: number;
}

function prescan(src: string, vMode: boolean): { count: number; named: boolean } {
  let count = 0;
  let named = false;
  let inClass = false;
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '[') {
      if (vMode) depth++;
      else inClass = true;
    } else if (c === ']') {
      if (vMode) {
        if (depth > 0) depth--;
      } else inClass = false;
    } else if (c === '(' && !inClass && depth === 0) {
      if (src[i + 1] === '?') {
        if (src[i + 2] === '<' && src[i + 3] !== '=' && src[i + 3] !== '!') {
          count++;
          named = true;
        }
      } else count++;
    }
  }
  return { count, named };
}

class Parser {
  private pos = 0;
  private readonly len: number;
  private readonly u: boolean;
  private readonly v: boolean;
  private readonly total: number;
  private readonly hasNamed: boolean;
  private groupCount = 0;
  private disjId = 0;
  private altPath: PathEntry[] = [];
  private groups: GroupInfo[] = [];
  private names = new Map<string, PathEntry[][]>();
  private namedRefs: BackrefNode[] = [];

  constructor(private readonly src: string, flags: RegexFlags) {
    this.len = src.length;
    this.v = flags.v;
    this.u = flags.u || flags.v;
    const scan = prescan(src, this.v);
    this.total = scan.count;
    this.hasNamed = scan.named;
  }

  parse(): ParseOutput {
    const ast = this.parseDisjunction();
    if (this.pos < this.len) {
      // only an unmatched ")" can stop the top-level disjunction early
      throw new RegexSyntaxError("Unmatched ')'", this.pos);
    }
    for (const ref of this.namedRefs) {
      if (!this.names.has(ref.name ?? '')) {
        throw new RegexSyntaxError('Invalid named capture referenced', ref.start);
      }
    }
    return { ast, groups: this.groups.slice().sort((a, b) => a.index - b.index), groupCount: this.groupCount };
  }

  // -- helpers -------------------------------------------------------------

  private peek(o = 0): string {
    return this.src[this.pos + o] ?? '';
  }

  private err(message: string, at = this.pos): RegexSyntaxError {
    return new RegexSyntaxError(message, at);
  }

  private startsWith(s: string): boolean {
    return this.src.startsWith(s, this.pos);
  }

  /** Read one source character (a full code point in unicode mode). */
  private readChar(): { cp: number; len: number } {
    const cu = this.src.charCodeAt(this.pos);
    if (this.u && cu >= 0xd800 && cu <= 0xdbff && this.pos + 1 < this.len) {
      const lo = this.src.charCodeAt(this.pos + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        return { cp: ((cu - 0xd800) << 10) + (lo - 0xdc00) + 0x10000, len: 2 };
      }
    }
    return { cp: cu, len: 1 };
  }

  private bracedQuantifierAt(pos: number): { min: number; max: number; len: number } | null {
    const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(this.src.slice(pos, pos + 64));
    if (!m) return null;
    const min = Number(m[1]);
    const max = m[2] ? (m[3] === '' ? Infinity : Number(m[3])) : min;
    return { min, max, len: m[0].length };
  }

  // -- structure -----------------------------------------------------------

  private parseDisjunction(): Disjunction {
    const start = this.pos;
    const id = this.disjId++;
    const alternatives: Alternative[] = [];
    const pipes: number[] = [];
    let alt = 0;
    for (;;) {
      this.altPath.push({ id, alt });
      alternatives.push(this.parseAlternative());
      this.altPath.pop();
      if (this.peek() === '|') {
        pipes.push(this.pos);
        this.pos++;
        alt++;
        continue;
      }
      break;
    }
    return { type: 'Disjunction', alternatives, pipes, start, end: this.pos };
  }

  private parseAlternative(): Alternative {
    const start = this.pos;
    const terms: Term[] = [];
    while (this.pos < this.len) {
      const c = this.peek();
      if (c === '|' || c === ')') break;
      terms.push(this.parseTerm());
    }
    return { type: 'Alternative', terms, start, end: this.pos };
  }

  private parseTerm(): Term {
    const start = this.pos;
    const c = this.peek();
    if (c === '^') {
      this.pos++;
      return { type: 'Assertion', kind: 'start', start, end: this.pos };
    }
    if (c === '$') {
      this.pos++;
      return { type: 'Assertion', kind: 'end', start, end: this.pos };
    }
    if (c === '\\' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
      const kind = this.peek(1) === 'b' ? 'wordBoundary' : 'notWordBoundary';
      this.pos += 2;
      return { type: 'Assertion', kind, start, end: this.pos };
    }
    const atom = this.parseAtom();
    if (atom.type === 'Group') {
      const quantifiable =
        atom.kind !== 'lookbehind' && atom.kind !== 'neg-lookbehind' &&
        (!this.u || (atom.kind !== 'lookahead' && atom.kind !== 'neg-lookahead'));
      if (!quantifiable) return atom;
    }
    return this.maybeQuantify(atom, start);
  }

  private maybeQuantify(atom: Atom, start: number): Term {
    const c = this.peek();
    let min: number;
    let max: number;
    const quantStart = this.pos;
    if (c === '*') {
      min = 0;
      max = Infinity;
      this.pos++;
    } else if (c === '+') {
      min = 1;
      max = Infinity;
      this.pos++;
    } else if (c === '?') {
      min = 0;
      max = 1;
      this.pos++;
    } else if (c === '{') {
      const q = this.bracedQuantifierAt(this.pos);
      if (!q) return atom;
      if (q.min > q.max) throw this.err('numbers out of order in {} quantifier', this.pos);
      min = q.min;
      max = q.max;
      this.pos += q.len;
    } else {
      return atom;
    }
    let lazy = false;
    if (this.peek() === '?') {
      lazy = true;
      this.pos++;
    }
    return { type: 'Quantified', atom, min, max, lazy, quantStart, start, end: this.pos };
  }

  private parseAtom(): Atom {
    const start = this.pos;
    const c = this.peek();
    switch (c) {
      case '.':
        this.pos++;
        return { type: 'Dot', start, end: this.pos };
      case '(':
        return this.parseGroup();
      case '[':
        return this.parseClass(false);
      case '\\':
        return this.parseAtomEscape();
      case '*':
      case '+':
      case '?':
        throw this.err('Nothing to repeat');
      case '{': {
        if (this.bracedQuantifierAt(this.pos)) throw this.err('Nothing to repeat');
        if (this.u) throw this.err('Incomplete quantifier');
        this.pos++;
        return { type: 'Char', cp: 0x7b, escape: 'none', inClass: false, start, end: this.pos };
      }
      case '}':
      case ']': {
        if (this.u) throw this.err('Lone quantifier brackets');
        this.pos++;
        return { type: 'Char', cp: c.charCodeAt(0), escape: 'none', inClass: false, start, end: this.pos };
      }
      default: {
        const ch = this.readChar();
        this.pos += ch.len;
        return { type: 'Char', cp: ch.cp, escape: 'none', inClass: false, start, end: this.pos };
      }
    }
  }

  // -- groups --------------------------------------------------------------

  private parseGroup(): GroupNode {
    const start = this.pos;
    this.pos++; // (
    let kind: GroupKind = 'capture';
    let name: string | undefined;
    let modifiers: { add: string; remove: string } | undefined;
    if (this.peek() === '?') {
      const n1 = this.peek(1);
      if (n1 === ':') {
        kind = 'noncapture';
        this.pos += 2;
      } else if (n1 === '=') {
        kind = 'lookahead';
        this.pos += 2;
      } else if (n1 === '!') {
        kind = 'neg-lookahead';
        this.pos += 2;
      } else if (n1 === '<') {
        const n2 = this.peek(2);
        if (n2 === '=') {
          kind = 'lookbehind';
          this.pos += 3;
        } else if (n2 === '!') {
          kind = 'neg-lookbehind';
          this.pos += 3;
        } else {
          kind = 'named';
          this.pos += 2;
          name = this.parseGroupName();
        }
      } else {
        const m = /^\?([a-z]*)(?:-([a-z]*))?:/.exec(this.src.slice(this.pos, this.pos + 16));
        if (!m) throw this.err('Invalid group', this.pos);
        const add = m[1] ?? '';
        const remove = m[2] ?? '';
        const all = add + remove;
        if (
          all.length === 0 ||
          !/^[ims]*$/.test(all) ||
          new Set(all).size !== all.length
        ) {
          throw this.err('Invalid group', this.pos);
        }
        kind = 'modifiers';
        modifiers = { add, remove };
        this.pos += m[0].length;
      }
    }
    let index: number | undefined;
    if (kind === 'capture' || kind === 'named') {
      index = ++this.groupCount;
      if (name !== undefined) this.registerName(name, start);
    }
    const openEnd = this.pos;
    const body = this.parseDisjunction();
    if (this.peek() !== ')') throw this.err('Unterminated group', start);
    const closeAt = this.pos;
    this.pos++;
    if (index !== undefined) {
      this.groups.push({ index, name, start, end: this.pos, source: this.src.slice(start, this.pos) });
    }
    return { type: 'Group', kind, index, name, modifiers, body, openEnd, closeAt, start, end: this.pos };
  }

  private registerName(name: string, at: number): void {
    const path = this.altPath.slice();
    const existing = this.names.get(name);
    if (existing) {
      for (const other of existing) {
        if (mightBothParticipate(path, other)) throw this.err('Duplicate capture group name', at);
      }
      existing.push(path);
    } else {
      this.names.set(name, [path]);
    }
  }

  /** Reads `name>` (pos is right after `<`). */
  private parseGroupName(): string {
    const begin = this.pos;
    const cps: number[] = [];
    for (;;) {
      if (this.pos >= this.len) throw this.err('Invalid capture group name', begin);
      const c = this.peek();
      if (c === '>') {
        this.pos++;
        break;
      }
      let cp: number;
      if (c === '\\') {
        if (this.peek(1) !== 'u') throw this.err('Invalid capture group name', begin);
        this.pos += 2;
        const v = this.readUnicodeEscapeBody(true, true);
        if (v === null) throw this.err('Invalid Unicode escape', this.pos);
        cp = v;
      } else {
        const cu = this.src.codePointAt(this.pos) ?? 0;
        cp = cu;
        this.pos += cu > 0xffff ? 2 : 1;
      }
      cps.push(cp);
    }
    if (cps.length === 0) throw this.err('Invalid capture group name', begin);
    // combine escaped surrogate pairs
    const str = String.fromCodePoint(...cps.map((x) => (x > 0x10ffff ? 0xfffd : x)));
    const chars = Array.from(str);
    chars.forEach((ch, i) => {
      if (!(i === 0 ? ID_START.test(ch) : ID_CONT.test(ch))) throw this.err('Invalid capture group name', begin);
    });
    return str;
  }

  // -- escapes -------------------------------------------------------------

  /**
   * pos is just after `\u`. Returns the code point or null (and restores pos) when malformed.
   * `braces`: allow `\u{…}`; `pairs`: combine surrogate pairs.
   */
  private readUnicodeEscapeBody(braces: boolean, pairs: boolean): number | null {
    const save = this.pos;
    if (braces && this.peek() === '{') {
      let i = this.pos + 1;
      let digits = '';
      while (isHex(this.src[i])) digits += this.src[i++];
      if (digits.length > 0 && this.src[i] === '}') {
        const cp = parseInt(digits, 16);
        if (cp > 0x10ffff) throw this.err('Invalid Unicode escape', save - 2);
        this.pos = i + 1;
        return cp;
      }
      this.pos = save;
      return null;
    }
    const hex4 = this.src.slice(this.pos, this.pos + 4);
    if (/^[0-9a-fA-F]{4}$/.test(hex4)) {
      let cp = parseInt(hex4, 16);
      this.pos += 4;
      if (pairs && cp >= 0xd800 && cp <= 0xdbff && this.src.startsWith('\\u', this.pos)) {
        const lo4 = this.src.slice(this.pos + 2, this.pos + 6);
        if (/^[0-9a-fA-F]{4}$/.test(lo4)) {
          const lo = parseInt(lo4, 16);
          if (lo >= 0xdc00 && lo <= 0xdfff) {
            cp = ((cp - 0xd800) << 10) + (lo - 0xdc00) + 0x10000;
            this.pos += 6;
          }
        }
      }
      return cp;
    }
    this.pos = save;
    return null;
  }

  /**
   * Shared CharacterEscape handling. pos is just after the backslash, `start` the offset of the backslash.
   * Handles f n r t v, c, 0, x, u and identity escapes (everything else is the caller's job).
   */
  private parseCharacterEscape(start: number, inClass: boolean): CharNode {
    const c = this.peek();
    const mk = (cp: number, escape: CharEscape): CharNode => ({ type: 'Char', cp, escape, inClass, start, end: this.pos });
    switch (c) {
      case 'f':
        this.pos++;
        return mk(0x0c, 'control');
      case 'n':
        this.pos++;
        return mk(0x0a, 'control');
      case 'r':
        this.pos++;
        return mk(0x0d, 'control');
      case 't':
        this.pos++;
        return mk(0x09, 'control');
      case 'v':
        this.pos++;
        return mk(0x0b, 'control');
      case 'c': {
        const l = this.peek(1);
        if (/^[A-Za-z]$/.test(l)) {
          this.pos += 2;
          return mk(l.charCodeAt(0) % 32, 'cx');
        }
        if (this.u) throw this.err('Invalid unicode escape', start);
        if (inClass && /^[0-9_]$/.test(l)) {
          this.pos += 2;
          return mk(l.charCodeAt(0) % 32, 'cx');
        }
        // "\c" is a literal backslash followed by "c"
        return { type: 'Char', cp: 0x5c, escape: 'none', inClass, start, end: start + 1 };
      }
      case '0': {
        const n = this.peek(1);
        if (!/^[0-9]$/.test(n)) {
          this.pos++;
          return mk(0, 'null');
        }
        if (this.u) throw this.err('Invalid decimal escape', start);
        return this.legacyOctal(start, inClass);
      }
      case 'x': {
        const h = this.src.slice(this.pos + 1, this.pos + 3);
        if (/^[0-9a-fA-F]{2}$/.test(h)) {
          this.pos += 3;
          return mk(parseInt(h, 16), 'hex');
        }
        if (this.u) throw this.err('Invalid escape', start);
        this.pos++;
        return mk(0x78, 'identity');
      }
      case 'u': {
        this.pos++;
        const cp = this.readUnicodeEscapeBody(this.u, this.u);
        if (cp !== null) return mk(cp, 'unicode');
        if (this.u) throw this.err('Invalid Unicode escape', start);
        return mk(0x75, 'identity');
      }
      default: {
        if (this.pos >= this.len) throw this.err('\\ at end of pattern', start);
        const ch = this.readChar();
        const s = String.fromCodePoint(ch.cp);
        if (this.u) {
          if (!(SYNTAX_CHARS.includes(s) || s === '/')) throw this.err('Invalid escape', start);
        }
        this.pos += ch.len;
        return mk(ch.cp, 'identity');
      }
    }
  }

  private legacyOctal(start: number, inClass: boolean): CharNode {
    // pos at first octal digit (0-7)
    let digits = this.peek();
    let i = this.pos + 1;
    const first = digits.charCodeAt(0) - 48;
    const maxLen = first <= 3 ? 3 : 2;
    while (digits.length < maxLen && /^[0-7]$/.test(this.src[i] ?? '')) digits += this.src[i++];
    this.pos = start + 1 + digits.length;
    return { type: 'Char', cp: parseInt(digits, 8), escape: 'octal', inClass, start, end: this.pos };
  }

  private parseAtomEscape(): Atom {
    const start = this.pos;
    this.pos++; // backslash
    if (this.pos >= this.len) throw this.err('\\ at end of pattern', start);
    const c = this.peek();
    if (c >= '1' && c <= '9') {
      let digits = '';
      let i = this.pos;
      while (/^[0-9]$/.test(this.src[i] ?? '')) digits += this.src[i++];
      const n = Number(digits);
      if (n <= this.total) {
        this.pos = i;
        return { type: 'Backref', index: n, start, end: this.pos };
      }
      if (this.u) throw this.err('Invalid escape', start);
      if (c >= '8') {
        this.pos++;
        return { type: 'Char', cp: c.charCodeAt(0), escape: 'identity', inClass: false, start, end: this.pos };
      }
      return this.legacyOctal(start, false);
    }
    switch (c) {
      case 'd':
      case 'D':
      case 's':
      case 'S':
      case 'w':
      case 'W':
        this.pos++;
        return { type: 'ClassEscape', kind: c, start, end: this.pos };
      case 'p':
      case 'P':
        if (this.u) return this.parseProperty(start);
        this.pos++;
        return { type: 'Char', cp: c.charCodeAt(0), escape: 'identity', inClass: false, start, end: this.pos };
      case 'k': {
        if (this.u || this.hasNamed) {
          this.pos++;
          if (this.peek() !== '<') throw this.err('Invalid named reference', start);
          this.pos++;
          const name = this.parseGroupName();
          const node: BackrefNode = { type: 'Backref', name, start, end: this.pos };
          this.namedRefs.push(node);
          return node;
        }
        this.pos++;
        return { type: 'Char', cp: 0x6b, escape: 'identity', inClass: false, start, end: this.pos };
      }
      default:
        return this.parseCharacterEscape(start, false);
    }
  }

  private parseProperty(start: number): PropertyNode {
    const negated = this.peek() === 'P';
    this.pos++; // p / P
    if (this.peek() !== '{') throw this.err('Invalid property name', start);
    const close = this.src.indexOf('}', this.pos);
    if (close < 0) throw this.err('Invalid property name', start);
    const body = this.src.slice(this.pos + 1, close);
    const m = /^([A-Za-z0-9_]+)(?:=([A-Za-z0-9_]+))?$/.exec(body);
    if (!m) throw this.err('Invalid property name', start);
    const name = m[1] ?? '';
    const value = m[2];
    if (!isValidProperty(name, value, negated, this.v)) throw this.err('Invalid property name', start);
    this.pos = close + 1;
    return { type: 'Property', negated, name, value, start, end: this.pos };
  }

  // -- classes -------------------------------------------------------------

  private parseClass(nested: boolean): ClassNode {
    const start = this.pos;
    this.pos++; // [
    let negated = false;
    if (this.peek() === '^') {
      negated = true;
      this.pos++;
    }
    if (this.v) return this.parseClassV(start, negated, nested);
    const items: ClassItem[] = [];
    for (;;) {
      if (this.pos >= this.len) throw this.err('Unterminated character class', start);
      if (this.peek() === ']') {
        this.pos++;
        break;
      }
      const a = this.parseClassAtom();
      if (this.peek() === '-' && this.pos + 1 < this.len && this.peek(1) !== ']') {
        const dash = this.pos;
        this.pos++;
        const b = this.parseClassAtom();
        if (a.type === 'Char' && b.type === 'Char') {
          if (a.cp > b.cp) throw this.err('Range out of order in character class', a.start);
          items.push({ type: 'Range', from: a, to: b, start: a.start, end: b.end });
        } else {
          if (this.u) throw this.err('Invalid character class', a.start);
          items.push(a, { type: 'Char', cp: 0x2d, escape: 'none', inClass: true, start: dash, end: dash + 1 }, b);
        }
      } else {
        items.push(a);
      }
    }
    return { type: 'Class', negated, op: 'union', items, vMode: false, nested, start, end: this.pos };
  }

  private parseClassAtom(): CharNode | ClassEscapeNode | PropertyNode {
    const start = this.pos;
    if (this.peek() !== '\\') {
      const ch = this.readChar();
      this.pos += ch.len;
      return { type: 'Char', cp: ch.cp, escape: 'none', inClass: true, start, end: this.pos };
    }
    this.pos++;
    if (this.pos >= this.len) throw this.err('\\ at end of pattern', start);
    const c = this.peek();
    switch (c) {
      case 'b':
        this.pos++;
        return { type: 'Char', cp: 8, escape: 'control', inClass: true, start, end: this.pos };
      case '-':
        this.pos++;
        return { type: 'Char', cp: 0x2d, escape: 'identity', inClass: true, start, end: this.pos };
      case 'd':
      case 'D':
      case 's':
      case 'S':
      case 'w':
      case 'W':
        this.pos++;
        return { type: 'ClassEscape', kind: c, start, end: this.pos };
      case 'p':
      case 'P':
        if (this.u) return this.parseProperty(start);
        this.pos++;
        return { type: 'Char', cp: c.charCodeAt(0), escape: 'identity', inClass: true, start, end: this.pos };
      case 'B':
        if (this.u) throw this.err('Invalid escape', start);
        this.pos++;
        return { type: 'Char', cp: 0x42, escape: 'identity', inClass: true, start, end: this.pos };
      case 'k':
        if (this.u || this.hasNamed) throw this.err('Invalid escape', start);
        this.pos++;
        return { type: 'Char', cp: 0x6b, escape: 'identity', inClass: true, start, end: this.pos };
      default:
        if (c >= '1' && c <= '9') {
          if (this.u) throw this.err('Invalid class escape', start);
          if (c >= '8') {
            this.pos++;
            return { type: 'Char', cp: c.charCodeAt(0), escape: 'identity', inClass: true, start, end: this.pos };
          }
          return this.legacyOctal(start, true);
        }
        return this.parseCharacterEscape(start, true);
    }
  }

  // -- v-mode classes ------------------------------------------------------

  private parseClassV(start: number, negated: boolean, nested: boolean): ClassNode {
    const items: ClassItem[] = [];
    let op: ClassNode['op'] = 'union';
    if (this.peek() === ']') {
      this.pos++;
      return { type: 'Class', negated, op, items, vMode: true, nested, start, end: this.pos };
    }
    if (this.pos >= this.len) throw this.err('Unterminated character class', start);
    const first = this.parseSetElement(true);
    items.push(first);
    if (this.startsWith('&&') || this.startsWith('--')) {
      if (first.type === 'Range') throw this.err('Invalid set operation in character class');
      const opStr = this.startsWith('&&') ? '&&' : '--';
      op = opStr === '&&' ? 'intersection' : 'subtraction';
      while (this.startsWith(opStr)) {
        this.pos += 2;
        if (opStr === '&&' && this.peek() === '&') throw this.err('Invalid set operation in character class');
        const operand = this.parseSetElement(false);
        items.push(operand);
      }
      if (this.peek() !== ']') {
        if (this.pos >= this.len) throw this.err('Unterminated character class', start);
        throw this.err('Invalid set operation in character class');
      }
      this.pos++;
    } else {
      for (;;) {
        if (this.pos >= this.len) throw this.err('Unterminated character class', start);
        if (this.peek() === ']') {
          this.pos++;
          break;
        }
        if (this.startsWith('&&') || this.startsWith('--')) {
          throw this.err('Invalid set operation in character class');
        }
        items.push(this.parseSetElement(true));
      }
    }
    const node: ClassNode = { type: 'Class', negated, op, items, vMode: true, nested, start, end: this.pos };
    if (negated && classContentsMayContainStrings(node)) {
      throw this.err('Negated character class may contain strings', start);
    }
    return node;
  }

  private parseSetElement(allowRange: boolean): ClassItem {
    const a = this.parseSetOperand();
    if (allowRange && a.type === 'Char' && this.peek() === '-' && this.peek(1) !== '-') {
      this.pos++;
      const b = this.parseSetOperand();
      if (b.type !== 'Char') throw this.err('Invalid character class', a.start);
      if (a.cp > b.cp) throw this.err('Range out of order in character class', a.start);
      return { type: 'Range', from: a, to: b, start: a.start, end: b.end };
    }
    return a;
  }

  private parseSetOperand(): CharNode | ClassEscapeNode | PropertyNode | ClassNode | ClassStringsNode {
    const start = this.pos;
    if (this.pos >= this.len) throw this.err('Unterminated character class', start);
    const c = this.peek();
    if (c === '[') return this.parseClass(true);
    if (c === '\\') {
      this.pos++;
      if (this.pos >= this.len) throw this.err('\\ at end of pattern', start);
      const e = this.peek();
      switch (e) {
        case 'd':
        case 'D':
        case 's':
        case 'S':
        case 'w':
        case 'W':
          this.pos++;
          return { type: 'ClassEscape', kind: e, start, end: this.pos };
        case 'p':
        case 'P':
          return this.parseProperty(start);
        case 'q':
          return this.parseClassStrings(start);
        case 'b':
          this.pos++;
          return { type: 'Char', cp: 8, escape: 'control', inClass: true, start, end: this.pos };
        default:
          if (CLASS_SET_RESERVED_PUNCT.includes(e)) {
            this.pos++;
            return { type: 'Char', cp: e.charCodeAt(0), escape: 'identity', inClass: true, start, end: this.pos };
          }
          return this.parseCharacterEscape(start, true);
      }
    }
    if (CLASS_SET_SYNTAX.includes(c)) throw this.err('Invalid character in character class');
    if (CLASS_SET_DOUBLE.includes(c) && this.peek(1) === c) throw this.err('Invalid set operation in character class');
    const ch = this.readChar();
    this.pos += ch.len;
    return { type: 'Char', cp: ch.cp, escape: 'none', inClass: true, start, end: this.pos };
  }

  /** `\q{abc|d}` — pos at `q`. */
  private parseClassStrings(start: number): ClassStringsNode {
    this.pos++; // q
    if (this.peek() !== '{') throw this.err('Invalid escape', start);
    this.pos++;
    const strings: string[] = [];
    let cur = '';
    for (;;) {
      if (this.pos >= this.len) throw this.err('Invalid escape', start);
      const c = this.peek();
      if (c === '}') {
        strings.push(cur);
        this.pos++;
        break;
      }
      if (c === '|') {
        strings.push(cur);
        cur = '';
        this.pos++;
        continue;
      }
      const operand = this.parseSetOperand();
      if (operand.type !== 'Char') throw this.err('Invalid escape', start);
      cur += String.fromCodePoint(operand.cp);
    }
    return { type: 'ClassStrings', strings, start, end: this.pos };
  }
}

function mightBothParticipate(a: PathEntry[], b: PathEntry[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.id === y.id && x.alt !== y.alt) return false;
    }
  }
  return true;
}

function itemMayContainStrings(it: ClassItem): boolean {
  switch (it.type) {
    case 'ClassStrings':
      return it.strings.some((s) => Array.from(s).length !== 1);
    case 'Property':
      return !it.negated && it.value === undefined && PROPS_OF_STRINGS.has(it.name);
    case 'Class':
      return classMayContainStrings(it);
    default:
      return false;
  }
}

export function classMayContainStrings(c: ClassNode): boolean {
  if (c.negated) return false;
  return classContentsMayContainStrings(c);
}

function classContentsMayContainStrings(c: ClassNode): boolean {
  if (c.op === 'intersection') return c.items.length > 0 && c.items.every(itemMayContainStrings);
  if (c.op === 'subtraction') return c.items[0] !== undefined && itemMayContainStrings(c.items[0]);
  return c.items.some(itemMayContainStrings);
}

export function parseRegex(pattern: string, flags: string): ParseOutput {
  const pf = parseFlags(flags);
  if (!pf.ok) throw new RegexSyntaxError(pf.error, 0);
  return new Parser(pattern, pf.flags).parse();
}

/** Error message from the real RegExp constructor, or null if it accepts the pattern. */
export function nativeCheck(pattern: string, flags: string): string | null {
  try {
    new RegExp(pattern, flags);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------
// Explanation
// ---------------------------------------------------------------------------

export type TokenKind =
  | 'literal'
  | 'escape'
  | 'class'
  | 'group'
  | 'lookaround'
  | 'quantifier'
  | 'anchor'
  | 'alternation'
  | 'backref'
  | 'dot';

export interface ExplainSpan {
  start: number;
  end: number;
  kind: TokenKind;
}

export interface ExplainNode {
  id: number;
  title: string;
  /** Quantifier phrase when the node is repeated, e.g. "exactly 4 times". */
  quantifier?: string;
  /** Extra info, e.g. the full list of a character class. */
  detail?: string;
  kind: TokenKind;
  start: number;
  end: number;
  code: string;
  spans: ExplainSpan[];
  children: ExplainNode[];
}

export interface PatternToken {
  start: number;
  end: number;
  kind: TokenKind;
  nodeId: number;
}

export interface Warning {
  id: string;
  severity: 'warn' | 'info';
  title: string;
  message: string;
  start: number;
  end: number;
}

export type AnalyzeResult =
  | {
      ok: true;
      ast: Disjunction;
      tree: ExplainNode;
      tokens: PatternToken[];
      groups: GroupInfo[];
      flags: FlagInfo[];
      warnings: Warning[];
      nodeCount: number;
    }
  | { ok: false; error: string; position: number; flags: FlagInfo[] };

const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL (U+0000)',
  8: 'backspace',
  9: 'tab',
  10: 'line feed (newline)',
  11: 'vertical tab',
  12: 'form feed',
  13: 'carriage return',
  32: 'space',
  0xa0: 'non-breaking space',
  0x2028: 'line separator (U+2028)',
  0x2029: 'paragraph separator (U+2029)',
  0xfeff: 'byte order mark (U+FEFF)',
};

export function hex4(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

function printable(cp: number): boolean {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return false;
  if (cp >= 0xd800 && cp <= 0xdfff) return false;
  if (cp === 0xad || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202e) || cp === 0xfeff) return false;
  return true;
}

/** Human description of one character, e.g. `"a"`, `tab`, `U+0001`. */
export function describeChar(cp: number): string {
  const named = CONTROL_NAMES[cp];
  if (named) return named;
  if (!printable(cp)) return hex4(cp);
  return `"${String.fromCodePoint(cp)}"`;
}

function charLabel(cp: number): string {
  const named = CONTROL_NAMES[cp];
  if (named) return named;
  return printable(cp) ? String.fromCodePoint(cp) : hex4(cp);
}

const GC_NAMES: Record<string, string> = {
  L: 'a letter', Letter: 'a letter',
  Lu: 'an uppercase letter', Uppercase_Letter: 'an uppercase letter',
  Ll: 'a lowercase letter', Lowercase_Letter: 'a lowercase letter',
  Lt: 'a titlecase letter', Titlecase_Letter: 'a titlecase letter',
  LC: 'a cased letter', Cased_Letter: 'a cased letter',
  Lm: 'a modifier letter', Modifier_Letter: 'a modifier letter',
  Lo: 'a letter without case (e.g. CJK)', Other_Letter: 'a letter without case (e.g. CJK)',
  M: 'a combining mark', Mark: 'a combining mark', Combining_Mark: 'a combining mark',
  Mn: 'a non-spacing mark', Nonspacing_Mark: 'a non-spacing mark',
  Mc: 'a spacing mark', Spacing_Mark: 'a spacing mark',
  Me: 'an enclosing mark', Enclosing_Mark: 'an enclosing mark',
  N: 'a number character', Number: 'a number character',
  Nd: 'a decimal digit (any script)', Decimal_Number: 'a decimal digit (any script)', digit: 'a decimal digit (any script)',
  Nl: 'a letter-like number (e.g. Roman numerals)', Letter_Number: 'a letter-like number',
  No: 'another kind of number (e.g. ², ½)', Other_Number: 'another kind of number',
  P: 'a punctuation character', Punctuation: 'a punctuation character', punct: 'a punctuation character',
  Pc: 'connector punctuation (e.g. _)', Connector_Punctuation: 'connector punctuation',
  Pd: 'a dash', Dash_Punctuation: 'a dash',
  Ps: 'an opening bracket', Open_Punctuation: 'an opening bracket',
  Pe: 'a closing bracket', Close_Punctuation: 'a closing bracket',
  Pi: 'an opening quote', Initial_Punctuation: 'an opening quote',
  Pf: 'a closing quote', Final_Punctuation: 'a closing quote',
  Po: 'other punctuation', Other_Punctuation: 'other punctuation',
  S: 'a symbol', Symbol: 'a symbol',
  Sm: 'a math symbol', Math_Symbol: 'a math symbol',
  Sc: 'a currency symbol', Currency_Symbol: 'a currency symbol',
  Sk: 'a modifier symbol', Modifier_Symbol: 'a modifier symbol',
  So: 'another symbol (e.g. ©, emoji)', Other_Symbol: 'another symbol',
  Z: 'a separator (space, line, paragraph)', Separator: 'a separator',
  Zs: 'a space separator', Space_Separator: 'a space separator',
  Zl: 'a line separator', Line_Separator: 'a line separator',
  Zp: 'a paragraph separator', Paragraph_Separator: 'a paragraph separator',
  C: 'a control/format/unassigned character', Other: 'a control/format/unassigned character',
  Cc: 'a control character', Control: 'a control character', cntrl: 'a control character',
  Cf: 'a format character (e.g. zero-width joiner)', Format: 'a format character',
  Cs: 'a surrogate code unit', Surrogate: 'a surrogate code unit',
  Co: 'a private-use character', Private_Use: 'a private-use character',
  Cn: 'an unassigned code point', Unassigned: 'an unassigned code point',
};

const BINARY_NAMES: Record<string, string> = {
  Alphabetic: 'an alphabetic character', Alpha: 'an alphabetic character',
  ASCII: 'an ASCII character (U+0000–U+007F)',
  ASCII_Hex_Digit: 'an ASCII hex digit', AHex: 'an ASCII hex digit',
  Any: 'any code point', Assigned: 'an assigned code point',
  Emoji: 'an emoji character', Emoji_Presentation: 'a character shown as emoji by default',
  Emoji_Modifier: 'an emoji skin-tone modifier', Emoji_Modifier_Base: 'an emoji that accepts a skin-tone modifier',
  Emoji_Component: 'an emoji component', Extended_Pictographic: 'a pictographic (emoji-like) character',
  Hex_Digit: 'a hex digit (incl. full-width)', ID_Start: 'a character that can start an identifier',
  ID_Continue: 'a character that can continue an identifier', Lowercase: 'a lowercase character',
  Uppercase: 'an uppercase character', White_Space: 'a white-space character', space: 'a white-space character',
  Math: 'a math character', Dash: 'a dash character', Ideographic: 'an ideographic (CJK) character',
  Diacritic: 'a diacritic', Quotation_Mark: 'a quotation mark',
  Regional_Indicator: 'a regional indicator (flag letter)', RI: 'a regional indicator (flag letter)',
  RGI_Emoji: 'an emoji (including sequences)', Basic_Emoji: 'a basic emoji', Emoji_Keycap_Sequence: 'a keycap emoji sequence',
  RGI_Emoji_Flag_Sequence: 'a flag emoji', RGI_Emoji_ZWJ_Sequence: 'a ZWJ emoji sequence',
  RGI_Emoji_Modifier_Sequence: 'an emoji with skin-tone modifier', RGI_Emoji_Tag_Sequence: 'a tag emoji sequence',
};

export function describeProperty(p: PropertyNode): string {
  const not = p.negated;
  let base: string;
  if (p.value !== undefined) {
    const n = p.name;
    if (n === 'General_Category' || n === 'gc') base = GC_NAMES[p.value] ?? `a character of category ${p.value}`;
    else if (n === 'Script' || n === 'sc') base = `a character in the ${p.value.replace(/_/g, ' ')} script`;
    else if (n === 'Script_Extensions' || n === 'scx') base = `a character used in the ${p.value.replace(/_/g, ' ')} script`;
    else base = `a character where ${n} = ${p.value}`;
  } else {
    base = GC_NAMES[p.name] ?? BINARY_NAMES[p.name] ?? `a character with the Unicode property ${p.name}`;
  }
  if (!not) return base;
  return `anything except ${base}`;
}

function classEscapeText(kind: ClassEscapeNode['kind'], flags: RegexFlags): string {
  const unicodeI = (flags.u || flags.v) && flags.i;
  switch (kind) {
    case 'd':
      return 'a digit (0–9)';
    case 'D':
      return 'a non-digit (anything except 0–9)';
    case 'w':
      return unicodeI ? 'a word character (letters, digits, underscore, plus ſ and K)' : 'a word character (A–Z, a–z, 0–9, _)';
    case 'W':
      return 'a non-word character (anything except A–Z, a–z, 0–9, _)';
    case 's':
      return 'a whitespace character (space, tab, line breaks, NBSP, …)';
    case 'S':
      return 'a non-whitespace character';
  }
}

function classEscapeShort(kind: ClassEscapeNode['kind']): string {
  switch (kind) {
    case 'd':
      return 'digit';
    case 'D':
      return 'non-digit';
    case 'w':
      return 'word character';
    case 'W':
      return 'non-word character';
    case 's':
      return 'whitespace';
    case 'S':
      return 'non-whitespace';
  }
}

function itemText(it: ClassItem): string {
  switch (it.type) {
    case 'Char':
      return describeChar(it.cp);
    case 'Range':
      return `${charLabel(it.from.cp)}–${charLabel(it.to.cp)}`;
    case 'ClassEscape':
      return classEscapeShort(it.kind);
    case 'Property':
      return describeProperty(it).replace(/^an? /, '');
    case 'ClassStrings':
      return `strings ${it.strings.map((s) => (s === '' ? '(empty)' : `"${s}"`)).join(' | ')}`;
    case 'Class':
      return `(${classText(it, false)})`;
  }
}

const NAMED_CLASS_SIGNATURES: Record<string, string> = {
  '0-9': 'a digit (0–9)',
  'a-z': 'a lowercase letter (a–z)',
  'A-Z': 'an uppercase letter (A–Z)',
  'A-Za-z': 'a letter (A–Z, a–z)',
  '0-9A-Za-z': 'a letter or digit (A–Z, a–z, 0–9)',
  '0-9A-Z': 'an uppercase letter or digit',
  '0-9a-z': 'a lowercase letter or digit',
  '0-9A-Fa-f': 'a hexadecimal digit (0–9, A–F, a–f)',
  '0-9A-F': 'an uppercase hexadecimal digit (0–9, A–F)',
  '0-9a-f': 'a lowercase hexadecimal digit (0–9, a–f)',
};

function classText(c: ClassNode, topLevel: boolean): string {
  if (c.op !== 'union' && c.items.length > 0) {
    const sep = c.op === 'intersection' ? ' AND ' : ' minus ';
    const body = c.items.map((it) => (it.type === 'Class' ? `(${classText(it, false)})` : itemText(it))).join(sep);
    return c.negated ? `anything except [${body}]` : body;
  }
  if (c.items.length === 0) return c.negated ? 'any character (including line breaks)' : 'nothing (the empty class never matches)';
  if (topLevel && !c.negated && !c.vMode) {
    const sig = c.items
      .map((it) => (it.type === 'Range' ? `${String.fromCodePoint(it.from.cp)}-${String.fromCodePoint(it.to.cp)}` : null))
      .filter((x): x is string => x !== null);
    if (sig.length === c.items.length) {
      const key = sig.slice().sort().join('');
      const named = NAMED_CLASS_SIGNATURES[key];
      if (named) return named;
    }
  }
  const parts = c.items.map(itemText);
  return `${c.negated ? 'any character except' : 'one of'}: ${parts.join(', ')}`;
}

export function quantifierPhrase(min: number, max: number, lazy: boolean): string {
  let s: string;
  if (min === 0 && max === Infinity) s = 'zero or more times';
  else if (min === 1 && max === Infinity) s = 'one or more times';
  else if (min === 0 && max === 1) s = 'optional (zero or one time)';
  else if (min === max) s = min === 0 ? 'zero times (never matches)' : min === 1 ? 'exactly once' : `exactly ${min} times`;
  else if (max === Infinity) s = `${min} or more times`;
  else s = `between ${min} and ${max} times`;
  if (lazy && min !== max) s += ' (lazy: as few as possible)';
  return s;
}

class Explainer {
  private nextId = 1;
  constructor(private readonly src: string, private readonly flags: RegexFlags) {}

  private node(
    kind: TokenKind,
    title: string,
    start: number,
    end: number,
    spans: ExplainSpan[],
    children: ExplainNode[] = [],
    extra: { quantifier?: string; detail?: string } = {}
  ): ExplainNode {
    return {
      id: this.nextId++,
      title,
      quantifier: extra.quantifier,
      detail: extra.detail,
      kind,
      start,
      end,
      code: this.src.slice(start, end),
      spans,
      children,
    };
  }

  root(ast: Disjunction): ExplainNode {
    const id = 0;
    const children = this.disjunction(ast);
    const root: ExplainNode = {
      id,
      title: 'Pattern',
      kind: 'literal',
      start: 0,
      end: this.src.length,
      code: this.src,
      spans: [],
      children,
    };
    if (this.src.length === 0) root.title = 'Empty pattern (matches the empty string at every position)';
    return root;
  }

  private disjunction(d: Disjunction): ExplainNode[] {
    if (d.alternatives.length === 1) {
      const only = d.alternatives[0];
      return only ? this.sequence(only) : [];
    }
    const pipes = d.pipes.map((p): ExplainSpan => ({ start: p, end: p + 1, kind: 'alternation' }));
    const alts = d.alternatives.map((alt, i) => {
      const kids = this.sequence(alt);
      const title = alt.terms.length === 0 ? `Alternative ${i + 1}: empty (always matches, consuming nothing)` : `Alternative ${i + 1}`;
      return this.node('alternation', title, alt.start, alt.end, [], kids);
    });
    return [
      this.node('alternation', `Match any one of ${d.alternatives.length} alternatives (first that succeeds wins)`, d.start, d.end, pipes, alts),
    ];
  }

  private mergeable(t: Term): t is CharNode {
    return t.type === 'Char' && (t.escape === 'none' || t.escape === 'identity') && printable(t.cp);
  }

  private sequence(alt: Alternative): ExplainNode[] {
    const out: ExplainNode[] = [];
    const terms = alt.terms;
    let i = 0;
    while (i < terms.length) {
      const t = terms[i];
      if (!t) break;
      if (this.mergeable(t)) {
        let j = i;
        let text = '';
        while (j < terms.length) {
          const x = terms[j];
          if (!x || !this.mergeable(x)) break;
          text += String.fromCodePoint(x.cp);
          j++;
        }
        const last = terms[j - 1];
        const hasEscapes = terms.slice(i, j).some((x) => x.type === 'Char' && x.escape === 'identity');
        const title = text === ' ' ? 'Literal space' : text.trim() === '' ? `Literal "${text}" (whitespace)` : `Literal "${text}"`;
        out.push(
          this.node(hasEscapes ? 'escape' : 'literal', title, t.start, last ? last.end : t.end, [
            { start: t.start, end: last ? last.end : t.end, kind: hasEscapes ? 'escape' : 'literal' },
          ])
        );
        i = j;
        continue;
      }
      out.push(this.term(t));
      i++;
    }
    return out;
  }

  private term(t: Term): ExplainNode {
    if (t.type === 'Assertion') return this.assertion(t);
    if (t.type === 'Quantified') {
      const n = this.atom(t.atom);
      n.quantifier = quantifierPhrase(t.min, t.max, t.lazy);
      n.start = t.start;
      n.end = t.end;
      n.code = this.src.slice(t.start, t.end);
      n.spans.push({ start: t.quantStart, end: t.end, kind: 'quantifier' });
      return n;
    }
    return this.atom(t);
  }

  private assertion(a: AssertionNode): ExplainNode {
    const m = this.flags.m;
    let title: string;
    switch (a.kind) {
      case 'start':
        title = m ? 'Start of a line' : 'Start of the input';
        break;
      case 'end':
        title = m ? 'End of a line' : 'End of the input';
        break;
      case 'wordBoundary':
        title = 'Word boundary (between a word character and a non-word character or the edge)';
        break;
      case 'notWordBoundary':
        title = 'Not a word boundary';
        break;
    }
    return this.node('anchor', title, a.start, a.end, [{ start: a.start, end: a.end, kind: 'anchor' }]);
  }

  private atom(a: Atom): ExplainNode {
    const span = (kind: TokenKind): ExplainSpan[] => [{ start: a.start, end: a.end, kind }];
    switch (a.type) {
      case 'Char': {
        const label = describeChar(a.cp);
        const escaped = a.escape !== 'none';
        let title: string;
        if (a.escape === 'control' || a.escape === 'null' || !printable(a.cp)) title = `Character: ${label}`;
        else title = `Literal ${label}`;
        if (a.escape === 'cx') title = `Control character Ctrl+${String.fromCharCode(a.cp + 64)} (${hex4(a.cp)})`;
        if (a.escape === 'octal') title = `Legacy octal escape: ${label}`;
        else if (a.escape === 'hex') title += ' (hex escape)';
        else if (a.escape === 'unicode') title += ' (Unicode escape)';
        return this.node(escaped ? 'escape' : 'literal', title, a.start, a.end, span(escaped ? 'escape' : 'literal'));
      }
      case 'Dot':
        return this.node(
          'dot',
          this.flags.s ? 'Any character (including line breaks, because of the s flag)' : 'Any character except line breaks (\\n, \\r, \\u2028, \\u2029)',
          a.start,
          a.end,
          span('dot')
        );
      case 'ClassEscape':
        return this.node('class', capitalize(classEscapeText(a.kind, this.flags)), a.start, a.end, span('class'));
      case 'Property':
        return this.node('class', capitalize(describeProperty(a)), a.start, a.end, span('class'), [], { detail: this.src.slice(a.start, a.end) });
      case 'Backref': {
        const title =
          a.name !== undefined
            ? `Backreference: the same text that group "${a.name}" matched`
            : `Backreference: the same text that group ${a.index} matched`;
        return this.node('backref', title, a.start, a.end, span('backref'));
      }
      case 'Class': {
        const text = classText(a, true);
        const op = a.vMode && a.op !== 'union' ? ` (set ${a.op})` : '';
        return this.node('class', capitalize(text) + op, a.start, a.end, span('class'));
      }
      case 'Group':
        return this.group(a);
    }
  }

  private group(g: GroupNode): ExplainNode {
    let title: string;
    let kind: TokenKind = 'group';
    switch (g.kind) {
      case 'capture':
        title = `Group ${g.index}`;
        break;
      case 'named':
        title = `Group ${g.index} (named "${g.name}")`;
        break;
      case 'noncapture':
        title = 'Non-capturing group';
        break;
      case 'lookahead':
        title = 'Positive lookahead: what follows must match (not consumed)';
        kind = 'lookaround';
        break;
      case 'neg-lookahead':
        title = 'Negative lookahead: what follows must NOT match';
        kind = 'lookaround';
        break;
      case 'lookbehind':
        title = 'Positive lookbehind: what precedes must match (not consumed)';
        kind = 'lookaround';
        break;
      case 'neg-lookbehind':
        title = 'Negative lookbehind: what precedes must NOT match';
        kind = 'lookaround';
        break;
      case 'modifiers': {
        const m = g.modifiers ?? { add: '', remove: '' };
        const names: Record<string, string> = { i: 'ignore case', m: 'multiline', s: 'dotAll' };
        const on = Array.from(m.add).map((c) => names[c] ?? c);
        const off = Array.from(m.remove).map((c) => names[c] ?? c);
        title = `Non-capturing group with modifiers${on.length ? `: ${on.join(', ')} on` : ''}${off.length ? `${on.length ? ';' : ':'} ${off.join(', ')} off` : ''}`;
        break;
      }
    }
    const spans: ExplainSpan[] = [
      { start: g.start, end: g.openEnd, kind },
      { start: g.closeAt, end: g.closeAt + 1, kind },
    ];
    const children = this.disjunction(g.body);
    if (g.body.alternatives.length === 1 && g.body.alternatives[0]?.terms.length === 0) {
      return this.node(kind, `${title} (empty)`, g.start, g.end, spans, children);
    }
    return this.node(kind, title, g.start, g.end, spans, children);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function collectTokens(root: ExplainNode, srcLen: number): PatternToken[] {
  const raw: PatternToken[] = [];
  const walk = (n: ExplainNode): void => {
    for (const s of n.spans) raw.push({ start: s.start, end: s.end, kind: s.kind, nodeId: n.id });
    for (const c of n.children) walk(c);
  };
  walk(root);
  raw.sort((a, b) => a.start - b.start || a.end - b.end);
  const out: PatternToken[] = [];
  let cur = 0;
  for (const t of raw) {
    if (t.start < cur) continue; // overlapping spans: keep first
    if (t.start > cur) out.push({ start: cur, end: t.start, kind: 'literal', nodeId: 0 });
    out.push(t);
    cur = t.end;
  }
  if (cur < srcLen) out.push({ start: cur, end: srcLen, kind: 'literal', nodeId: 0 });
  return out;
}

function countNodes(n: ExplainNode): number {
  return 1 + n.children.reduce((a, c) => a + countNodes(c), 0);
}

export function describeFlags(flags: string): FlagInfo[] {
  const out: FlagInfo[] = [];
  for (const f of flags) {
    const info = FLAG_INFO[f];
    if (info) out.push({ flag: f, ...info });
  }
  return out;
}

export function analyze(pattern: string, flags: string): AnalyzeResult {
  const flagInfos = describeFlags(flags);
  const pf = parseFlags(flags);
  if (!pf.ok) return { ok: false, error: pf.error, position: 0, flags: flagInfos };
  try {
    const parsed = new Parser(pattern, pf.flags).parse();
    const tree = new Explainer(pattern, pf.flags).root(parsed.ast);
    return {
      ok: true,
      ast: parsed.ast,
      tree,
      tokens: collectTokens(tree, pattern.length),
      groups: parsed.groups,
      flags: flagInfos,
      warnings: lint(parsed.ast, pattern, pf.flags),
      nodeCount: countNodes(tree),
    };
  } catch (e) {
    if (e instanceof RegexSyntaxError) return { ok: false, error: e.message, position: e.position, flags: flagInfos };
    throw e;
  }
}

export function treeToText(n: ExplainNode, depth = 0): string {
  const pad = '  '.repeat(depth);
  const line = n.id === 0 ? n.title : `${pad}${n.code.length ? `${n.code}  →  ` : ''}${n.title}${n.quantifier ? `, ${n.quantifier}` : ''}`;
  const kids = n.children.map((c) => treeToText(c, n.id === 0 ? 0 : depth + 1));
  return [line, ...kids].join('\n');
}

// ---------------------------------------------------------------------------
// Lint (heuristics)
// ---------------------------------------------------------------------------

type CS = [number, number][];
const MAX_CP = 0x10ffff;

function csNormalize(ranges: CS): CS {
  const s = ranges.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: CS = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}
function csUnion(a: CS, b: CS): CS {
  return csNormalize([...a, ...b]);
}
function csComplement(a: CS): CS {
  const n = csNormalize(a);
  const out: CS = [];
  let cur = 0;
  for (const [lo, hi] of n) {
    if (lo > cur) out.push([cur, lo - 1]);
    cur = hi + 1;
  }
  if (cur <= MAX_CP) out.push([cur, MAX_CP]);
  return out;
}
function csIntersect(a: CS, b: CS): CS {
  const x = csNormalize(a);
  const y = csNormalize(b);
  const out: CS = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const p = x[i];
    const q = y[j];
    if (!p || !q) break;
    const lo = Math.max(p[0], q[0]);
    const hi = Math.min(p[1], q[1]);
    if (lo <= hi) out.push([lo, hi]);
    if (p[1] < q[1]) i++;
    else j++;
  }
  return out;
}
function csSubtract(a: CS, b: CS): CS {
  return csIntersect(a, csComplement(b));
}
function csOverlap(a: CS, b: CS): boolean {
  return csIntersect(a, b).length > 0;
}

const CS_DIGIT: CS = [[48, 57]];
const CS_WORD: CS = [[48, 57], [65, 90], [95, 95], [97, 122]];
const CS_SPACE: CS = csNormalize([
  [9, 13], [32, 32], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a], [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000], [0xfeff, 0xfeff],
]);
const CS_DOT: CS = csComplement([[10, 10], [13, 13], [0x2028, 0x2029]]);

function foldCase(cs: CS, ignoreCase: boolean): CS {
  if (!ignoreCase) return cs;
  const extra: CS = [];
  for (const [lo, hi] of cs) {
    if (hi - lo > 2000) continue;
    for (let c = lo; c <= hi; c++) {
      const s = String.fromCodePoint(c);
      const l = s.toLowerCase();
      const u = s.toUpperCase();
      if (l !== s && Array.from(l).length === 1) extra.push([l.codePointAt(0) ?? c, l.codePointAt(0) ?? c]);
      if (u !== s && Array.from(u).length === 1) extra.push([u.codePointAt(0) ?? c, u.codePointAt(0) ?? c]);
    }
  }
  return extra.length ? csUnion(cs, extra) : cs;
}

function classEscapeSet(kind: ClassEscapeNode['kind']): CS {
  switch (kind) {
    case 'd':
      return CS_DIGIT;
    case 'D':
      return csComplement(CS_DIGIT);
    case 'w':
      return CS_WORD;
    case 'W':
      return csComplement(CS_WORD);
    case 's':
      return CS_SPACE;
    case 'S':
      return csComplement(CS_SPACE);
  }
}

/** Approximate set of code points one atom can consume; null when unknown. */
function itemSet(it: ClassItem, ic: boolean): CS | null {
  switch (it.type) {
    case 'Char':
      return foldCase([[it.cp, it.cp]], ic);
    case 'Range':
      return foldCase([[it.from.cp, it.to.cp]], ic);
    case 'ClassEscape':
      return classEscapeSet(it.kind);
    case 'Property':
      return null;
    case 'ClassStrings':
      return [];
    case 'Class':
      return classSet(it, ic);
  }
}

function classSet(c: ClassNode, ic: boolean): CS | null {
  let acc: CS | null = null;
  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i];
    if (!it) continue;
    const s = itemSet(it, ic);
    if (s === null) return null;
    if (acc === null) acc = s;
    else if (c.op === 'union') acc = csUnion(acc, s);
    else if (c.op === 'intersection') acc = csIntersect(acc, s);
    else acc = csSubtract(acc, s);
  }
  acc = acc ?? [];
  return c.negated ? csComplement(acc) : acc;
}

interface First {
  set: CS | null;
  nullable: boolean;
}

function firstOf(t: Term | Alternative | Disjunction, flags: RegexFlags): First {
  const ic = flags.i;
  switch (t.type) {
    case 'Char':
      return { set: foldCase([[t.cp, t.cp]], ic), nullable: false };
    case 'Dot':
      return { set: flags.s ? [[0, MAX_CP]] : CS_DOT, nullable: false };
    case 'ClassEscape':
      return { set: classEscapeSet(t.kind), nullable: false };
    case 'Property':
      return { set: null, nullable: false };
    case 'Class':
      return { set: classSet(t, ic), nullable: false };
    case 'Backref':
      return { set: null, nullable: true };
    case 'Assertion':
      return { set: [], nullable: true };
    case 'Quantified': {
      const f = firstOf(t.atom, flags);
      return { set: f.set, nullable: f.nullable || t.min === 0 };
    }
    case 'Group': {
      if (t.kind.includes('look')) return { set: [], nullable: true };
      return firstOf(t.body, flags);
    }
    case 'Alternative': {
      let set: CS | null = [];
      for (const x of t.terms) {
        const f = firstOf(x, flags);
        set = set === null || f.set === null ? null : csUnion(set, f.set);
        if (!f.nullable) return { set, nullable: false };
      }
      return { set, nullable: true };
    }
    case 'Disjunction': {
      let set: CS | null = [];
      let nullable = false;
      for (const a of t.alternatives) {
        const f = firstOf(a, flags);
        set = set === null || f.set === null ? null : csUnion(set, f.set);
        nullable = nullable || f.nullable;
      }
      return { set, nullable };
    }
  }
}

function overlaps(a: CS | null, b: CS | null): boolean {
  if (a === null || b === null) return false;
  return csOverlap(a, b);
}

function isUnboundedQuant(t: Term): t is QuantifiedNode {
  return t.type === 'Quantified' && t.max === Infinity;
}

function innerGroupOf(t: Term): GroupNode | null {
  if (t.type === 'Group') return t;
  if (t.type === 'Quantified' && t.atom.type === 'Group') return t.atom;
  return null;
}

function lint(ast: Disjunction, src: string, flags: RegexFlags): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  const add = (w: Warning): void => {
    const key = `${w.id}:${w.start}:${w.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(w);
  };

  const sequences: { alt: Alternative; owner: Disjunction }[] = [];
  const quantifiers: QuantifiedNode[] = [];
  const classes: ClassNode[] = [];
  const chars: CharNode[] = [];
  const dots: DotNode[] = [];
  const assertions: AssertionNode[] = [];

  const visitDisj = (d: Disjunction): void => {
    for (const a of d.alternatives) {
      sequences.push({ alt: a, owner: d });
      for (const t of a.terms) visitTerm(t);
    }
  };
  const visitAtom = (a: Atom): void => {
    switch (a.type) {
      case 'Group':
        visitDisj(a.body);
        break;
      case 'Class':
        classes.push(a);
        visitClass(a);
        break;
      case 'Char':
        chars.push(a);
        break;
      case 'Dot':
        dots.push(a);
        break;
      default:
        break;
    }
  };
  const visitClass = (c: ClassNode): void => {
    for (const it of c.items) {
      if (it.type === 'Char') chars.push(it);
      else if (it.type === 'Class') visitClass(it);
    }
  };
  const visitTerm = (t: Term): void => {
    if (t.type === 'Quantified') {
      quantifiers.push(t);
      visitAtom(t.atom);
    } else if (t.type === 'Assertion') assertions.push(t);
    else visitAtom(t);
  };
  visitDisj(ast);

  // 1. catastrophic backtracking: nested quantifiers / overlapping alternation in a repeated group
  for (const q of quantifiers) {
    if (q.max <= 1) continue;
    const g = innerGroupOf(q);
    if (!g || g.kind === 'lookahead' || g.kind === 'neg-lookahead' || g.kind === 'lookbehind' || g.kind === 'neg-lookbehind') continue;
    const bodyFirst = firstOf(g.body, flags);
    let flagged = false;
    // nested repeat whose continuation can start the same way
    const scanSeq = (alt: Alternative): void => {
      for (let i = 0; i < alt.terms.length && !flagged; i++) {
        const t = alt.terms[i];
        if (!t) continue;
        const inner = t.type === 'Quantified' && t.max > 1 ? t : null;
        if (inner) {
          const innerSet = firstOf(inner, flags).set;
          let follow: CS | null = [];
          let nullableRest = true;
          for (let j = i + 1; j < alt.terms.length; j++) {
            const nxt = alt.terms[j];
            if (!nxt) continue;
            const f = firstOf(nxt, flags);
            follow = follow === null || f.set === null ? null : csUnion(follow, f.set);
            if (!f.nullable) {
              nullableRest = false;
              break;
            }
          }
          if (nullableRest && follow !== null && bodyFirst.set !== null) follow = csUnion(follow, bodyFirst.set);
          if (overlaps(innerSet, follow) || (innerSet !== null && follow === null && nullableRest && bodyFirst.set === null)) {
            flagged = true;
            add({
              id: 'nested-quantifier',
              severity: 'warn',
              title: 'Potential catastrophic backtracking',
              message: `A repeated group (${src.slice(g.start, g.end)}${src.slice(q.quantStart, q.end)}) contains the quantified part "${src.slice(inner.start, inner.end)}", and the text it matches can also be matched by the next iteration. On a non-matching input the engine may try exponentially many ways to split the text (ReDoS). Make the inner part unambiguous (e.g. require a separator) or use atomic-style lookahead tricks.`,
              start: q.start,
              end: q.end,
            });
            return;
          }
        }
        const sub = t.type === 'Group' ? t : t.type === 'Quantified' && t.atom.type === 'Group' ? t.atom : null;
        if (sub && !flagged) for (const a of sub.body.alternatives) scanSeq(a);
      }
    };
    for (const a of g.body.alternatives) scanSeq(a);

    // overlapping alternatives inside a repeated group
    if (!flagged && g.body.alternatives.length > 1) {
      const sets = g.body.alternatives.map((a) => firstOf(a, flags));
      outer: for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
          const a = sets[i];
          const b = sets[j];
          if (a && b && overlaps(a.set, b.set)) {
            flagged = true;
            add({
              id: 'overlapping-alternation',
              severity: 'warn',
              title: 'Potential catastrophic backtracking',
              message: `The alternatives inside the repeated group ${src.slice(q.start, q.end)} can start with the same characters, so the engine may retry many combinations on failure. Reorder, factor out the common prefix, or make the alternatives mutually exclusive.`,
              start: q.start,
              end: q.end,
            });
            break outer;
          }
        }
      }
    }
  }

  // adjacent overlapping unbounded quantifiers: polynomial backtracking
  for (const { alt } of sequences) {
    for (let i = 0; i < alt.terms.length; i++) {
      const a = alt.terms[i];
      if (!a || !isUnboundedQuant(a)) continue;
      const aSet = firstOf(a, flags).set;
      for (let j = i + 1; j < alt.terms.length; j++) {
        const b = alt.terms[j];
        if (!b) continue;
        if (isUnboundedQuant(b) && overlaps(aSet, firstOf(b, flags).set)) {
          add({
            id: 'adjacent-quantifiers',
            severity: 'warn',
            title: 'Overlapping adjacent quantifiers',
            message: `"${src.slice(a.start, a.end)}" and "${src.slice(b.start, b.end)}" can match the same characters, which causes polynomial (quadratic or worse) backtracking when the overall match fails. Merge them or separate them with a distinct delimiter.`,
            start: a.start,
            end: b.end,
          });
          break;
        }
        if (!firstOf(b, flags).nullable) break;
      }
    }
  }

  // 2. unescaped "." in domain / IP-looking patterns
  const TLD = /^(com|net|org|edu|gov|mil|int|io|co|dev|app|info|biz|me|us|uk|de|fr|ru|cn|jp|in|au|ca|nl|br|es|it|ch|se|no|xyz|tech|online|site)(?![a-z])/i;
  const digitLike = (t: Term | undefined): boolean => {
    if (!t) return false;
    const x = t.type === 'Quantified' ? t.atom : t;
    if (x.type === 'ClassEscape') return x.kind === 'd';
    if (x.type === 'Class') {
      const s = classSet(x, false);
      return s !== null && s.length > 0 && csIntersect(s, CS_DIGIT).length > 0 && csSubtract(s, CS_DIGIT).length === 0;
    }
    return false;
  };
  for (const { alt } of sequences) {
    const dotsHere: { idx: number; node: DotNode }[] = [];
    alt.terms.forEach((t, idx) => {
      if (t.type === 'Dot') dotsHere.push({ idx, node: t });
    });
    const ipDots = dotsHere.filter((d) => digitLike(alt.terms[d.idx - 1]) && digitLike(alt.terms[d.idx + 1]));
    if (ipDots.length >= 2) {
      const firstDot = ipDots[0];
      const lastDot = ipDots[ipDots.length - 1];
      if (firstDot && lastDot) {
        add({
          id: 'unescaped-dot-ip',
          severity: 'warn',
          title: 'Unescaped "." in an IP-address-like pattern',
          message: `${ipDots.length} bare "." characters sit between digit patterns. A bare "." matches any character, so this also matches things like 192x168y1z1. Escape the dots as \\. to match literal dots.`,
          start: firstDot.node.start,
          end: lastDot.node.end,
        });
      }
      continue;
    }
    for (const d of dotsHere) {
      let run = '';
      for (let k = d.idx + 1; k < alt.terms.length; k++) {
        const nx = alt.terms[k];
        if (nx && nx.type === 'Char' && nx.escape === 'none') run += String.fromCodePoint(nx.cp);
        else break;
      }
      let before = '';
      for (let k = d.idx - 1; k >= 0; k--) {
        const pv = alt.terms[k];
        if (pv && pv.type === 'Char' && pv.escape === 'none') before = String.fromCodePoint(pv.cp) + before;
        else break;
      }
      const prevTerm = alt.terms[d.idx - 1];
      if (prevTerm && TLD.test(run) && (run.length <= 6 || /^[a-z]{2,}$/i.test(run))) {
        add({
          id: 'unescaped-dot-domain',
          severity: 'warn',
          title: 'Unescaped "." in a domain-like pattern',
          message: `The "." before "${run}" matches any character (e.g. "examplexcom"). Use \\. to match a literal dot.`,
          start: d.node.start,
          end: d.node.end,
        });
      } else if (/(^|[^a-z])www$/i.test(before) && run.length > 0) {
        add({
          id: 'unescaped-dot-domain',
          severity: 'warn',
          title: 'Unescaped "." after "www"',
          message: 'The "." matches any character. Use \\. to match a literal dot in hostnames.',
          start: d.node.start,
          end: d.node.end,
        });
      }
    }
  }

  // 3. anchors without the m flag
  if (!flags.m) {
    for (const { alt } of sequences) {
      alt.terms.forEach((t, idx) => {
        if (t.type !== 'Assertion') return;
        if (t.kind === 'start') {
          const before = alt.terms.slice(0, idx);
          if (before.some((x) => !firstOf(x, flags).nullable)) {
            add({
              id: 'anchor-middle',
              severity: 'warn',
              title: '"^" after other content can never match',
              message: 'Without the m flag, ^ only matches at the very start of the input, so it cannot match after consuming characters. Add the m flag if you mean "start of a line".',
              start: t.start,
              end: t.end,
            });
          }
        } else if (t.kind === 'end') {
          const after = alt.terms.slice(idx + 1);
          if (after.some((x) => !firstOf(x, flags).nullable)) {
            add({
              id: 'anchor-middle',
              severity: 'warn',
              title: '"$" followed by other content can never match',
              message: 'Without the m flag, $ only matches at the very end of the input, so more characters cannot follow it. Add the m flag if you mean "end of a line".',
              start: t.start,
              end: t.end,
            });
          }
        }
      });
    }
    const hasAnchor = assertions.some((a) => a.kind === 'start' || a.kind === 'end');
    const newline = chars.find((c) => (c.cp === 10 || c.cp === 13) && c.escape !== 'none');
    if (hasAnchor && newline) {
      const anchor = assertions.find((a) => a.kind === 'start' || a.kind === 'end');
      add({
        id: 'anchor-multiline',
        severity: 'info',
        title: '^ / $ without the m flag on a multi-line pattern',
        message: 'The pattern mentions line breaks but ^ and $ only match at the start and end of the whole input. If you want per-line anchoring, enable the m flag.',
        start: anchor ? anchor.start : 0,
        end: anchor ? anchor.end : 0,
      });
    }
  }

  // 4. empty alternatives
  const visitEmpty = (d: Disjunction): void => {
    if (d.alternatives.length > 1) {
      d.alternatives.forEach((a, i) => {
        if (a.terms.length === 0) {
          const pipe = i > 0 ? d.pipes[i - 1] : d.pipes[0];
          const at = pipe ?? a.start;
          add({
            id: 'empty-alternative',
            severity: 'warn',
            title: 'Empty alternative',
            message: 'One side of a "|" is empty, so this alternative matches the empty string — usually a stray or doubled "|". If you meant "optional", use a "?" quantifier.',
            start: at,
            end: at + 1,
          });
        }
      });
    }
    for (const a of d.alternatives) {
      for (const t of a.terms) {
        const x = t.type === 'Quantified' ? t.atom : t;
        if (x.type === 'Group') visitEmpty(x.body);
      }
    }
  };
  visitEmpty(ast);

  // 5. unnecessary escapes
  const classUnnecessary = '.*+?(){}|$/';
  const outsideUnnecessary = (s: string): boolean => /^[^A-Za-z0-9\s]$/.test(s) && !SYNTAX_CHARS.includes(s) && s !== '/' && s !== '-' && s !== '\\';
  for (const c of chars) {
    if (c.escape !== 'identity' || c.cp > 0xffff) continue;
    const ch = String.fromCharCode(c.cp);
    if (/^[A-Za-z0-9]$/.test(ch)) continue;
    let unnecessary = false;
    if (c.inClass) {
      unnecessary =
        (classUnnecessary.includes(ch) && !(flags.v && '(){}/|'.includes(ch))) ||
        (outsideUnnecessary(ch) && !(flags.v && CLASS_SET_RESERVED_PUNCT.includes(ch)));
    } else {
      unnecessary = outsideUnnecessary(ch) || (ch === '-' && !flags.u && !flags.v);
    }
    if (ch === '/') unnecessary = false;
    if (unnecessary) {
      add({
        id: 'unnecessary-escape',
        severity: 'info',
        title: `Unnecessary escape \\${ch}`,
        message: `"${ch}" has no special meaning ${c.inClass ? 'inside a character class' : 'here'}, so the backslash is not needed.`,
        start: c.start,
        end: c.end,
      });
    }
  }

  // 6. [A-z] style ranges
  for (const cl of classes) {
    for (const it of cl.items) {
      if (it.type === 'Range') {
        const lo = it.from.cp;
        const hi = it.to.cp;
        const upperToLower = lo >= 65 && lo <= 90 && hi >= 97 && hi <= 122;
        const digitToLetter = lo >= 48 && lo <= 57 && hi >= 65;
        if (upperToLower || digitToLetter) {
          const extra = '[\\]^_`'.length;
          add({
            id: 'range-a-z',
            severity: 'warn',
            title: `Suspicious range ${String.fromCharCode(lo)}-${String.fromCharCode(hi)}`,
            message: upperToLower
              ? `The range ${String.fromCharCode(lo)}-${String.fromCharCode(hi)} spans ASCII punctuation between the upper- and lower-case letters (${extra} extra characters: [ \\ ] ^ _ \`). Use A-Za-z instead.`
              : `The range ${String.fromCharCode(lo)}-${String.fromCharCode(hi)} also includes punctuation and symbols between the digits and letters. List the ranges separately (0-9A-Za-z).`,
            start: it.start,
            end: it.end,
          });
        }
      }
    }
  }

  // 7. lazy quantifier at the very end
  const lastSeq = ast.alternatives[ast.alternatives.length - 1];
  const endsWith = (alt: Alternative | undefined): void => {
    if (!alt) return;
    const last = alt.terms[alt.terms.length - 1];
    if (last && last.type === 'Quantified' && last.lazy && last.min !== last.max && alt.end === last.end) {
      const top = ast.alternatives.includes(alt);
      if (top) {
        add({
          id: 'lazy-at-end',
          severity: 'info',
          title: 'Lazy quantifier at the end of the pattern',
          message: `Nothing follows "${src.slice(last.start, last.end)}", so a lazy quantifier always matches as little as possible (${last.min === 0 ? 'often just nothing' : `only ${last.min}`}). Use a greedy quantifier or add a terminating token.`,
          start: last.start,
          end: last.end,
        });
      }
    }
  };
  for (const a of ast.alternatives) endsWith(a);
  void lastSeq;

  // extra: \p{…} / \u{…} without the u flag, "|" inside a class
  if (!flags.u && !flags.v) {
    for (const c of chars) {
      if (c.escape !== 'identity' || c.inClass) continue;
      const next = src.slice(c.end);
      if ((c.cp === 0x70 || c.cp === 0x50) && /^\{[A-Za-z0-9_=]+\}/.test(next)) {
        add({
          id: 'property-no-u',
          severity: 'warn',
          title: `\\${String.fromCharCode(c.cp)}{…} needs the u (or v) flag`,
          message: `Without the u flag \\${String.fromCharCode(c.cp)} is just the letter "${String.fromCharCode(c.cp)}" followed by literal text. Add the u flag to use Unicode property escapes.`,
          start: c.start,
          end: c.end,
        });
      } else if (c.cp === 0x75 && /^\{[0-9a-fA-F]+\}/.test(next)) {
        add({
          id: 'unicode-escape-no-u',
          severity: 'warn',
          title: '\\u{…} needs the u (or v) flag',
          message: 'Without the u flag \\u{…} is read as the letter "u" repeated by a quantifier. Add the u flag for code point escapes.',
          start: c.start,
          end: c.end,
        });
      }
    }
  }
  for (const cl of classes) {
    if (!cl.vMode && cl.items.some((it) => it.type === 'Char' && it.cp === 0x7c && it.escape === 'none') && cl.items.length > 2 && !cl.negated) {
      const pipe = cl.items.find((it) => it.type === 'Char' && it.cp === 0x7c);
      add({
        id: 'pipe-in-class',
        severity: 'info',
        title: '"|" inside a character class',
        message: 'Inside [...] the pipe is a literal "|" character, not alternation. Remove it unless you want to match a pipe.',
        start: pipe ? pipe.start : cl.start,
        end: pipe ? pipe.end : cl.end,
      });
    }
  }
  void dots;

  out.sort((a, b) => (a.severity === b.severity ? a.start - b.start : a.severity === 'warn' ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------------------
// Tester (uses the real RegExp). `runMatches` is self-contained so the UI can
// run it inside a Web Worker (via Function#toString) and kill it on timeout.
// ---------------------------------------------------------------------------

export interface MatchRequest {
  pattern: string;
  flags: string;
  text: string;
  max: number;
  all: boolean;
}

export interface MatchGroup {
  name: string | null;
  value: string | null;
}

export interface MatchItem {
  index: number;
  end: number;
  text: string;
  groups: MatchGroup[];
}

export interface MatchRun {
  matches: MatchItem[];
  truncated: boolean;
  error: string | null;
  ms: number;
}

export function runMatches(req: MatchRequest): MatchRun {
  const t0 = Date.now();
  const out: MatchItem[] = [];
  let flags = req.flags;
  if (req.all && flags.indexOf('g') < 0) flags += 'g';
  let re: RegExp;
  try {
    re = new RegExp(req.pattern, flags);
  } catch (e) {
    return { matches: [], truncated: false, error: e instanceof Error ? e.message : String(e), ms: 0 };
  }
  const global = re.global || re.sticky;
  const unicode = re.unicode || (re as unknown as { unicodeSets?: boolean }).unicodeSets === true;
  let truncated = false;
  for (;;) {
    const m = re.exec(req.text);
    if (!m) break;
    const groupNames: Array<string | null> = [];
    for (let i = 1; i < m.length; i++) groupNames.push(null);
    if (m.groups) {
      // map names to numbers by locating each named group's source position
      const src = req.pattern;
      let idx = 0;
      let inClass = false;
      for (let i = 0; i < src.length; i++) {
        const c = src.charAt(i);
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '(' && !inClass) {
          if (src.charAt(i + 1) !== '?') idx++;
          else if (src.charAt(i + 2) === '<' && src.charAt(i + 3) !== '=' && src.charAt(i + 3) !== '!') {
            idx++;
            const close = src.indexOf('>', i + 3);
            if (close > 0) groupNames[idx - 1] = src.slice(i + 3, close);
          }
        }
      }
    }
    const groups: MatchGroup[] = [];
    for (let i = 1; i < m.length; i++) {
      const nm = groupNames[i - 1] ?? null;
      const v = m[i];
      groups.push({ name: nm, value: v === undefined ? null : v });
    }
    out.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups });
    if (out.length >= req.max) {
      truncated = true;
      break;
    }
    if (!global) break;
    if (m[0].length === 0) {
      let step = 1;
      if (unicode) {
        const cp = req.text.codePointAt(re.lastIndex);
        if (cp !== undefined && cp > 0xffff) step = 2;
      }
      re.lastIndex += step;
      if (re.lastIndex > req.text.length) break;
    }
  }
  return { matches: out, truncated, error: null, ms: Date.now() - t0 };
}

export interface HighlightSegment {
  text: string;
  match: number | null;
}

/** Split the test string into plain / matched segments for highlighting. */
export function buildSegments(text: string, matches: MatchItem[]): HighlightSegment[] {
  const out: HighlightSegment[] = [];
  let cur = 0;
  matches.forEach((m, i) => {
    if (m.end === m.index || m.index < cur) return;
    if (m.index > cur) out.push({ text: text.slice(cur, m.index), match: null });
    out.push({ text: text.slice(m.index, m.end), match: i });
    cur = m.end;
  });
  if (cur < text.length) out.push({ text: text.slice(cur), match: null });
  return out;
}
