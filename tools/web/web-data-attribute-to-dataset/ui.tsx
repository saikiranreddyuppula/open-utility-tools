'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'forward' | 'reverse';

const SAMPLE_FORWARD = `data-user-id
data-is-active
data-foo-bar-baz
<div data-product-sku="A1" data-in-stock="true"></div>`;

const SAMPLE_REVERSE = `userId
isActive
fooBarBaz
productSku`;

/**
 * Convert a data-* attribute name to its dataset property name per the WHATWG
 * rules: strip leading "data-", then every "-x" (lowercase ascii letter) becomes
 * uppercase "X". A dash NOT followed by a lowercase letter is preserved literally.
 */
function attrToDataset(attr: string): { prop: string; warn: string | null } {
  let name = attr.trim();
  if (name.toLowerCase().startsWith('data-')) name = name.slice(5);
  if (!name) return { prop: '', warn: 'Empty after stripping "data-".' };

  // The spec forbids an uppercase ASCII letter in the attribute name.
  let warn: string | null = null;
  if (/[A-Z]/.test(name)) {
    warn = 'Attribute names should be lowercase; uppercase letters are invalid in data-* names.';
  }

  let out = '';
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if (c === undefined) continue;
    if (c === '-') {
      const next = name[i + 1];
      if (next !== undefined && next >= 'a' && next <= 'z') {
        out += next.toUpperCase();
        i++;
      } else {
        out += '-';
      }
    } else {
      out += c;
    }
  }
  return { prop: out, warn };
}

/**
 * Convert a dataset property name back to a data-* attribute name: every
 * uppercase letter becomes "-" + its lowercase form. Per the spec a property
 * name may not contain a "-" immediately followed by a lowercase letter.
 */
function datasetToAttr(prop: string): { attr: string; warn: string | null } {
  const name = prop.trim();
  if (!name) return { attr: '', warn: 'Empty property name.' };

  let warn: string | null = null;
  if (/-[a-z]/.test(name)) {
    warn = 'A dataset property cannot contain "-" followed by a lowercase letter.';
  }

  let out = 'data-';
  for (const c of name) {
    if (c >= 'A' && c <= 'Z') out += `-${c.toLowerCase()}`;
    else out += c;
  }
  return { attr: out, warn };
}

/** Pull data-* attribute names out of an HTML snippet, plus bare lines. */
function collectAttrTokens(input: string): string[] {
  const tokens = new Set<string>();
  // From HTML: data-foo="..." or data-foo (bare).
  const attrRe = /\bdata-[a-z][\w-]*/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(input)) !== null) {
    tokens.add(m[0]);
  }
  // From plain lines that look like attribute names.
  for (const line of input.split(/\r?\n/)) {
    const t = line.trim();
    if (t && /^data-[\w-]+$/i.test(t)) tokens.add(t);
  }
  return [...tokens];
}

export default function DataAttributeToDataset() {
  const [mode, setMode] = useState<Mode>('forward');

  return (
    <TextToolLayout
      deps={[mode]}
      transform={(input) => {
        if (!input.trim()) return '';

        if (mode === 'forward') {
          // Gather tokens: HTML attrs if present, else each line.
          let tokens: string[];
          if (/[<>="]/.test(input)) {
            tokens = collectAttrTokens(input);
          } else {
            tokens = input
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
          }
          if (tokens.length === 0) {
            throw new Error('No data-* attributes found.');
          }
          const lines: string[] = [];
          for (const t of tokens) {
            const { prop, warn } = attrToDataset(t);
            if (!prop) {
              lines.push(`${t}  →  (invalid)${warn ? `  // ${warn}` : ''}`);
              continue;
            }
            const accessor = /^[A-Za-z_$][\w$]*$/.test(prop)
              ? `element.dataset.${prop}`
              : `element.dataset['${prop}']`;
            lines.push(`${t}  →  ${accessor}${warn ? `  // ${warn}` : ''}`);
          }
          return lines.join('\n');
        }

        // reverse
        const tokens = input
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (tokens.length === 0) {
          throw new Error('Enter dataset property names, one per line.');
        }
        const lines: string[] = [];
        for (const t of tokens) {
          const clean = t.replace(/^element\.dataset[.[]['"]?/, '').replace(/['"]?\]?$/, '');
          const { attr, warn } = datasetToAttr(clean);
          lines.push(`${clean}  →  ${attr}${warn ? `  // ${warn}` : ''}`);
        }
        return lines.join('\n');
      }}
      inputLabel={mode === 'forward' ? 'data-* attributes or HTML' : 'dataset property names'}
      outputLabel={mode === 'forward' ? 'dataset accessors' : 'data-* attributes'}
      inputPlaceholder={mode === 'forward' ? SAMPLE_FORWARD : SAMPLE_REVERSE}
      sample={mode === 'forward' ? SAMPLE_FORWARD : SAMPLE_REVERSE}
      downloadName="dataset-conversion.txt"
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="forward">data-* → dataset</TabsTrigger>
              <TabsTrigger value="reverse">dataset → data-*</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
