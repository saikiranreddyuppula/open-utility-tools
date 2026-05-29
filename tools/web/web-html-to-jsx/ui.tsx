'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

// HTML attribute name -> JSX attribute name for names that are NOT a simple
// camelCase of the hyphenated original.
const ATTR_RENAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  enctype: 'encType',
  novalidate: 'noValidate',
  formaction: 'formAction',
  formnovalidate: 'formNoValidate',
  accesskey: 'accessKey',
  spellcheck: 'spellCheck',
  srcset: 'srcSet',
  usemap: 'useMap',
  datetime: 'dateTime',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  nomodule: 'noModule',
  playsinline: 'playsInline',
  charset: 'charSet',
  classid: 'classID',
  'http-equiv': 'httpEquiv',
};

// HTML boolean attributes that render as plain JSX boolean props when present.
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'selected',
  'readonly',
  'required',
  'multiple',
  'autofocus',
  'autoplay',
  'controls',
  'loop',
  'muted',
  'open',
  'hidden',
  'default',
  'novalidate',
  'formnovalidate',
  'reversed',
  'async',
  'defer',
  'nomodule',
  'playsinline',
  'itemscope',
]);

// Void / self-closing HTML elements.
const VOID_ELEMENTS = new Set([
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

function camelCaseDataAttr(name: string): string {
  // data-* and aria-* keep their hyphenated form in JSX.
  return name;
}

function renameAttr(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('data-') || lower.startsWith('aria-')) {
    return camelCaseDataAttr(lower);
  }
  const mapped = ATTR_RENAMES[lower];
  if (mapped) return mapped;
  if (lower.includes('-')) {
    // generic hyphenated -> camelCase (e.g. accept-charset -> acceptCharset)
    return lower.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  }
  return lower;
}

function cssPropToCamel(prop: string): string {
  const trimmed = prop.trim();
  if (trimmed.startsWith('--')) return trimmed; // CSS custom property stays as-is
  if (trimmed.startsWith('-ms-')) {
    return 'ms' + trimmed.slice(4).replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  }
  return trimmed
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

function styleToObject(style: string): string {
  const entries: string[] = [];
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const rawProp = decl.slice(0, idx).trim();
    const rawVal = decl.slice(idx + 1).trim();
    if (!rawProp || !rawVal) continue;
    const key = cssPropToCamel(rawProp);
    const needsQuotesKey = key.startsWith('--') || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
    const safeVal = rawVal.replace(/'/g, "\\'");
    const keyOut = needsQuotesKey ? `'${key}'` : key;
    entries.push(`${keyOut}: '${safeVal}'`);
  }
  if (entries.length === 0) return '{{}}';
  return `{{ ${entries.join(', ')} }}`;
}

function escapeJsxText(text: string): string {
  return text
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;');
}

function indentOf(depth: number): string {
  return '  '.repeat(depth);
}

function emitAttributes(el: Element): string {
  const parts: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    const value = attr.value;
    const lower = name.toLowerCase();
    if (lower === 'style') {
      parts.push(`style=${styleToObject(value)}`);
      continue;
    }
    const jsxName = renameAttr(name);
    if (BOOLEAN_ATTRS.has(lower) && (value === '' || value.toLowerCase() === lower)) {
      // present boolean attribute -> bare prop
      parts.push(jsxName);
      continue;
    }
    const safe = value.replace(/"/g, '&quot;');
    parts.push(`${jsxName}="${safe}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

function emitNode(node: Node, depth: number): string {
  // Text node
  if (node.nodeType === 3) {
    const raw = node.textContent ?? '';
    const trimmed = raw.replace(/\s+/g, ' ');
    if (trimmed.trim() === '') return '';
    return indentOf(depth) + escapeJsxText(trimmed.trim()) + '\n';
  }
  // Comment node
  if (node.nodeType === 8) {
    const text = (node.textContent ?? '').trim();
    if (!text) return '';
    return indentOf(depth) + `{/* ${text.replace(/\*\//g, '* /')} */}\n`;
  }
  // Element node
  if (node.nodeType === 1) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const attrs = emitAttributes(el);
    const children = Array.from(el.childNodes);
    const childOut = children.map((c) => emitNode(c, depth + 1)).join('');
    if (VOID_ELEMENTS.has(tag) || childOut.trim() === '') {
      if (childOut.trim() === '' && !VOID_ELEMENTS.has(tag)) {
        return indentOf(depth) + `<${tag}${attrs} />\n`;
      }
      return indentOf(depth) + `<${tag}${attrs} />\n`;
    }
    return (
      indentOf(depth) +
      `<${tag}${attrs}>\n` +
      childOut +
      indentOf(depth) +
      `</${tag}>\n`
    );
  }
  return '';
}

export default function HtmlToJsxTool() {
  const [wrap, setWrap] = useState<'fragment' | 'none'>('fragment');

  const transform = useCallback(
    (input: string) => {
      const src = input.trim();
      if (!src) return '';
      if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        throw new Error('DOMParser is not available in this environment.');
      }
      const doc = new DOMParser().parseFromString(src, 'text/html');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Could not parse the provided HTML.');
      }
      const body = doc.body;
      const nodes = Array.from(body.childNodes);
      if (nodes.length === 0) return '';

      const baseDepth = wrap === 'fragment' ? 1 : 0;
      const rendered = nodes.map((n) => emitNode(n, baseDepth)).join('');
      if (rendered.trim() === '') return '';

      if (wrap === 'fragment') {
        return `<>\n${rendered}</>`;
      }
      return rendered.replace(/\n$/, '');
    },
    [wrap],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[wrap]}
      inputLabel="HTML"
      outputLabel="JSX"
      inputPlaceholder='<div class="card" style="margin-top: 10px; background-color: #fff;"><label for="n">Name</label><input type="text" disabled></div>'
      sample={
        '<div class="card" style="margin-top: 10px; padding: 1rem;">\n' +
        '  <label for="name">Name</label>\n' +
        '  <input type="text" maxlength="20" required>\n' +
        '  <br>\n' +
        '  <!-- a comment -->\n' +
        '</div>'
      }
      downloadName="component.jsx"
      options={
        <Field label="Wrapper" hint="Wrap output in a JSX fragment for multiple roots.">
          <Tabs value={wrap} onValueChange={(v) => setWrap(v as 'fragment' | 'none')}>
            <TabsList>
              <TabsTrigger value="fragment">Fragment</TabsTrigger>
              <TabsTrigger value="none">None</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
