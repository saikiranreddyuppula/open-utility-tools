'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

interface Specificity {
  a: number; // IDs
  b: number; // classes, attributes, pseudo-classes
  c: number; // elements (type) and pseudo-elements
}

const PSEUDO_ELEMENTS = new Set([
  'before',
  'after',
  'first-line',
  'first-letter',
  'selection',
  'placeholder',
  'marker',
  'backdrop',
  'file-selector-button',
]);

// Pseudo-classes whose specificity is that of their most specific argument.
const FORWARD_ARG = new Set(['not', 'is', 'has']);
// :where() always contributes zero specificity.
const ZERO_ARG = new Set(['where']);

function addSpec(target: Specificity, src: Specificity): void {
  target.a += src.a;
  target.b += src.b;
  target.c += src.c;
}

function maxSpec(list: Specificity[]): Specificity {
  let best: Specificity = { a: 0, b: 0, c: 0 };
  for (const s of list) {
    if (s.a > best.a || (s.a === best.a && s.b > best.b) || (s.a === best.a && s.b === best.b && s.c > best.c)) {
      best = s;
    }
  }
  return best;
}

/**
 * Compute specificity for a single complex selector (no commas).
 * Handles ID/class/attribute/pseudo-class/element tokens plus functional
 * pseudo-classes :not/:is/:has/:where.
 */
function specificityOfComplex(selector: string): Specificity {
  const spec: Specificity = { a: 0, b: 0, c: 0 };
  let i = 0;
  const s = selector;
  const len = s.length;

  // Read a balanced parenthesised group starting at an opening "(".
  const readParens = (start: number): { inner: string; end: number } => {
    let depth = 0;
    let j = start;
    for (; j < len; j++) {
      const ch = s[j];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return { inner: s.slice(start + 1, j), end: j + 1 };
      }
    }
    return { inner: s.slice(start + 1), end: len };
  };

  const readName = (start: number): { name: string; end: number } => {
    let j = start;
    while (j < len) {
      const ch = s[j];
      if (ch !== undefined && /[A-Za-z0-9_-]/.test(ch)) j++;
      else break;
    }
    return { name: s.slice(start, j), end: j };
  };

  while (i < len) {
    const ch = s[i];
    if (ch === undefined) break;

    if (/\s|>|\+|~/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '*') {
      // Universal selector — contributes nothing.
      i++;
      continue;
    }

    if (ch === '#') {
      const { end } = readName(i + 1);
      spec.a += 1;
      i = end;
      continue;
    }

    if (ch === '.') {
      const { end } = readName(i + 1);
      spec.b += 1;
      i = end;
      continue;
    }

    if (ch === '[') {
      // Attribute selector — skip to matching "]".
      let j = i + 1;
      while (j < len && s[j] !== ']') j++;
      spec.b += 1;
      i = j + 1;
      continue;
    }

    if (ch === ':') {
      const doubleColon = s[i + 1] === ':';
      const nameStart = doubleColon ? i + 2 : i + 1;
      const { name, end } = readName(nameStart);
      let cursor = end;
      const lower = name.toLowerCase();

      // Functional pseudo-class with parentheses.
      if (s[cursor] === '(') {
        const { inner, end: pEnd } = readParens(cursor);
        cursor = pEnd;
        if (ZERO_ARG.has(lower)) {
          // :where() => 0
        } else if (FORWARD_ARG.has(lower)) {
          const args = splitTopLevel(inner, ',');
          const argSpecs = args.map((a) => specificityOfComplex(a));
          addSpec(spec, maxSpec(argSpecs));
        } else if (lower === 'nth-child' || lower === 'nth-last-child' || lower === 'nth-of-type' || lower === 'nth-last-of-type') {
          // Counts as a pseudo-class (the "of S" arg is ignored here for simplicity).
          spec.b += 1;
        } else {
          spec.b += 1;
        }
        i = cursor;
        continue;
      }

      if (doubleColon || PSEUDO_ELEMENTS.has(lower)) {
        // Pseudo-element.
        spec.c += 1;
      } else {
        // Pseudo-class.
        spec.b += 1;
      }
      i = cursor;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      // Type / element selector.
      const { end } = readName(i);
      spec.c += 1;
      i = end;
      continue;
    }

    // Combinators, escapes, or anything else — advance.
    i++;
  }

  return spec;
}

/** Split a string on a separator, respecting parentheses/brackets nesting. */
function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === undefined) continue;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((x) => x.trim()).filter((x) => x.length > 0);
}

function fmt(s: Specificity): string {
  return `(${s.a},${s.b},${s.c})`;
}

function compare(x: Specificity, y: Specificity): number {
  if (x.a !== y.a) return y.a - x.a;
  if (x.b !== y.b) return y.b - x.b;
  return y.c - x.c;
}

export default function CssSpecificityTool() {
  const transform = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Each non-empty line is treated as one selector list entry.
    const lines = trimmed
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    interface Row {
      selector: string;
      spec: Specificity;
    }
    const rows: Row[] = [];

    for (const line of lines) {
      // A comma-separated selector list: each part is independent.
      const parts = splitTopLevel(line, ',');
      if (parts.length <= 1) {
        rows.push({ selector: line, spec: specificityOfComplex(line) });
      } else {
        for (const p of parts) {
          rows.push({ selector: p, spec: specificityOfComplex(p) });
        }
      }
    }

    if (rows.length === 0) return '';

    if (rows.length === 1) {
      const r = rows[0];
      if (!r) return '';
      return [
        `Selector:    ${r.selector}`,
        `Specificity: ${fmt(r.spec)}`,
        '',
        `  a (IDs):                          ${r.spec.a}`,
        `  b (classes/attrs/pseudo-classes): ${r.spec.b}`,
        `  c (elements/pseudo-elements):     ${r.spec.c}`,
      ].join('\n');
    }

    // Multiple selectors — rank by specificity (winner first).
    const ranked = [...rows].sort((p, q) => compare(p.spec, q.spec));
    const width = Math.max(...ranked.map((r) => r.selector.length), 8);
    const header = `${'specificity'.padEnd(13)}  selector`;
    const body = ranked.map((r, idx) => {
      const prev = ranked[idx - 1];
      const tie = idx > 0 && prev && compare(prev.spec, r.spec) === 0 ? ' (tie)' : '';
      return `${fmt(r.spec).padEnd(13)}  ${r.selector.padEnd(width)}${tie}`;
    });
    const winner = ranked[0];
    const footer = winner
      ? `\nWinner: ${winner.selector}  ${fmt(winner.spec)} (later source order breaks ties)`
      : '';
    return [header, '-'.repeat(header.length + width), ...body, footer].join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="CSS selector(s) — one per line"
      outputLabel="Specificity"
      inputPlaceholder="#nav .item a:hover"
      sample={'#header .nav a\nul li.active\na:hover\n.btn.btn-primary\ndiv > p::first-line'}
      downloadName="specificity.txt"
    />
  );
}
