'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
  <path d="M5 12h14" stroke-linecap="round"/>
  <!-- arrow head -->
  <path d="M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Attributes that map to a different JSX name entirely.
const RENAME: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  'xlink:href': 'xlinkHref',
  'xml:lang': 'xmlLang',
  'xml:space': 'xmlSpace',
  tabindex: 'tabIndex',
  crossorigin: 'crossOrigin',
};

// Attributes that should stay lowercase / unchanged (no camelCase).
const KEEP_AS_IS = new Set(['viewBox', 'preserveAspectRatio']);

function toCamel(name: string): string {
  if (RENAME[name]) return RENAME[name];
  if (KEEP_AS_IS.has(name)) return name;
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  // hyphenated -> camelCase (stroke-width -> strokeWidth)
  if (name.includes('-')) {
    return name
      .split('-')
      .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
      .join('');
  }
  // colon namespaced (e.g. unknown ns) -> camel
  if (name.includes(':')) {
    const parts = name.split(':');
    const head = parts[0] ?? '';
    const tail = parts.slice(1).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    return head + tail;
  }
  return name;
}

/** Convert an inline `style="a: b; c: d"` string into a JSX style object literal. */
function styleToObject(style: string): string {
  const decls = style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d !== '');
  const entries: string[] = [];
  for (const decl of decls) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop) continue;
    const jsKey = prop.startsWith('--')
      ? `'${prop}'`
      : prop
          .split('-')
          .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
          .join('');
    entries.push(`${jsKey}: ${JSON.stringify(value)}`);
  }
  return `{{ ${entries.join(', ')} }}`;
}

/** Transform a single tag's attributes. Returns the rewritten attribute text. */
function transformAttrs(attrText: string): string {
  const out: string[] = [];
  // match name="value" | name='value' | name (boolean)
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrText)) !== null) {
    const rawName = m[1];
    if (!rawName) continue;
    const dq = m[2];
    const sq = m[3];
    const hasValue = dq !== undefined || sq !== undefined;
    const value = dq ?? sq ?? '';
    const name = toCamel(rawName);
    if (!hasValue) {
      out.push(`${name}={true}`);
      continue;
    }
    if (name === 'style') {
      out.push(`style=${styleToObject(value)}`);
      continue;
    }
    out.push(`${name}=${JSON.stringify(value)}`);
  }
  return out.join(' ');
}

function jsxify(svg: string): string {
  // strip XML/HTML comments and doctype/prolog
  let s = svg.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\?xml[\s\S]*?\?>/g, '');
  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // rewrite tags
  s = s.replace(/<\s*([a-zA-Z][\w:-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g, (_full, tag: string, attrs: string, selfClose: string) => {
    const newAttrs = transformAttrs(attrs);
    const attrPart = newAttrs ? ' ' + newAttrs : '';
    // self-close void/empty-content tags
    const close = selfClose === '/' ? ' />' : '>';
    return `<${tag}${attrPart}${close}`;
  });

  return s.trim();
}

/** Indent a block of JSX by `n` spaces on each non-empty line. */
function indent(block: string, n: number): string {
  const pad = ' '.repeat(n);
  return block
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

export default function SvgToJsxTool() {
  const [name, setName] = useState('MyIcon');
  const [typescript, setTypescript] = useState(true);
  const [spreadProps, setSpreadProps] = useState(true);

  return (
    <TextToolLayout
      deps={[name, typescript, spreadProps]}
      transform={(input) => {
        const trimmed = input.trim();
        if (!trimmed) return '';
        if (!/<svg[\s>]/i.test(trimmed)) throw new Error('Input does not contain an <svg> element.');

        let jsx = jsxify(trimmed);

        // inject {...props} on the root <svg ...> if requested
        if (spreadProps) {
          jsx = jsx.replace(/<svg\b([^>]*?)(\s*\/?>)/i, (_m, attrs: string, end: string) => {
            const sp = attrs.trimEnd();
            return `<svg${sp} {...props}${end}`;
          });
        }

        const compName = (name.trim() || 'MyIcon').replace(/[^A-Za-z0-9_]/g, '');
        const importLine = typescript && spreadProps ? "import type { SVGProps } from 'react';\n\n" : '';

        let paramList = '';
        if (spreadProps) paramList = typescript ? 'props: SVGProps<SVGSVGElement>' : 'props';

        const body = indent(jsx, 4);
        return (
          importLine +
          `export function ${compName}(${paramList}) {\n` +
          `  return (\n${body}\n  );\n}\n`
        );
      }}
      inputLabel="SVG"
      outputLabel={typescript ? 'TSX Component' : 'JSX Component'}
      sample={SAMPLE}
      downloadName="Icon.tsx"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Component name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-44" />
          </Field>
          <Field label="TypeScript">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={typescript} onCheckedChange={setTypescript} />
              {typescript ? 'TSX' : 'JSX'}
            </label>
          </Field>
          <Field label="Spread props">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={spreadProps} onCheckedChange={setSpreadProps} />
              {spreadProps ? '{...props}' : 'None'}
            </label>
          </Field>
        </>
      }
    />
  );
}
