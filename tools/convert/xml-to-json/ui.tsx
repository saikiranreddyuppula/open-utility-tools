'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Options {
  attrPrefix: string;
  textKey: string;
  arrayMode: boolean;
  coerce: boolean;
  trim: boolean;
}

function coerceScalar(raw: string, enabled: boolean): Json {
  if (!enabled) return raw;
  const v = raw.trim();
  if (v === '') return raw;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) {
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

function walk(el: Element, opts: Options): Json {
  const obj: { [k: string]: Json } = {};

  // Attributes.
  for (const attr of Array.from(el.attributes)) {
    obj[`${opts.attrPrefix}${attr.name}`] = coerceScalar(attr.value, opts.coerce);
  }

  // Child element grouping.
  const childElements = Array.from(el.children);

  // Gather text content from direct text nodes only.
  let textContent = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* TEXT */ || node.nodeType === 4 /* CDATA */) {
      textContent += node.nodeValue ?? '';
    }
  }
  if (opts.trim) textContent = textContent.trim();

  // Leaf element: no attributes, no child elements -> scalar.
  if (childElements.length === 0 && el.attributes.length === 0) {
    return coerceScalar(textContent, opts.coerce);
  }

  // Element with attributes but no children -> put text under textKey.
  if (childElements.length === 0) {
    if (textContent !== '') obj[opts.textKey] = coerceScalar(textContent, opts.coerce);
    return obj;
  }

  // Recurse into children, grouping repeats into arrays.
  for (const child of childElements) {
    const name = child.tagName;
    const value = walk(child, opts);
    const existing = obj[name];
    if (existing === undefined) {
      obj[name] = opts.arrayMode ? [value] : value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      obj[name] = [existing, value];
    }
  }

  // Mixed content: attach significant text alongside children.
  if (textContent !== '') {
    obj[opts.textKey] = coerceScalar(textContent, opts.coerce);
  }

  return obj;
}

function xmlToJson(input: string, opts: Options): { [k: string]: Json } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    const msg = parseError.textContent?.replace(/\s+/g, ' ').trim() ?? 'Malformed XML';
    throw new Error(msg);
  }

  const root = doc.documentElement;
  if (!root) throw new Error('No root element found in the XML.');

  return { [root.tagName]: walk(root, opts) };
}

export default function XmlToJsonTool() {
  const [indent, setIndent] = useState<'2' | '4' | 'tab' | 'min'>('2');
  const [attrPrefix, setAttrPrefix] = useState('@');
  const [textKey, setTextKey] = useState('#text');
  const [arrayMode, setArrayMode] = useState(false);
  const [coerce, setCoerce] = useState(true);
  const [trim, setTrim] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const opts: Options = {
        attrPrefix,
        textKey: textKey || '#text',
        arrayMode,
        coerce,
        trim,
      };
      let data: { [k: string]: Json };
      try {
        data = xmlToJson(input, opts);
      } catch (err) {
        throw new Error(`XML parse error: ${(err as Error).message}`);
      }
      if (indent === 'min') return JSON.stringify(data);
      const indentValue = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(data, null, indentValue);
    },
    [indent, attrPrefix, textKey, arrayMode, coerce, trim],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent, attrPrefix, textKey, arrayMode, coerce, trim]}
      inputLabel="XML"
      outputLabel="JSON"
      inputPlaceholder={'<note id="1">\n  <to>Tove</to>\n  <from>Jani</from>\n</note>'}
      sample={
        '<library>\n  <book id="1" available="true">\n    <title>The Go Programming Language</title>\n    <pages>380</pages>\n  </book>\n  <book id="2" available="false">\n    <title>Clean Code</title>\n    <pages>464</pages>\n  </book>\n</library>'
      }
      downloadName="data.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Output">
            <Tabs
              value={indent}
              onValueChange={(v) => setIndent(v as '2' | '4' | 'tab' | 'min')}
            >
              <TabsList>
                <TabsTrigger value="2">2 spaces</TabsTrigger>
                <TabsTrigger value="4">4 spaces</TabsTrigger>
                <TabsTrigger value="tab">Tab</TabsTrigger>
                <TabsTrigger value="min">Minify</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Attribute prefix" className="w-28">
            <Input
              value={attrPrefix}
              onChange={(e) => setAttrPrefix(e.target.value)}
              placeholder="@"
            />
          </Field>
          <Field label="Text node key" className="w-32">
            <Input
              value={textKey}
              onChange={(e) => setTextKey(e.target.value)}
              placeholder="#text"
            />
          </Field>
          <Field label="Always arrays" hint="Wrap every element">
            <div className="flex h-9 items-center">
              <Switch checked={arrayMode} onCheckedChange={setArrayMode} />
            </div>
          </Field>
          <Field label="Coerce types" hint="Numbers / booleans">
            <div className="flex h-9 items-center">
              <Switch checked={coerce} onCheckedChange={setCoerce} />
            </div>
          </Field>
          <Field label="Trim whitespace">
            <div className="flex h-9 items-center">
              <Switch checked={trim} onCheckedChange={setTrim} />
            </div>
          </Field>
        </>
      }
    />
  );
}
