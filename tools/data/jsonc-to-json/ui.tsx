'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Strip line/block comments and trailing commas from JSONC/JSON5 without
 * touching string contents, then normalize JSON5-ish quoting so the result
 * can be parsed by JSON.parse.
 */
function stripToJson(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i] ?? '';
    const next = src[i + 1] ?? '';

    // Double-quoted string: copy verbatim, honoring escapes.
    if (ch === '"') {
      out += ch;
      i++;
      while (i < n) {
        const c = src[i] ?? '';
        out += c;
        if (c === '\\') {
          out += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        i++;
        if (c === '"') break;
      }
      continue;
    }

    // Single-quoted string (JSON5): convert to a double-quoted JSON string.
    if (ch === "'") {
      i++;
      let body = '';
      while (i < n) {
        const c = src[i] ?? '';
        if (c === '\\') {
          const e = src[i + 1] ?? '';
          if (e === "'") {
            body += "'";
          } else if (e === '"') {
            body += '\\"';
          } else {
            body += '\\' + e;
          }
          i += 2;
          continue;
        }
        if (c === "'") {
          i++;
          break;
        }
        if (c === '"') {
          body += '\\"';
        } else {
          body += c;
        }
        i++;
      }
      out += `"${body}"`;
      continue;
    }

    // Line comment.
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      continue;
    }

    // Block comment.
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  // Remove trailing commas before } or ] (now safe — strings are intact).
  out = out.replace(/,(\s*[}\]])/g, '$1');

  // Quote bare/unquoted object keys (JSON5). Match identifiers followed by ':'.
  out = out.replace(
    /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g,
    '$1"$2"$3',
  );

  return out;
}

export default function JsoncToJsonTool() {
  const [indent, setIndent] = useState<'2' | '4' | 'tab' | 'min'>('2');
  const [validate, setValidate] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      const stripped = stripToJson(input);

      if (!validate) {
        return stripped.trim();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripped);
      } catch (err) {
        throw new Error(
          `Could not produce valid JSON: ${(err as Error).message}. ` +
            'Disable "Validate & reformat" to see the raw stripped output.',
        );
      }

      if (indent === 'min') return JSON.stringify(parsed);
      const indentValue = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(parsed, null, indentValue);
    },
    [indent, validate],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent, validate]}
      inputLabel="JSONC / JSON5"
      outputLabel="JSON"
      inputPlaceholder={'{\n  // a comment\n  name: "example",\n  tags: ["a", "b",], /* trailing comma */\n}'}
      sample={
        '{\n  // App configuration\n  name: \'my-app\',\n  version: "1.2.3",\n  features: [\n    "search",\n    "export", // trailing comma below\n  ],\n  /* nested block */\n  limits: { max: 100, min: 0, },\n}'
      }
      downloadName="output.json"
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
          <Field label="Validate & reformat" hint="Off = raw stripped text">
            <div className="flex h-9 items-center">
              <Switch checked={validate} onCheckedChange={setValidate} />
            </div>
          </Field>
        </>
      }
    />
  );
}
