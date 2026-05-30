'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Flavor = 'js' | 'pcre' | 'python' | 'go';
type Context = 'pattern' | 'class';

// Metacharacters special in a JS regex pattern body.
const JS_META = new Set('.*+?^${}()|[]\\'.split(''));
// Metacharacters special in PCRE / Go pattern body.
const PCRE_META = new Set('.*+?^${}()|[]\\-'.split(''));
// Characters special inside a [...] character class.
const CLASS_META = new Set('\\^]-'.split(''));

function escapeChar(ch: string): string {
  return `\\${ch}`;
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export default function RegexLiteralEscapeTool() {
  const [flavor, setFlavor] = useState<Flavor>('js');
  const [context, setContext] = useState<Context>('pattern');
  const [escSlash, setEscSlash] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let out = '';

      if (context === 'class') {
        // Only escape characters that are special inside [ ].
        for (const ch of input) {
          out += CLASS_META.has(ch) ? escapeChar(ch) : ch;
        }
        return out;
      }

      for (const ch of input) {
        switch (flavor) {
          case 'js': {
            if (ch === '/' && escSlash) out += escapeChar(ch);
            else if (JS_META.has(ch)) out += escapeChar(ch);
            else out += ch;
            break;
          }
          case 'go': {
            // Go regexp.QuoteMeta escapes the same set as PCRE-style.
            if (PCRE_META.has(ch)) out += escapeChar(ch);
            else out += ch;
            break;
          }
          case 'python': {
            // re.escape: escape every non-alphanumeric, non-underscore ASCII char.
            const code = ch.codePointAt(0) ?? 0;
            if (code < 128 && !isWordChar(ch)) out += escapeChar(ch);
            else out += ch;
            break;
          }
          case 'pcre': {
            if (PCRE_META.has(ch)) out += escapeChar(ch);
            else out += ch;
            break;
          }
          default: {
            out += ch;
            break;
          }
        }
      }
      return out;
    },
    [flavor, context, escSlash],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[flavor, context, escSlash]}
      inputLabel="Literal text"
      outputLabel="Escaped pattern"
      sample="Price: $5.00 (50% off?) — see [docs] a.b*c"
      downloadName="regex-escaped.txt"
      options={
        <>
          <Field label="Flavor">
            <Select value={flavor} onValueChange={(v) => setFlavor(v as Flavor)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="js">JavaScript</SelectItem>
                <SelectItem value="pcre">PCRE / Perl</SelectItem>
                <SelectItem value="python">Python re.escape</SelectItem>
                <SelectItem value="go">Go QuoteMeta</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Context">
            <Select value={context} onValueChange={(v) => setContext(v as Context)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pattern">Pattern body</SelectItem>
                <SelectItem value="class">Character class [ ]</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {flavor === 'js' && context === 'pattern' && (
            <Field label="Escape forward slash">
              <Switch checked={escSlash} onCheckedChange={setEscSlash} />
            </Field>
          )}
        </>
      }
    />
  );
}
