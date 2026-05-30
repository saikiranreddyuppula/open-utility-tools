'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'markdown' | 'html' | 'path' | 'flatten';
type Bullet = '-' | '*' | '+';

interface OutlineNode {
  text: string;
  depth: number;
}

const SAMPLE = [
  'Animals',
  '\tMammals',
  '\t\tDog',
  '\t\tCat',
  '\tBirds',
  '\t\tEagle',
  'Plants',
  '\tTrees',
  '\t\tOak',
].join('\n');

const MD_SAMPLE = [
  '- Animals',
  '  - Mammals',
  '    - Dog',
  '    - Cat',
  '  - Birds',
  '- Plants',
].join('\n');

/** Strip a Markdown bullet/number prefix from already-indented content. */
function stripMarker(content: string): string {
  const m = content.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
  return m && m[1] !== undefined ? m[1] : content;
}

/** Parse indented (or Markdown) text into a flat list of nodes with depth. */
function parseOutline(input: string, spaceUnit: number): OutlineNode[] {
  const lines = input.split('\n');
  const nodes: OutlineNode[] = [];
  for (const raw of lines) {
    if (raw.trim() === '') continue;
    // Measure indentation: tabs count as one level each, spaces by unit.
    const lead = raw.match(/^[\t ]*/)?.[0] ?? '';
    let depth = 0;
    let spaceRun = 0;
    for (const ch of lead) {
      if (ch === '\t') {
        depth += Math.floor(spaceRun / spaceUnit);
        spaceRun = 0;
        depth += 1;
      } else {
        spaceRun += 1;
      }
    }
    depth += Math.floor(spaceRun / spaceUnit);
    const content = stripMarker(raw.slice(lead.length).trimEnd());
    nodes.push({ text: content, depth });
  }
  return nodes;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toMarkdown(nodes: OutlineNode[], bullet: Bullet, ordered: boolean): string {
  const out: string[] = [];
  // Track per-depth counters for ordered lists.
  const counters: number[] = [];
  let prevDepth = 0;
  for (const n of nodes) {
    if (n.depth < prevDepth) {
      counters.length = n.depth + 1;
    }
    prevDepth = n.depth;
    const indent = '  '.repeat(n.depth);
    if (ordered) {
      counters[n.depth] = (counters[n.depth] ?? 0) + 1;
      out.push(`${indent}${counters[n.depth]}. ${n.text}`);
    } else {
      out.push(`${indent}${bullet} ${n.text}`);
    }
  }
  return out.join('\n');
}

function toHtml(nodes: OutlineNode[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const out: string[] = [];
  let currentDepth = -1;
  const pad = (d: number) => '  '.repeat(Math.max(0, d) * 2);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    if (n.depth > currentDepth) {
      // Open one or more lists down to this depth.
      for (let d = currentDepth + 1; d <= n.depth; d++) {
        out.push(`${pad(d)}<${tag}>`);
      }
    } else if (n.depth < currentDepth) {
      // Close items/lists back up to this depth.
      for (let d = currentDepth; d > n.depth; d--) {
        out.push(`${pad(d)}  </li>`);
        out.push(`${pad(d)}</${tag}>`);
      }
      out.push(`${pad(n.depth)}  </li>`);
    } else if (i > 0) {
      out.push(`${pad(n.depth)}  </li>`);
    }
    currentDepth = n.depth;
    out.push(`${pad(n.depth)}  <li>${escapeHtml(n.text)}`);
  }
  // Close remaining open items/lists.
  for (let d = currentDepth; d >= 0; d--) {
    out.push(`${pad(d)}  </li>`);
    out.push(`${pad(d)}</${tag}>`);
  }
  return out.join('\n');
}

function toPaths(nodes: OutlineNode[], sep: string): string {
  const stack: string[] = [];
  const out: string[] = [];
  for (const n of nodes) {
    stack.length = n.depth;
    stack[n.depth] = n.text;
    out.push(stack.slice(0, n.depth + 1).join(sep));
  }
  return out.join('\n');
}

export default function OutlineToListTool() {
  const [mode, setMode] = useState<Mode>('markdown');
  const [spaceUnit, setSpaceUnit] = useState('2');
  const [bullet, setBullet] = useState<Bullet>('-');
  const [ordered, setOrdered] = useState<'unordered' | 'ordered'>('unordered');
  const [pathSep, setPathSep] = useState(' > ');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const unit = (() => {
        const n = Number(spaceUnit);
        return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 2;
      })();
      const isOrdered = ordered === 'ordered';

      if (mode === 'flatten') {
        // Parse a (Markdown or indented) nested list back to a tab outline.
        const nodes = parseOutline(input, unit);
        return nodes.map((n) => '\t'.repeat(n.depth) + n.text).join('\n');
      }

      const nodes = parseOutline(input, unit);
      switch (mode) {
        case 'markdown':
          return toMarkdown(nodes, bullet, isOrdered);
        case 'html':
          return toHtml(nodes, isOrdered);
        case 'path':
          return toPaths(nodes, pathSep || ' > ');
        default:
          return toMarkdown(nodes, bullet, isOrdered);
      }
    },
    [mode, spaceUnit, bullet, ordered, pathSep]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, spaceUnit, bullet, ordered, pathSep]}
      inputLabel={mode === 'flatten' ? 'Nested list / outline' : 'Indented outline'}
      outputLabel={
        mode === 'markdown'
          ? 'Markdown list'
          : mode === 'html'
            ? 'HTML list'
            : mode === 'path'
              ? 'Flattened paths'
              : 'Tab outline'
      }
      sample={mode === 'flatten' ? MD_SAMPLE : SAMPLE}
      downloadName={mode === 'html' ? 'list.html' : 'outline.txt'}
      options={
        <>
          <Field label="Convert to">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown nested list</SelectItem>
                <SelectItem value="html">HTML &lt;ul&gt;/&lt;ol&gt;</SelectItem>
                <SelectItem value="path">Flattened paths</SelectItem>
                <SelectItem value="flatten">Outline (flatten list)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Spaces per level">
            <Input
              value={spaceUnit}
              onChange={(e) => setSpaceUnit(e.target.value)}
              className="w-[90px]"
              inputMode="numeric"
            />
          </Field>
          {(mode === 'markdown' || mode === 'html') && (
            <Field label="List type">
              <Select value={ordered} onValueChange={(v) => setOrdered(v as 'unordered' | 'ordered')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unordered">Unordered</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {mode === 'markdown' && ordered === 'unordered' && (
            <Field label="Bullet">
              <Select value={bullet} onValueChange={(v) => setBullet(v as Bullet)}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Dash (-)</SelectItem>
                  <SelectItem value="*">Star (*)</SelectItem>
                  <SelectItem value="+">Plus (+)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {mode === 'path' && (
            <Field label="Path separator">
              <Input
                value={pathSep}
                onChange={(e) => setPathSep(e.target.value)}
                className="w-[110px]"
                placeholder=" > "
              />
            </Field>
          )}
        </>
      }
    />
  );
}
