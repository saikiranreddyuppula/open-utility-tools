'use client';

import { useCallback, useState } from 'react';

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
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'escape' | 'unescape';
type Quote = 'single' | 'double' | 'backtick';

const QUOTE_CHAR: Record<Quote, string> = {
  single: "'",
  double: '"',
  backtick: '`',
};

function hex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0');
}

function hex4(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0');
}

export default function JsStringEscapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [quote, setQuote] = useState<Quote>('single');
  const [asciiOnly, setAsciiOnly] = useState(true);
  const [useBraces, setUseBraces] = useState(false);
  const [wrap, setWrap] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      if (mode === 'escape') {
        const q = QUOTE_CHAR[quote];
        let out = '';
        // Iterate by code point so astral characters can use \u{...}.
        for (const ch of input) {
          const cp = ch.codePointAt(0) ?? 0;
          switch (cp) {
            case 0x5c:
              out += '\\\\';
              continue;
            case 0x08:
              out += '\\b';
              continue;
            case 0x0c:
              out += '\\f';
              continue;
            case 0x0a:
              out += '\\n';
              continue;
            case 0x0d:
              out += '\\r';
              continue;
            case 0x09:
              out += '\\t';
              continue;
            case 0x0b:
              out += '\\v';
              continue;
            default:
              break;
          }
          if (ch === q) {
            out += `\\${q}`;
            continue;
          }
          // ${ must be escaped inside template literals.
          if (quote === 'backtick' && ch === '$') {
            out += '\\$';
            continue;
          }
          if (cp < 0x20) {
            out += `\\x${hex2(cp)}`;
            continue;
          }
          if (cp > 0x7e && asciiOnly) {
            if (cp > 0xffff) {
              if (useBraces) {
                out += `\\u{${cp.toString(16).toUpperCase()}}`;
              } else {
                // Encode as a UTF-16 surrogate pair.
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += `\\u${hex4(hi)}\\u${hex4(lo)}`;
              }
            } else {
              out += `\\u${hex4(cp)}`;
            }
            continue;
          }
          out += ch;
        }
        return wrap ? `${q}${out}${q}` : out;
      }

      // unescape
      let s = input.trim();
      // Strip a single matching pair of surrounding quotes if present.
      const first = s[0];
      const last = s[s.length - 1];
      if (
        s.length >= 2 &&
        first !== undefined &&
        (first === '"' || first === "'" || first === '`') &&
        first === last
      ) {
        s = s.slice(1, -1);
      }

      let out = '';
      let i = 0;
      while (i < s.length) {
        const ch = s[i] ?? '';
        if (ch !== '\\') {
          out += ch;
          i++;
          continue;
        }
        const next = s[i + 1];
        if (next === undefined) {
          out += '\\';
          i++;
          continue;
        }
        switch (next) {
          case 'n':
            out += '\n';
            i += 2;
            continue;
          case 'r':
            out += '\r';
            i += 2;
            continue;
          case 't':
            out += '\t';
            i += 2;
            continue;
          case 'b':
            out += '\b';
            i += 2;
            continue;
          case 'f':
            out += '\f';
            i += 2;
            continue;
          case 'v':
            out += '\v';
            i += 2;
            continue;
          case '0':
            // \0 only when not followed by another digit.
            if (!/[0-9]/.test(s[i + 2] ?? '')) {
              out += '\0';
              i += 2;
              continue;
            }
            out += '0';
            i += 2;
            continue;
          case '\n':
            // Line continuation: backslash-newline produces nothing.
            i += 2;
            continue;
          case '\r':
            i += 2;
            if (s[i] === '\n') i++;
            continue;
          case 'x': {
            const hh = s.slice(i + 2, i + 4);
            if (/^[0-9a-fA-F]{2}$/.test(hh)) {
              out += String.fromCharCode(parseInt(hh, 16));
              i += 4;
              continue;
            }
            out += 'x';
            i += 2;
            continue;
          }
          case 'u': {
            if (s[i + 2] === '{') {
              const close = s.indexOf('}', i + 3);
              if (close !== -1) {
                const body = s.slice(i + 3, close);
                if (/^[0-9a-fA-F]+$/.test(body)) {
                  const cp = parseInt(body, 16);
                  if (Number.isFinite(cp) && cp <= 0x10ffff) {
                    out += String.fromCodePoint(cp);
                    i = close + 1;
                    continue;
                  }
                }
              }
              out += 'u';
              i += 2;
              continue;
            }
            const hhhh = s.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hhhh)) {
              out += String.fromCharCode(parseInt(hhhh, 16));
              i += 6;
              continue;
            }
            out += 'u';
            i += 2;
            continue;
          }
          default:
            // Any other escaped char is itself (e.g. \\ , \" , \' , \` , \/).
            out += next;
            i += 2;
            continue;
        }
      }
      return out;
    },
    [mode, quote, asciiOnly, useBraces, wrap],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, quote, asciiOnly, useBraces, wrap]}
      inputLabel={mode === 'escape' ? 'Raw text' : 'Escaped string'}
      outputLabel={mode === 'escape' ? 'JS string literal' : 'Raw text'}
      sample={'Line 1\nTab\there — café 🚀'}
      downloadName="js-string.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="escape">Escape</TabsTrigger>
                <TabsTrigger value="unescape">Unescape</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'escape' && (
            <>
              <Field label="Quote style">
                <Select
                  value={quote}
                  onValueChange={(v) => setQuote(v as Quote)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single &#39;</SelectItem>
                    <SelectItem value="double">Double &quot;</SelectItem>
                    <SelectItem value="backtick">Backtick `</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ASCII-only (escape non-ASCII)">
                <Switch checked={asciiOnly} onCheckedChange={setAsciiOnly} />
              </Field>
              <Field label="Use \u{…} for astral chars">
                <Switch checked={useBraces} onCheckedChange={setUseBraces} />
              </Field>
              <Field label="Wrap in quotes">
                <Switch checked={wrap} onCheckedChange={setWrap} />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
