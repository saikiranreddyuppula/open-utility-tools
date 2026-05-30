'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `<users>
  <user id="1">
    <name>Ada</name>
    <email>ada@example.com</email>
    <address>
      <city>London</city>
    </address>
  </user>
  <user id="2">
    <name>Alan</name>
    <email>alan@example.com</email>
    <address>
      <city>Manchester</city>
    </address>
  </user>
</users>`;

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function hasElementChild(el: Element): boolean {
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i]) return true;
  }
  return false;
}

/** Collect leaf values from a record element into a flat path->value map. */
function collectLeaves(
  el: Element,
  prefix: string,
  out: Array<{ path: string; value: string }>,
  includeAttrs: boolean
): void {
  if (includeAttrs) {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (!attr) continue;
      out.push({ path: prefix ? `${prefix}.@${attr.name}` : `@${attr.name}`, value: attr.value });
    }
  }
  if (!hasElementChild(el)) {
    // leaf element with text
    const text = (el.textContent ?? '').trim();
    if (prefix !== '') {
      out.push({ path: prefix, value: text });
    }
    return;
  }
  // Track repeated child tags to disambiguate with indices.
  const counts: { [tag: string]: number } = {};
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (!child) continue;
    const tag = child.tagName;
    const seen = counts[tag] ?? 0;
    counts[tag] = seen + 1;
  }
  const used: { [tag: string]: number } = {};
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (!child) continue;
    const tag = child.tagName;
    const total = counts[tag] ?? 1;
    let name = tag;
    if (total > 1) {
      const idx = used[tag] ?? 0;
      used[tag] = idx + 1;
      name = `${tag}[${idx}]`;
    }
    const childPrefix = prefix ? `${prefix}.${name}` : name;
    collectLeaves(child, childPrefix, out, includeAttrs);
  }
}

function csvEscape(field: string, delim: string): string {
  if (field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function XmlToCsvTool() {
  const [recordName, setRecordName] = useState('');
  const [includeAttrs, setIncludeAttrs] = useState(true);
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t' | '|'>(',');
  const [includeHeader, setIncludeHeader] = useState(true);

  return (
    <TextToolLayout
      deps={[recordName, includeAttrs, delimiter, includeHeader]}
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

        // Determine the repeating record element.
        let records: Element[] = [];
        const wanted = recordName.trim();
        if (wanted !== '') {
          records = Array.from(root.getElementsByTagName(wanted));
          if (records.length === 0 && root.tagName === wanted) records = [root];
          if (records.length === 0) {
            throw new Error(`No <${wanted}> elements found.`);
          }
        } else {
          // Default: direct element children of root. If root itself is the only record, use it.
          records = Array.from(root.children);
          if (records.length === 0) records = [root];
        }

        // Build per-record flattened maps and a first-seen union header.
        const rowMaps: Array<{ [path: string]: string }> = [];
        const header: string[] = [];
        const seen = new Set<string>();
        for (const rec of records) {
          const leaves: Array<{ path: string; value: string }> = [];
          collectLeaves(rec, '', leaves, includeAttrs);
          const map: { [path: string]: string } = {};
          for (const { path, value } of leaves) {
            // If a path repeats within one record, keep the first occurrence.
            if (!(path in map)) map[path] = value;
            if (!seen.has(path)) {
              seen.add(path);
              header.push(path);
            }
          }
          rowMaps.push(map);
        }

        if (header.length === 0) {
          throw new Error('No leaf values found in records. Try setting the record element name.');
        }

        const delim = delimiter;
        const lines: string[] = [];
        if (includeHeader) {
          lines.push(header.map((h) => csvEscape(h, delim)).join(delim));
        }
        for (const row of rowMaps) {
          lines.push(header.map((h) => csvEscape(row[h] ?? '', delim)).join(delim));
        }
        return lines.join('\r\n');
      }}
      inputLabel="XML"
      outputLabel="CSV"
      inputPlaceholder="Paste an XML document with repeating records…"
      sample={SAMPLE}
      downloadName="output.csv"
      downloadMime="text/csv"
      options={
        <>
          <Field label="Record element" hint="blank = root's children" className="w-44">
            <Input
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
              placeholder="e.g. user"
            />
          </Field>
          <Field label="Delimiter">
            <Select value={delimiter} onValueChange={(v) => setDelimiter(v as ',' | ';' | '\t' | '|')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma</SelectItem>
                <SelectItem value=";">Semicolon</SelectItem>
                <SelectItem value={'\t'}>Tab</SelectItem>
                <SelectItem value="|">Pipe</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Include attributes" hint="@name columns">
            <Switch checked={includeAttrs} onCheckedChange={setIncludeAttrs} />
          </Field>
          <Field label="Include header">
            <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
          </Field>
        </>
      }
    />
  );
}
