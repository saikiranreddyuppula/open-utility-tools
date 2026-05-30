'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `- Fruit
  - Apple
  - Banana
    - Cavendish
    - Plantain
- Vegetables
  - Carrot
  - Potato`;

type Dir = 'to-json' | 'to-md';
type Shape = 'object' | 'strings';

interface TreeNode {
  text: string;
  children: TreeNode[];
}

// JSON value union used by both shapes.
type JsonVal = string | { text: string; children: JsonVal[] } | JsonVal[];

const MARKER_RE = /^([-*+]|\d+[.)])\s+(.*)$/;

/** Measure indent depth of a line, given indent width (spaces) — tabs count as one level. */
function indentLevel(line: string, width: number): { level: number; rest: string } {
  let i = 0;
  let cols = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === ' ') {
      cols += 1;
      i++;
    } else if (c === '\t') {
      cols += width; // a tab equals one indent unit
      i++;
    } else break;
  }
  const level = Math.round(cols / width);
  return { level, rest: line.slice(i) };
}

function parseMarkdownList(
  input: string,
  width: number,
  includeEmpty: boolean
): TreeNode[] {
  const roots: TreeNode[] = [];
  // stack[d] = the node at depth d whose children we append to at depth d+1
  const stack: TreeNode[] = [];
  const lines = input.split(/\r?\n/);
  for (const rawLine of lines) {
    if (rawLine.trim() === '' && !includeEmpty) continue;
    const { level, rest } = indentLevel(rawLine, width);
    const m = rest.match(MARKER_RE);
    const text = m ? (m[2] ?? '').trim() : rest.trim();
    if (text === '' && !includeEmpty) continue;
    const node: TreeNode = { text, children: [] };
    // truncate stack to current depth
    stack.length = Math.min(stack.length, level);
    if (level === 0 || stack.length === 0) {
      roots.push(node);
      stack[0] = node;
      stack.length = 1;
    } else {
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(node);
      else roots.push(node);
      stack[level] = node;
      stack.length = level + 1;
    }
  }
  return roots;
}

function toShape(nodes: TreeNode[], shape: Shape): JsonVal[] {
  if (shape === 'object') {
    return nodes.map((n) => ({ text: n.text, children: toShape(n.children, shape) }));
  }
  // strings mode: a node with children becomes [text, [..children..]]; leaf is just text
  const out: JsonVal[] = [];
  for (const n of nodes) {
    if (n.children.length === 0) {
      out.push(n.text);
    } else {
      out.push(n.text);
      out.push(toShape(n.children, shape));
    }
  }
  return out;
}

/** Parse JSON (either shape) back into a TreeNode list. */
function jsonToTree(value: JsonVal): TreeNode[] {
  if (!Array.isArray(value)) {
    // single node
    if (typeof value === 'string') return [{ text: value, children: [] }];
    return [{ text: value.text, children: jsonArrToTree(value.children) }];
  }
  return jsonArrToTree(value);
}

function jsonArrToTree(arr: JsonVal[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item === undefined) continue;
    if (typeof item === 'string') {
      // strings mode: a following array is this node's children
      const next = arr[i + 1];
      if (Array.isArray(next)) {
        out.push({ text: item, children: jsonArrToTree(next) });
        i++;
      } else {
        out.push({ text: item, children: [] });
      }
    } else if (Array.isArray(item)) {
      // bare nested array without a preceding label
      out.push(...jsonArrToTree(item));
    } else {
      // object shape {text, children}
      out.push({ text: item.text, children: jsonArrToTree(item.children) });
    }
  }
  return out;
}

function treeToMarkdown(nodes: TreeNode[], depth: number, indent: number): string[] {
  const lines: string[] = [];
  const pad = ' '.repeat(depth * indent);
  for (const n of nodes) {
    lines.push(`${pad}- ${n.text}`);
    if (n.children.length) {
      lines.push(...treeToMarkdown(n.children, depth + 1, indent));
    }
  }
  return lines;
}

export default function MarkdownListToJsonTool() {
  const [dir, setDir] = useState<Dir>('to-json');
  const [shape, setShape] = useState<Shape>('object');
  const [width, setWidth] = useState('2');
  const [includeEmpty, setIncludeEmpty] = useState<'skip' | 'keep'>('skip');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const w = Number(width);
      const indent = Number.isFinite(w) && w > 0 ? w : 2;
      if (dir === 'to-json') {
        const tree = parseMarkdownList(input, indent, includeEmpty === 'keep');
        const shaped = toShape(tree, shape);
        return JSON.stringify(shaped, null, 2);
      }
      // to-md
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error('Input is not valid JSON. Switch direction or fix the JSON.');
      }
      const tree = jsonToTree(parsed as JsonVal);
      return treeToMarkdown(tree, 0, indent).join('\n');
    },
    [dir, shape, width, includeEmpty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, shape, width, includeEmpty]}
      inputLabel={dir === 'to-json' ? 'Markdown list' : 'JSON tree'}
      outputLabel={dir === 'to-json' ? 'JSON tree' : 'Markdown list'}
      inputPlaceholder={dir === 'to-json' ? '- item\n  - subitem' : '[{ "text": "item", "children": [] }]'}
      sample={dir === 'to-json' ? SAMPLE : undefined}
      downloadName={dir === 'to-json' ? 'list.json' : 'list.md'}
      downloadMime={dir === 'to-json' ? 'application/json' : 'text/markdown'}
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="to-json">MD → JSON</TabsTrigger>
                <TabsTrigger value="to-md">JSON → MD</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Shape">
            <Tabs value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <TabsList>
                <TabsTrigger value="object">{`{text, children}`}</TabsTrigger>
                <TabsTrigger value="strings">Strings</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Indent width">
            <Select value={width} onValueChange={setWidth}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Empty lines">
            <Tabs
              value={includeEmpty}
              onValueChange={(v) => setIncludeEmpty(v as 'skip' | 'keep')}
            >
              <TabsList>
                <TabsTrigger value="skip">Skip</TabsTrigger>
                <TabsTrigger value="keep">Keep</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
