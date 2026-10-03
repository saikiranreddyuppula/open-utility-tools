/**
 * YAML 1.2 (core schema) parser, linter and formatter.
 * Pure TypeScript, no dependencies. Every node carries source positions so the UI can
 * point at line:column. Comments are kept (attached to the following entry / the same line)
 * so that formatting can preserve them.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Pos {
  /** 0-based UTF-16 offset into the (newline-normalised) source. */
  offset: number;
  /** 1-based line. */
  line: number;
  /** 1-based column (counted in Unicode code points). */
  col: number;
}

export type ScalarStyle = 'plain' | 'single' | 'double' | 'literal' | 'folded';
export type Chomp = 'clip' | 'strip' | 'keep';

interface NodeBase {
  start: Pos;
  endOffset: number;
  endLine: number;
  anchor?: string;
  anchorPos?: Pos;
  tag?: string;
  tagPos?: Pos;
}

export interface ScalarNode extends NodeBase {
  type: 'scalar';
  style: ScalarStyle;
  /** The resolved text of the scalar (escapes processed, lines folded). */
  value: string;
  /** Source text of a single-line plain/quoted scalar (including quotes). */
  raw?: string;
  /** Block scalars: de-indented content lines. Multi-line flow scalars: trimmed source lines. */
  lines?: string[];
  chomp?: Chomp;
  indentIndicator?: number;
  /** Plain scalar with no text (e.g. only a tag/anchor). */
  empty?: boolean;
  multiline?: boolean;
}

export interface AliasNode extends NodeBase {
  type: 'alias';
  name: string;
  target?: YamlNode;
}

export interface SeqItem {
  value: YamlNode | null;
  start: Pos;
  leading: string[];
  trailing?: string;
}

export interface SeqNode extends NodeBase {
  type: 'seq';
  flow: boolean;
  items: SeqItem[];
}

export interface MapPair {
  key: YamlNode | null;
  value: YamlNode | null;
  start: Pos;
  explicit: boolean;
  leading: string[];
  trailing?: string;
  colon?: Pos;
}

export interface MapNode extends NodeBase {
  type: 'map';
  flow: boolean;
  pairs: MapPair[];
  /** `[a: b]` — a single-pair mapping inside a flow sequence. */
  singlePair?: boolean;
}

export type YamlNode = ScalarNode | AliasNode | SeqNode | MapNode;

export interface YamlDocument {
  index: number;
  root: YamlNode | null;
  explicitStart: boolean;
  explicitEnd: boolean;
  directives: string[];
  start: Pos;
  leading: string[];
  trailing?: string;
  footer: string[];
}

export type IssueLevel = 'error' | 'warning' | 'info';

export interface YamlIssue {
  level: IssueLevel;
  rule: string;
  message: string;
  line: number;
  col: number;
  offset: number;
}

export interface AnchorInfo {
  name: string;
  pos: Pos;
  node: YamlNode;
  uses: number;
}

export interface YamlParseResult {
  /** Newline-normalised source that all offsets refer to. */
  source: string;
  docs: YamlDocument[];
  errors: YamlIssue[];
  anchors: AnchorInfo[];
  tabSeparators: Pos[];
  commentCount: number;
  /** Comments that could not be attached to a node (e.g. inside flow collections). */
  unattachedComments: number;
}

export type YValue = null | boolean | number | bigint | string | YValue[] | Map<string, YValue>;

/* ------------------------------------------------------------------ */
/* Core-schema scalar resolution                                       */
/* ------------------------------------------------------------------ */

const RE_INT = /^[-+]?[0-9]+$/;
const RE_OCT = /^0o[0-7]+$/;
const RE_HEX = /^0x[0-9a-fA-F]+$/;
const RE_FLOAT = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const RE_INF = /^[-+]?\.(?:inf|Inf|INF)$/;
const RE_NAN = /^\.(?:nan|NaN|NAN)$/;

function bigOrNumber(big: bigint): number | bigint {
  const n = Number(big);
  return Number.isSafeInteger(n) ? n : big;
}

/** Resolve an untagged plain scalar using the YAML 1.2 core schema. */
export function resolvePlain(text: string): null | boolean | number | bigint | string {
  switch (text) {
    case '':
    case '~':
    case 'null':
    case 'Null':
    case 'NULL':
      return null;
    case 'true':
    case 'True':
    case 'TRUE':
      return true;
    case 'false':
    case 'False':
    case 'FALSE':
      return false;
    default:
      break;
  }
  const c = text.charCodeAt(0);
  // quick reject: must start with digit, sign or dot
  if (!((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46)) return text;
  if (RE_INT.test(text)) {
    if (text.length < 16) {
      const n = Number(text);
      return n === 0 ? 0 : n;
    }
    return bigOrNumber(BigInt(text.startsWith('+') ? text.slice(1) : text));
  }
  if (RE_OCT.test(text)) return bigOrNumber(BigInt(text));
  if (RE_HEX.test(text)) return bigOrNumber(BigInt(text));
  if (RE_FLOAT.test(text)) return Number(text);
  if (RE_INF.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
  if (RE_NAN.test(text)) return NaN;
  return text;
}

/** Describe the core-schema type a plain scalar resolves to. */
export function plainType(text: string): 'null' | 'bool' | 'int' | 'float' | 'str' {
  const v = resolvePlain(text);
  if (v === null) return 'null';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'bigint') return 'int';
  if (typeof v === 'number') {
    return RE_INT.test(text) || RE_OCT.test(text) || RE_HEX.test(text) ? 'int' : 'float';
  }
  return 'str';
}

/* ------------------------------------------------------------------ */
/* Character helpers                                                   */
/* ------------------------------------------------------------------ */

const isWs = (c: string): boolean => c === ' ' || c === '\t';
const isBlankOrEnd = (c: string): boolean => c === '' || c === ' ' || c === '\t' || c === '\n';
const isFlowInd = (c: string): boolean => c === ',' || c === '[' || c === ']' || c === '{' || c === '}';

class YamlSyntaxError extends Error {
  offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

const NON_PRINTABLE = /[^\x09\x0A\x0D\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  anchor?: string;
  anchorPos?: Pos;
  tag?: string;
  tagPos?: Pos;
}

interface CommentTok {
  offset: number;
  line0: number;
  text: string;
  own: boolean;
  inFlow: boolean;
  used: boolean;
}

interface EntryReg {
  line0: number;
  target: { leading: string[] };
}

type NodeMode = 'line' | 'seq' | 'explicit' | 'value' | 'root';

const MAX_DEPTH = 400;
const MAX_ERRORS = 60;

const ESCAPES: Record<string, string> = {
  '0': '\0',
  a: '\x07',
  b: '\b',
  t: '\t',
  '\t': '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  e: '\x1b',
  ' ': ' ',
  '"': '"',
  '/': '/',
  '\\': '\\',
  N: '\x85',
  _: '\xa0',
  L: '\u2028',
  P: '\u2029',
};

class Parser {
  readonly s: string;
  readonly len: number;
  i = 0;
  readonly lineStarts: number[] = [0];
  errors: YamlIssue[] = [];
  private errorLines = new Set<number>();
  private comments: CommentTok[] = [];
  private commentByLine = new Map<number, CommentTok>();
  private owned = new Set<number>();
  tabSeps: Pos[] = [];
  private tabSepLines = new Set<number>();
  private leadingTabLines = new Set<number>();
  private entries: EntryReg[] = [];
  private trailingTargets: ({ trailing?: string } | undefined)[] = [];
  private anchors = new Map<string, AnchorInfo>();
  private allAnchors: AnchorInfo[] = [];
  private pendingAnchors = new Set<string>();
  private tagHandles = new Map<string, string>();
  private depth = 0;
  private lastLine = 0;
  private astralLines = new Map<number, boolean>();
  private readonly hasAstral: boolean;

  constructor(source: string) {
    this.s = source;
    this.len = source.length;
    this.hasAstral = /[\uD800-\uDBFF]/.test(source);
    let k = source.indexOf('\n');
    while (k !== -1) {
      this.lineStarts.push(k + 1);
      k = source.indexOf('\n', k + 1);
    }
  }

  /* ---------- positions & errors ---------- */

  private lineIdx(off: number): number {
    const ls = this.lineStarts;
    const c = this.lastLine;
    const cs = ls[c] ?? 0;
    const nx = ls[c + 1];
    if (off >= cs && (nx === undefined || off < nx)) return c;
    let lo = 0;
    let hi = ls.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if ((ls[mid] ?? 0) <= off) lo = mid;
      else hi = mid - 1;
    }
    this.lastLine = lo;
    return lo;
  }

  private lineStart(off: number): number {
    return this.lineStarts[this.lineIdx(off)] ?? 0;
  }

  private colOf(off: number): number {
    return off - this.lineStart(off);
  }

  private lineEnd(line0: number): number {
    const nx = this.lineStarts[line0 + 1];
    return nx === undefined ? this.len : nx - 1;
  }

  private eol(off: number): number {
    const k = this.s.indexOf('\n', off);
    return k === -1 ? this.len : k;
  }

  pos(off: number): Pos {
    const l = this.lineIdx(off);
    const ls = this.lineStarts[l] ?? 0;
    let astral = false;
    if (this.hasAstral) {
      const cached = this.astralLines.get(l);
      if (cached === undefined) {
        astral = /[\uD800-\uDBFF]/.test(this.s.slice(ls, this.lineEnd(l)));
        this.astralLines.set(l, astral);
      } else astral = cached;
    }
    let col = off - ls + 1;
    if (astral) {
      col = 1;
      for (let k = ls; k < off; k++) {
        const c = this.s.charCodeAt(k);
        if (c >= 0xd800 && c <= 0xdbff) k++;
        col++;
      }
    }
    return { offset: off, line: l + 1, col };
  }

  private err(message: string, off: number = this.i): YamlSyntaxError {
    return new YamlSyntaxError(message, off);
  }

  addError(message: string, off: number, rule = 'syntax'): void {
    if (this.errors.length >= MAX_ERRORS) return;
    const l = this.lineIdx(off);
    if (this.errorLines.has(l)) return;
    this.errorLines.add(l);
    const p = this.pos(off);
    this.errors.push({ level: 'error', rule, message, line: p.line, col: p.col, offset: off });
  }

  private recordError(e: unknown): void {
    if (e instanceof YamlSyntaxError) this.addError(e.message, e.offset);
    else throw e;
  }

  private tooManyErrors(): boolean {
    return this.errors.length >= MAX_ERRORS;
  }

  /* ---------- low-level scanning ---------- */

  private isLeadingWs(off: number): boolean {
    const ls = this.lineStart(off);
    for (let k = off - 1; k >= ls; k--) {
      const c = this.s.charCodeAt(k);
      if (c !== 32 && c !== 9) return false;
    }
    return true;
  }

  private skipSpaces(): void {
    const s = this.s;
    let j = this.i;
    while (j < this.len) {
      const c = s.charCodeAt(j);
      if (c === 32) j++;
      else if (c === 9) {
        if (!this.isLeadingWs(j)) {
          const l = this.lineIdx(j);
          if (!this.tabSepLines.has(l)) {
            this.tabSepLines.add(l);
            this.tabSeps.push(this.pos(j));
          }
        }
        j++;
      } else break;
    }
    this.i = j;
  }

  private readComment(inFlow: boolean): void {
    const s = this.s;
    const start = this.i;
    let j = start;
    while (j < this.len && s.charCodeAt(j) !== 10) j++;
    const text = s.slice(start, j).replace(/[ \t]+$/, '');
    const line0 = this.lineIdx(start);
    const own = this.isLeadingWs(start);
    const tok: CommentTok = { offset: start, line0, text, own, inFlow, used: false };
    this.comments.push(tok);
    this.commentByLine.set(line0, tok);
    this.i = j;
  }

  /** Skip whitespace, line breaks and comments. */
  private skipToContent(inFlow: boolean): void {
    const s = this.s;
    for (;;) {
      this.skipSpaces();
      const c = s.charAt(this.i);
      if (c === '#') {
        const prev = this.i === 0 ? '\n' : s.charAt(this.i - 1);
        if (isWs(prev) || prev === '\n') {
          this.readComment(inFlow);
          continue;
        }
        return;
      }
      if (c === '\n') {
        this.i++;
        continue;
      }
      return;
    }
  }

  private checkLeadingTab(off: number): void {
    const ls = this.lineStart(off);
    for (let k = ls; k < off; k++) {
      if (this.s.charCodeAt(k) === 9) {
        const l = this.lineIdx(off);
        if (!this.leadingTabLines.has(l)) {
          this.leadingTabLines.add(l);
          this.addError('Tab characters cannot be used for indentation; use spaces', k, 'tabs');
        }
        return;
      }
    }
  }

  /** Move to the next piece of content (block context), validating indentation characters. */
  private nextContent(): void {
    const l0 = this.lineIdx(this.i);
    this.skipToContent(false);
    if (this.i < this.len && this.lineIdx(this.i) !== l0) this.checkLeadingTab(this.i);
  }

  private isDocMarkerAt(off: number): '---' | '...' | null {
    if (off !== 0 && this.s.charAt(off - 1) !== '\n') return null;
    const t = this.s.slice(off, off + 3);
    if ((t === '---' || t === '...') && isBlankOrEnd(this.s.charAt(off + 3))) return t;
    return null;
  }

  private isSeqEntryAt(off: number): boolean {
    return this.s.charAt(off) === '-' && isBlankOrEnd(this.s.charAt(off + 1));
  }

  /**
   * After an error: skip the rest of the current line and every following line that is
   * indented deeper than `c` (blank/comment lines are skipped too).
   */
  private skipDeeper(c: number): void {
    const s = this.s;
    this.i = this.eol(this.i);
    for (;;) {
      if (this.i >= this.len) return;
      // at '\n'
      const lineStart = this.i + 1;
      let k = lineStart;
      while (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9) k++;
      const ch = s.charAt(k);
      if (ch === '' ) {
        this.i = this.len;
        return;
      }
      if (ch === '\n' || ch === '#') {
        this.i = this.eol(k);
        continue;
      }
      if (this.isDocMarkerAt(lineStart)) {
        this.i = lineStart;
        return;
      }
      if (k - lineStart > c) {
        this.i = this.eol(k);
        continue;
      }
      this.i = k;
      return;
    }
  }

  private skipToDocBoundary(): void {
    this.i = this.eol(this.i);
    while (this.i < this.len) {
      const lineStart = this.i + 1;
      if (this.isDocMarkerAt(lineStart)) {
        this.i = lineStart;
        return;
      }
      this.i = this.eol(lineStart);
      if (lineStart >= this.len) break;
    }
    this.i = Math.min(this.i, this.len);
  }

  /* ---------- stream & documents ---------- */

  parse(): YamlParseResult {
    const s = this.s;
    // control characters
    const re = new RegExp(NON_PRINTABLE.source, 'gu');
    let found = 0;
    for (let m = re.exec(s); m && found < 3; m = re.exec(s)) {
      const cp = m[0].codePointAt(0) ?? 0;
      this.addError(
        `Character U+${cp.toString(16).toUpperCase().padStart(4, '0')} is not allowed in a YAML stream`,
        m.index,
        'syntax'
      );
      found++;
    }

    const docs: YamlDocument[] = [];
    for (;;) {
      this.nextContent();
      if (this.i >= this.len || this.tooManyErrors()) break;
      if (this.isDocMarkerAt(this.i) === '...') {
        this.i += 3;
        continue;
      }
      const before = this.i;
      docs.push(this.parseDocument(docs.length));
      if (this.i <= before) this.i = Math.min(this.len, before + 1);
    }

    // documents' trailing footer for the last document (comments after the final content)
    const lastDoc = docs[docs.length - 1];
    if (lastDoc && !lastDoc.explicitEnd) {
      lastDoc.footer = this.collectAbove(this.lineStarts.length);
    }
    this.attachComments();

    let unattached = 0;
    for (const t of this.comments) if (!t.used) unattached++;
    return {
      source: s,
      docs,
      errors: this.errors.sort((a, b) => a.offset - b.offset),
      anchors: this.allAnchors,
      tabSeparators: this.tabSeps,
      commentCount: this.comments.length,
      unattachedComments: unattached,
    };
  }

  private parseDocument(index: number): YamlDocument {
    const s = this.s;
    const doc: YamlDocument = {
      index,
      root: null,
      explicitStart: false,
      explicitEnd: false,
      directives: [],
      start: this.pos(this.i),
      leading: [],
      footer: [],
    };
    this.anchors = new Map();
    this.tagHandles = new Map();

    let sawYaml = false;
    while (this.colOf(this.i) === 0 && s.charAt(this.i) === '%') {
      const end = this.eol(this.i);
      const text = s.slice(this.i, end).replace(/\s+#.*$/, '').trimEnd();
      doc.directives.push(text);
      sawYaml = this.checkDirective(text, this.i, sawYaml) || sawYaml;
      this.i = end;
      this.nextContent();
    }

    const marker = this.isDocMarkerAt(this.i);
    if (marker === '---') {
      doc.explicitStart = true;
      doc.start = this.pos(this.i);
      const line0 = this.lineIdx(this.i);
      this.entries.push({ line0, target: doc });
      this.trailingTargets[line0] = doc;
      this.i += 3;
    } else if (doc.directives.length > 0) {
      this.addError('A directive must be followed by a "---" document start marker', this.i);
    }

    try {
      this.skipSpaces();
      const c = s.charAt(this.i);
      if (marker === '---' && c !== '' && c !== '\n' && c !== '#') {
        doc.root = this.parseBlockNode(-1, 'root', false);
      } else {
        this.nextContent();
        if (this.i < this.len && !this.isDocMarkerAt(this.i)) {
          doc.root = this.parseBlockNode(-1, 'line', false);
        }
      }
    } catch (e) {
      this.recordError(e);
      this.skipToDocBoundary();
    }
    if (doc.root && !doc.explicitStart) {
      const r = doc.root;
      const blockColl = (r.type === 'map' || r.type === 'seq') && !r.flow;
      if (!blockColl) this.entries.push({ line0: r.start.line - 1, target: doc });
    }

    // leftover content after the root node
    for (;;) {
      this.nextContent();
      if (this.i >= this.len || this.isDocMarkerAt(this.i) || this.tooManyErrors()) break;
      if (this.colOf(this.i) === 0 && s.charAt(this.i) === '%') break;
      const before = this.i;
      const root = doc.root;
      let msg = 'Unexpected content after the end of the document. Check the indentation, or start a new document with "---".';
      if (root && root.type === 'seq' && !root.flow) {
        msg = 'Expected another sequence entry ("- ") here. Content at the same indentation as the sequence items must also start with "- ".';
      } else if (root && root.type === 'map' && !root.flow) {
        msg = 'Unexpected content after the mapping. Every line at this indentation must be a "key: value" pair.';
      } else if (root && root.type === 'scalar') {
        msg = 'Unexpected content after a plain value. A document that starts with a plain value can only contain that value.';
      }
      this.addError(msg, this.i);
      try {
        this.parseBlockNode(-1, 'line', false);
      } catch (e) {
        this.recordError(e);
        this.i = this.eol(this.i);
      }
      if (this.i <= before) this.i = this.eol(this.i);
    }

    if (this.isDocMarkerAt(this.i) === '...') {
      doc.explicitEnd = true;
      const line0 = this.lineIdx(this.i);
      doc.footer = this.collectAbove(line0);
      this.trailingTargets[line0] = { trailing: undefined };
      this.i += 3;
      this.skipSpaces();
      const c = s.charAt(this.i);
      if (c === '#') {
        this.readComment(false);
      } else if (c !== '' && c !== '\n') {
        this.addError('Unexpected content after the document end marker "..."', this.i);
        this.i = this.eol(this.i);
      }
    }
    return doc;
  }

  private checkDirective(text: string, off: number, sawYaml: boolean): boolean {
    const m = /^%(\S+)\s*(.*)$/.exec(text);
    const name = m?.[1] ?? '';
    const rest = m?.[2] ?? '';
    if (name === '' || name.startsWith('#')) {
      this.addError('A directive needs a name (%YAML or %TAG)', off);
      return false;
    }
    if (name === 'YAML') {
      if (sawYaml) this.addError('Duplicate %YAML directive', off);
      const v = /^(\d+)\.(\d+)$/.exec(rest);
      if (!v) this.addError(`Invalid %YAML directive "${text}" (expected "%YAML 1.2")`, off);
      else if (v[1] !== '1') this.addError(`Unsupported YAML version ${rest} (only 1.x is supported)`, off);
      return true;
    }
    if (name === 'TAG') {
      const t = /^(!(?:[A-Za-z0-9-]*!)?)\s+(\S+)$/.exec(rest);
      if (!t) this.addError(`Invalid %TAG directive "${text}"`, off);
      else {
        if (this.tagHandles.has(t[1] ?? '')) this.addError(`Duplicate %TAG directive for the handle ${t[1] ?? ''}`, off);
        this.tagHandles.set(t[1] ?? '', t[2] ?? '');
      }
      return false;
    }
    return false;
  }

  /* ---------- properties ---------- */

  private parseProps(inFlow: boolean): Props | null {
    const s = this.s;
    let props: Props | null = null;
    for (;;) {
      const c = s.charAt(this.i);
      if (c === '&') {
        const start = this.i;
        if (props?.anchor !== undefined) throw this.err('A node can have only one anchor', start);
        let j = start + 1;
        while (j < this.len) {
          const d = s.charAt(j);
          if (isBlankOrEnd(d) || isFlowInd(d)) break;
          j++;
        }
        let name = s.slice(start + 1, j);
        if (name.endsWith(':') && name.length > 1 && isBlankOrEnd(s.charAt(j))) {
          // like libyaml: "&a: x" is an anchor "a" on an empty key, not an anchor named "a:"
          name = name.slice(0, -1);
          j--;
        }
        if (name === '') throw this.err('Anchor name is missing after "&"', start);
        if (s.charAt(j) !== ':') this.expectPropEnd(j, inFlow, `Anchor "&${name}"`);
        props = props ?? {};
        props.anchor = name;
        props.anchorPos = this.pos(start);
        this.pendingAnchors.add(name);
        this.i = j;
      } else if (c === '!') {
        const start = this.i;
        if (props?.tag !== undefined) throw this.err('A node can have only one tag', start);
        let j = start + 1;
        if (s.charAt(j) === '<') {
          const close = s.indexOf('>', j);
          if (close === -1 || s.slice(j, close).includes('\n')) throw this.err('Unterminated verbatim tag "!<…>"', start);
          j = close + 1;
        } else {
          while (j < this.len) {
            const d = s.charAt(j);
            if (isBlankOrEnd(d) || isFlowInd(d)) break;
            j++;
          }
        }
        const tag = s.slice(start, j);
        this.expectPropEnd(j, inFlow, `Tag "${tag}"`);
        this.checkTag(tag, start);
        props = props ?? {};
        props.tag = tag;
        props.tagPos = this.pos(start);
        this.i = j;
      } else break;
      this.skipSpaces();
    }
    return props;
  }

  private expectPropEnd(j: number, inFlow: boolean, what: string): void {
    const d = this.s.charAt(j);
    if (isBlankOrEnd(d) || (inFlow && isFlowInd(d))) return;
    throw this.err(`${what} must be followed by a space (found "${d}")`, j);
  }

  private checkTag(tag: string, off: number): void {
    if (/%(?![0-9A-Fa-f]{2})/.test(tag)) throw this.err(`Tag "${tag}" contains an invalid %-escape`, off);
    const body = tag.startsWith('!<') ? tag.slice(2, -1) : tag;
    const bad = (tag.startsWith('!<') ? /[^0-9A-Za-z\-#;/?:@&=+$,_.!~*'()[\]%]/ : /[^0-9A-Za-z\-#;/?:@&=+$_.!~*'()%]/).exec(body);
    if (bad) throw this.err(`Tag "${tag}" contains the invalid character "${bad[0]}"`, off + 1 + bad.index);
    if (tag === '!' || tag.startsWith('!<')) return;
    const m = /^(!(?:[A-Za-z0-9-]*)!)(.*)$/.exec(tag);
    if (m) {
      const handle = m[1] ?? '';
      if (handle !== '!!' && !this.tagHandles.has(handle)) {
        throw this.err(`Tag handle "${handle}" is not declared (add a %TAG directive)`, off);
      }
      if ((m[2] ?? '') === '') throw this.err(`Tag "${tag}" has no name after the handle`, off);
    }
  }

  private applyProps(node: YamlNode, props: Props): void {
    if (node.type === 'alias') {
      throw this.err('An alias (*name) cannot have its own anchor or tag', (props.anchorPos ?? props.tagPos)?.offset ?? this.i);
    }
    if (props.tag !== undefined) {
      if (node.tag !== undefined) throw this.err('A node can have only one tag', props.tagPos?.offset ?? this.i);
      node.tag = props.tag;
      node.tagPos = props.tagPos;
    }
    if (props.anchor !== undefined) {
      if (node.anchor !== undefined) throw this.err('A node can have only one anchor', props.anchorPos?.offset ?? this.i);
      node.anchor = props.anchor;
      node.anchorPos = props.anchorPos;
      this.pendingAnchors.delete(props.anchor);
      const info: AnchorInfo = { name: props.anchor, pos: props.anchorPos ?? node.start, node, uses: 0 };
      this.anchors.set(props.anchor, info);
      this.allAnchors.push(info);
    }
  }

  private emptyScalar(props: Props | null, off: number): ScalarNode {
    const node: ScalarNode = {
      type: 'scalar',
      style: 'plain',
      value: '',
      empty: true,
      start: this.pos(off),
      endOffset: off,
      endLine: this.pos(off).line,
    };
    if (props) this.applyProps(node, props);
    return node;
  }

  /* ---------- block nodes ---------- */

  private parseBlockNode(n: number, mode: NodeMode, seqAtN: boolean): YamlNode | null {
    if (++this.depth > MAX_DEPTH) {
      this.depth--;
      throw this.err(`Nesting is too deep (more than ${MAX_DEPTH} levels)`);
    }
    try {
      return this.parseBlockNodeInner(n, mode, seqAtN);
    } finally {
      this.depth--;
    }
  }

  private parseBlockNodeInner(n: number, mode: NodeMode, seqAtN: boolean): YamlNode | null {
    const s = this.s;
    const startOff = this.i;
    const startCol = this.colOf(startOff);
    const props = this.parseProps(false);

    if (props) {
      const c0 = s.charAt(this.i);
      if (c0 === '' || c0 === '\n' || c0 === '#') {
        // properties alone on their line: they apply to the node that follows
        const afterProps = this.i;
        this.nextContent();
        const have = this.i < this.len && !this.isDocMarkerAt(this.i);
        const col = have ? this.colOf(this.i) : -1;
        if (!have || !(col > n || (seqAtN && col === n && this.isSeqEntryAt(this.i)))) {
          return this.emptyScalar(props, afterProps);
        }
        const node = this.parseBlockNode(n, 'line', seqAtN);
        if (node === null) return this.emptyScalar(props, afterProps);
        this.applyProps(node, props);
        return node;
      }
    }

    const compactOk = mode === 'line' || mode === 'seq' || mode === 'explicit';
    const here = this.i;
    const c = s.charAt(here);
    const c1 = s.charAt(here + 1);

    if (c === '-' && isBlankOrEnd(c1)) {
      if (!compactOk) {
        throw this.err('A block sequence ("- item") is not allowed here; put the list on its own lines, indented under the key', here);
      }
      if (props) {
        throw this.err('An anchor or tag cannot come before "- " on the same line; put it on its own line above the list', here);
      }
      return this.parseBlockSeq(startCol);
    }
    if ((c === '?' || c === ':') && isBlankOrEnd(c1)) {
      if (!compactOk) {
        throw this.err(`"${c} " is not allowed here; mappings must start on their own line, indented under the key`, here);
      }
      if (props && c === '?') throw this.err('An anchor or tag cannot come before "? " on the same line', here);
      return this.parseBlockMapping(startCol, props ? this.emptyScalar(props, here) : null, startOff);
    }
    if (c === '|' || c === '>') {
      const node = this.parseBlockScalar(n);
      if (props) this.applyProps(node, props);
      return node;
    }

    let head: YamlNode;
    let plain = false;
    switch (c) {
      case '"':
        head = this.parseDoubleQuoted();
        break;
      case "'":
        head = this.parseSingleQuoted();
        break;
      case '[':
      case '{':
        head = this.parseFlowCollection();
        break;
      case '*':
        head = this.parseAlias(false);
        break;
      case '@':
      case '`':
      case '%':
        throw this.reservedChar(c, here);
      case ']':
      case '}':
      case ',':
        throw this.err(`Unexpected "${c}" — it is only valid inside a flow collection ([...] or {...})`, here);
      case '':
        return this.emptyScalar(props, here);
      default:
        head = this.parsePlainFirstLine(false);
        plain = true;
        break;
    }

    // implicit key?
    let p = this.i;
    while (isWs(s.charAt(p))) p++;
    if (s.charAt(p) === ':' && isBlankOrEnd(s.charAt(p + 1))) {
      if (!compactOk) {
        throw this.err(
          'A nested mapping ("key: value") is not allowed on the same line as its parent key; put it on a new line and indent it',
          p
        );
      }
      if (head.type === 'scalar' && head.multiline) {
        throw this.err('Implicit mapping keys must fit on a single line (use "? " for multi-line keys)', head.start.offset);
      }
      if (props) this.applyProps(head, props);
      this.i = p;
      return this.parseBlockMapping(startCol, head, startOff);
    }
    if (plain) this.continuePlain(head as ScalarNode, n);
    else this.expectLineEnd();
    if (props) this.applyProps(head, props);
    return head;
  }

  private reservedChar(c: string, off: number): YamlSyntaxError {
    if (c === '%' && this.colOf(off) === 0 && /^%[A-Za-z]/.test(this.s.slice(off, off + 2))) {
      return this.err(
        'A directive (%YAML / %TAG) is only allowed at the start of a document: end the previous document with "..." first. If this is text, wrap it in quotes.',
        off
      );
    }
    return this.err(`The character "${c}" is reserved in YAML and cannot start a plain value. If this is text, wrap it in quotes.`, off);
  }

  private expectLineEnd(): void {
    this.skipSpaces();
    const c = this.s.charAt(this.i);
    if (c === '' || c === '\n') return;
    if (c === '#' && isWs(this.s.charAt(this.i - 1))) return;
    throw this.err(`Unexpected content "${this.s.slice(this.i, this.i + 20).split('\n')[0] ?? ''}" after the value; a comment needs " #" with a space before it`);
  }

  private setEnd(node: NodeBase, endOffset: number): void {
    node.endOffset = endOffset;
    node.endLine = this.lineIdx(Math.max(0, endOffset - (endOffset > 0 ? 1 : 0))) + 1;
  }

  /* ---------- sequences ---------- */

  private parseBlockSeq(c: number): SeqNode {
    const s = this.s;
    const startOff = this.i;
    const seq: SeqNode = {
      type: 'seq',
      flow: false,
      items: [],
      start: this.pos(startOff),
      endOffset: startOff,
      endLine: this.pos(startOff).line,
    };
    for (;;) {
      const dashOff = this.i;
      const item: SeqItem = { value: null, start: this.pos(dashOff), leading: [] };
      this.entries.push({ line0: item.start.line - 1, target: item });
      seq.items.push(item);
      try {
        this.i++;
        this.skipSpaces();
        const ch0 = s.charAt(this.i);
        if (ch0 === '' || ch0 === '\n' || ch0 === '#') {
          this.nextContent();
          if (this.i < this.len && !this.isDocMarkerAt(this.i) && this.colOf(this.i) > c) {
            item.value = this.parseBlockNode(c, 'line', false);
          }
        } else {
          item.value = this.parseBlockNode(c, 'seq', false);
        }
      } catch (e) {
        this.recordError(e);
        this.skipDeeper(c);
      }
      this.registerTrailing(item.start.line - 1, item, item.value, true);
      this.setEnd(seq, Math.max(seq.endOffset, item.value ? item.value.endOffset : dashOff + 1));

      for (;;) {
        this.nextContent();
        if (this.i >= this.len || this.isDocMarkerAt(this.i) || this.tooManyErrors()) return seq;
        const cc = this.colOf(this.i);
        if (cc < c) return seq;
        if (cc > c) {
          this.addError(
            `Unexpected indentation: sequence items start at column ${c + 1} but this line starts at column ${cc + 1}`,
            this.i
          );
          this.skipDeeper(c);
          continue;
        }
        break;
      }
      if (!this.isSeqEntryAt(this.i)) return seq;
    }
  }

  /** Decide on which source line a trailing comment for this entry would sit. */
  private registerTrailing(
    startLine0: number,
    target: { trailing?: string },
    value: YamlNode | null,
    isSeqItem: boolean
  ): void {
    if (value === null) {
      this.trailingTargets[startLine0] = target;
      return;
    }
    if (value.type === 'scalar' && (value.style === 'literal' || value.style === 'folded')) {
      this.trailingTargets[value.start.line - 1] = target;
      return;
    }
    if ((value.type === 'map' || value.type === 'seq') && !value.flow) {
      if (isSeqItem && value.start.line - 1 === startLine0) return; // compact: inner entry owns the line
      this.trailingTargets[startLine0] = target;
      return;
    }
    this.trailingTargets[value.endLine - 1] = target;
  }

  /* ---------- mappings ---------- */

  private parseBlockMapping(c: number, firstKey: YamlNode | null, startOff: number): MapNode {
    const map: MapNode = {
      type: 'map',
      flow: false,
      pairs: [],
      start: this.pos(startOff),
      endOffset: startOff,
      endLine: this.pos(startOff).line,
    };
    let pre = firstKey;
    for (;;) {
      const pair: MapPair = {
        key: null,
        value: null,
        start: this.pos(pre ? startOff : this.i),
        explicit: false,
        leading: [],
      };
      map.pairs.push(pair);
      this.entries.push({ line0: pair.start.line - 1, target: pair });
      try {
        this.parseMapPair(pair, c, pre);
      } catch (e) {
        this.recordError(e);
        this.skipDeeper(c);
      }
      pre = null;
      this.registerTrailing((pair.colon ?? pair.start).line - 1, pair, pair.value, false);
      const last = pair.value ?? pair.key;
      if (last) this.setEnd(map, Math.max(map.endOffset, last.endOffset));

      for (;;) {
        this.nextContent();
        if (this.i >= this.len || this.isDocMarkerAt(this.i) || this.tooManyErrors()) return map;
        const cc = this.colOf(this.i);
        if (cc < c) return map;
        if (cc > c) {
          this.addError(
            `Unexpected indentation: mapping keys start at column ${c + 1} but this line starts at column ${cc + 1}. Indent it under a key, or align it with the other keys.`,
            this.i
          );
          this.skipDeeper(c);
          continue;
        }
        if (this.isSeqEntryAt(this.i)) {
          this.addError(
            'Unexpected "- " list item inside a mapping. List items must be indented under a key, or this line is missing its "key:".',
            this.i
          );
          this.skipDeeper(c);
          continue;
        }
        break;
      }
    }
  }

  private parseMapPair(pair: MapPair, c: number, pre: YamlNode | null): void {
    const s = this.s;
    const c0 = s.charAt(this.i);
    const c1 = s.charAt(this.i + 1);
    if (!pre && c0 === '?' && isBlankOrEnd(c1)) {
      pair.explicit = true;
      this.i++;
      this.skipSpaces();
      const k = s.charAt(this.i);
      if (k === '' || k === '\n' || k === '#') {
        this.nextContent();
        if (this.i < this.len && !this.isDocMarkerAt(this.i) && this.colOf(this.i) > c) {
          pair.key = this.parseBlockNode(c, 'line', false);
        }
      } else {
        pair.key = this.parseBlockNode(c, 'explicit', false);
      }
      this.nextContent();
      if (
        this.i < this.len &&
        !this.isDocMarkerAt(this.i) &&
        this.colOf(this.i) === c &&
        s.charAt(this.i) === ':' &&
        isBlankOrEnd(s.charAt(this.i + 1))
      ) {
        pair.colon = this.pos(this.i);
        this.i++;
        pair.value = this.parseMapValue(c, true);
      }
      return;
    }
    if (!pre && c0 === ':' && isBlankOrEnd(c1)) {
      pair.colon = this.pos(this.i);
      this.i++;
      pair.value = this.parseMapValue(c, false);
      return;
    }
    pair.key = pre ?? this.parseImplicitKey();
    pair.colon = this.pos(this.i);
    this.i++;
    pair.value = this.parseMapValue(c, false);
  }

  private parseImplicitKey(): YamlNode {
    const s = this.s;
    const startOff = this.i;
    const props = this.parseProps(false);
    const c = s.charAt(this.i);
    let head: YamlNode;
    switch (c) {
      case '"':
        head = this.parseDoubleQuoted();
        break;
      case "'":
        head = this.parseSingleQuoted();
        break;
      case '[':
      case '{':
        head = this.parseFlowCollection();
        break;
      case '*':
        head = this.parseAlias(false);
        break;
      case '|':
      case '>':
        throw this.err('A block scalar ("|" or ">") cannot be used as a mapping key', this.i);
      case '@':
      case '`':
      case '%':
        throw this.reservedChar(c, this.i);
      case ']':
      case '}':
      case ',':
        throw this.err(`Unexpected "${c}" — it is only valid inside a flow collection ([...] or {...})`, this.i);
      case '':
      case '\n':
        throw this.err('Expected a "key: value" pair', this.i);
      case ':':
        if (isBlankOrEnd(s.charAt(this.i + 1)) && props) {
          head = this.emptyScalar(props, this.i);
          break;
        }
        head = this.parsePlainFirstLine(false);
        break;
      default:
        head = this.parsePlainFirstLine(false);
        break;
    }
    let p = this.i;
    while (isWs(s.charAt(p))) p++;
    if (!(s.charAt(p) === ':' && isBlankOrEnd(s.charAt(p + 1)))) {
      const shown = s.slice(startOff, this.eol(startOff)).trim();
      throw this.err(
        `Expected a "key: value" pair, but found no ":" after "${shown.length > 40 ? shown.slice(0, 40) + '…' : shown}". ` +
          'If this line continues the previous value, indent it more; otherwise add "key:".',
        startOff
      );
    }
    if (head.type === 'scalar' && head.multiline) {
      throw this.err('Implicit mapping keys must fit on a single line (use "? " for multi-line keys)', head.start.offset);
    }
    if (p - head.start.offset > 1024) {
      throw this.err('Implicit mapping keys are limited to 1024 characters (use "? " for long keys)', head.start.offset);
    }
    if (props && head.anchor === undefined && head.tag === undefined) this.applyProps(head, props);
    this.i = p;
    return head;
  }

  private parseMapValue(c: number, explicit: boolean): YamlNode | null {
    const s = this.s;
    this.skipSpaces();
    const ch0 = s.charAt(this.i);
    if (ch0 === '' || ch0 === '\n' || ch0 === '#') {
      this.nextContent();
      if (this.i >= this.len || this.isDocMarkerAt(this.i)) return null;
      const cc = this.colOf(this.i);
      if (cc > c) return this.parseBlockNode(c, 'line', false);
      if (cc === c && !explicit && this.isSeqEntryAt(this.i)) return this.parseBlockSeq(c);
      return null;
    }
    return this.parseBlockNode(c, explicit ? 'explicit' : 'value', !explicit);
  }

  /* ---------- plain scalars ---------- */

  private scanPlainLine(from: number, inFlow: boolean): number {
    const s = this.s;
    let j = from;
    let lastNonWs = from;
    for (;;) {
      const c = s.charAt(j);
      if (c === '' || c === '\n') break;
      if (c === ':') {
        const nx = s.charAt(j + 1);
        if (isBlankOrEnd(nx) || (inFlow && isFlowInd(nx))) break;
      } else if (c === '#') {
        if (j > from && isWs(s.charAt(j - 1))) break;
      } else if (inFlow && isFlowInd(c)) break;
      j++;
      if (c !== ' ' && c !== '\t') lastNonWs = j;
    }
    return lastNonWs;
  }

  private parsePlainFirstLine(inFlow: boolean): ScalarNode {
    const start = this.i;
    const end = this.scanPlainLine(start, inFlow);
    if (end === start) throw this.err(`Unexpected character "${this.s.charAt(start)}"`, start);
    const value = this.s.slice(start, end);
    const node: ScalarNode = {
      type: 'scalar',
      style: 'plain',
      value,
      raw: value,
      start: this.pos(start),
      endOffset: end,
      endLine: this.lineIdx(end - 1) + 1,
    };
    this.i = end;
    return node;
  }

  private continuePlain(node: ScalarNode, n: number): void {
    const s = this.s;
    const lines = [node.value];
    let value = node.value;
    let end = node.endOffset;
    for (;;) {
      let k = end;
      while (isWs(s.charAt(k))) k++;
      if (s.charAt(k) !== '\n') break;
      let p = k + 1;
      let blanks = 0;
      let q = p;
      for (;;) {
        q = p;
        while (isWs(s.charAt(q))) q++;
        if (s.charAt(q) === '\n') {
          blanks++;
          p = q + 1;
          continue;
        }
        break;
      }
      const c = s.charAt(q);
      if (c === '' || c === '#') break;
      let ind = 0;
      while (s.charAt(p + ind) === ' ') ind++;
      if (ind <= n) break;
      if (this.isDocMarkerAt(p)) break;
      const lineEnd = this.scanPlainLine(q, false);
      if (lineEnd === q) break;
      let t = lineEnd;
      while (isWs(s.charAt(t))) t++;
      if (s.charAt(t) === ':' && isBlankOrEnd(s.charAt(t + 1))) {
        throw this.err(
          'A nested "key: value" cannot continue a multi-line plain value. Indent the nested mapping on its own lines, or quote the text if it contains ": ".',
          t
        );
      }
      const text = s.slice(q, lineEnd);
      for (let b = 0; b < blanks; b++) lines.push('');
      lines.push(text);
      value += (blanks > 0 ? '\n'.repeat(blanks) : ' ') + text;
      end = lineEnd;
    }
    if (lines.length > 1) {
      node.multiline = true;
      node.lines = lines;
      node.raw = undefined;
      const l0 = node.start.line - 1;
      const l1 = this.lineIdx(end - 1);
      for (let l = l0 + 1; l <= l1; l++) this.owned.add(l);
    }
    node.value = value;
    this.setEnd(node, end);
    this.i = end;
  }

  private parseAlias(inFlow: boolean): AliasNode {
    const s = this.s;
    const start = this.i;
    let j = start + 1;
    while (j < this.len) {
      const d = s.charAt(j);
      if (isBlankOrEnd(d) || isFlowInd(d)) break;
      j++;
    }
    let name = s.slice(start + 1, j);
    if (name.endsWith(':') && (isBlankOrEnd(s.charAt(j)) || (inFlow && isFlowInd(s.charAt(j))))) {
      name = name.slice(0, -1);
      j--;
    }
    if (name === '') throw this.err('Alias name is missing after "*"', start);
    this.i = j;
    const node: AliasNode = {
      type: 'alias',
      name,
      start: this.pos(start),
      endOffset: j,
      endLine: this.lineIdx(j - 1) + 1,
    };
    const target = this.anchors.get(name);
    if (target) {
      node.target = target.node;
      target.uses++;
    } else if (this.pendingAnchors.has(name)) {
      this.addError(
        `Recursive alias "*${name}": a node cannot contain an alias to its own anchor "&${name}" (it cannot be converted to JSON).`,
        start,
        'undefined-alias'
      );
    } else {
      this.addError(
        `Undefined alias "*${name}": no anchor "&${name}" is defined earlier in this document. ` +
          'If you meant literal text (such as a glob like "*.js"), wrap the value in quotes.',
        start,
        'undefined-alias'
      );
    }
    return node;
  }

  /* ---------- quoted scalars ---------- */

  /** After a line break inside a quoted scalar: count blank lines, skip leading indentation. */
  private scanFlowBreaks(startOff: number): string {
    const s = this.s;
    let breaks = '';
    for (;;) {
      if (this.colOf(this.i) === 0 && this.isDocMarkerAt(this.i)) {
        throw this.err('Found a document separator ("---" or "...") inside a quoted string; the string is probably missing its closing quote', startOff);
      }
      while (isWs(s.charAt(this.i))) this.i++;
      if (s.charAt(this.i) === '\n') {
        breaks += '\n';
        this.i++;
        continue;
      }
      return breaks;
    }
  }

  private finishQuoted(node: ScalarNode, start: number): void {
    const end = this.i;
    this.setEnd(node, end);
    if (node.multiline) {
      const slice = this.s.slice(start, end);
      node.lines = slice.split('\n').map((ln) => {
        const lead = ln.replace(/^[ \t]+/, '');
        const trimmed = lead.replace(/[ \t]+$/, '');
        if (trimmed.length === lead.length || node.style !== 'double') return trimmed;
        // keep one whitespace character that is protected by a backslash
        let bs = 0;
        for (let k = trimmed.length - 1; k >= 0 && trimmed.charAt(k) === '\\'; k--) bs++;
        return bs % 2 === 1 ? trimmed + lead.charAt(trimmed.length) : trimmed;
      });
      const l0 = this.lineIdx(start);
      const l1 = this.lineIdx(end - 1);
      for (let l = l0 + 1; l <= l1; l++) this.owned.add(l);
    } else {
      node.raw = this.s.slice(start, end);
    }
  }

  private parseDoubleQuoted(): ScalarNode {
    const s = this.s;
    const start = this.i;
    this.i++;
    let value = '';
    let multiline = false;
    for (;;) {
      const c = s.charAt(this.i);
      if (c === '') throw this.err('Unterminated double-quoted string: the closing " is missing', start);
      if (c === '"') {
        this.i++;
        break;
      }
      if (c === '\\') {
        const e = s.charAt(this.i + 1);
        if (e === '\n') {
          this.i += 2;
          multiline = true;
          value += this.scanFlowBreaks(start);
          continue;
        }
        const simple = ESCAPES[e];
        if (e !== '' && simple !== undefined) {
          value += simple;
          this.i += 2;
          continue;
        }
        const hexLen = e === 'x' ? 2 : e === 'u' ? 4 : e === 'U' ? 8 : 0;
        if (hexLen > 0) {
          const hex = s.slice(this.i + 2, this.i + 2 + hexLen);
          if (hex.length !== hexLen || !/^[0-9a-fA-F]+$/.test(hex)) {
            throw this.err(`Invalid escape "\\${e}${hex.slice(0, hexLen)}": expected ${hexLen} hexadecimal digits`, this.i);
          }
          const cp = parseInt(hex, 16);
          if (cp > 0x10ffff) throw this.err(`Invalid escape "\\${e}${hex}": code point is out of range`, this.i);
          value += String.fromCodePoint(cp);
          this.i += 2 + hexLen;
          continue;
        }
        throw this.err(`Unknown escape sequence "\\${e}" in double-quoted string (to write a backslash use "\\\\")`, this.i);
      }
      if (c === ' ' || c === '\t') {
        let j = this.i;
        while (isWs(s.charAt(j))) j++;
        const d = s.charAt(j);
        if (d === '\n') {
          this.i = j + 1;
          multiline = true;
          const breaks = this.scanFlowBreaks(start);
          value += breaks === '' ? ' ' : breaks;
          continue;
        }
        if (d === '') throw this.err('Unterminated double-quoted string: the closing " is missing', start);
        value += s.slice(this.i, j);
        this.i = j;
        continue;
      }
      if (c === '\n') {
        this.i++;
        multiline = true;
        const breaks = this.scanFlowBreaks(start);
        value += breaks === '' ? ' ' : breaks;
        continue;
      }
      let j = this.i;
      for (;;) {
        const d = s.charCodeAt(j);
        if (d === 34 || d === 92 || d === 32 || d === 9 || d === 10 || Number.isNaN(d)) break;
        j++;
      }
      value += s.slice(this.i, j);
      this.i = j;
    }
    const node: ScalarNode = {
      type: 'scalar',
      style: 'double',
      value,
      multiline,
      start: this.pos(start),
      endOffset: this.i,
      endLine: 0,
    };
    this.finishQuoted(node, start);
    return node;
  }

  private parseSingleQuoted(): ScalarNode {
    const s = this.s;
    const start = this.i;
    this.i++;
    let value = '';
    let multiline = false;
    for (;;) {
      const c = s.charAt(this.i);
      if (c === '') throw this.err("Unterminated single-quoted string: the closing ' is missing", start);
      if (c === "'") {
        if (s.charAt(this.i + 1) === "'") {
          value += "'";
          this.i += 2;
          continue;
        }
        this.i++;
        break;
      }
      if (c === ' ' || c === '\t') {
        let j = this.i;
        while (isWs(s.charAt(j))) j++;
        const d = s.charAt(j);
        if (d === '\n') {
          this.i = j + 1;
          multiline = true;
          const breaks = this.scanFlowBreaks(start);
          value += breaks === '' ? ' ' : breaks;
          continue;
        }
        if (d === '') throw this.err("Unterminated single-quoted string: the closing ' is missing", start);
        value += s.slice(this.i, j);
        this.i = j;
        continue;
      }
      if (c === '\n') {
        this.i++;
        multiline = true;
        const breaks = this.scanFlowBreaks(start);
        value += breaks === '' ? ' ' : breaks;
        continue;
      }
      let j = this.i;
      for (;;) {
        const d = s.charCodeAt(j);
        if (d === 39 || d === 32 || d === 9 || d === 10 || Number.isNaN(d)) break;
        j++;
      }
      value += s.slice(this.i, j);
      this.i = j;
    }
    const node: ScalarNode = {
      type: 'scalar',
      style: 'single',
      value,
      multiline,
      start: this.pos(start),
      endOffset: this.i,
      endLine: 0,
    };
    this.finishQuoted(node, start);
    return node;
  }

  /* ---------- block scalars ---------- */

  private parseBlockScalar(n: number): ScalarNode {
    const s = this.s;
    const start = this.i;
    const style: ScalarStyle = s.charAt(start) === '|' ? 'literal' : 'folded';
    this.i++;
    let chomp: Chomp = 'clip';
    let ind = 0;
    for (let k = 0; k < 2; k++) {
      const c = s.charAt(this.i);
      if (c === '+' || c === '-') {
        chomp = c === '+' ? 'keep' : 'strip';
        this.i++;
      } else if (c >= '1' && c <= '9' && ind === 0) {
        ind = Number(c);
        this.i++;
      } else if (c === '0') {
        throw this.err('A block scalar indentation indicator must be between 1 and 9', this.i);
      }
    }
    this.skipSpaces();
    const hc = s.charAt(this.i);
    if (hc === '#') {
      if (!isWs(s.charAt(this.i - 1))) throw this.err('A comment needs a space before the "#"', this.i);
      this.readComment(false);
    } else if (hc !== '' && hc !== '\n') {
      throw this.err(
        `Unexpected "${s.slice(this.i, this.i + 12).split('\n')[0] ?? ''}" after the block scalar header "${s.slice(start, this.i)}". ` +
          'Block scalar content must start on the next line (only a chomping +/- and an indentation digit are allowed here).',
        this.i
      );
    }
    const headerLine0 = this.lineIdx(start);
    const node: ScalarNode = {
      type: 'scalar',
      style,
      value: '',
      chomp,
      indentIndicator: ind || undefined,
      lines: [],
      start: this.pos(start),
      endOffset: this.i,
      endLine: headerLine0 + 1,
    };
    if (this.i >= this.len) return node;
    this.i++; // consume the newline after the header

    // determine content indentation
    const minIndent = Math.max(n + 1, 0);
    let indent: number;
    if (ind > 0) {
      indent = Math.max(n, 0) + ind;
    } else {
      let p = this.i;
      let maxBlank = 0;
      indent = -1;
      for (;;) {
        if (p >= this.len) break;
        let k = 0;
        while (s.charAt(p + k) === ' ') k++;
        const ch = s.charAt(p + k);
        if (ch === '\n' || ch === '') {
          maxBlank = Math.max(maxBlank, k);
          if (ch === '') break;
          p = p + k + 1;
          continue;
        }
        indent = k;
        break;
      }
      if (indent !== -1 && maxBlank > indent && indent >= minIndent) {
        this.addError(
          'A leading blank line in this block scalar has more spaces than its first content line; indent the first line more, or add an indentation indicator (e.g. "|2")',
          this.i
        );
      }
      if (indent !== -1 && indent < minIndent) indent = -1;
    }

    const lines: string[] = [];
    let p = this.i;
    let lastContentLine0 = headerLine0;
    let unterminated = false;
    for (;;) {
      if (p >= this.len) break;
      let k = 0;
      while (s.charAt(p + k) === ' ') k++;
      const lineEnd = this.eol(p);
      const isBlank = p + k === lineEnd;
      if (isBlank) {
        if (indent === -1 || k <= indent) lines.push('');
        else {
          lines.push(' '.repeat(k - indent));
          if (lineEnd >= this.len) unterminated = true;
        }
        p = lineEnd + 1;
        if (lineEnd >= this.len) break;
        continue;
      }
      if (indent === -1 || k < indent) break;
      if (indent === 0 && this.isDocMarkerAt(p)) break;
      lines.push(s.slice(p + indent, lineEnd));
      lastContentLine0 = this.lineIdx(p);
      p = lineEnd + 1;
      if (lineEnd >= this.len) {
        unterminated = true;
        break;
      }
    }
    // Trailing blank (empty) lines carry no content unless chomping is "keep".
    let bodyEnd = lines.length;
    while (bodyEnd > 0 && lines[bodyEnd - 1] === '') bodyEnd--;
    const trailingBlanks = lines.length - bodyEnd;
    node.value = foldBlockScalar(lines.slice(0, bodyEnd), trailingBlanks, style === 'folded', chomp, unterminated);
    node.lines = chomp === 'keep' ? lines : lines.slice(0, bodyEnd);

    const endLine0 = chomp === 'keep' ? headerLine0 + lines.length : lastContentLine0;
    for (let l = headerLine0 + 1; l <= endLine0; l++) this.owned.add(l);
    node.endLine = Math.max(headerLine0, endLine0) + 1;
    // the parser resumes at the start of the first line that is not part of the scalar
    this.i = Math.min(p, this.len);
    node.endOffset = this.i;
    return node;
  }

  /* ---------- flow collections ---------- */

  private skipFlowWs(startOff: number): void {
    const s = this.s;
    for (;;) {
      this.skipSpaces();
      const c = s.charAt(this.i);
      if (c === '\n') {
        this.i++;
        if (this.isDocMarkerAt(this.i)) {
          throw this.err('Found a document separator ("---" or "...") inside a flow collection; it is probably missing its closing bracket', startOff);
        }
        continue;
      }
      if (c === '#') {
        const prev = this.i === 0 ? '\n' : s.charAt(this.i - 1);
        if (isWs(prev) || prev === '\n') {
          this.readComment(true);
          continue;
        }
      }
      return;
    }
  }

  private parseFlowCollection(): SeqNode | MapNode {
    if (++this.depth > MAX_DEPTH) {
      this.depth--;
      throw this.err(`Nesting is too deep (more than ${MAX_DEPTH} levels)`);
    }
    try {
      return this.s.charAt(this.i) === '[' ? this.parseFlowSeq() : this.parseFlowMap();
    } finally {
      this.depth--;
    }
  }

  private isFlowValueIndicator(key: YamlNode | null): boolean {
    const s = this.s;
    if (s.charAt(this.i) !== ':') return false;
    const nx = s.charAt(this.i + 1);
    if (isBlankOrEnd(nx) || isFlowInd(nx)) return true;
    // JSON-like keys may be followed directly by ":"
    if (key && (key.type === 'map' || key.type === 'seq')) return true;
    if (key && key.type === 'scalar' && (key.style === 'double' || key.style === 'single')) return true;
    return false;
  }

  private parseFlowNode(): YamlNode {
    const s = this.s;
    const startOff = this.i;
    const props = this.parseProps(true);
    if (props) this.skipFlowWs(startOff);
    const c = s.charAt(this.i);
    let node: YamlNode;
    switch (c) {
      case '[':
      case '{':
        node = this.parseFlowCollection();
        break;
      case '*':
        node = this.parseAlias(true);
        break;
      case '"':
        node = this.parseDoubleQuoted();
        break;
      case "'":
        node = this.parseSingleQuoted();
        break;
      case '@':
      case '`':
      case '%':
        throw this.reservedChar(c, this.i);
      case '|':
      case '>':
        throw this.err('Block scalars ("|" and ">") are not allowed inside flow collections; use a quoted string', this.i);
      case ',':
      case ']':
      case '}':
      case '':
        return this.emptyScalar(props, this.i);
      case '-':
        if (isBlankOrEnd(s.charAt(this.i + 1))) {
          throw this.err('A "- " list indicator is not allowed inside a flow collection ([...] or {...})', this.i);
        }
        node = this.parseFlowPlain();
        break;
      case ':': {
        const nx = s.charAt(this.i + 1);
        if (isBlankOrEnd(nx) || isFlowInd(nx)) return this.emptyScalar(props, this.i);
        node = this.parseFlowPlain();
        break;
      }
      default:
        node = this.parseFlowPlain();
        break;
    }
    if (props) this.applyProps(node, props);
    return node;
  }

  private parseFlowPlain(): ScalarNode {
    const s = this.s;
    const start = this.i;
    let value = '';
    const lines: string[] = [];
    let end = start;
    let first = true;
    this.i = start;
    for (;;) {
      const lineStart = this.i;
      const e = this.scanPlainLine(lineStart, true);
      if (e === lineStart && first) throw this.err(`Unexpected character "${s.charAt(start)}"`, start);
      const text = s.slice(lineStart, e);
      value += text;
      lines.push(text);
      end = e;
      first = false;
      let k = e;
      while (isWs(s.charAt(k))) k++;
      if (s.charAt(k) !== '\n') break;
      let p = k + 1;
      let blanks = 0;
      let q = p;
      for (;;) {
        q = p;
        while (isWs(s.charAt(q))) q++;
        if (s.charAt(q) === '\n') {
          blanks++;
          p = q + 1;
          continue;
        }
        break;
      }
      const c = s.charAt(q);
      if (c === '' || c === '#' || isFlowInd(c)) break;
      if (c === ':' && (isBlankOrEnd(s.charAt(q + 1)) || isFlowInd(s.charAt(q + 1)))) break;
      if (this.isDocMarkerAt(p)) break;
      for (let b = 0; b < blanks; b++) lines.push('');
      value += blanks > 0 ? '\n'.repeat(blanks) : ' ';
      this.i = q;
    }
    this.i = end;
    const node: ScalarNode = {
      type: 'scalar',
      style: 'plain',
      value,
      start: this.pos(start),
      endOffset: end,
      endLine: this.lineIdx(Math.max(end - 1, 0)) + 1,
    };
    if (lines.length > 1) {
      node.multiline = true;
      node.lines = lines;
      const l0 = this.lineIdx(start);
      const l1 = this.lineIdx(end - 1);
      for (let l = l0 + 1; l <= l1; l++) this.owned.add(l);
    } else node.raw = value;
    return node;
  }

  private parseFlowSeq(): SeqNode {
    const s = this.s;
    const startOff = this.i;
    this.i++;
    const seq: SeqNode = {
      type: 'seq',
      flow: true,
      items: [],
      start: this.pos(startOff),
      endOffset: startOff,
      endLine: this.pos(startOff).line,
    };
    for (;;) {
      this.skipFlowWs(startOff);
      const c = s.charAt(this.i);
      if (c === '') throw this.err('Unterminated flow sequence: the closing "]" is missing', startOff);
      if (c === ']') {
        this.i++;
        break;
      }
      if (c === ',') throw this.err('Unexpected "," in a flow sequence (an empty entry; remove the extra comma)', this.i);
      if (c === '}') throw this.err('Unexpected "}" in a flow sequence; expected "]"', this.i);
      const entryStart = this.i;
      const item: SeqItem = { value: null, start: this.pos(entryStart), leading: [] };
      if (c === '?' && isBlankOrEnd(s.charAt(this.i + 1))) {
        this.i++;
        this.skipFlowWs(startOff);
      }
      const explicitKey = s.charAt(entryStart) === '?' && isBlankOrEnd(s.charAt(entryStart + 1));
      const key = this.parseFlowNode();
      this.skipFlowWs(startOff);
      if (explicitKey || this.isFlowValueIndicator(key)) {
        if (key.type === 'scalar' && key.multiline && !explicitKey) {
          throw this.err(
            'This flow sequence is not closed: a closing "]" or a comma is probably missing before the next line (text continues onto the next line and then meets a ":")',
            startOff
          );
        }
        let colon: Pos | undefined;
        if (this.isFlowValueIndicator(key)) {
          colon = this.pos(this.i);
          this.i++;
        }
        this.skipFlowWs(startOff);
        let value: YamlNode | null = null;
        const d = s.charAt(this.i);
        if (colon && d !== ',' && d !== ']') value = this.parseFlowNode();
        const pairMap: MapNode = {
          type: 'map',
          flow: true,
          singlePair: true,
          pairs: [
            {
              key: key.type === 'scalar' && key.empty && !key.tag && !key.anchor ? null : key,
              value,
              start: item.start,
              explicit: false,
              leading: [],
              colon,
            },
          ],
          start: item.start,
          endOffset: this.i,
          endLine: this.lineIdx(Math.max(this.i - 1, 0)) + 1,
        };
        item.value = pairMap;
      } else {
        item.value = key.type === 'scalar' && key.empty && !key.tag && !key.anchor ? null : key;
      }
      seq.items.push(item);
      this.skipFlowWs(startOff);
      const d = s.charAt(this.i);
      if (d === ',') {
        this.i++;
        continue;
      }
      if (d === ']') {
        this.i++;
        break;
      }
      if (d === '') throw this.err('Unterminated flow sequence: the closing "]" is missing', startOff);
      if (d === ':' && item.value?.type === 'scalar' && item.value.multiline) {
        throw this.err(
          'This flow sequence is not closed: a closing "]" or a comma is probably missing before the next line (text continues onto the next line and then meets a ":")',
          startOff
        );
      }
      throw this.err(`Expected "," or "]" in the flow sequence but found "${d}" (a comma may be missing)`, this.i);
    }
    this.setEnd(seq, this.i);
    return seq;
  }

  private parseFlowMap(): MapNode {
    const s = this.s;
    const startOff = this.i;
    this.i++;
    const map: MapNode = {
      type: 'map',
      flow: true,
      pairs: [],
      start: this.pos(startOff),
      endOffset: startOff,
      endLine: this.pos(startOff).line,
    };
    for (;;) {
      this.skipFlowWs(startOff);
      const c = s.charAt(this.i);
      if (c === '') throw this.err('Unterminated flow mapping: the closing "}" is missing', startOff);
      if (c === '}') {
        this.i++;
        break;
      }
      if (c === ',') throw this.err('Unexpected "," in a flow mapping (an empty entry; remove the extra comma)', this.i);
      if (c === ']') throw this.err('Unexpected "]" in a flow mapping; expected "}"', this.i);
      const pair: MapPair = { key: null, value: null, start: this.pos(this.i), explicit: false, leading: [] };
      if (c === '?' && isBlankOrEnd(s.charAt(this.i + 1))) {
        pair.explicit = true;
        this.i++;
        this.skipFlowWs(startOff);
      }
      const key = this.parseFlowNode();
      pair.key = key.type === 'scalar' && key.empty && !key.tag && !key.anchor ? null : key;
      this.skipFlowWs(startOff);
      if (this.isFlowValueIndicator(key)) {
        if (key.type === 'scalar' && key.multiline && !pair.explicit) {
          throw this.err(
            'This flow mapping is not closed: a closing "}" or a comma is probably missing before the next line (text continues onto the next line and then meets a ":")',
            startOff
          );
        }
        pair.colon = this.pos(this.i);
        this.i++;
        this.skipFlowWs(startOff);
        const d = s.charAt(this.i);
        if (d !== ',' && d !== '}') pair.value = this.parseFlowNode();
      }
      map.pairs.push(pair);
      this.skipFlowWs(startOff);
      const d = s.charAt(this.i);
      if (d === ',') {
        this.i++;
        continue;
      }
      if (d === '}') {
        this.i++;
        break;
      }
      if (d === '') throw this.err('Unterminated flow mapping: the closing "}" is missing', startOff);
      if (d === ':' && pair.value?.type === 'scalar' && pair.value.multiline) {
        throw this.err(
          'This flow mapping is not closed: a closing "}" or a comma is probably missing before the next line (text continues onto the next line and then meets a ":")',
          startOff
        );
      }
      throw this.err(`Expected "," or "}" in the flow mapping but found "${d}" (a comma may be missing)`, this.i);
    }
    this.setEnd(map, this.i);
    return map;
  }

  /* ---------- comments ---------- */

  private isBlankLine(line0: number): boolean {
    const ls = this.lineStarts[line0] ?? 0;
    const le = this.lineEnd(line0);
    for (let k = ls; k < le; k++) {
      const c = this.s.charCodeAt(k);
      if (c !== 32 && c !== 9) return false;
    }
    return true;
  }

  /** Comment lines and blank lines directly above `line0` (blank lines are represented as ''). */
  private collectAbove(line0: number): string[] {
    const out: string[] = [];
    let l = line0 - 1;
    while (l >= 0) {
      const tok = this.commentByLine.get(l);
      if (tok && tok.own && !tok.inFlow && !tok.used) {
        out.push(tok.text);
        tok.used = true;
        l--;
        continue;
      }
      if (!tok && this.isBlankLine(l) && !this.owned.has(l)) {
        if (out.length === 0 || out[out.length - 1] !== '') out.push('');
        l--;
        continue;
      }
      break;
    }
    return out.reverse();
  }

  private attachComments(): void {
    let lastClaimed = -1;
    for (const e of this.entries) {
      if (e.line0 <= lastClaimed) continue;
      lastClaimed = e.line0;
      e.target.leading = this.collectAbove(e.line0);
    }
    for (const tok of this.comments) {
      if (tok.own || tok.inFlow || tok.used) continue;
      const target = this.trailingTargets[tok.line0];
      if (target && target.trailing === undefined) {
        target.trailing = tok.text;
        tok.used = true;
      }
    }
  }
}

/** Compute the value of a block scalar from its de-indented lines (YAML 1.2 §8.1). */
function foldBlockScalar(
  body: string[],
  trailingBlanks: number,
  folded: boolean,
  chomp: Chomp,
  unterminated = false
): string {
  let result = '';
  let pending = 0;
  let prev: string | null = null;
  for (const line of body) {
    if (line === '') {
      pending++;
      continue;
    }
    if (prev === null) {
      result += '\n'.repeat(pending) + line;
    } else {
      const prevPlain = !(prev.startsWith(' ') || prev.startsWith('\t'));
      const curPlain = !(line.startsWith(' ') || line.startsWith('\t'));
      if (folded && prevPlain && curPlain) result += pending === 0 ? ' ' : '\n'.repeat(pending);
      else result += '\n'.repeat(pending + 1);
      result += line;
    }
    pending = 0;
    prev = line;
  }
  if (prev !== null) {
    // like libyaml: a last line cut off by the end of the stream has no line break to keep
    if (chomp !== 'strip' && !unterminated) result += '\n';
    if (chomp === 'keep') result += '\n'.repeat(trailingBlanks);
  } else if (chomp === 'keep') {
    result = '\n'.repeat(trailingBlanks + pending);
  }
  return result;
}

/** Normalise line endings / BOM the same way the parser does. */
export function normalizeYamlSource(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  if (t.includes('\r')) t = t.replace(/\r\n?/g, '\n');
  return t;
}

/** Parse a YAML stream (zero or more documents). Never throws; syntax problems are in `errors`. */
export function parseYaml(text: string): YamlParseResult {
  return new Parser(normalizeYamlSource(text)).parse();
}

/* ------------------------------------------------------------------ */
/* Values (core schema), merge keys, JSON                              */
/* ------------------------------------------------------------------ */

function normalizeTag(tag: string | undefined): string | null {
  if (tag === undefined) return null;
  if (tag === '!') return 'str';
  if (tag.startsWith('!!')) return tag.slice(2);
  const m = /^!<tag:yaml\.org,2002:(.+)>$/.exec(tag);
  if (m) return m[1] ?? null;
  return null;
}

export function valueToKeyString(v: YValue): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return '.nan';
    if (v === Infinity) return '.inf';
    if (v === -Infinity) return '-.inf';
    return v === 0 ? '0' : String(v);
  }
  return stringifyYValue(v, 0).text;
}

class Converter {
  private memo = new Map<YamlNode, YValue>();
  private active = new Set<YamlNode>();
  errors: YamlIssue[] = [];
  constructor(private readonly merge: boolean) {}

  private error(message: string, at: Pos, rule = 'value'): void {
    if (this.errors.length < 50) {
      this.errors.push({ level: 'error', rule, message, line: at.line, col: at.col, offset: at.offset });
    }
  }

  scalar(node: ScalarNode): YValue {
    const tag = normalizeTag(node.tag);
    const text = node.value;
    if (tag !== null) return this.coerce(tag, node, text);
    if (node.tag !== undefined) return text; // local / unknown tag: keep text
    if (node.style !== 'plain') return text;
    return resolvePlain(text);
  }

  private coerce(tag: string, node: ScalarNode, text: string): YValue {
    switch (tag) {
      case 'str':
        return text;
      case 'null':
        if (text === '' || text === '~' || text === 'null' || text === 'Null' || text === 'NULL') return null;
        this.error(`"${text}" is not a valid !!null value`, node.start, 'tag');
        return text;
      case 'bool': {
        const v = resolvePlain(text);
        if (typeof v === 'boolean') return v;
        this.error(`"${text}" is not a valid !!bool value (use true or false)`, node.start, 'tag');
        return text;
      }
      case 'int': {
        if (plainType(text) === 'int') return resolvePlain(text);
        this.error(`"${text}" is not a valid !!int value`, node.start, 'tag');
        return text;
      }
      case 'float': {
        const t = plainType(text);
        if (t === 'float' || t === 'int') {
          const v = resolvePlain(text);
          return typeof v === 'bigint' ? Number(v) : v;
        }
        this.error(`"${text}" is not a valid !!float value`, node.start, 'tag');
        return text;
      }
      default:
        return text;
    }
  }

  keyString(key: YamlNode | null): string {
    if (key === null) return 'null';
    if (key.type === 'scalar') return valueToKeyString(this.scalar(key));
    if (key.type === 'alias') return key.target ? this.keyString(key.target) : 'null';
    return valueToKeyString(this.convert(key));
  }

  private isMergeKey(key: YamlNode | null): boolean {
    return (
      key !== null &&
      key.type === 'scalar' &&
      key.style === 'plain' &&
      key.value === '<<' &&
      (key.tag === undefined || key.tag === '!!merge')
    );
  }

  convert(node: YamlNode | null): YValue {
    if (node === null) return null;
    switch (node.type) {
      case 'alias':
        return node.target ? this.convert(node.target) : null;
      case 'scalar':
        return this.scalar(node);
      case 'seq': {
        const cached = this.memo.get(node);
        if (cached !== undefined) return cached;
        if (this.active.has(node)) {
          this.error('Recursive alias: a collection contains itself, which cannot be represented as JSON', node.start, 'alias');
          return null;
        }
        this.active.add(node);
        const arr: YValue[] = [];
        for (const it of node.items) arr.push(this.convert(it.value));
        this.active.delete(node);
        if (node.anchor !== undefined) this.memo.set(node, arr);
        return arr;
      }
      case 'map': {
        const cached = this.memo.get(node);
        if (cached !== undefined) return cached;
        if (this.active.has(node)) {
          this.error('Recursive alias: a collection contains itself, which cannot be represented as JSON', node.start, 'alias');
          return null;
        }
        this.active.add(node);
        const result = new Map<string, YValue>();
        if (this.merge) {
          for (const pair of node.pairs) {
            if (this.isMergeKey(pair.key)) this.applyMerge(result, pair);
          }
        }
        for (const pair of node.pairs) {
          if (this.merge && this.isMergeKey(pair.key)) continue;
          result.set(this.keyString(pair.key), this.convert(pair.value));
        }
        this.active.delete(node);
        if (node.anchor !== undefined) this.memo.set(node, result);
        return result;
      }
    }
  }

  private applyMerge(result: Map<string, YValue>, pair: MapPair): void {
    const at = pair.value?.start ?? pair.start;
    const v = this.convert(pair.value);
    const sources: Map<string, YValue>[] = [];
    if (v instanceof Map) sources.push(v);
    else if (Array.isArray(v)) {
      for (const el of v) {
        if (el instanceof Map) sources.push(el);
        else {
          this.error('A merge key ("<<") list may only contain mappings', at, 'merge');
          return;
        }
      }
    } else {
      this.error('A merge key ("<<") must point to a mapping (or a list of mappings), e.g. "<<: *defaults"', at, 'merge');
      return;
    }
    // earlier sources take precedence, so apply them last
    for (let k = sources.length - 1; k >= 0; k--) {
      for (const [key, val] of sources[k] ?? []) result.set(key, val);
    }
  }
}

export interface ConvertOptions {
  /** Apply "<<" merge keys (default true). */
  merge?: boolean;
}

export function documentToValue(doc: YamlDocument, opts: ConvertOptions = {}): { value: YValue; errors: YamlIssue[] } {
  const c = new Converter(opts.merge !== false);
  const value = c.convert(doc.root);
  return { value, errors: c.errors };
}

export function parsedToValues(
  parsed: YamlParseResult,
  opts: ConvertOptions = {}
): { values: YValue[]; errors: YamlIssue[] } {
  const values: YValue[] = [];
  const errors: YamlIssue[] = [];
  for (const d of parsed.docs) {
    const r = documentToValue(d, opts);
    values.push(r.value);
    errors.push(...r.errors);
  }
  return { values, errors };
}

/** Convenience: parse and convert. Throws nothing; syntax errors are returned. */
export function loadYaml(text: string, opts: ConvertOptions = {}): { values: YValue[]; errors: YamlIssue[]; parsed: YamlParseResult } {
  const parsed = parseYaml(text);
  const r = parsedToValues(parsed, opts);
  return { values: r.values, errors: [...parsed.errors, ...r.errors], parsed };
}

/** Convert the value model to plain JS objects/arrays (bigint kept). */
export function toPlain(v: YValue): unknown {
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, val] of v) o[k] = toPlain(val);
    return o;
  }
  if (Array.isArray(v)) return v.map(toPlain);
  return v;
}

/**
 * JSON serialisation that keeps mapping order, prints big integers exactly and turns
 * non-finite numbers into null. Output is capped to guard against alias explosions.
 */
export function stringifyYValue(
  value: YValue,
  indent = 2,
  maxChars = 16_000_000
): { text: string; nonFinite: number } {
  const parts: string[] = [];
  let size = 0;
  let nonFinite = 0;
  const push = (t: string): void => {
    size += t.length;
    if (size > maxChars) throw new Error(`JSON output exceeds ${(maxChars / 1e6).toFixed(0)} MB (alias expansion?)`);
    parts.push(t);
  };
  const nl = (level: number): string => (indent > 0 ? '\n' + ' '.repeat(indent * level) : '');
  const walk = (v: YValue, level: number): void => {
    if (v === null) return push('null');
    switch (typeof v) {
      case 'string':
        return push(JSON.stringify(v));
      case 'boolean':
        return push(v ? 'true' : 'false');
      case 'bigint':
        return push(v.toString());
      case 'number':
        if (!Number.isFinite(v)) {
          nonFinite++;
          return push('null');
        }
        return push(Object.is(v, -0) ? '-0' : String(v));
      default:
        break;
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return push('[]');
      push('[');
      v.forEach((el, idx) => {
        push((idx > 0 ? ',' : '') + nl(level + 1));
        walk(el, level + 1);
      });
      return push(nl(level) + ']');
    }
    const m = v as Map<string, YValue>;
    if (m.size === 0) return push('{}');
    push('{');
    let idx = 0;
    for (const [k, val] of m) {
      push((idx++ > 0 ? ',' : '') + nl(level + 1) + JSON.stringify(k) + (indent > 0 ? ': ' : ':'));
      walk(val, level + 1);
    }
    return push(nl(level) + '}');
  };
  walk(value, 0);
  return { text: parts.join(''), nonFinite };
}

/** JSON text for a whole stream: one document as-is, several documents as an array. */
export function streamToJson(
  values: YValue[],
  indent = 2
): { text: string; nonFinite: number } {
  if (values.length === 0) return { text: 'null', nonFinite: 0 };
  if (values.length === 1) return stringifyYValue(values[0] ?? null, indent);
  return stringifyYValue(values, indent);
}

/* ------------------------------------------------------------------ */
/* Snippets                                                            */
/* ------------------------------------------------------------------ */

/** A few source lines around line:col with a caret under the column. */
export function sourceSnippet(source: string, line: number, col: number, context = 1): string {
  const lines = normalizeYamlSource(source).split('\n');
  const first = Math.max(1, line - context);
  const last = Math.min(lines.length, line + context);
  const width = String(last).length;
  const out: string[] = [];
  for (let l = first; l <= last; l++) {
    let text = lines[l - 1] ?? '';
    let shift = 0;
    if (text.length > 160) {
      // keep the interesting part of very long lines
      const from = l === line ? Math.max(0, col - 60) : 0;
      shift = from;
      text = (from > 0 ? '…' : '') + text.slice(from, from + 140) + (text.length > from + 140 ? '…' : '');
      if (from > 0) shift = from - 1;
    }
    out.push(`${String(l).padStart(width)} | ${text}`);
    if (l === line) {
      const caretCol = Math.max(0, col - 1 - shift);
      out.push(`${' '.repeat(width)} | ${' '.repeat(caretCol)}^`);
    }
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Lint                                                                */
/* ------------------------------------------------------------------ */

export interface LintRuleInfo {
  id: string;
  label: string;
  level: 'warning' | 'info';
  description: string;
}

export const LINT_RULES: LintRuleInfo[] = [
  {
    id: 'duplicate-keys',
    label: 'Duplicate keys',
    level: 'warning',
    description: 'The same key appears twice in one mapping. Most parsers silently keep the last value.',
  },
  {
    id: 'tabs',
    label: 'Tabs as whitespace',
    level: 'warning',
    description: 'Tab characters between tokens. YAML forbids tabs for indentation and they render inconsistently.',
  },
  {
    id: 'indentation',
    label: 'Inconsistent indentation',
    level: 'warning',
    description: 'Nested blocks use a different indentation width (or list style) than the rest of the file.',
  },
  {
    id: 'yaml11-bool',
    label: 'YAML 1.1 booleans (Norway problem)',
    level: 'warning',
    description: 'yes/no/on/off/y/n are booleans in YAML 1.1 parsers (PyYAML, Ruby, Go yaml.v2) but strings in YAML 1.2.',
  },
  {
    id: 'octal',
    label: 'Leading-zero numbers',
    level: 'warning',
    description: 'Numbers like 0755 are octal in YAML 1.1 but decimal (leading zero dropped) in YAML 1.2.',
  },
  {
    id: 'sexagesimal',
    label: 'Sexagesimal numbers',
    level: 'warning',
    description: 'Values like 1:30 are base-60 integers in YAML 1.1 (1:30 becomes 90).',
  },
  {
    id: 'version-float',
    label: 'Version-like floats',
    level: 'warning',
    description: 'Values like 3.10 are floats: trailing zeros are lost (3.10 becomes 3.1).',
  },
  {
    id: 'risky-value',
    label: 'Values that look like tags or anchors',
    level: 'warning',
    description: 'A value that starts with ! or & is parsed as a tag/anchor rather than as text.',
  },
  {
    id: 'trailing-spaces',
    label: 'Trailing spaces',
    level: 'info',
    description: 'Whitespace at the end of a line.',
  },
  {
    id: 'eof-newline',
    label: 'Missing newline at end of file',
    level: 'info',
    description: 'POSIX text files should end with a line break.',
  },
  {
    id: 'line-length',
    label: 'Very long lines (> 120)',
    level: 'info',
    description: 'Lines longer than 120 characters are hard to read and review.',
  },
  {
    id: 'duplicate-anchor',
    label: 'Duplicate anchors',
    level: 'warning',
    description: 'The same anchor name is defined twice in one document; aliases refer to the most recent definition.',
  },
  {
    id: 'unused-anchor',
    label: 'Unused anchors',
    level: 'info',
    description: 'An anchor (&name) that no alias (*name) refers to.',
  },
];

function keySignature(key: YamlNode | null, conv: Converter): string | null {
  if (key === null) return 'null';
  if (key.type === 'scalar') {
    const v = conv.scalar(key);
    if (v === null) return 'null';
    return `${typeof v === 'bigint' ? 'number' : typeof v}:${valueToKeyString(v)}`;
  }
  if (key.type === 'alias') return key.target ? keySignature(key.target, conv) : null;
  return null;
}

/**
 * Run the lint rules. `enabled` limits the rules (all rules when omitted).
 * Parser errors are *not* included here — they live in `parsed.errors`.
 */
export function lintYaml(
  parsed: YamlParseResult,
  enabled?: ReadonlySet<string>,
  maxLineLength = 120
): YamlIssue[] {
  const out: YamlIssue[] = [];
  const on = (id: string): boolean => !enabled || enabled.has(id);
  const levelOf = (id: string): 'warning' | 'info' => LINT_RULES.find((r) => r.id === id)?.level ?? 'warning';
  const push = (rule: string, at: Pos, message: string, level?: 'warning' | 'info'): void => {
    out.push({ level: level ?? levelOf(rule), rule, message, line: at.line, col: at.col, offset: at.offset });
  };
  const conv = new Converter(true);

  const checkScalar = (node: ScalarNode, role: 'key' | 'value'): void => {
    if (node.style === 'plain' && node.tag === undefined && !node.empty) {
      const t = node.value;
      if (on('yaml11-bool') && /^(?:y|n|yes|no|on|off)$/i.test(t)) {
        if (role === 'key') {
          push(
            'yaml11-bool',
            node.start,
            `The key "${t}" is a boolean (true/false) in YAML 1.1 parsers such as PyYAML. YAML 1.2 treats it as the string "${t}". Quote it if the key must be a string everywhere.`,
            'info'
          );
        } else {
          push(
            'yaml11-bool',
            node.start,
            `"${t}" is a boolean in YAML 1.1 parsers (PyYAML, Ruby, Go yaml.v2) but the string "${t}" in YAML 1.2. Quote it ("${t}") to make it a string everywhere, or use true/false for a boolean.`
          );
        }
      }
      if (role === 'value') {
        if (on('octal') && /^[-+]?0[0-9]+$/.test(t)) {
          const octal = /^[-+]?0[0-7]+$/.test(t) ? ` (octal ${parseInt(t, 8)} in YAML 1.1)` : '';
          push(
            'octal',
            node.start,
            `Leading-zero number ${t}: YAML 1.1 reads it as octal${octal}, YAML 1.2 as decimal ${parseInt(t, 10)} (the leading zero is lost). Quote it if it is a string, a zip code, or a file mode.`
          );
        }
        if (on('sexagesimal') && (/^[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/.test(t) || /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/.test(t))) {
          push(
            'sexagesimal',
            node.start,
            `"${t}" looks like a base-60 number: YAML 1.1 parsers turn it into a number (e.g. 1:30 becomes 90). Quote it if it is a time, ratio or MAC-style value.`
          );
        }
        if (on('version-float') && /^[-+]?\d+\.\d*[1-9]0+$/.test(t)) {
          push(
            'version-float',
            node.start,
            `${t} is a float, so the trailing zero is lost (it becomes ${Number(t)}). Quote it ("${t}") if it is a version number.`
          );
        }
      }
    }
    if (on('risky-value') && node.empty && role === 'value') {
      if (node.tag !== undefined && !node.tag.startsWith('!!') && !node.tag.startsWith('!<') && node.tag !== '!') {
        push(
          'risky-value',
          node.tagPos ?? node.start,
          `"${node.tag}" at the start of a value is parsed as a YAML tag, not as text, so the value is empty. Quote the value if you meant the text "${node.tag}".`
        );
      } else if (node.anchor !== undefined && node.tag === undefined) {
        push(
          'risky-value',
          node.anchorPos ?? node.start,
          `"&${node.anchor}" at the start of a value is parsed as an anchor, not as text, so the value is empty. Quote the value if you meant the text "&${node.anchor}".`
        );
      }
    }
  };

  const mapDeltas: { delta: number; pos: Pos }[] = [];
  const seqDeltas: { delta: number; pos: Pos }[] = [];

  const walk = (node: YamlNode | null, role: 'key' | 'value'): void => {
    if (node === null) return;
    if (node.type === 'scalar') return checkScalar(node, role);
    if (node.type === 'alias') return;
    if (node.type === 'seq') {
      for (const it of node.items) walk(it.value, 'value');
      return;
    }
    const seen = new Map<string, MapPair>();
    for (const pair of node.pairs) {
      if (on('duplicate-keys') && pair.key !== null) {
        const sig = keySignature(pair.key, conv);
        if (sig !== null) {
          const prev = seen.get(sig);
          if (prev) {
            const label = pair.key.type === 'scalar' ? pair.key.value : conv.keyString(pair.key);
            push(
              'duplicate-keys',
              pair.key.start,
              `Duplicate key "${label}" (first defined on line ${prev.start.line}). The YAML spec requires unique keys; most parsers silently keep only the last value.`
            );
          } else seen.set(sig, pair);
        }
      }
      walk(pair.key, 'key');
      walk(pair.value, 'value');
      // indentation statistics (block pairs whose value starts on a later line)
      const v = pair.value;
      if (!node.flow && v && (v.type === 'map' || v.type === 'seq') && !v.flow && pair.key && !pair.explicit) {
        const colonLine = (pair.colon ?? pair.start).line;
        if (v.start.line > colonLine) {
          const delta = v.start.col - pair.start.col;
          if (v.type === 'map') mapDeltas.push({ delta, pos: v.start });
          else seqDeltas.push({ delta, pos: v.start });
        }
      }
    }
  };

  parsed.docs.forEach((d) => walk(d.root, 'value'));

  if (on('indentation')) {
    const indented = [...mapDeltas, ...seqDeltas.filter((s) => s.delta > 0)].filter((x) => x.delta > 0);
    const counts = new Map<number, number>();
    for (const x of indented) counts.set(x.delta, (counts.get(x.delta) ?? 0) + 1);
    if (counts.size > 1) {
      let dominant = 0;
      let best = -1;
      for (const [d, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
        if (c > best) {
          best = c;
          dominant = d;
        }
      }
      for (const x of indented) {
        if (x.delta !== dominant) {
          push(
            'indentation',
            x.pos,
            `This block is indented by ${x.delta} spaces, but most of the file uses ${dominant}. Use one indentation width throughout.`
          );
        }
      }
    }
    const compact = seqDeltas.filter((s) => s.delta === 0);
    const indentedSeq = seqDeltas.filter((s) => s.delta > 0);
    if (compact.length > 0 && indentedSeq.length > 0) {
      const minority = compact.length <= indentedSeq.length ? compact : indentedSeq;
      const style = minority === compact ? 'not indented under its key' : 'indented under its key';
      const other = minority === compact ? 'indented' : 'not indented';
      for (const x of minority) {
        push('indentation', x.pos, `This list is ${style}, but most lists in the file are ${other}. Pick one list style.`);
      }
    }
  }

  if (on('tabs')) {
    for (const p of parsed.tabSeparators) {
      push('tabs', p, 'Tab character used as whitespace. Use spaces instead; tabs render differently in every editor and are invalid for indentation.');
    }
  }

  if (on('duplicate-anchor')) {
    const seenAnchors = new Map<string, AnchorInfo>();
    let curDoc = -1;
    for (const a of parsed.anchors) {
      const di = parsed.docs.findIndex((d, idx) => a.pos.offset >= d.start.offset && (idx === parsed.docs.length - 1 || a.pos.offset < (parsed.docs[idx + 1]?.start.offset ?? Infinity)));
      if (di !== curDoc) {
        seenAnchors.clear();
        curDoc = di;
      }
      const prev = seenAnchors.get(a.name);
      if (prev) {
        push('duplicate-anchor', a.pos, `Anchor "&${a.name}" is already defined on line ${prev.pos.line}. Aliases after this point refer to the new definition.`);
      }
      seenAnchors.set(a.name, a);
    }
  }

  if (on('unused-anchor')) {
    for (const a of parsed.anchors) {
      if (a.uses === 0) push('unused-anchor', a.pos, `Anchor "&${a.name}" is never used by an alias ("*${a.name}").`);
    }
  }

  const lines = parsed.source.split('\n');
  let offset = 0;
  const lineCount = lines.length;
  for (let li = 0; li < lineCount; li++) {
    const text = lines[li] ?? '';
    const isLast = li === lineCount - 1;
    if (on('trailing-spaces')) {
      const m = /[ \t]+$/.exec(text);
      if (m && text.length > 0) {
        push('trailing-spaces', { offset: offset + m.index, line: li + 1, col: cpLen(text.slice(0, m.index)) + 1 }, `Trailing whitespace (${m[0].length} character${m[0].length === 1 ? '' : 's'}).`);
      }
    }
    if (on('line-length')) {
      const len = cpLen(text);
      if (len > maxLineLength) {
        // column of the first character past the limit
        const cut = cpOffset(text, maxLineLength);
        push('line-length', { offset: offset + cut, line: li + 1, col: maxLineLength + 1 }, `Line is ${len} characters long (limit ${maxLineLength}).`);
      }
    }
    if (on('eof-newline') && isLast && text.length > 0) {
      push('eof-newline', { offset: offset + text.length, line: li + 1, col: cpLen(text) + 1 }, 'The file does not end with a newline.');
    }
    offset += text.length + 1;
  }

  return out.sort((a, b) => a.line - b.line || a.col - b.col);
}

function cpLen(text: string): number {
  let n = 0;
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (c >= 0xd800 && c <= 0xdbff) k++;
    n++;
  }
  return n;
}

/** UTF-16 offset of the code point with index `cp`. */
function cpOffset(text: string, cp: number): number {
  let n = 0;
  let k = 0;
  while (k < text.length && n < cp) {
    const c = text.charCodeAt(k);
    k += c >= 0xd800 && c <= 0xdbff ? 2 : 1;
    n++;
  }
  return k;
}

/* ------------------------------------------------------------------ */
/* Formatter                                                           */
/* ------------------------------------------------------------------ */

export interface FormatOptions {
  /** Spaces per nesting level (1-8). */
  indent: number;
  /** `indented`: "key:\n  - a"; `compact`: "key:\n- a". */
  seqIndent: 'indented' | 'compact';
  sortKeys: boolean;
  /** How string scalars are quoted. */
  quote: 'preserve' | 'minimal' | 'single' | 'double';
  /** Apply the `single`/`double` choice to mapping keys too. */
  quoteKeys: boolean;
  /** Wrap long strings and flow collections at this width (0 = never). */
  width: number;
  comments: boolean;
  /** Write strings that contain line breaks as block scalars (|). */
  blockMultiline: boolean;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  indent: 2,
  seqIndent: 'indented',
  sortKeys: false,
  quote: 'preserve',
  quoteKeys: false,
  width: 80,
  comments: true,
  blockMultiline: true,
};

const YAML11_AMBIGUOUS: RegExp[] = [
  /^(?:y|n|yes|no|on|off)$/i,
  /^[-+]?0[0-9_]+$/,
  /^[-+]?[0-9][0-9_,]*(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?$/,
  /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/,
  /^\d{4}-\d{1,2}-\d{1,2}(?:[Tt ].*)?$/,
  /^(?:=|<<)$/,
  /^[-+]?0b[01_]+$/,
];

function plainSafe(v: string, inFlow: boolean): boolean {
  if (v === '' || v !== v.trim()) return false;
  if (/[\x00-\x1f\x7f-\x9f\u2028\u2029\uFEFF]/.test(v)) return false;
  const c = v.charAt(0);
  if ('[]{},&*!|>\'"%@`#'.includes(c)) return false;
  if ((c === '-' || c === '?' || c === ':') && (v.length === 1 || v.charAt(1) === ' ')) return false;
  if (v.includes(': ') || v.endsWith(':') || v.includes(' #')) return false;
  if (inFlow && /[,[\]{}?]/.test(v)) return false;
  if (v.startsWith('---') || v.startsWith('...')) return false;
  if (plainType(v) !== 'str') return false;
  for (const re of YAML11_AMBIGUOUS) if (re.test(v)) return false;
  return true;
}

function singleSafe(v: string): boolean {
  return !/[\x00-\x1f\x7f-\x9f\u2028\u2029\uFEFF]/.test(v);
}

function canBlock(v: string): boolean {
  if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u2028\u2029\uFEFF]/.test(v)) return false;
  if (/[\ud800-\udbff](?![\udc00-\udfff])|(?:[^\ud800-\udbff]|^)[\udc00-\udfff]/.test(v)) return false;
  const body = v.replace(/\n+$/, '');
  if (body.trim() === '') return false;
  const lastLine = body.slice(body.lastIndexOf('\n') + 1);
  if (lastLine.trim() === '') return false;
  return true;
}

/** Escape a string as a YAML double-quoted scalar. */
export function doubleQuote(v: string): string {
  let out = '"';
  for (const ch of v) {
    const c = ch.codePointAt(0) ?? 0;
    switch (ch) {
      case '"':
        out += '\\"';
        continue;
      case '\\':
        out += '\\\\';
        continue;
      case '\n':
        out += '\\n';
        continue;
      case '\t':
        out += '\\t';
        continue;
      case '\r':
        out += '\\r';
        continue;
      case '\0':
        out += '\\0';
        continue;
      case '\x07':
        out += '\\a';
        continue;
      case '\b':
        out += '\\b';
        continue;
      case '\v':
        out += '\\v';
        continue;
      case '\f':
        out += '\\f';
        continue;
      case '\x1b':
        out += '\\e';
        continue;
      case '\x85':
        out += '\\N';
        continue;
      case '\xa0':
        out += '\\_';
        continue;
      case '\u2028':
        out += '\\L';
        continue;
      case '\u2029':
        out += '\\P';
        continue;
      default:
        break;
    }
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) out += '\\x' + c.toString(16).toUpperCase().padStart(2, '0');
    else if (c === 0xfeff || (c >= 0xd800 && c <= 0xdfff)) out += '\\u' + c.toString(16).toUpperCase().padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

/** Break `text` at single spaces so that lines fit (best effort). */
function wrapAtSpaces(text: string, firstAvail: number, contAvail: number, quoted: boolean): string[] {
  const lines: string[] = [];
  let rest = text;
  let avail = firstAvail;
  const lo = quoted ? 2 : 1;
  for (;;) {
    if (rest.length <= avail) {
      lines.push(rest);
      return lines;
    }
    let cut = -1;
    const limit = Math.min(avail, rest.length - 1);
    for (let k = limit; k >= lo; k--) {
      if (isBreakPoint(rest, k, quoted)) {
        cut = k;
        break;
      }
    }
    if (cut === -1) {
      for (let k = limit + 1; k < rest.length - (quoted ? 2 : 1); k++) {
        if (isBreakPoint(rest, k, quoted)) {
          cut = k;
          break;
        }
      }
    }
    if (cut === -1) {
      lines.push(rest);
      return lines;
    }
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
    avail = contAvail;
  }
}

function isBreakPoint(s: string, k: number, quoted: boolean): boolean {
  if (s.charAt(k) !== ' ') return false;
  if (s.charAt(k - 1) === ' ' || s.charAt(k + 1) === ' ') return false;
  if (quoted && (k < 2 || k > s.length - 3)) return false;
  const next = s.charAt(k + 1);
  if (!quoted && '#-?:|>&*!%@`\'"[]{},'.includes(next)) return false;
  return true;
}

class Emitter {
  out: string[] = [];
  emitted = 0;
  private readonly conv = new Converter(true);
  private readonly sortedCache = new Map<MapNode, MapPair[]>();
  constructor(private readonly o: FormatOptions) {}

  push(line: string): void {
    this.out.push(line);
  }

  private pad(n: number): string {
    return ' '.repeat(n);
  }

  private capture(fn: () => void): string[] {
    const saved = this.out;
    this.out = [];
    try {
      fn();
      return this.out;
    } finally {
      this.out = saved;
    }
  }

  private trail(t: string | undefined): string {
    if (!this.o.comments || !t) return '';
    this.emitted++;
    return '  ' + t;
  }

  writeLeading(leading: string[], indent: number, first: boolean): void {
    if (!this.o.comments) return;
    let started = false;
    for (const l of leading) {
      if (l === '') {
        if ((first && !started) || this.out.length === 0 || this.out[this.out.length - 1] === '') continue;
        this.push('');
      } else {
        this.push(this.pad(indent) + l);
        this.emitted++;
        started = true;
      }
    }
    // a blank line directly above the entry is meaningful only between comments / entries
  }

  writeFooter(footer: string[]): void {
    if (!this.o.comments) return;
    let end = footer.length;
    while (end > 0 && footer[end - 1] === '') end--;
    let started = false;
    for (let k = 0; k < end; k++) {
      const l = footer[k] ?? '';
      if (l === '') {
        if (this.out.length > 0 && this.out[this.out.length - 1] !== '') this.push('');
      } else {
        this.push(l);
        this.emitted++;
        started = true;
      }
    }
    void started;
  }

  private propsText(node: YamlNode): string {
    const parts: string[] = [];
    if (node.anchor !== undefined) parts.push('&' + node.anchor);
    if (node.tag !== undefined) parts.push(node.tag);
    return parts.join(' ');
  }

  /* ----- scalars ----- */

  private choose(node: ScalarNode, isKey: boolean, inFlow: boolean): 'plain' | 'single' | 'double' | 'block' {
    const o = this.o;
    const value = node.value;
    const tagged = node.tag !== undefined;
    const origin: 'plain' | 'single' | 'double' =
      node.style === 'plain' || node.style === 'single' || node.style === 'double' ? node.style : 'double';
    const mode = isKey && !o.quoteKeys && (o.quote === 'single' || o.quote === 'double') ? 'preserve' : o.quote;
    const isStr = origin !== 'plain' || tagged || plainType(value) === 'str';
    const nl = value.includes('\n');
    // a plain "<<" key is the merge key; quoting it would change its meaning
    if (isKey && node.style === 'plain' && value === '<<' && !tagged) return 'plain';
    let s: 'plain' | 'single' | 'double' = origin;
    if (!tagged) {
      switch (mode) {
        case 'preserve':
          s = origin;
          break;
        case 'minimal':
          if (isStr && origin !== 'plain') s = plainSafe(value, inFlow) ? 'plain' : singleSafe(value) ? 'single' : 'double';
          break;
        case 'double':
          if (isStr) s = 'double';
          break;
        case 'single':
          if (isStr) s = singleSafe(value) ? 'single' : 'double';
          break;
      }
    }
    if (nl) {
      if (!tagged && !isKey && !inFlow && o.blockMultiline && canBlock(value)) return 'block';
      return 'double';
    }
    if (node.style === 'literal' || node.style === 'folded') {
      // block scalar in an inline-only position (key / flow collection)
      return singleSafe(value) && plainSafe(value, inFlow) ? 'plain' : 'double';
    }
    if (s === 'single' && !singleSafe(value)) s = 'double';
    if (s === 'plain' && /^(?:---|\.\.\.)(?:\s|$)/.test(value)) s = singleSafe(value) ? 'single' : 'double';
    return s;
  }

  private render(node: ScalarNode, style: 'plain' | 'single' | 'double'): string {
    if (style === node.style && node.raw !== undefined) return node.raw;
    if (style === 'plain') return node.value;
    if (style === 'single') return "'" + node.value.replace(/'/g, "''") + "'";
    return doubleQuote(node.value);
  }

  /** Single-line text of a scalar in a key or flow position. */
  private scalarText(node: ScalarNode, isKey: boolean, inFlow: boolean): string | null {
    if (node.empty) return '';
    let style = this.choose(node, isKey, inFlow);
    if (style === 'block') style = 'double';
    if (isKey && node.value.includes('\n')) return null;
    return this.render(node, style);
  }

  private scalarLines(node: ScalarNode, style: 'plain' | 'single' | 'double', firstPrefixLen: number, contIndent: number): string[] {
    const text = this.render(node, style);
    const w = this.o.width;
    if (style === node.style && node.lines && node.multiline && !node.value.includes('\n') && w === 0) {
      return node.lines.map((l, k) => (k === 0 || l === '' ? l : this.pad(contIndent) + l));
    }
    if (w === 0 || firstPrefixLen + text.length <= w) return [text];
    const parts = wrapAtSpaces(text, w - firstPrefixLen, Math.max(20, w - contIndent), style !== 'plain');
    return parts.map((l, k) => (k === 0 ? l : this.pad(contIndent) + l));
  }

  private blockFromString(value: string): { lines: string[]; chomp: Chomp } {
    let body = value;
    let trailingNl = 0;
    while (body.endsWith('\n')) {
      body = body.slice(0, -1);
      trailingNl++;
    }
    const chomp: Chomp = trailingNl === 0 ? 'strip' : trailingNl === 1 ? 'clip' : 'keep';
    const lines = body.split('\n');
    for (let k = 1; k < trailingNl; k++) lines.push('');
    return { lines, chomp };
  }

  private blockParts(node: ScalarNode): { lines: string[]; chomp: Chomp } {
    const lines = (node.lines ?? []).slice();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    const v = node.value;
    let k = 0;
    while (k < v.length && v.charAt(v.length - 1 - k) === '\n') k++;
    if (lines.length === 0) return k === 0 ? { lines: [], chomp: 'clip' } : { lines: new Array<string>(k).fill(''), chomp: 'keep' };
    for (let j = 1; j < k; j++) lines.push('');
    return { lines, chomp: k === 0 ? 'strip' : k === 1 ? 'clip' : 'keep' };
  }

  private writeBlockScalar(
    head: string,
    marker: '|' | '>',
    lines: string[],
    chomp: Chomp,
    indent: number,
    trailing: string | undefined
  ): void {
    const step = this.o.indent;
    const firstContent = lines.find((l) => l !== '');
    const needsIndicator = firstContent !== undefined && firstContent.startsWith(' ');
    const header =
      marker + (needsIndicator ? String(step) : '') + (chomp === 'strip' ? '-' : chomp === 'keep' ? '+' : '');
    this.push((head ? head + ' ' : '') + header + this.trail(trailing));
    const cpad = this.pad(indent + step);
    for (const l of lines) this.push(l === '' ? '' : cpad + l);
  }

  /* ----- flow collections ----- */

  private flowNodeText(node: YamlNode): string {
    const props = this.propsText(node);
    const body = this.flowBody(node);
    return props ? (body === '' ? props : props + ' ' + body) : body;
  }

  private flowKeyText(key: YamlNode | null): string {
    if (key === null) return 'null';
    if (key.type === 'alias') return `*${key.name} `;
    return this.flowNodeText(key);
  }

  private flowBody(node: YamlNode): string {
    switch (node.type) {
      case 'alias':
        return '*' + node.name;
      case 'scalar':
        return this.scalarText(node, false, true) ?? '""';
      case 'seq': {
        if (node.items.length === 0) return '[]';
        return '[' + node.items.map((it) => (it.value === null ? 'null' : this.flowNodeText(it.value))).join(', ') + ']';
      }
      case 'map': {
        if (node.pairs.length === 0) return '{}';
        const pairs = this.pairsOf(node).map((p) => {
          const k = this.flowKeyText(p.key);
          const v = p.value === null ? 'null' : this.flowNodeText(p.value);
          return `${k}: ${v}`;
        });
        return node.singlePair ? (pairs[0] ?? '') : '{ ' + pairs.join(', ') + ' }';
      }
    }
  }

  private flowBlock(node: SeqNode | MapNode, indent: number): string[] {
    const pad = this.pad(indent);
    const inner = this.pad(indent + this.o.indent);
    const elements: string[] =
      node.type === 'seq'
        ? node.items.map((it) => (it.value === null ? 'null' : this.flowNodeText(it.value)))
        : this.pairsOf(node).map((p) => `${this.flowKeyText(p.key)}: ${p.value === null ? 'null' : this.flowNodeText(p.value)}`);
    const lines = [pad + (node.type === 'seq' ? '[' : '{')];
    elements.forEach((t, k) => lines.push(inner + t + (k < elements.length - 1 ? ',' : '')));
    lines.push(pad + (node.type === 'seq' ? ']' : '}'));
    return lines;
  }

  /* ----- entries ----- */

  private inlineKey(key: YamlNode): string | null {
    if (key.type === 'alias') return `*${key.name} `;
    const props = this.propsText(key);
    const sp = props ? props + ' ' : '';
    if (key.type === 'scalar') {
      if (key.style === 'literal' || key.style === 'folded') return null;
      const text = this.scalarText(key, true, false);
      if (text === null) return null;
      return sp + text;
    }
    if (key.flow) {
      const t = this.flowBody(key);
      return sp + t;
    }
    return null;
  }

  private sortKey(p: MapPair): string {
    const k = p.key;
    if (k === null) return '';
    if (k.type === 'scalar' && k.style === 'plain' && k.value === '<<') return '\u0000';
    if (k.type === 'scalar' || k.type === 'alias') return this.conv.keyString(k);
    return '\uFFFF';
  }

  private pairsOf(map: MapNode): MapPair[] {
    if (!this.o.sortKeys || map.singlePair) return map.pairs;
    const cached = this.sortedCache.get(map);
    if (cached) return cached;
    const keyed = map.pairs.map((p, idx) => ({ p, idx, k: this.sortKey(p) }));
    const cmp = (a: { k: string; idx: number }, b: { k: string; idx: number }): number =>
      a.k < b.k ? -1 : a.k > b.k ? 1 : a.idx - b.idx;
    keyed.sort(cmp);

    // An alias must stay after the pair that defines its anchor: move dependants after their anchors.
    const owner = new Map<YamlNode, number>();
    const uses: Set<number>[] = map.pairs.map(() => new Set<number>());
    const defsOf = (n: YamlNode | null, idx: number, acc: YamlNode[]): void => {
      if (n === null) return;
      if (n.anchor !== undefined) acc.push(n);
      if (n.type === 'seq') for (const it of n.items) defsOf(it.value, idx, acc);
      else if (n.type === 'map') {
        for (const pr of n.pairs) {
          defsOf(pr.key, idx, acc);
          defsOf(pr.value, idx, acc);
        }
      }
    };
    let anyAnchor = false;
    map.pairs.forEach((pr, idx) => {
      const acc: YamlNode[] = [];
      defsOf(pr.key, idx, acc);
      defsOf(pr.value, idx, acc);
      for (const n of acc) {
        owner.set(n, idx);
        anyAnchor = true;
      }
    });
    if (!anyAnchor) {
      const res = keyed.map((x) => x.p);
      this.sortedCache.set(map, res);
      return res;
    }
    const aliasTargets = (n: YamlNode | null, acc: YamlNode[]): void => {
      if (n === null) return;
      if (n.type === 'alias') {
        if (n.target) acc.push(n.target);
      } else if (n.type === 'seq') for (const it of n.items) aliasTargets(it.value, acc);
      else if (n.type === 'map') {
        for (const pr of n.pairs) {
          aliasTargets(pr.key, acc);
          aliasTargets(pr.value, acc);
        }
      }
    };
    map.pairs.forEach((pr, idx) => {
      const acc: YamlNode[] = [];
      aliasTargets(pr.key, acc);
      aliasTargets(pr.value, acc);
      for (const target of acc) {
        const o = owner.get(target);
        if (o !== undefined && o !== idx) uses[idx]?.add(o);
      }
    });
    if (uses.every((s) => s.size === 0)) {
      const res = keyed.map((x) => x.p);
      this.sortedCache.set(map, res);
      return res;
    }
    // sorted order, but every pair is preceded by the pairs that define the anchors it uses
    const placed = new Set<number>();
    const result: MapPair[] = [];
    const visit = (idx: number, depth: number): void => {
      if (placed.has(idx) || depth > 1000) return;
      placed.add(idx);
      for (const dep of [...(uses[idx] ?? [])].sort((a, b) => a - b)) visit(dep, depth + 1);
      const pr = map.pairs[idx];
      if (pr) result.push(pr);
    };
    for (const x of keyed) visit(x.idx, 0);
    this.sortedCache.set(map, result);
    return result;
  }

  writeMap(map: MapNode, indent: number): void {
    this.pairsOf(map).forEach((p, idx) => {
      this.writeLeading(p.leading, indent, idx === 0);
      this.writePair(p, indent);
    });
  }

  writeSeq(seq: SeqNode, indent: number): void {
    seq.items.forEach((it, idx) => {
      this.writeLeading(it.leading, indent, idx === 0);
      this.writeEntry('-', it.value, indent, 'seq', it.trailing);
    });
  }

  private writePair(p: MapPair, indent: number): void {
    const key = p.key;
    const keyText = key === null ? '' : this.inlineKey(key);
    if (keyText === null) {
      this.writeEntry('?', key, indent, 'seq', undefined);
      if (p.value !== null) this.writeEntry(':', p.value, indent, 'seq', p.trailing);
      return;
    }
    this.writeEntry(keyText + ':', p.value, indent, 'map', p.trailing);
  }

  private writeEntry(
    prefix: string,
    value: YamlNode | null,
    indent: number,
    kind: 'map' | 'seq',
    trailing: string | undefined
  ): void {
    const pad = this.pad(indent);
    const childStep = kind === 'seq' ? 2 : this.o.indent;
    if (value === null) {
      this.push(pad + prefix + this.trail(trailing));
      return;
    }
    const props = this.propsText(value);
    const sp = props ? ' ' + props : '';
    const head = pad + prefix + sp;

    if (value.type === 'alias') {
      this.push(`${pad}${prefix} *${value.name}${this.trail(trailing)}`);
      return;
    }

    if (value.type === 'scalar') {
      if (value.style === 'literal' || value.style === 'folded') {
        const bp = this.blockParts(value);
        this.writeBlockScalar(head, value.style === 'literal' ? '|' : '>', bp.lines, bp.chomp, indent, trailing);
        return;
      }
      if (value.empty) {
        this.push(head + this.trail(trailing));
        return;
      }
      const style = this.choose(value, false, false);
      if (style === 'block') {
        const b = this.blockFromString(value.value);
        this.writeBlockScalar(head, '|', b.lines, b.chomp, indent, trailing);
        return;
      }
      const lines = this.scalarLines(value, style, head.length + 1, indent + childStep);
      lines.forEach((l, k) => {
        const first = k === 0;
        const last = k === lines.length - 1;
        this.push((first ? head + ' ' + l : l) + (last ? this.trail(trailing) : ''));
      });
      return;
    }

    if (value.flow) {
      const body = this.flowBody(value);
      const single = head + ' ' + body;
      const w = this.o.width;
      const empty = value.type === 'seq' ? value.items.length === 0 : value.pairs.length === 0;
      if (w === 0 || single.length <= w || empty) {
        this.push(single + this.trail(trailing));
        return;
      }
      this.push(head + this.trail(trailing));
      for (const l of this.flowBlock(value, indent + childStep)) this.push(l);
      return;
    }

    // block collections
    if (kind === 'seq' && !props) {
      const childIndent = indent + 2;
      const lines = this.capture(() => {
        if (value.type === 'map') this.writeMap(value, childIndent);
        else this.writeSeq(value, childIndent);
      });
      const first = lines[0];
      if (first !== undefined && first.startsWith(this.pad(childIndent)) && first.charAt(childIndent) !== '#') {
        lines[0] = pad + prefix + ' ' + first.slice(childIndent);
      } else {
        this.push(pad + prefix);
      }
      for (const l of lines) this.push(l);
      return;
    }
    this.push(head + this.trail(trailing));
    if (value.type === 'map') {
      this.writeMap(value, indent + childStep);
    } else {
      const seqIndent = kind === 'map' && this.o.seqIndent === 'compact' ? indent : indent + childStep;
      this.writeSeq(value, seqIndent);
    }
  }

  /* ----- documents ----- */

  writeRoot(doc: YamlDocument): void {
    const root = doc.root;
    if (root === null) return;
    const props = this.propsText(root);
    if ((root.type === 'map' || root.type === 'seq') && !root.flow) {
      if (props) this.push(props);
      if (root.type === 'map') this.writeMap(root, 0);
      else this.writeSeq(root, 0);
      return;
    }
    if (root.type === 'alias') {
      this.push('*' + root.name);
      return;
    }
    if (root.type === 'scalar') {
      if (root.style === 'literal' || root.style === 'folded') {
        const bp = this.blockParts(root);
        this.writeBlockScalar(props, root.style === 'literal' ? '|' : '>', bp.lines, bp.chomp, 0, undefined);
        return;
      }
      if (root.empty) {
        if (props) this.push(props);
        return;
      }
      const style = this.choose(root, false, false);
      if (style === 'block') {
        const b = this.blockFromString(root.value);
        this.writeBlockScalar(props, '|', b.lines, b.chomp, 0, undefined);
        return;
      }
      const prefixLen = props ? props.length + 1 : 0;
      const lines = this.scalarLines(root, style, prefixLen, 0);
      lines.forEach((l, k) => this.push(k === 0 && props ? props + ' ' + l : l));
      return;
    }
    // flow collection at the root
    const body = this.flowBody(root);
    const text = props ? props + ' ' + body : body;
    const empty = root.type === 'seq' ? root.items.length === 0 : root.pairs.length === 0;
    if (this.o.width === 0 || text.length <= this.o.width || empty) {
      this.push(text);
      return;
    }
    if (props) this.push(props);
    for (const l of this.flowBlock(root, 0)) this.push(l);
  }
}

export interface FormatResult {
  text: string;
  emittedComments: number;
  totalComments: number;
}

/** Re-emit parsed documents using the given style options. Comments are preserved when `comments` is true. */
export function formatYaml(parsed: YamlParseResult, opts: Partial<FormatOptions> = {}): FormatResult {
  const o: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS, ...opts };
  o.indent = Math.min(8, Math.max(1, Math.round(o.indent)));
  if (parsed.docs.length === 0) {
    const t = parsed.source.trim() === '' ? '' : parsed.source.replace(/\s+$/, '') + '\n';
    return { text: o.comments ? t : '', emittedComments: o.comments ? parsed.commentCount : 0, totalComments: parsed.commentCount };
  }
  const em = new Emitter(o);
  const chunks: string[] = [];
  parsed.docs.forEach((doc, idx) => {
    em.out = [];
    em.writeLeading(doc.leading, 0, true);
    if (idx > 0 && doc.directives.length > 0) em.push('...');
    for (const d of doc.directives) em.push(d);
    const marker = idx > 0 || doc.explicitStart || doc.directives.length > 0;
    if (marker) {
      let line = '---';
      if (o.comments && doc.trailing) {
        line += '  ' + doc.trailing;
        em.emitted++;
      }
      em.push(line);
    }
    em.writeRoot(doc);
    em.writeFooter(doc.footer);
    chunks.push(em.out.join('\n'));
  });
  return { text: chunks.join('\n') + '\n', emittedComments: em.emitted, totalComments: parsed.commentCount };
}

/** Stable JSON used to compare two parsed streams irrespective of key order. */
export function canonicalJson(values: YValue[]): string {
  const canon = (v: YValue): unknown => {
    if (v instanceof Map) {
      const keys = [...v.keys()].sort();
      return { __map: keys.map((k) => [k, canon(v.get(k) ?? null)]) };
    }
    if (Array.isArray(v)) return v.map(canon);
    if (typeof v === 'bigint') return { __big: v.toString() };
    if (typeof v === 'number' && !Number.isFinite(v)) return { __num: String(v) };
    return v;
  };
  return JSON.stringify(values.map(canon));
}

/** Check that formatted output parses to the same data as the original. */
export function verifyFormat(parsed: YamlParseResult, formatted: string): { ok: boolean; message?: string } {
  const again = parseYaml(formatted);
  if (again.errors.length > 0) {
    const e = again.errors[0];
    return { ok: false, message: `Formatted output does not parse: ${e?.message ?? 'error'} (line ${e?.line ?? '?'})` };
  }
  const a = parsedToValues(parsed);
  const b = parsedToValues(again);
  if (canonicalJson(a.values) !== canonicalJson(b.values)) {
    return { ok: false, message: 'Formatted output parses to different data than the input.' };
  }
  return { ok: true };
}
