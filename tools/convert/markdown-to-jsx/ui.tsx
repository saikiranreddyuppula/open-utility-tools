'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `# Welcome

This is **bold**, this is *italic*, and \`inline code\`.

- First item
- Second item
- Third item

> A blockquote line.

[Visit](https://example.com)

\`\`\`js
const x = 1;
\`\`\`

---

End.`;

type Wrap = 'fragment' | 'div';

/** Escape characters that are special in JSX text/attribute contexts. */
function escapeJsxText(s: string, escapeBraces: boolean): string {
  let out = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (escapeBraces) {
    out = out.replace(/\{/g, '{"{"}').replace(/\}/g, '{"}"}');
  }
  return out;
}

/** Inline markdown -> JSX: code, bold, italic, links, images. */
function inline(text: string, escapeBraces: boolean): string {
  const tokens: string[] = [];
  let i = 0;
  const n = text.length;
  let buf = '';
  const flush = () => {
    if (buf) {
      tokens.push(escapeJsxText(buf, escapeBraces));
      buf = '';
    }
  };
  while (i < n) {
    const c = text[i] ?? '';
    // inline code
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        const code = text.slice(i + 1, end);
        tokens.push(`<code>${escapeJsxText(code, escapeBraces)}</code>`);
        i = end + 1;
        continue;
      }
    }
    // image ![alt](src)
    if (c === '!' && text[i + 1] === '[') {
      const close = text.indexOf(']', i + 2);
      if (close !== -1 && text[close + 1] === '(') {
        const paren = text.indexOf(')', close + 2);
        if (paren !== -1) {
          flush();
          const alt = text.slice(i + 2, close);
          const src = text.slice(close + 2, paren).trim();
          tokens.push(`<img src="${escapeJsxText(src, false)}" alt="${escapeJsxText(alt, false)}" />`);
          i = paren + 1;
          continue;
        }
      }
    }
    // link [text](href)
    if (c === '[') {
      const close = text.indexOf(']', i + 1);
      if (close !== -1 && text[close + 1] === '(') {
        const paren = text.indexOf(')', close + 2);
        if (paren !== -1) {
          flush();
          const label = text.slice(i + 1, close);
          const href = text.slice(close + 2, paren).trim();
          tokens.push(`<a href="${escapeJsxText(href, false)}">${inline(label, escapeBraces)}</a>`);
          i = paren + 1;
          continue;
        }
      }
    }
    // bold ** or __
    if ((c === '*' && text[i + 1] === '*') || (c === '_' && text[i + 1] === '_')) {
      const marker = c + c;
      const end = text.indexOf(marker, i + 2);
      if (end !== -1) {
        flush();
        const inner = text.slice(i + 2, end);
        tokens.push(`<strong>${inline(inner, escapeBraces)}</strong>`);
        i = end + 2;
        continue;
      }
    }
    // italic * or _
    if (c === '*' || c === '_') {
      const end = text.indexOf(c, i + 1);
      if (end !== -1 && end !== i + 1) {
        flush();
        const inner = text.slice(i + 1, end);
        tokens.push(`<em>${inline(inner, escapeBraces)}</em>`);
        i = end + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return tokens.join('');
}

interface Block {
  html: string;
}

function parseBlocks(input: string, escapeBraces: boolean): Block[] {
  const lines = input.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // fenced code
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < n && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // closing fence
      const langAttr = lang ? ` className="language-${lang}"` : '';
      // Emit raw code as a JS string literal so JSX braces/quotes are preserved.
      blocks.push({
        html: `<pre><code${langAttr}>{${JSON.stringify(codeLines.join('\n'))}}</code></pre>`,
      });
      continue;
    }

    // horizontal rule
    if (/^(\*\s*){3,}$/.test(trimmed) || /^(-\s*){3,}$/.test(trimmed) || /^(_\s*){3,}$/.test(trimmed)) {
      blocks.push({ html: '<hr />' });
      i++;
      continue;
    }

    // heading
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = (h[1] ?? '#').length;
      const content = inline((h[2] ?? '').trim(), escapeBraces);
      blocks.push({ html: `<h${level}>${content}</h${level}>` });
      i++;
      continue;
    }

    // blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < n && (lines[i] ?? '').trim().startsWith('>')) {
        quoteLines.push((lines[i] ?? '').trim().replace(/^>\s?/, ''));
        i++;
      }
      const content = inline(quoteLines.join(' '), escapeBraces);
      blocks.push({ html: `<blockquote><p>${content}</p></blockquote>` });
      continue;
    }

    // lists
    const isUl = /^[-*+]\s+/.test(trimmed);
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    if (isUl || isOl) {
      const items: string[] = [];
      while (i < n) {
        const t = (lines[i] ?? '').trim();
        const ulM = t.match(/^[-*+]\s+(.*)$/);
        const olM = t.match(/^\d+[.)]\s+(.*)$/);
        if (isUl && ulM) {
          items.push(inline((ulM[1] ?? '').trim(), escapeBraces));
          i++;
        } else if (isOl && olM) {
          items.push(inline((olM[1] ?? '').trim(), escapeBraces));
          i++;
        } else {
          break;
        }
      }
      const tag = isOl ? 'ol' : 'ul';
      const lis = items.map((it) => `  <li>${it}</li>`).join('\n');
      blocks.push({ html: `<${tag}>\n${lis}\n</${tag}>` });
      continue;
    }

    // paragraph (gather consecutive non-blank, non-special lines)
    const paraLines: string[] = [];
    while (i < n) {
      const t = (lines[i] ?? '').trim();
      if (
        t === '' ||
        t.startsWith('#') ||
        t.startsWith('>') ||
        t.startsWith('```') ||
        /^[-*+]\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t) ||
        /^(\*\s*){3,}$/.test(t) ||
        /^(-\s*){3,}$/.test(t) ||
        /^(_\s*){3,}$/.test(t)
      ) {
        break;
      }
      paraLines.push(t);
      i++;
    }
    const content = inline(paraLines.join(' '), escapeBraces);
    blocks.push({ html: `<p>${content}</p>` });
  }
  return blocks;
}

function indentLines(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

function isValidComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function buildComponent(
  input: string,
  componentName: string,
  wrap: Wrap,
  indentSize: number,
  escapeBraces: boolean
): string {
  if (!isValidComponentName(componentName)) {
    throw new Error('Component name must start with an uppercase letter (e.g. MyComponent).');
  }
  const blocks = parseBlocks(input, escapeBraces);
  const unit = ' '.repeat(indentSize);
  const open = wrap === 'div' ? '<div>' : '<>';
  const close = wrap === 'div' ? '</div>' : '</>';
  // body indented two levels (return + wrapper) -> 3 units for content
  const body = blocks.map((b) => indentLines(b.html, unit.repeat(3))).join('\n');
  return [
    `export default function ${componentName}() {`,
    `${unit}return (`,
    `${unit.repeat(2)}${open}`,
    body,
    `${unit.repeat(2)}${close}`,
    `${unit});`,
    `}`,
  ].join('\n');
}

export default function MarkdownToJsxTool() {
  const [componentName, setComponentName] = useState('MarkdownContent');
  const [wrap, setWrap] = useState<Wrap>('fragment');
  const [indentSize, setIndentSize] = useState('2');
  const [escapeBraces, setEscapeBraces] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const n = Number(indentSize);
      const size = Number.isFinite(n) && n > 0 ? n : 2;
      return buildComponent(input, componentName.trim(), wrap, size, escapeBraces);
    },
    [componentName, wrap, indentSize, escapeBraces]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[componentName, wrap, indentSize, escapeBraces]}
      inputLabel="Markdown"
      outputLabel="JSX component"
      inputPlaceholder="# Title&#10;&#10;Some **markdown**."
      sample={SAMPLE}
      downloadName="component.tsx"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Component name">
            <Input
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              className="w-44"
              placeholder="MyComponent"
            />
          </Field>
          <Field label="Wrapper">
            <Tabs value={wrap} onValueChange={(v) => setWrap(v as Wrap)}>
              <TabsList>
                <TabsTrigger value="fragment">{`<>`}</TabsTrigger>
                <TabsTrigger value="div">{`<div>`}</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Indent">
            <Select value={indentSize} onValueChange={setIndentSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Escape braces">
            <div className="flex h-8 items-center gap-2">
              <Switch id="braces" checked={escapeBraces} onCheckedChange={setEscapeBraces} />
              <Label htmlFor="braces" className="text-xs text-muted-foreground">
                {`{ } in text`}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
