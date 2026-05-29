'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

interface Options {
  attrPrefix: string;
  textKey: string;
  coerce: boolean;
}

function coerceScalar(raw: string, coerce: boolean): JsonValue {
  if (!coerce) return raw;
  const t = raw.trim();
  if (t === '') return raw;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

function elementToJson(el: Element, opts: Options): JsonValue {
  const obj: { [k: string]: JsonValue } = {};

  // Attributes
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i);
    if (!attr) continue;
    obj[opts.attrPrefix + attr.name] = coerceScalar(attr.value, opts.coerce);
  }

  // Child nodes
  const childElements: Element[] = [];
  let textContent = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes.item(i);
    if (!node) continue;
    if (node.nodeType === 1) {
      childElements.push(node as Element);
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      textContent += node.nodeValue ?? '';
    }
  }

  const trimmedText = textContent.trim();

  // Leaf element with no attributes and no child elements -> scalar
  if (childElements.length === 0 && el.attributes.length === 0) {
    return trimmedText === '' ? '' : coerceScalar(trimmedText, opts.coerce);
  }

  // Has attributes but only text -> use textKey
  if (childElements.length === 0) {
    if (trimmedText !== '') obj[opts.textKey] = coerceScalar(trimmedText, opts.coerce);
    return obj;
  }

  // Group child elements by tag name
  for (const child of childElements) {
    const name = child.tagName;
    const value = elementToJson(child, opts);
    const existing = obj[name];
    if (existing === undefined) {
      obj[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      obj[name] = [existing, value];
    }
  }

  // Preserve mixed text content if meaningful
  if (trimmedText !== '') {
    obj[opts.textKey] = coerceScalar(trimmedText, opts.coerce);
  }

  return obj;
}

function xmlToJson(input: string, opts: Options): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    const msg = parseError.textContent?.replace(/\s+/g, ' ').trim() ?? 'Malformed XML.';
    throw new Error('Invalid XML: ' + msg);
  }
  const root = doc.documentElement;
  if (!root) throw new Error('No root element found in XML.');
  const result: { [k: string]: JsonValue } = { [root.tagName]: elementToJson(root, opts) };
  return JSON.stringify(result, null, 2);
}

export default function XmlToJsonTool() {
  const [coerce, setCoerce] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return xmlToJson(input, { attrPrefix: '@', textKey: '#text', coerce });
    },
    [coerce],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[coerce]}
      inputLabel="XML"
      outputLabel="JSON"
      inputPlaceholder="Paste XML…"
      sample={
        '<note id="1" priority="high">\n  <to>Alice</to>\n  <from>Bob</from>\n  <tags>\n    <tag>work</tag>\n    <tag>urgent</tag>\n  </tags>\n  <body>Meeting at 3pm</body>\n</note>'
      }
      downloadName="converted.json"
      downloadMime="application/json"
      options={
        <Field label="Values" hint="Attributes use @ prefix; text uses #text">
          <div className="flex items-center gap-2">
            <Switch id="coerce" checked={coerce} onCheckedChange={setCoerce} />
            <Label htmlFor="coerce">Coerce numbers & booleans</Label>
          </div>
        </Field>
      }
    />
  );
}
