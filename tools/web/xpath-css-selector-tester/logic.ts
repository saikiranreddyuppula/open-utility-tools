/**
 * Helpers for the XPath & CSS selector tester. Everything here works on a minimal DOM-like
 * interface (`NodeLike`), so it is unit-testable without a browser; the page itself passes real
 * DOM nodes. Only `evaluateXPath` / `evaluateCss` touch browser APIs, and they take the document
 * as a parameter.
 */

export const NODE = {
  ELEMENT: 1,
  ATTRIBUTE: 2,
  TEXT: 3,
  CDATA: 4,
  PI: 7,
  COMMENT: 8,
  DOCUMENT: 9,
  DOCTYPE: 10,
  FRAGMENT: 11,
} as const;

export const XHTML_NS = 'http://www.w3.org/1999/xhtml';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

export interface AttrLike {
  name: string;
  value: string;
  localName?: string | null;
  prefix?: string | null;
  namespaceURI?: string | null;
  nodeType: number;
  ownerElement?: NodeLike | null;
}

export interface NodeLike {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  namespaceURI?: string | null;
  prefix?: string | null;
  nodeValue?: string | null;
  textContent?: string | null;
  parentNode?: NodeLike | null;
  childNodes: ArrayLike<NodeLike>;
  attributes?: ArrayLike<AttrLike> | null;
  /** Attr nodes */
  ownerElement?: NodeLike | null;
  name?: string;
  value?: string;
  /** Text / comment / PI data */
  data?: string;
  /** PI target */
  target?: string;
  /** Doctype */
  publicId?: string;
  systemId?: string;
}

function kids(n: NodeLike): NodeLike[] {
  return Array.from(n.childNodes);
}

function attrList(n: NodeLike): AttrLike[] {
  return n.attributes ? Array.from(n.attributes) : [];
}

function localOf(n: { localName?: string | null; nodeName?: string; name?: string }): string {
  if (n.localName) return n.localName;
  const raw = n.nodeName ?? n.name ?? '';
  const c = raw.indexOf(':');
  return c >= 0 ? raw.slice(c + 1) : raw;
}

// ---------------------------------------------------------------------------
// Document type detection
// ---------------------------------------------------------------------------

export type DocKind = 'xml' | 'html';

/** Heuristic: is the pasted text XML or HTML? */
export function detectDocType(text: string): DocKind {
  const t = text.replace(/^﻿/, '').trimStart();
  if (/^<\?xml[\s?]/i.test(t)) return 'xml';
  if (/^<!doctype\s+html/i.test(t)) return 'html';
  if (/^<html[\s>]/i.test(t)) return /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/1999\/xhtml["']/i.test(t) && /\/>/.test(t) ? 'xml' : 'html';
  if (!t.startsWith('<')) return 'html'; // plain text or a fragment without markup: the HTML parser is more forgiving
  // a fragment: look at the tags
  if (/<(head|body|div|span|p|a|ul|ol|li|table|tr|td|th|script|style|meta|link|br|img|input|form|button|h[1-6]|section|article|nav|header|footer|main|label|select|option|textarea|iframe)(\s|\/?>)/i.test(t)) {
    return 'html';
  }
  return 'xml';
}

// ---------------------------------------------------------------------------
// Parse-error extraction (<parsererror> text differs between browsers)
// ---------------------------------------------------------------------------

export interface ParseIssue {
  message: string;
  line: number | null;
  column: number | null;
}

/**
 * Chrome / Safari: "error on line 3 at column 7: Opening and ending tag mismatch: a line 3 and b".
 * Firefox: "XML Parsing Error: mismatched tag. Expected: </b>.\nLocation: ...\nLine Number 3, Column 7:".
 */
export function parseXmlErrorText(raw: string): ParseIssue {
  const text = raw.replace(/\r\n?/g, '\n');
  let line: number | null = null;
  let column: number | null = null;
  let message = '';

  const chrome = /error on line (\d+) at column (\d+):\s*([^\n]*)/i.exec(text);
  if (chrome) {
    line = Number(chrome[1]);
    column = Number(chrome[2]);
    message = (chrome[3] ?? '').trim();
  }
  const ff = /XML Parsing Error:\s*([^\n]*)/i.exec(text);
  const ffPos = /Line Number\s+(\d+),\s*Column\s+(\d+)/i.exec(text);
  if (ffPos) {
    line = Number(ffPos[1]);
    column = Number(ffPos[2]);
  }
  if (!message && ff) message = (ff[1] ?? '').trim();
  if (!message) {
    const generic = /(?:line|Line)\D{0,12}(\d+)\D{1,12}(?:column|Column|col)\D{0,6}(\d+)/.exec(text);
    if (generic && line === null) {
      line = Number(generic[1]);
      column = Number(generic[2]);
    }
    message = text
      .replace(/This page contains the following errors:/i, '')
      .replace(/Below is a rendering of the page up to the first error\.?/i, '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)[0] ?? 'The document is not well-formed XML.';
  }
  return { message, line, column };
}

/** Source line with a caret under `column` (for error display). */
export function sourceFrame(text: string, line: number | null, column: number | null): string | null {
  if (line === null || line < 1) return null;
  const lines = text.split(/\r\n|\n|\r/);
  const src = lines[line - 1];
  if (src === undefined) return null;
  const col = column !== null && column >= 1 ? column : 1;
  const start = Math.max(0, col - 1 - 50);
  const shown = src.slice(start, start + 120);
  return `${String(line).padStart(4)} | ${shown}\n     | ${' '.repeat(Math.max(0, col - 1 - start))}^`;
}

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

export interface NsDecl {
  /** '' for the default namespace. */
  prefix: string;
  uri: string;
}

/** Collects `xmlns` / `xmlns:*` declarations (document order, de-duplicated). */
export function collectNamespaces(root: NodeLike, limit = 200_000): NsDecl[] {
  const out: NsDecl[] = [];
  const seen = new Set<string>();
  let visited = 0;
  const walk = (n: NodeLike): void => {
    if (visited++ > limit) return;
    if (n.nodeType === NODE.ELEMENT) {
      for (const a of attrList(n)) {
        let prefix: string | null = null;
        if (a.name === 'xmlns') prefix = '';
        else if (a.name.startsWith('xmlns:')) prefix = a.name.slice(6);
        if (prefix === null) continue;
        const key = `${prefix}\u0000${a.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ prefix, uri: a.value });
        }
      }
    }
    for (const c of kids(n)) if (c.nodeType === NODE.ELEMENT || c.nodeType === NODE.DOCUMENT) walk(c);
  };
  walk(root);
  return out;
}

/** Same thing from raw text, for documents that do not parse. */
export function collectNamespacesFromText(xml: string): NsDecl[] {
  const out: NsDecl[] = [];
  const seen = new Set<string>();
  const re = /\bxmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const prefix = m[1] ?? '';
    const uri = m[3] ?? m[4] ?? '';
    const key = `${prefix}\u0000${uri}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ prefix, uri });
    }
  }
  return out;
}

/** Text for the namespace editor: declared prefixes plus a suggested prefix for each default namespace. */
export function autoNamespaceText(decls: NsDecl[]): string {
  const lines: string[] = [];
  const taken = new Set<string>();
  for (const d of decls) {
    if (d.prefix && !taken.has(d.prefix)) {
      taken.add(d.prefix);
      lines.push(`${d.prefix}=${d.uri}`);
    }
  }
  const uniqueDefaults = [...new Set(decls.filter((d) => d.prefix === '').map((d) => d.uri))];
  let counter = 0;
  const defLines: string[] = [];
  for (const uri of uniqueDefaults) {
    // a default namespace that is also declared under a prefix needs no extra prefix
    if (decls.some((d) => d.prefix && d.uri === uri)) continue;
    counter++;
    let p = counter === 1 ? 'd' : `d${counter}`;
    while (taken.has(p)) {
      counter++;
      p = `d${counter}`;
    }
    taken.add(p);
    defLines.push(`${p}=${uri}`);
  }
  if (defLines.length) {
    lines.push('# XPath 1.0 cannot match a default namespace without a prefix:', '# use the prefix below, e.g. //' + (defLines[0] ?? '').split('=')[0] + ':item', ...defLines);
  }
  return lines.join('\n');
}

export interface NsParse {
  map: Map<string, string>;
  problems: string[];
}

/** Parses `prefix=uri` lines (also `xmlns:prefix="uri"`); `#` starts a comment. */
export function parseNamespaceText(text: string): NsParse {
  const map = new Map<string, string>();
  const problems: string[] = [];
  const lines = text.split(/\r\n|\n|\r/);
  lines.forEach((raw, i) => {
    const line = raw.replace(/^\s*#.*$/, '').trim();
    if (!line) return;
    let prefix: string;
    let uri: string;
    const decl = /^xmlns:([^\s=]+)\s*=\s*(.*)$/.exec(line);
    const eq = line.indexOf('=');
    if (decl) {
      prefix = decl[1] ?? '';
      uri = decl[2] ?? '';
    } else if (eq > 0) {
      prefix = line.slice(0, eq).trim();
      uri = line.slice(eq + 1).trim();
    } else {
      const sp = /^(\S+)\s+(\S.*)$/.exec(line);
      if (!sp) {
        problems.push(`Line ${i + 1}: expected "prefix=namespace-uri".`);
        return;
      }
      prefix = sp[1] ?? '';
      uri = sp[2] ?? '';
    }
    uri = uri.replace(/^["']|["']$/g, '').trim();
    if (!/^[A-Za-z_][\w.-]*$/.test(prefix)) {
      problems.push(`Line ${i + 1}: "${prefix}" is not a valid prefix.`);
      return;
    }
    if (prefix.toLowerCase().startsWith('xml')) {
      problems.push(`Line ${i + 1}: prefixes starting with "xml" are reserved.`);
      return;
    }
    if (!uri) {
      problems.push(`Line ${i + 1}: missing namespace URI for "${prefix}".`);
      return;
    }
    map.set(prefix, uri);
  });
  return { map, problems };
}

export interface NsResolverLike {
  lookupNamespaceURI(prefix: string | null): string | null;
}

export function makeResolver(map: Map<string, string>): NsResolverLike {
  return {
    lookupNamespaceURI(prefix: string | null): string | null {
      if (prefix === null || prefix === '') return null;
      if (prefix === 'xml') return XML_NS;
      return map.get(prefix) ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// XPath / CSS path generation
// ---------------------------------------------------------------------------

export interface XPathPathOptions {
  /** namespace URI -> prefix known to the evaluator */
  prefixByUri?: Map<string, string>;
  html?: boolean;
  /** Always write [n], even for an only child. */
  alwaysIndex?: boolean;
}

function isElementOfSameName(a: NodeLike, b: NodeLike): boolean {
  return a.nodeType === NODE.ELEMENT && b.nodeType === NODE.ELEMENT && localOf(a) === localOf(b) && (a.namespaceURI ?? '') === (b.namespaceURI ?? '');
}

function isTextual(n: NodeLike): boolean {
  return n.nodeType === NODE.TEXT || n.nodeType === NODE.CDATA;
}

function sameTest(a: NodeLike, b: NodeLike): boolean {
  if (a.nodeType === NODE.ELEMENT) return isElementOfSameName(a, b);
  if (isTextual(a)) return isTextual(b);
  if (a.nodeType === NODE.COMMENT) return b.nodeType === NODE.COMMENT;
  if (a.nodeType === NODE.PI) return b.nodeType === NODE.PI && (a.target ?? a.nodeName) === (b.target ?? b.nodeName);
  return a.nodeType === b.nodeType;
}

function nameTest(n: { localName?: string | null; nodeName?: string; name?: string; namespaceURI?: string | null; prefix?: string | null }, o: XPathPathOptions): string {
  const local = o.html ? localOf(n).toLowerCase() : localOf(n);
  const ns = n.namespaceURI ?? '';
  if (!ns) return local;
  if (o.html && ns === XHTML_NS) return local;
  if (ns === XML_NS) return `xml:${local}`;
  const prefix = o.prefixByUri?.get(ns);
  if (prefix) return `${prefix}:${local}`;
  return `*[local-name()='${local}' and namespace-uri()='${ns}']`;
}

/** Absolute XPath of a node, e.g. /bookstore/book[2]/title, /a/b/@id or /a/text()[1]. */
export function xpathOf(node: NodeLike, o: XPathPathOptions = {}): string {
  if (node.nodeType === NODE.DOCUMENT || node.nodeType === NODE.FRAGMENT) return '/';
  if (node.nodeType === NODE.ATTRIBUTE) {
    const owner = node.ownerElement;
    return (owner ? xpathOf(owner, o) : '') + '/@' + nameTest(node, o);
  }
  const segs: string[] = [];
  let cur: NodeLike | null | undefined = node;
  while (cur && cur.nodeType !== NODE.DOCUMENT && cur.nodeType !== NODE.FRAGMENT) {
    segs.unshift(segment(cur, o));
    cur = cur.parentNode;
  }
  return '/' + segs.join('/');
}

function segment(n: NodeLike, o: XPathPathOptions): string {
  let test: string;
  switch (n.nodeType) {
    case NODE.ELEMENT:
      test = nameTest(n, o);
      break;
    case NODE.TEXT:
    case NODE.CDATA:
      test = 'text()';
      break;
    case NODE.COMMENT:
      test = 'comment()';
      break;
    case NODE.PI:
      test = `processing-instruction('${n.target ?? n.nodeName}')`;
      break;
    default:
      test = 'node()';
      break;
  }
  const parent = n.parentNode;
  if (!parent) return test;
  let index = 0;
  let total = 0;
  for (const s of kids(parent)) {
    if (sameTest(n, s)) {
      total++;
      if (s === n) index = total;
    }
  }
  if (index === 0) return test;
  return total > 1 || o.alwaysIndex ? `${test}[${index}]` : test;
}

/** CSS.escape (CSSOM spec algorithm), usable without a browser. */
export function cssEscape(value: string): string {
  const s = String(value);
  const length = s.length;
  const first = s.charCodeAt(0);
  let result = '';
  if (length === 1 && first === 0x2d) return '\\' + s;
  for (let i = 0; i < length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0) {
      result += String.fromCharCode(0xfffd);
      continue;
    }
    if (
      (c >= 0x01 && c <= 0x1f) ||
      c === 0x7f ||
      (i === 0 && c >= 0x30 && c <= 0x39) ||
      (i === 1 && c >= 0x30 && c <= 0x39 && first === 0x2d)
    ) {
      result += '\\' + c.toString(16) + ' ';
      continue;
    }
    if (c >= 0x80 || c === 0x2d || c === 0x5f || (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
      result += s.charAt(i);
      continue;
    }
    result += '\\' + s.charAt(i);
  }
  return result;
}

export interface CssPathOptions {
  /** How many elements in the document carry this id (default: assume unique). */
  countId?: (id: string) => number;
  html?: boolean;
  nth?: 'of-type' | 'child';
}

function attrValue(n: NodeLike, name: string): string | null {
  for (const a of attrList(n)) if (a.name === name) return a.value;
  return null;
}

/** A unique CSS selector path for an element, e.g. `#menu > li:nth-of-type(2) > a`. */
export function cssPathOf(el: NodeLike, o: CssPathOptions = {}): string | null {
  if (el.nodeType !== NODE.ELEMENT) return null;
  const parts: string[] = [];
  let cur: NodeLike | null | undefined = el;
  while (cur && cur.nodeType === NODE.ELEMENT) {
    const id = attrValue(cur, 'id');
    if (id && id.length > 0 && (o.countId ? o.countId(id) === 1 : true)) {
      parts.unshift('#' + cssEscape(id));
      break;
    }
    const local = o.html ? localOf(cur).toLowerCase() : localOf(cur);
    let seg = cssEscape(local);
    const parent: NodeLike | null | undefined = cur.parentNode;
    if (parent && (parent.nodeType === NODE.ELEMENT || parent.nodeType === NODE.DOCUMENT || parent.nodeType === NODE.FRAGMENT)) {
      const siblings = kids(parent).filter((s) => s.nodeType === NODE.ELEMENT);
      if (o.nth === 'child') {
        if (siblings.length > 1) seg += `:nth-child(${siblings.indexOf(cur) + 1})`;
      } else {
        const same = siblings.filter((s) => isElementOfSameName(s, cur as NodeLike));
        if (same.length > 1) seg += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(seg);
    cur = parent;
  }
  return parts.join(' > ');
}

// ---------------------------------------------------------------------------
// Serialising / describing nodes
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** Compact markup of a node (no pretty-printing). */
export function serializeNode(node: NodeLike, html: boolean): string {
  switch (node.nodeType) {
    case NODE.ELEMENT: {
      const name = html && (node.namespaceURI ?? XHTML_NS) === XHTML_NS ? localOf(node).toLowerCase() : node.nodeName;
      const attrs = attrList(node)
        .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
        .join('');
      const children = kids(node);
      if (html && VOID_ELEMENTS.has(name)) return `<${name}${attrs}>`;
      if (children.length === 0) return html ? `<${name}${attrs}></${name}>` : `<${name}${attrs}/>`;
      const inner = children.map((c) => serializeNode(c, html)).join('');
      return `<${name}${attrs}>${inner}</${name}>`;
    }
    case NODE.ATTRIBUTE:
      return `${node.name ?? node.nodeName}="${escapeAttr(node.value ?? node.nodeValue ?? '')}"`;
    case NODE.TEXT: {
      const parent = node.parentNode;
      const raw = html && parent && parent.nodeType === NODE.ELEMENT && RAW_TEXT.has(localOf(parent).toLowerCase());
      const t = node.data ?? node.nodeValue ?? '';
      return raw ? t : escapeText(t);
    }
    case NODE.CDATA:
      return `<![CDATA[${node.data ?? node.nodeValue ?? ''}]]>`;
    case NODE.COMMENT:
      return `<!--${node.data ?? node.nodeValue ?? ''}-->`;
    case NODE.PI:
      return `<?${node.target ?? node.nodeName} ${node.data ?? node.nodeValue ?? ''}?>`;
    case NODE.DOCTYPE:
      return `<!DOCTYPE ${node.nodeName}>`;
    case NODE.DOCUMENT:
    case NODE.FRAGMENT:
      return kids(node)
        .map((c) => serializeNode(c, html))
        .join('');
    default:
      return node.textContent ?? '';
  }
}

export type NodeKind = 'element' | 'attribute' | 'text' | 'cdata' | 'comment' | 'processing-instruction' | 'document' | 'other';

export function kindOf(node: NodeLike): NodeKind {
  switch (node.nodeType) {
    case NODE.ELEMENT: return 'element';
    case NODE.ATTRIBUTE: return 'attribute';
    case NODE.TEXT: return 'text';
    case NODE.CDATA: return 'cdata';
    case NODE.COMMENT: return 'comment';
    case NODE.PI: return 'processing-instruction';
    case NODE.DOCUMENT: return 'document';
    default: return 'other';
  }
}

export interface NodeInfo {
  kind: NodeKind;
  name: string;
  xpath: string;
  css: string | null;
  markup: string;
  text: string;
  attrs: { name: string; value: string }[];
}

export interface DescribeOptions extends XPathPathOptions {
  countId?: (id: string) => number;
  normalizeWhitespace?: boolean;
}

export function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function describeNode(node: NodeLike, o: DescribeOptions = {}): NodeInfo {
  const kind = kindOf(node);
  const html = !!o.html;
  const norm = o.normalizeWhitespace !== false;
  let name = node.nodeName;
  if (kind === 'element' && html) name = localOf(node).toLowerCase();
  if (kind === 'attribute') name = node.name ?? node.nodeName;
  let text: string;
  if (kind === 'attribute') text = node.value ?? node.nodeValue ?? '';
  else if (kind === 'text' || kind === 'cdata' || kind === 'comment') text = node.data ?? node.nodeValue ?? '';
  else if (kind === 'processing-instruction') text = node.data ?? node.nodeValue ?? '';
  else text = node.textContent ?? '';
  if (norm && kind !== 'attribute') text = normalizeWs(text);
  const owner = kind === 'attribute' ? node.ownerElement ?? null : null;
  return {
    kind,
    name,
    xpath: xpathOf(node, o),
    css: kind === 'element' ? cssPathOf(node, o) : owner ? cssPathOf(owner, o) : null,
    markup: serializeNode(node, html),
    text,
    attrs: kind === 'element' ? attrList(node).map((a) => ({ name: a.name, value: a.value })) : [],
  };
}

// ---------------------------------------------------------------------------
// Query evaluation (browser objects are passed in)
// ---------------------------------------------------------------------------

export const XR = {
  ANY_TYPE: 0,
  NUMBER_TYPE: 1,
  STRING_TYPE: 2,
  BOOLEAN_TYPE: 3,
  UNORDERED_NODE_ITERATOR_TYPE: 4,
  ORDERED_NODE_ITERATOR_TYPE: 5,
  UNORDERED_NODE_SNAPSHOT_TYPE: 6,
  ORDERED_NODE_SNAPSHOT_TYPE: 7,
  ANY_UNORDERED_NODE_TYPE: 8,
  FIRST_ORDERED_NODE_TYPE: 9,
} as const;

export interface XPathResultLike {
  resultType: number;
  numberValue: number;
  stringValue: string;
  booleanValue: boolean;
  snapshotLength: number;
  snapshotItem(i: number): NodeLike | null;
  iterateNext?(): NodeLike | null;
  singleNodeValue?: NodeLike | null;
}

export interface XPathDocLike {
  evaluate(expr: string, ctx: unknown, resolver: NsResolverLike | null, type: number, result: null): XPathResultLike;
}

export type QueryOutcome =
  | { kind: 'nodes'; nodes: NodeLike[]; total: number; truncated: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean };

export const MAX_NODES = 5000;

export class QueryError extends Error {
  hint: string | null;
  constructor(message: string, hint: string | null = null) {
    super(message);
    this.name = 'QueryError';
    this.hint = hint;
  }
}

/** Turn a browser DOMException into a short, readable message. */
export function describeQueryError(e: unknown, mode: 'xpath' | 'css'): QueryError {
  const raw = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : '';
  const cleaned = raw
    .replace(/^Failed to execute '[^']+' on '[^']+':\s*/, '')
    .replace(/^SyntaxError:\s*/, '')
    .trim();
  if (mode === 'css') {
    return new QueryError(cleaned || 'Invalid CSS selector.', 'Check brackets, quotes and pseudo-class names. Namespace prefixes (ns|tag) and some pseudo-classes are not supported by querySelectorAll.');
  }
  const nsProblem = name === 'NamespaceError' || /namespace|prefix|unresolv/i.test(cleaned);
  if (nsProblem) {
    return new QueryError(
      cleaned || 'Unresolvable namespace prefix.',
      'Declare the prefix in the Namespaces box (prefix=uri). XPath 1.0 cannot match a default namespace without a prefix: give it one (for example d) and write //d:item, or use //*[local-name()="item"].'
    );
  }
  return new QueryError(
    cleaned || 'Invalid XPath expression.',
    'This is XPath 1.0 evaluated by the browser. Check parentheses and quotes; XPath 2.0 functions (matches, replace, lower-case, ...) are not available.'
  );
}

export function evaluateXPath(doc: XPathDocLike, expr: string, resolver: NsResolverLike | null, limit = MAX_NODES): QueryOutcome {
  const q = expr.trim();
  if (!q) throw new QueryError('Enter an XPath expression.');
  let res: XPathResultLike;
  try {
    res = doc.evaluate(q, doc, resolver, XR.ANY_TYPE, null);
  } catch (e) {
    throw describeQueryError(e, 'xpath');
  }
  switch (res.resultType) {
    case XR.NUMBER_TYPE:
      return { kind: 'number', value: res.numberValue };
    case XR.STRING_TYPE:
      return { kind: 'string', value: res.stringValue };
    case XR.BOOLEAN_TYPE:
      return { kind: 'boolean', value: res.booleanValue };
    default: {
      let snap: XPathResultLike;
      try {
        snap = doc.evaluate(q, doc, resolver, XR.ORDERED_NODE_SNAPSHOT_TYPE, null);
      } catch (e) {
        throw describeQueryError(e, 'xpath');
      }
      const total = snap.snapshotLength;
      const nodes: NodeLike[] = [];
      for (let i = 0; i < total && i < limit; i++) {
        const n = snap.snapshotItem(i);
        if (n) nodes.push(n);
      }
      return { kind: 'nodes', nodes, total, truncated: total > limit };
    }
  }
}

export interface CssDocLike {
  querySelectorAll(sel: string): ArrayLike<NodeLike>;
}

export function evaluateCss(doc: CssDocLike, selector: string, limit = MAX_NODES): QueryOutcome {
  const q = selector.trim();
  if (!q) throw new QueryError('Enter a CSS selector.');
  let list: ArrayLike<NodeLike>;
  try {
    list = doc.querySelectorAll(q);
  } catch (e) {
    throw describeQueryError(e, 'css');
  }
  const total = list.length;
  const nodes: NodeLike[] = [];
  for (let i = 0; i < total && i < limit; i++) {
    const n = list[i];
    if (n) nodes.push(n);
  }
  return { kind: 'nodes', nodes, total, truncated: total > limit };
}

// ---------------------------------------------------------------------------
// Exports: JSON / CSV
// ---------------------------------------------------------------------------

export interface ExportRow {
  type: NodeKind;
  name: string;
  xpath: string;
  css: string | null;
  text: string;
  attributes: Record<string, string>;
  markup: string;
}

export function toExportRows(infos: NodeInfo[]): ExportRow[] {
  return infos.map((n) => {
    const attributes: Record<string, string> = {};
    for (const a of n.attrs) attributes[a.name] = a.value;
    if (n.kind === 'attribute') attributes[n.name] = n.text;
    return { type: n.kind, name: n.name, xpath: n.xpath, css: n.css, text: n.text, attributes, markup: n.markup };
  });
}

export function resultsToJson(outcome: QueryOutcome, infos: NodeInfo[]): string {
  if (outcome.kind !== 'nodes') return JSON.stringify({ type: outcome.kind, value: outcome.value }, null, 2);
  return JSON.stringify(toExportRows(infos), null, 2);
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** One row per node: index, type, name, xpath, text, then one column per attribute name (`@href`, ...). */
export function resultsToCsv(outcome: QueryOutcome, infos: NodeInfo[]): string {
  if (outcome.kind !== 'nodes') return `type,value\r\n${outcome.kind},${csvCell(String(outcome.value))}\r\n`;
  const rows = toExportRows(infos);
  const attrNames: string[] = [];
  for (const r of rows) for (const k of Object.keys(r.attributes)) if (!attrNames.includes(k)) attrNames.push(k);
  const header = ['#', 'type', 'name', 'xpath', 'text', ...attrNames.map((a) => `@${a}`)];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((r, i) => {
    lines.push([String(i + 1), r.type, r.name, r.xpath, r.text, ...attrNames.map((a) => r.attributes[a] ?? '')].map(csvCell).join(','));
  });
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Pretty-printed document with highlighted matches
// ---------------------------------------------------------------------------

export type SegClass = 'punct' | 'tag' | 'attr' | 'val' | 'text' | 'comment' | 'pi' | 'cdata' | 'doctype';

export interface PrettySeg {
  text: string;
  cls: SegClass;
  /** Index of the result this segment belongs to. */
  match?: number;
}

export interface PrettyLine {
  indent: number;
  segs: PrettySeg[];
}

export interface PrettyResult {
  lines: PrettyLine[];
  truncated: boolean;
}

export function prettyPrintDoc(root: NodeLike, matches: Map<unknown, number>, o: { html: boolean; maxNodes?: number }): PrettyResult {
  const lines: PrettyLine[] = [];
  const max = o.maxNodes ?? 4000;
  let count = 0;
  let truncated = false;
  const html = o.html;

  const tagName = (el: NodeLike): string => (html && (el.namespaceURI ?? XHTML_NS) === XHTML_NS ? localOf(el).toLowerCase() : el.nodeName);

  const startTag = (el: NodeLike, selfClose: boolean): PrettySeg[] => {
    const m = matches.get(el);
    const segs: PrettySeg[] = [{ text: '<', cls: 'punct', match: m }, { text: tagName(el), cls: 'tag', match: m }];
    for (const a of attrList(el)) {
      const am = matches.get(a);
      segs.push({ text: ' ', cls: 'punct', match: am ?? m });
      segs.push({ text: a.name, cls: 'attr', match: am ?? m });
      segs.push({ text: '=', cls: 'punct', match: am ?? m });
      segs.push({ text: `"${escapeAttr(a.value)}"`, cls: 'val', match: am ?? m });
    }
    segs.push({ text: selfClose ? '/>' : '>', cls: 'punct', match: m });
    return segs;
  };
  const endTag = (el: NodeLike): PrettySeg[] => {
    const m = matches.get(el);
    return [{ text: '</', cls: 'punct', match: m }, { text: tagName(el), cls: 'tag', match: m }, { text: '>', cls: 'punct', match: m }];
  };
  const isBlank = (n: NodeLike): boolean => n.nodeType === NODE.TEXT && (n.data ?? n.nodeValue ?? '').trim() === '';

  const printNode = (n: NodeLike, depth: number): void => {
    if (truncated) return;
    if (++count > max) {
      truncated = true;
      return;
    }
    switch (n.nodeType) {
      case NODE.ELEMENT: {
        const name = tagName(n);
        const children = kids(n).filter((c) => !isBlank(c));
        if (html && VOID_ELEMENTS.has(name)) {
          lines.push({ indent: depth, segs: startTag(n, false) });
          return;
        }
        if (children.length === 0) {
          if (html) lines.push({ indent: depth, segs: [...startTag(n, false), ...endTag(n)] });
          else lines.push({ indent: depth, segs: startTag(n, true) });
          return;
        }
        const only = children[0];
        const inlineText =
          children.length === 1 && only && isTextual(only) && !(html && RAW_TEXT.has(name)) && !/\n/.test((only.data ?? only.nodeValue ?? '').trim());
        if (inlineText && only) {
          const tm = matches.get(only);
          const raw = only.nodeType === NODE.CDATA ? `<![CDATA[${only.data ?? ''}]]>` : escapeText(normalizeWs(only.data ?? only.nodeValue ?? ''));
          lines.push({
            indent: depth,
            segs: [...startTag(n, false), { text: raw, cls: only.nodeType === NODE.CDATA ? 'cdata' : 'text', match: tm }, ...endTag(n)],
          });
          return;
        }
        lines.push({ indent: depth, segs: startTag(n, false) });
        for (const c of children) printNode(c, depth + 1);
        lines.push({ indent: depth, segs: endTag(n) });
        return;
      }
      case NODE.TEXT: {
        const m = matches.get(n);
        const parent = n.parentNode;
        const raw = !!(html && parent && parent.nodeType === NODE.ELEMENT && RAW_TEXT.has(localOf(parent).toLowerCase()));
        const t = n.data ?? n.nodeValue ?? '';
        if (raw) {
          const ls = t.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
          const common = Math.min(...ls.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)?.[0].length ?? 0), 1e9);
          for (const l of ls) lines.push({ indent: depth, segs: [{ text: l.slice(common === 1e9 ? 0 : common), cls: 'text', match: m }] });
        } else {
          const trimmed = normalizeWs(t);
          if (trimmed) lines.push({ indent: depth, segs: [{ text: escapeText(trimmed), cls: 'text', match: m }] });
        }
        return;
      }
      case NODE.CDATA:
        lines.push({ indent: depth, segs: [{ text: `<![CDATA[${n.data ?? n.nodeValue ?? ''}]]>`, cls: 'cdata', match: matches.get(n) }] });
        return;
      case NODE.COMMENT:
        lines.push({ indent: depth, segs: [{ text: `<!--${n.data ?? n.nodeValue ?? ''}-->`, cls: 'comment', match: matches.get(n) }] });
        return;
      case NODE.PI:
        lines.push({ indent: depth, segs: [{ text: `<?${n.target ?? n.nodeName} ${n.data ?? n.nodeValue ?? ''}?>`, cls: 'pi', match: matches.get(n) }] });
        return;
      case NODE.DOCTYPE: {
        const ids = n.publicId ? ` PUBLIC "${n.publicId}"${n.systemId ? ` "${n.systemId}"` : ''}` : n.systemId ? ` SYSTEM "${n.systemId}"` : '';
        lines.push({ indent: depth, segs: [{ text: `<!DOCTYPE ${n.nodeName}${ids}>`, cls: 'doctype' }] });
        return;
      }
      default:
        return;
    }
  };

  if (root.nodeType === NODE.DOCUMENT || root.nodeType === NODE.FRAGMENT) {
    const docMatch = matches.get(root);
    if (docMatch !== undefined) lines.push({ indent: 0, segs: [{ text: '(document node)', cls: 'comment', match: docMatch }] });
    for (const c of kids(root)) printNode(c, 0);
  } else {
    printNode(root, 0);
  }
  return { lines, truncated };
}

export function prettyToText(lines: PrettyLine[], indent = '  '): string {
  return lines.map((l) => indent.repeat(l.indent) + l.segs.map((s) => s.text).join('')).join('\n');
}
