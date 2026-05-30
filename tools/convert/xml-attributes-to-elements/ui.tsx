'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `<book id="bk101" lang="en">
  <title>XML Developer's Guide</title>
  <author>Gambardella, Matthew</author>
  <price>44.95</price>
</book>`;

type Direction = 'attrs2elems' | 'elems2attrs';

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function hasElementChild(el: Element): boolean {
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c && isElement(c)) return true;
  }
  return false;
}

/** Text content of an element if it has only text/whitespace (no element children). */
function textOnly(el: Element): string | null {
  if (hasElementChild(el)) return null;
  return el.textContent ?? '';
}

function attrsToElems(el: Element, doc: Document, skipMixed: boolean): void {
  // Recurse first into element children.
  const children = Array.from(el.children);
  for (const child of children) attrsToElems(child, doc, skipMixed);

  if (skipMixed && hasMixedContent(el)) return;

  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    const newEl = doc.createElement(attr.name);
    newEl.textContent = attr.value;
    el.appendChild(newEl);
    el.removeAttribute(attr.name);
  }
}

function hasMixedContent(el: Element): boolean {
  let hasElem = false;
  let hasText = false;
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (!c) continue;
    if (isElement(c)) hasElem = true;
    else if (c.nodeType === 3 && (c.textContent ?? '').trim() !== '') hasText = true;
  }
  return hasElem && hasText;
}

function elemsToAttrs(el: Element, skipMixed: boolean): void {
  // Recurse into children first.
  const children = Array.from(el.children);
  for (const child of children) elemsToAttrs(child, skipMixed);

  if (skipMixed && hasMixedContent(el)) return;

  for (const child of Array.from(el.children)) {
    // Only demote children that are leaf, attribute-free, text-only, and won't collide.
    if (child.attributes.length > 0) continue;
    if (hasElementChild(child)) continue;
    const name = child.tagName;
    if (el.hasAttribute(name)) continue;
    const text = textOnly(child) ?? '';
    el.setAttribute(name, text);
    el.removeChild(child);
  }
}

function serializePretty(node: Node, indent: number, level: number): string {
  const pad = ' '.repeat(indent * level);
  if (node.nodeType === 3) {
    const t = (node.textContent ?? '').trim();
    return t === '' ? '' : pad + escapeText(t) + '\n';
  }
  if (node.nodeType === 8) {
    return `${pad}<!--${node.textContent ?? ''}-->\n`;
  }
  if (!isElement(node)) return '';

  const el = node;
  const attrStr = Array.from(el.attributes)
    .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join('');

  const elemChildren = Array.from(el.childNodes).filter(
    (c) => isElement(c) || (c.nodeType === 3 && (c.textContent ?? '').trim() !== '') || c.nodeType === 8
  );

  if (elemChildren.length === 0) {
    return `${pad}<${el.tagName}${attrStr}/>\n`;
  }

  // Single text child: keep on one line.
  if (elemChildren.length === 1 && elemChildren[0] && elemChildren[0].nodeType === 3) {
    const txt = escapeText((elemChildren[0].textContent ?? '').trim());
    return `${pad}<${el.tagName}${attrStr}>${txt}</${el.tagName}>\n`;
  }

  let out = `${pad}<${el.tagName}${attrStr}>\n`;
  for (const child of elemChildren) {
    out += serializePretty(child, indent, level + 1);
  }
  out += `${pad}</${el.tagName}>\n`;
  return out;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export default function XmlAttributesToElementsTool() {
  const [direction, setDirection] = useState<Direction>('attrs2elems');
  const [indent, setIndent] = useState(2);
  const [skipMixed, setSkipMixed] = useState(true);

  return (
    <TextToolLayout
      deps={[direction, indent, skipMixed]}
      transform={(input) => {
        if (!input.trim()) return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(input, 'application/xml');
        const errNode = doc.querySelector('parsererror');
        if (errNode) {
          throw new Error('Invalid XML: ' + (errNode.textContent ?? 'parse error'));
        }
        const root = doc.documentElement;
        if (!root) throw new Error('No root element found.');

        if (direction === 'attrs2elems') {
          attrsToElems(root, doc, skipMixed);
        } else {
          elemsToAttrs(root, skipMixed);
        }

        return serializePretty(root, indent, 0).trimEnd();
      }}
      inputLabel="XML"
      outputLabel="Rewritten XML"
      inputPlaceholder="Paste an XML document…"
      sample={SAMPLE}
      downloadName="output.xml"
      downloadMime="application/xml"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="attrs2elems">Attributes → Elements</TabsTrigger>
                <TabsTrigger value="elems2attrs">Elements → Attributes</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`Indent: ${indent}`} hint="Spaces" className="min-w-[9rem]">
            <Slider
              min={0}
              max={8}
              step={1}
              value={[indent]}
              onValueChange={(v) => setIndent(v[0] ?? 2)}
            />
          </Field>
          <Field label="Skip mixed content" hint="text + elements">
            <Switch checked={skipMixed} onCheckedChange={setSkipMixed} />
          </Field>
        </>
      }
    />
  );
}
