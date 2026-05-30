'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'minify' | 'beautify';
type IndentKind = '2' | '4' | 'tab';

const SAMPLE =
  '<!DOCTYPE html>\n' +
  '<!-- page comment -->\n' +
  '<html>\n' +
  '  <head>\n' +
  '    <title>  Hello  </title>\n' +
  '  </head>\n' +
  '  <body>\n' +
  '    <div class="wrap">\n' +
  '      <p>Some    text   here.</p>\n' +
  '      <pre>  keep   this   exact  </pre>\n' +
  '    </div>\n' +
  '  </body>\n' +
  '</html>';

const RAW_TAGS = new Set(['pre', 'textarea', 'script', 'style']);
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const INLINE_TAGS = new Set([
  'a', 'b', 'i', 'em', 'strong', 'span', 'code', 'small', 'sub', 'sup',
  'u', 's', 'mark', 'abbr', 'cite', 'q', 'time', 'label', 'kbd', 'var',
]);

interface Token {
  type: 'open' | 'close' | 'selfclose' | 'text' | 'comment' | 'cdata' | 'pi' | 'doctype' | 'raw';
  value: string;
  name?: string;
}

function tagName(tag: string): string {
  const m = /^<\/?\s*([a-zA-Z][\w:-]*)/.exec(tag);
  return (m?.[1] ?? '').toLowerCase();
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === '<') {
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: 'comment', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      if (input.startsWith('<![CDATA[', i)) {
        const end = input.indexOf(']]>', i);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: 'cdata', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      if (input.startsWith('<?', i)) {
        const end = input.indexOf('?>', i);
        const stop = end === -1 ? n : end + 2;
        tokens.push({ type: 'pi', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      if (input.startsWith('<!', i)) {
        const end = input.indexOf('>', i);
        const stop = end === -1 ? n : end + 1;
        tokens.push({ type: 'doctype', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      const end = input.indexOf('>', i);
      if (end === -1) {
        tokens.push({ type: 'text', value: input.slice(i) });
        break;
      }
      const tag = input.slice(i, end + 1);
      const name = tagName(tag);
      if (tag[1] === '/') {
        tokens.push({ type: 'close', value: tag, name });
        i = end + 1;
        continue;
      }
      // Raw-content tags: swallow everything until the matching close tag.
      if (RAW_TAGS.has(name) && tag[tag.length - 2] !== '/') {
        const closeIdx = input.toLowerCase().indexOf(`</${name}`, end + 1);
        if (closeIdx === -1) {
          tokens.push({ type: 'open', value: tag, name });
          i = end + 1;
          continue;
        }
        const closeEnd = input.indexOf('>', closeIdx);
        const stop = closeEnd === -1 ? n : closeEnd + 1;
        tokens.push({ type: 'raw', value: input.slice(i, stop), name });
        i = stop;
        continue;
      }
      if (tag[tag.length - 2] === '/') {
        tokens.push({ type: 'selfclose', value: tag, name });
      } else {
        tokens.push({ type: 'open', value: tag, name });
      }
      i = end + 1;
      continue;
    }
    const next = input.indexOf('<', i);
    const stop = next === -1 ? n : next;
    tokens.push({ type: 'text', value: input.slice(i, stop) });
    i = stop;
  }
  return tokens;
}

function minify(input: string, keepConditional: boolean): string {
  const tokens = tokenize(input);
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok.type === 'comment') {
      const isCond = /^<!--\s*\[if/i.test(tok.value) || /\[endif\]/i.test(tok.value);
      if (keepConditional && isCond) out.push(tok.value);
      continue;
    }
    if (tok.type === 'text') {
      const collapsed = tok.value.replace(/\s+/g, ' ');
      if (collapsed.trim() === '') {
        // Drop whitespace-only text between block tags.
        continue;
      }
      out.push(collapsed);
      continue;
    }
    if (tok.type === 'raw' || tok.type === 'cdata') {
      out.push(tok.value);
      continue;
    }
    out.push(tok.value.replace(/\s+/g, ' ').replace(/\s+>/g, '>').trim());
  }
  return out.join('');
}

function beautify(input: string, unit: string): string {
  const tokens = tokenize(input);
  const out: string[] = [];
  let depth = 0;
  const pushLine = (s: string, d: number) => out.push(unit.repeat(Math.max(0, d)) + s);

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (!tok) continue;
    if (tok.type === 'text') {
      const trimmed = tok.value.replace(/\s+/g, ' ').trim();
      if (trimmed === '') continue;
      pushLine(trimmed, depth);
      continue;
    }
    if (tok.type === 'raw') {
      pushLine(tok.value, depth);
      continue;
    }
    if (tok.type === 'open') {
      const name = tok.name ?? '';
      if (VOID_TAGS.has(name)) {
        pushLine(tok.value, depth);
        continue;
      }
      // Inline short content: <tag>text</tag> on one line.
      const next = tokens[idx + 1];
      const after = tokens[idx + 2];
      if (
        next &&
        next.type === 'text' &&
        next.value.trim() !== '' &&
        after &&
        after.type === 'close' &&
        after.name === name
      ) {
        pushLine(tok.value + next.value.replace(/\s+/g, ' ').trim() + after.value, depth);
        idx += 2;
        continue;
      }
      pushLine(tok.value, depth);
      if (!INLINE_TAGS.has(name)) depth++;
      continue;
    }
    if (tok.type === 'close') {
      const name = tok.name ?? '';
      if (!INLINE_TAGS.has(name) && !VOID_TAGS.has(name)) depth--;
      pushLine(tok.value, depth);
      continue;
    }
    // selfclose, comment, cdata, pi, doctype
    pushLine(tok.value.replace(/\s+/g, ' ').trim(), depth);
  }
  return out.join('\n');
}

export default function HtmlMinifyTool() {
  const [mode, setMode] = useState<Mode>('minify');
  const [indent, setIndent] = useState<IndentKind>('2');
  const [keepConditional, setKeepConditional] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return mode === 'minify'
        ? minify(input, keepConditional)
        : beautify(input, indent === 'tab' ? '\t' : indent === '4' ? '    ' : '  ');
    },
    [mode, indent, keepConditional],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, indent, keepConditional]}
      inputLabel="HTML"
      outputLabel={mode === 'minify' ? 'Minified HTML' : 'Formatted HTML'}
      inputPlaceholder="Paste HTML…"
      sample={SAMPLE}
      downloadName="output.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="minify">Minify</TabsTrigger>
                <TabsTrigger value="beautify">Beautify</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'beautify' && (
            <Field label="Indent">
              <Select value={indent} onValueChange={(v) => setIndent(v as IndentKind)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {mode === 'minify' && (
            <Field label="Keep conditional comments">
              <Switch checked={keepConditional} onCheckedChange={setKeepConditional} />
            </Field>
          )}
        </>
      }
    />
  );
}
