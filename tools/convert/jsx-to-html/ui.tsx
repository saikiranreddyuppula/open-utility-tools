'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `<div className="card" tabIndex={0}>
  <label htmlFor="name">Name</label>
  <input id="name" type="text" autoComplete="off" />
  <svg viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M4 12h16" strokeLinecap="round" />
  </svg>
  <p>Hello {"world"}, your score is {score}.</p>
  <br />
</div>`;

type ExprMode = 'drop' | 'comment' | 'keep';

// Void elements that render without a closing tag in HTML.
const VOID_TAGS = new Set<string>([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

// JSX attribute name -> HTML attribute name (special cases).
const ATTR_MAP: Record<string, string> = {
  classname: 'class',
  htmlfor: 'for',
  tabindex: 'tabindex',
  readonly: 'readonly',
  maxlength: 'maxlength',
  minlength: 'minlength',
  autocomplete: 'autocomplete',
  autofocus: 'autofocus',
  spellcheck: 'spellcheck',
  crossorigin: 'crossorigin',
  contenteditable: 'contenteditable',
  enctype: 'enctype',
  formaction: 'formaction',
  novalidate: 'novalidate',
  srcset: 'srcset',
};

interface Attr {
  name: string;
  value: string; // raw token after '=' incl. quotes/braces, or '' for boolean
  hasValue: boolean;
}

interface OpenTag {
  kind: 'open';
  name: string;
  attrs: Attr[];
  selfClose: boolean;
}
interface CloseTag {
  kind: 'close';
  name: string;
}
interface TextNode {
  kind: 'text';
  value: string;
}
interface CommentNode {
  kind: 'comment';
  value: string;
}
type Token = OpenTag | CloseTag | TextNode | CommentNode;

/** Convert a camelCase JSX attribute name to its HTML equivalent. */
function htmlAttrName(jsx: string): string {
  const lower = jsx.toLowerCase();
  const mapped = ATTR_MAP[lower];
  if (mapped) return mapped;
  // Preserve data-/aria- as-is.
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower;
  // SVG-style camelCase -> hyphenated (strokeWidth -> stroke-width),
  // but only when it actually has internal capitals.
  if (/[A-Z]/.test(jsx)) {
    return jsx.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
  return lower;
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Parse the attribute portion of an opening tag into structured attrs. */
function parseAttrs(raw: string): Attr[] {
  const attrs: Attr[] = [];
  let i = 0;
  const n = raw.length;
  while (i < n) {
    // skip whitespace
    while (i < n && /\s/.test(raw[i] ?? '')) i++;
    if (i >= n) break;
    // read attribute name
    let name = '';
    while (i < n && /[^\s=/>]/.test(raw[i] ?? '')) {
      name += raw[i];
      i++;
    }
    if (!name) {
      i++;
      continue;
    }
    // skip whitespace before '='
    while (i < n && /\s/.test(raw[i] ?? '')) i++;
    if (raw[i] === '=') {
      i++;
      while (i < n && /\s/.test(raw[i] ?? '')) i++;
      const ch = raw[i] ?? '';
      let value = '';
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        while (i < n && raw[i] !== quote) {
          value += raw[i];
          i++;
        }
        i++; // closing quote
        attrs.push({ name, value, hasValue: true });
      } else if (ch === '{') {
        // braced expression; capture balanced braces
        let depth = 0;
        let expr = '';
        while (i < n) {
          const c = raw[i] ?? '';
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          if (!(depth === 1 && c === '{' && expr === '')) expr += c;
          i++;
        }
        // expr now holds inner content including leading '{'
        const inner = expr.startsWith('{') ? expr.slice(1) : expr;
        attrs.push({ name, value: `{${inner.trim()}}`, hasValue: true });
      } else {
        // bare value until whitespace
        while (i < n && /[^\s/>]/.test(raw[i] ?? '')) {
          value += raw[i];
          i++;
        }
        attrs.push({ name, value, hasValue: true });
      }
    } else {
      attrs.push({ name, value: '', hasValue: false });
    }
  }
  return attrs;
}

/** Tokenize the JSX source into tags, text and comments. */
function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      const rest = src.slice(i);
      if (rest) tokens.push({ kind: 'text', value: rest });
      break;
    }
    if (lt > i) {
      tokens.push({ kind: 'text', value: src.slice(i, lt) });
    }
    // comment <!-- -->
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ kind: 'comment', value: src.slice(lt + 4, end === -1 ? n : end) });
      i = stop;
      continue;
    }
    // find end of tag (respecting quotes and braces)
    let j = lt + 1;
    let depth = 0;
    while (j < n) {
      const c = src[j] ?? '';
      if (c === '"' || c === "'") {
        const q = c;
        j++;
        while (j < n && src[j] !== q) j++;
      } else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth <= 0) break;
      j++;
    }
    const tagInner = src.slice(lt + 1, j);
    i = j + 1;
    if (tagInner.startsWith('/')) {
      const name = tagInner.slice(1).trim();
      tokens.push({ kind: 'close', name });
      continue;
    }
    const selfClose = tagInner.trimEnd().endsWith('/');
    const body = selfClose ? tagInner.trimEnd().slice(0, -1) : tagInner;
    const m = body.match(/^\s*([A-Za-z][\w.-]*)([\s\S]*)$/);
    const name = m?.[1] ?? '';
    const attrRaw = m?.[2] ?? '';
    tokens.push({ kind: 'open', name, attrs: parseAttrs(attrRaw), selfClose });
  }
  return tokens;
}

/** Convert a JSX text segment containing {expr} into HTML text. */
function convertText(text: string, exprMode: ExprMode): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i] ?? '';
    if (c === '{') {
      let depth = 0;
      let expr = '';
      while (i < n) {
        const ch = text[i] ?? '';
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        if (!(depth === 1 && ch === '{' && expr === '')) expr += ch;
        i++;
      }
      const inner = (expr.startsWith('{') ? expr.slice(1) : expr).trim();
      // String literal expression -> literal text.
      const strMatch = inner.match(/^(['"`])([\s\S]*)\1$/);
      if (strMatch) {
        out += escapeHtmlText(strMatch[2] ?? '');
        continue;
      }
      if (inner === '') continue;
      if (exprMode === 'comment') out += `<!-- ${inner} -->`;
      else if (exprMode === 'keep') out += `{${inner}}`;
      // 'drop' -> emit nothing
      continue;
    }
    out += escapeHtmlText(c);
    i++;
  }
  return out;
}

/** Convert one open tag's attributes into an HTML attribute string. */
function renderAttrs(attrs: Attr[], exprMode: ExprMode, convertStyle: boolean): string {
  const parts: string[] = [];
  for (const a of attrs) {
    if (a.name === 'key' || a.name === 'ref') continue;
    const name = htmlAttrName(a.name);
    if (!a.hasValue) {
      parts.push(name);
      continue;
    }
    const v = a.value;
    if (v.startsWith('{') && v.endsWith('}')) {
      const inner = v.slice(1, -1).trim();
      const strMatch = inner.match(/^(['"`])([\s\S]*)\1$/);
      if (strMatch) {
        parts.push(`${name}="${escapeAttr(strMatch[2] ?? '')}"`);
        continue;
      }
      // boolean true
      if (inner === 'true') {
        parts.push(name);
        continue;
      }
      if (inner === 'false') continue; // omit
      // numeric literal
      if (/^-?\d+(\.\d+)?$/.test(inner)) {
        parts.push(`${name}="${inner}"`);
        continue;
      }
      // style object {{...}} -> inline CSS
      if (convertStyle && name === 'style' && inner.startsWith('{') && inner.endsWith('}')) {
        const css = styleObjectToCss(inner.slice(1, -1));
        if (css) parts.push(`style="${escapeAttr(css)}"`);
        continue;
      }
      // dynamic expression
      if (exprMode === 'keep') parts.push(`${name}="{${inner}}"`);
      else if (exprMode === 'comment') parts.push(`${name}="" data-jsx-${name}="${escapeAttr(inner)}"`);
      // 'drop' -> omit attribute
      continue;
    }
    parts.push(`${name}="${escapeAttr(v)}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

/** Convert a JS style object body (key: 'val', ...) to a CSS declaration string. */
function styleObjectToCss(body: string): string {
  const decls: string[] = [];
  // split on commas not inside quotes
  const segments: string[] = [];
  let depthQ: string | null = null;
  let cur = '';
  for (const ch of body) {
    if (depthQ) {
      if (ch === depthQ) depthQ = null;
      cur += ch;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      depthQ = ch;
      cur += ch;
    } else if (ch === ',') {
      segments.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) segments.push(cur);
  for (const seg of segments) {
    const idx = seg.indexOf(':');
    if (idx === -1) continue;
    const rawKey = seg.slice(0, idx).trim().replace(/^['"`]|['"`]$/g, '');
    if (!rawKey) continue;
    const cssKey = rawKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    let rawVal = seg.slice(idx + 1).trim();
    const strMatch = rawVal.match(/^(['"`])([\s\S]*)\1$/);
    if (strMatch) rawVal = strMatch[2] ?? '';
    if (!rawVal) continue;
    decls.push(`${cssKey}: ${rawVal}`);
  }
  return decls.join('; ');
}

function jsxToHtml(
  input: string,
  exprMode: ExprMode,
  indentSize: number,
  convertStyle: boolean
): string {
  if (!input.trim()) return '';
  const tokens = tokenize(input);
  const out: string[] = [];
  let depth = 0;
  const pad = (d: number) => ' '.repeat(Math.max(0, d) * indentSize);

  for (const tok of tokens) {
    if (tok.kind === 'text') {
      const converted = convertText(tok.value, exprMode);
      if (converted.trim()) {
        out.push(pad(depth) + converted.trim());
      }
      continue;
    }
    if (tok.kind === 'comment') {
      out.push(pad(depth) + `<!--${tok.value}-->`);
      continue;
    }
    if (tok.kind === 'close') {
      depth = Math.max(0, depth - 1);
      out.push(pad(depth) + `</${tok.name}>`);
      continue;
    }
    // open tag
    const isVoid = VOID_TAGS.has(tok.name.toLowerCase());
    const attrStr = renderAttrs(tok.attrs, exprMode, convertStyle);
    if (isVoid || tok.selfClose) {
      if (isVoid) {
        out.push(pad(depth) + `<${tok.name}${attrStr}>`);
      } else {
        // non-void self-closing -> explicit close
        out.push(pad(depth) + `<${tok.name}${attrStr}></${tok.name}>`);
      }
      continue;
    }
    out.push(pad(depth) + `<${tok.name}${attrStr}>`);
    depth++;
  }
  return out.join('\n');
}

export default function JsxToHtmlTool() {
  const [exprMode, setExprMode] = useState<ExprMode>('comment');
  const [indentSize, setIndentSize] = useState('2');
  const [keepStyle, setKeepStyle] = useState(true);

  const transform = useCallback(
    (input: string) => {
      const size = Number(indentSize);
      const ind = Number.isFinite(size) && size > 0 ? size : 2;
      return jsxToHtml(input, exprMode, ind, keepStyle);
    },
    [exprMode, indentSize, keepStyle]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[exprMode, indentSize, keepStyle]}
      inputLabel="JSX"
      outputLabel="HTML"
      inputPlaceholder='<div className="box">Hello</div>'
      sample={SAMPLE}
      downloadName="output.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Expressions {…}">
            <Tabs value={exprMode} onValueChange={(v) => setExprMode(v as ExprMode)}>
              <TabsList>
                <TabsTrigger value="drop">Drop</TabsTrigger>
                <TabsTrigger value="comment">Comment</TabsTrigger>
                <TabsTrigger value="keep">Keep</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Indent">
            <Select value={indentSize} onValueChange={setIndentSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Style objects">
            <div className="flex h-8 items-center gap-2">
              <Switch id="keepstyle" checked={keepStyle} onCheckedChange={setKeepStyle} />
              <Label htmlFor="keepstyle" className="text-xs text-muted-foreground">
                Convert to inline CSS
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
