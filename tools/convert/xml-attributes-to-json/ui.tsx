'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `<library name="City">
  <book id="1" available="true">
    <title>The Pragmatic Programmer</title>
    <pages>352</pages>
  </book>
  <book id="2" available="false">
    <title>Clean Code</title>
    <pages>464</pages>
  </book>
</library>`;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Opts {
  attrPrefix: string;
  textKey: string;
  collapseTextOnly: boolean;
  coerce: boolean;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function coerceValue(s: string, coerce: boolean): Json {
  if (!coerce) return s;
  const t = s.trim();
  if (t === '') return s;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^[+-]?\d+$/.test(t)) {
    const n = parseInt(t, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

function elementToJson(el: Element, opts: Opts): Json {
  const obj: { [k: string]: Json } = {};

  // Attributes
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (!attr) continue;
    obj[`${opts.attrPrefix}${attr.name}`] = coerceValue(attr.value, opts.coerce);
  }

  // Child elements grouped by tag name.
  const childGroups: { [tag: string]: Json[] } = {};
  let textBuf = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (!node) continue;
    if (isElement(node)) {
      const tag = node.tagName;
      const value = elementToJson(node, opts);
      const group = childGroups[tag];
      if (group) group.push(value);
      else childGroups[tag] = [value];
    } else if (node.nodeType === 3) {
      textBuf += node.textContent ?? '';
    }
  }

  const childTags = Object.keys(childGroups);
  const text = textBuf.trim();

  // No child elements: this is a leaf.
  if (childTags.length === 0) {
    const hasAttrs = el.attributes.length > 0;
    if (!hasAttrs && opts.collapseTextOnly) {
      return coerceValue(text, opts.coerce);
    }
    if (text !== '') {
      obj[opts.textKey] = coerceValue(text, opts.coerce);
    }
    return obj;
  }

  // Has child elements.
  for (const tag of childTags) {
    const arr = childGroups[tag];
    if (!arr) continue;
    obj[tag] = arr.length === 1 ? (arr[0] ?? null) : arr;
  }
  if (text !== '') {
    obj[opts.textKey] = coerceValue(text, opts.coerce);
  }
  return obj;
}

export default function XmlAttributesToJsonTool() {
  const [attrPrefix, setAttrPrefix] = useState('@');
  const [textKey, setTextKey] = useState('#text');
  const [collapseTextOnly, setCollapseTextOnly] = useState(true);
  const [coerce, setCoerce] = useState(false);
  const [minify, setMinify] = useState(false);

  return (
    <TextToolLayout
      deps={[attrPrefix, textKey, collapseTextOnly, coerce, minify]}
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

        const opts: Opts = {
          attrPrefix,
          textKey: textKey || '#text',
          collapseTextOnly,
          coerce,
        };
        const result: Json = { [root.tagName]: elementToJson(root, opts) };
        return JSON.stringify(result, null, minify ? undefined : 2);
      }}
      inputLabel="XML"
      outputLabel="JSON"
      inputPlaceholder="Paste an XML document…"
      sample={SAMPLE}
      downloadName="output.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Attribute prefix" className="w-32">
            <Input value={attrPrefix} onChange={(e) => setAttrPrefix(e.target.value)} placeholder="@" />
          </Field>
          <Field label="Text key" className="w-40">
            <Input value={textKey} onChange={(e) => setTextKey(e.target.value)} placeholder="#text" />
          </Field>
          <Field label="Collapse text-only" hint="leaf → string">
            <Switch checked={collapseTextOnly} onCheckedChange={setCollapseTextOnly} />
          </Field>
          <Field label="Coerce types" hint="numbers/booleans">
            <Switch checked={coerce} onCheckedChange={setCoerce} />
          </Field>
          <Field label="Minify">
            <Switch checked={minify} onCheckedChange={setMinify} />
          </Field>
        </>
      }
    />
  );
}
