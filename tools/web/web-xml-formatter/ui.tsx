'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'beautify' | 'minify';
type IndentKind = '2' | '4' | 'tab';

interface Token {
  type: 'open' | 'close' | 'selfclose' | 'text' | 'comment' | 'cdata' | 'pi' | 'doctype';
  value: string;
}

function validate(input: string): void {
  const doc = new DOMParser().parseFromString(input, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    const msg = err.textContent?.replace(/\s+/g, ' ').trim() ?? 'Malformed XML.';
    throw new Error('Invalid XML: ' + msg);
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === '<') {
      // Comment
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: 'comment', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      // CDATA
      if (input.startsWith('<![CDATA[', i)) {
        const end = input.indexOf(']]>', i);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ type: 'cdata', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      // Processing instruction / XML declaration
      if (input.startsWith('<?', i)) {
        const end = input.indexOf('?>', i);
        const stop = end === -1 ? n : end + 2;
        tokens.push({ type: 'pi', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      // DOCTYPE / other declarations
      if (input.startsWith('<!', i)) {
        const end = input.indexOf('>', i);
        const stop = end === -1 ? n : end + 1;
        tokens.push({ type: 'doctype', value: input.slice(i, stop) });
        i = stop;
        continue;
      }
      // Regular tag
      const end = input.indexOf('>', i);
      if (end === -1) {
        tokens.push({ type: 'text', value: input.slice(i) });
        break;
      }
      const tag = input.slice(i, end + 1);
      if (tag[1] === '/') {
        tokens.push({ type: 'close', value: tag });
      } else if (tag[tag.length - 2] === '/') {
        tokens.push({ type: 'selfclose', value: tag });
      } else {
        tokens.push({ type: 'open', value: tag });
      }
      i = end + 1;
      continue;
    }
    // Text content up to next '<'
    const next = input.indexOf('<', i);
    const stop = next === -1 ? n : next;
    tokens.push({ type: 'text', value: input.slice(i, stop) });
    i = stop;
  }
  return tokens;
}

function beautify(input: string, unit: string): string {
  const tokens = tokenize(input);
  const out: string[] = [];
  let depth = 0;

  const pushLine = (s: string, d: number) => {
    out.push(unit.repeat(Math.max(0, d)) + s);
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (!tok) continue;
    if (tok.type === 'text') {
      const trimmed = tok.value.trim();
      if (trimmed === '') continue;
      // Inline text between an open and its matching close: keep on its own line
      pushLine(trimmed, depth);
      continue;
    }
    if (tok.type === 'open') {
      // Look ahead: if next meaningful token is text then a close for same depth, inline it
      const next = tokens[idx + 1];
      const after = tokens[idx + 2];
      if (
        next &&
        next.type === 'text' &&
        next.value.trim() !== '' &&
        after &&
        after.type === 'close'
      ) {
        pushLine(tok.value + next.value.trim() + after.value, depth);
        idx += 2;
        continue;
      }
      pushLine(tok.value, depth);
      depth++;
      continue;
    }
    if (tok.type === 'close') {
      depth--;
      pushLine(tok.value, depth);
      continue;
    }
    // selfclose, comment, cdata, pi, doctype
    pushLine(tok.value.trim(), depth);
  }

  return out.join('\n');
}

function minify(input: string): string {
  const tokens = tokenize(input);
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok.type === 'text') {
      const collapsed = tok.value.replace(/\s+/g, ' ');
      // Drop pure-whitespace text between tags
      if (collapsed.trim() === '') continue;
      out.push(collapsed);
    } else if (tok.type === 'comment' || tok.type === 'cdata') {
      out.push(tok.value);
    } else {
      out.push(tok.value.trim());
    }
  }
  return out.join('');
}

export default function XmlFormatterTool() {
  const [mode, setMode] = useState<Mode>('beautify');
  const [indent, setIndent] = useState<IndentKind>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      validate(input);
      if (mode === 'minify') return minify(input);
      const unit = indent === 'tab' ? '\t' : indent === '4' ? '    ' : '  ';
      return beautify(input, unit);
    },
    [mode, indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, indent]}
      inputLabel="XML"
      outputLabel={mode === 'minify' ? 'Minified XML' : 'Formatted XML'}
      inputPlaceholder="Paste XML…"
      sample={
        '<?xml version="1.0"?><catalog><book id="1"><title>XML Guide</title><author>A. Smith</author></book><book id="2"><title>JSON Guide</title><author>B. Jones</author></book></catalog>'
      }
      downloadName="formatted.xml"
      downloadMime="application/xml"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="beautify">Beautify</TabsTrigger>
                <TabsTrigger value="minify">Minify</TabsTrigger>
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
        </>
      }
    />
  );
}
