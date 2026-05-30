'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OutMode = 'pairs' | 'values';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePointer(pointer: string): string[] {
  // "" and "#" both denote the whole document.
  if (pointer === '' || pointer === '#') return [];
  if (!pointer.startsWith('/')) {
    throw new Error('Pointer must be "#"/empty (whole document) or start with "/".');
  }
  return pointer
    .slice(1)
    .split('/')
    .map((tok) => tok.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function resolve(doc: unknown, pointer: string): string {
  const tokens = parsePointer(pointer);
  let node: unknown = doc;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    if (Array.isArray(node)) {
      if (token === '-') {
        throw new Error(`"-" references the (nonexistent) element after the end of the array.`);
      }
      if (!/^(0|[1-9]\d*)$/.test(token)) {
        throw new Error(`token "${token}" is not a valid array index.`);
      }
      const idx = Number(token);
      if (idx >= node.length) {
        throw new Error(`array index ${idx} is out of range (length ${node.length}).`);
      }
      node = node[idx];
    } else if (isPlainObject(node)) {
      if (!Object.prototype.hasOwnProperty.call(node, token)) {
        throw new Error(`key "${token}" not found.`);
      }
      node = node[token];
    } else {
      throw new Error(`cannot descend into a ${node === null ? 'null' : typeof node} at "${token}".`);
    }
  }
  return JSON.stringify(node, null, 2);
}

const SAMPLE = JSON.stringify(
  {
    store: {
      book: [
        { title: 'JSON Basics', price: 9.99 },
        { title: 'Pointers', price: 12.5 },
      ],
      'a/b': 'escaped slash',
      'm~n': 'escaped tilde',
    },
  },
  null,
  2,
);

const DEFAULT_POINTERS = ['/store/book/0/title', '/store/book/1/price', '/store/a~1b', '/store/m~0n', '#'].join(
  '\n',
);

export default function JsonPointerResolverTool() {
  const [pointers, setPointers] = useState(DEFAULT_POINTERS);
  const [outMode, setOutMode] = useState<OutMode>('pairs');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON document: ${e instanceof Error ? e.message : String(e)}`);
      }

      const lines = pointers.split('\n');
      const out: string[] = [];
      for (const rawLine of lines) {
        const ptr = rawLine.replace(/\r$/, '').trim();
        // Blank lines are ignored; use "#" for the whole document.
        if (ptr === '') continue;
        let resolved: string;
        try {
          resolved = resolve(doc, ptr);
        } catch (e) {
          resolved = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
        }
        if (outMode === 'values') {
          out.push(resolved);
        } else {
          const label = ptr === '#' ? '# (whole document)' : ptr;
          out.push(`${label} =>\n${resolved}`);
        }
      }
      if (out.length === 0) return '';
      return out.join(outMode === 'pairs' ? '\n\n' : '\n');
    },
    [pointers, outMode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[pointers, outMode]}
      inputLabel="JSON document"
      outputLabel="Resolved values"
      sample={SAMPLE}
      downloadName="resolved.txt"
      downloadMime="text/plain"
      options={
        <>
          <Field
            label="Pointers (one per line)"
            hint="Empty line = whole document. ~1 = /, ~0 = ~"
            className="min-w-[280px] flex-1"
          >
            <Textarea
              value={pointers}
              onChange={(e) => setPointers(e.target.value)}
              spellCheck={false}
              rows={4}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Output">
            <Tabs value={outMode} onValueChange={(v) => setOutMode(v as OutMode)}>
              <TabsList>
                <TabsTrigger value="pairs">Pointer: value</TabsTrigger>
                <TabsTrigger value="values">Values only</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
