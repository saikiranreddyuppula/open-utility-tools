'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `doctype html
html(lang="en")
  head
    title Hello Pug
  body
    h1.title#main Welcome
    p This is a paragraph.
    ul
      li Item one
      li Item two
    a(href="/about", target="_blank") About
    // a comment line`;

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

interface PugNode {
  tag: string;
  id: string | null;
  classes: string[];
  attrs: { name: string; value: string | null }[];
  text: string | null;
  selfClose: boolean;
  isText: boolean;
  raw: string;
  children: PugNode[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parse the attribute list inside ( ... ), respecting quoted values.
function parseAttrs(src: string): { name: string; value: string | null }[] {
  const attrs: { name: string; value: string | null }[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    while (i < n && (src[i] === ' ' || src[i] === ',' || src[i] === '\t')) i++;
    if (i >= n) break;
    let name = '';
    while (i < n) {
      const c = src[i] ?? '';
      if (c === '=' || c === ' ' || c === ',' || c === ')') break;
      name += c;
      i++;
    }
    if (name === '') {
      i++;
      continue;
    }
    while (i < n && src[i] === ' ') i++;
    if (src[i] === '=') {
      i++;
      while (i < n && src[i] === ' ') i++;
      const quote = src[i];
      if (quote === '"' || quote === "'") {
        i++;
        let val = '';
        while (i < n && src[i] !== quote) {
          val += src[i] ?? '';
          i++;
        }
        i++;
        attrs.push({ name, value: val });
      } else {
        let val = '';
        while (i < n) {
          const c = src[i] ?? '';
          if (c === ' ' || c === ',' || c === ')') break;
          val += c;
          i++;
        }
        attrs.push({ name, value: val });
      }
    } else {
      attrs.push({ name, value: null });
    }
  }
  return attrs;
}

function parseLine(content: string): PugNode {
  const base: PugNode = {
    tag: 'div',
    id: null,
    classes: [],
    attrs: [],
    text: null,
    selfClose: false,
    isText: false,
    raw: '',
    children: [],
  };

  // Comment line.
  if (content.startsWith('//')) {
    base.isText = true;
    base.raw = `<!-- ${content.slice(2).trim()} -->`;
    return base;
  }
  // Piped text.
  if (content.startsWith('|')) {
    base.isText = true;
    base.raw = escapeHtml(content.slice(1).replace(/^ /, ''));
    return base;
  }
  // Doctype.
  if (/^doctype\b/i.test(content)) {
    base.isText = true;
    const kind = content.slice(7).trim().toLowerCase();
    base.raw = kind === 'html' || kind === '' ? '<!DOCTYPE html>' : `<!DOCTYPE ${kind}>`;
    return base;
  }

  let i = 0;
  const n = content.length;
  // Tag name (optional — if line starts with . or #, default div).
  let tag = '';
  while (i < n) {
    const c = content[i] ?? '';
    if (/[A-Za-z0-9_-]/.test(c)) {
      tag += c;
      i++;
    } else break;
  }
  base.tag = tag === '' ? 'div' : tag;

  // .class / #id shorthand.
  while (i < n && (content[i] === '.' || content[i] === '#')) {
    const marker = content[i];
    i++;
    let name = '';
    while (i < n) {
      const c = content[i] ?? '';
      if (/[A-Za-z0-9_-]/.test(c)) {
        name += c;
        i++;
      } else break;
    }
    if (marker === '.') base.classes.push(name);
    else base.id = name;
  }

  // Attributes ( ... ).
  if (content[i] === '(') {
    i++;
    let depth = 1;
    let attrSrc = '';
    while (i < n && depth > 0) {
      const c = content[i] ?? '';
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      attrSrc += c;
      i++;
    }
    base.attrs = parseAttrs(attrSrc);
  }

  // Trailing '/' means explicit self-close.
  if (content[i] === '/') {
    base.selfClose = true;
    i++;
  }

  // Inline text after the tag.
  const rest = content.slice(i).replace(/^[ \t]/, '');
  if (rest !== '') {
    if (rest.startsWith('.')) {
      // block text marker — not supported deeply; keep rest after dot/space
      base.text = rest.slice(1);
    } else {
      base.text = rest;
    }
  }
  return base;
}

interface IndentLine {
  indent: number;
  content: string;
}

function tokenizeLines(input: string): IndentLine[] {
  const result: IndentLine[] = [];
  for (const raw of input.split(/\r\n|\r|\n/)) {
    if (raw.trim() === '') continue;
    const match = /^(\s*)/.exec(raw);
    const ws = match && match[1] ? match[1] : '';
    // Treat each tab as one indent unit; spaces counted directly.
    const indent = ws.replace(/\t/g, '  ').length;
    result.push({ indent, content: raw.trim() });
  }
  return result;
}

function buildTree(lines: IndentLine[]): PugNode[] {
  const roots: PugNode[] = [];
  const stack: { node: PugNode; indent: number }[] = [];
  for (const line of lines) {
    const node = parseLine(line.content);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top && top.indent >= line.indent) stack.pop();
      else break;
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else roots.push(node);
    if (!node.isText) stack.push({ node, indent: line.indent });
  }
  return roots;
}

function attrString(node: PugNode): string {
  const parts: string[] = [];
  if (node.id) parts.push(`id="${escapeHtml(node.id)}"`);
  if (node.classes.length > 0) parts.push(`class="${escapeHtml(node.classes.join(' '))}"`);
  for (const a of node.attrs) {
    if (a.value === null) parts.push(escapeHtml(a.name));
    else parts.push(`${escapeHtml(a.name)}="${escapeHtml(a.value)}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function renderNode(node: PugNode, depth: number, pretty: boolean, indentSize: number): string {
  const pad = pretty ? ' '.repeat(depth * indentSize) : '';
  const nl = pretty ? '\n' : '';
  if (node.isText) {
    return `${pad}${node.raw}`;
  }
  const open = `<${node.tag}${attrString(node)}`;
  const isVoid = VOID_TAGS.has(node.tag.toLowerCase());
  if (isVoid || node.selfClose) {
    return `${pad}${open} />`;
  }
  const hasChildren = node.children.length > 0;
  const text = node.text ? escapeHtml(node.text) : '';
  if (!hasChildren) {
    return `${pad}${open}>${text}</${node.tag}>`;
  }
  const childStrings = node.children.map((c) => renderNode(c, depth + 1, pretty, indentSize));
  const inner = text
    ? `${pretty ? ' '.repeat((depth + 1) * indentSize) : ''}${text}${nl}` + childStrings.join(nl) + nl
    : childStrings.join(nl) + nl;
  return `${pad}${open}>${nl}${inner}${pad}</${node.tag}>`;
}

export default function PugToHtmlTool() {
  const [pretty, setPretty] = useState(true);
  const [indentSize, setIndentSize] = useState<'2' | '4'>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = tokenizeLines(input);
      const tree = buildTree(lines);
      const size = Number(indentSize);
      const out = tree.map((n) => renderNode(n, 0, pretty, size));
      return out.join(pretty ? '\n' : '');
    },
    [pretty, indentSize],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[pretty, indentSize]}
      inputLabel="Pug"
      outputLabel="HTML"
      inputPlaceholder="div.card\n  h1 Title"
      sample={SAMPLE}
      downloadName="output.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Pretty">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
          {pretty && (
            <Field label="Indent">
              <Select value={indentSize} onValueChange={(v) => setIndentSize(v as '2' | '4')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      }
    />
  );
}
