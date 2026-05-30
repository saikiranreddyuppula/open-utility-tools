'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `<div id="app" class="container main">
  <h1 class="title">Hello</h1>
  <!-- nav -->
  <ul>
    <li><a href="/home" data-id="1">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
  <input type="text" placeholder="Search" disabled>
</div>`;

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

function escapeAttrValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteClass(token: string): boolean {
  // class/id tokens usable as shorthand must be CSS-ident-ish
  return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(token);
}

interface Opts {
  unit: string;
  shorthand: boolean;
  inlineText: boolean;
}

function buildAttrs(el: Element, opts: Opts): { selector: string; attrs: string } {
  const tag = el.tagName.toLowerCase();
  let idPart = '';
  const classParts: string[] = [];
  const otherAttrs: string[] = [];

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    const value = attr.value;
    if (opts.shorthand && name === 'id' && value && quoteClass(value)) {
      idPart = `#${value}`;
      continue;
    }
    if (opts.shorthand && name === 'class' && value.trim()) {
      const tokens = value.trim().split(/\s+/);
      let allOk = true;
      for (const t of tokens) {
        if (!quoteClass(t)) {
          allOk = false;
          break;
        }
      }
      if (allOk) {
        for (const t of tokens) classParts.push(`.${t}`);
        continue;
      }
    }
    if (value === '') {
      otherAttrs.push(name);
    } else {
      otherAttrs.push(`${name}="${escapeAttrValue(value)}"`);
    }
  }

  // tag name: omit "div" if there is an id/class shorthand
  let selector = tag;
  if (opts.shorthand && tag === 'div' && (idPart || classParts.length > 0)) {
    selector = '';
  }
  selector += idPart + classParts.join('');
  if (selector === '') selector = tag;

  const attrs = otherAttrs.length > 0 ? `(${otherAttrs.join(', ')})` : '';
  return { selector, attrs };
}

function emitNode(node: Node, depth: number, opts: Opts, out: string[]): void {
  const indent = opts.unit.repeat(depth);

  if (node.nodeType === 3) {
    // text node
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) out.push(`${indent}| ${text}`);
    return;
  }
  if (node.nodeType === 8) {
    // comment
    const text = (node.textContent ?? '').trim();
    out.push(`${indent}// ${text}`);
    return;
  }
  if (node.nodeType !== 1) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const { selector, attrs } = buildAttrs(el, opts);

  const childNodes = Array.from(el.childNodes).filter((c) => {
    if (c.nodeType === 3) return (c.textContent ?? '').trim() !== '';
    return c.nodeType === 1 || c.nodeType === 8;
  });

  // <script>/<style> raw content
  if (tag === 'script' || tag === 'style') {
    const raw = el.textContent ?? '';
    if (raw.trim()) {
      out.push(`${indent}${selector}${attrs}.`);
      for (const line of raw.replace(/\r/g, '').split('\n')) {
        out.push(`${indent}${opts.unit}${line}`);
      }
    } else {
      out.push(`${indent}${selector}${attrs}`);
    }
    return;
  }

  if (VOID_TAGS.has(tag) || childNodes.length === 0) {
    out.push(`${indent}${selector}${attrs}`);
    return;
  }

  // single text child -> inline
  const onlyChild = childNodes.length === 1 ? childNodes[0] : undefined;
  if (opts.inlineText && onlyChild && onlyChild.nodeType === 3) {
    const text = (onlyChild.textContent ?? '').replace(/\s+/g, ' ').trim();
    out.push(`${indent}${selector}${attrs} ${text}`);
    return;
  }

  out.push(`${indent}${selector}${attrs}`);
  for (const child of childNodes) {
    emitNode(child, depth + 1, opts, out);
  }
}

export default function HtmlToPugTool() {
  const [indentSize, setIndentSize] = useState('2');
  const [shorthand, setShorthand] = useState(true);
  const [inlineText, setInlineText] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const size = Math.min(8, Math.max(1, Number(indentSize) || 2));
      const opts: Opts = { unit: ' '.repeat(size), shorthand, inlineText };
      const doc = new DOMParser().parseFromString(input, 'text/html');

      // Decide root set: if input looks like a full document use <html>, else body children.
      const looksFullDoc = /<html[\s>]/i.test(input) || /<!doctype/i.test(input);
      const out: string[] = [];
      if (looksFullDoc && doc.documentElement) {
        emitNode(doc.documentElement, 0, opts, out);
      } else {
        const body = doc.body;
        const roots = body ? Array.from(body.childNodes) : [];
        for (const r of roots) {
          if (r.nodeType === 3 && (r.textContent ?? '').trim() === '') continue;
          emitNode(r, 0, opts, out);
        }
      }
      const result = out.join('\n');
      if (!result.trim()) throw new Error('No HTML elements found to convert.');
      return result + '\n';
    },
    [indentSize, shorthand, inlineText]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indentSize, shorthand, inlineText]}
      inputLabel="HTML"
      outputLabel="Pug"
      sample={SAMPLE}
      downloadName="template.pug"
      options={
        <>
          <Field label="Indent">
            <Select value={indentSize} onValueChange={setIndentSize}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="id/class shorthand">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={shorthand} onCheckedChange={setShorthand} id="h2p-sh" />
              <Label htmlFor="h2p-sh" className="text-xs text-muted-foreground">
                {shorthand ? '#id .class' : 'attributes'}
              </Label>
            </div>
          </Field>
          <Field label="Inline single text">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={inlineText} onCheckedChange={setInlineText} id="h2p-inline" />
              <Label htmlFor="h2p-inline" className="text-xs text-muted-foreground">
                {inlineText ? 'h1 Hello' : 'piped lines'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
