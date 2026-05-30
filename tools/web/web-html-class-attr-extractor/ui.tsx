'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OutMode = 'list' | 'csv' | 'css' | 'json';
type View = 'combined' | 'separate';

const SAMPLE =
  '<section class="hero hero--dark" id="top">\n' +
  '  <h1 class="title">Hi</h1>\n' +
  '  <p class="lead p-4 text-sm">Welcome</p>\n' +
  '  <button class="btn btn-primary" id="cta">Go</button>\n' +
  '  <a class="btn" href="#">Link</a>\n' +
  '</section>';

interface Counted {
  token: string;
  count: number;
}

function collect(html: string, ignoreCase: boolean, excludeRe: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const classMap = new Map<string, number>();
  const idMap = new Map<string, number>();

  let filter: RegExp | null = null;
  if (excludeRe.trim()) {
    try {
      filter = new RegExp(excludeRe);
    } catch {
      throw new Error('Invalid exclude regex.');
    }
  }

  const norm = (s: string) => (ignoreCase ? s.toLowerCase() : s);

  doc.querySelectorAll('*').forEach((el) => {
    const cls = el.getAttribute('class');
    if (cls) {
      cls
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((tok) => {
          if (filter && filter.test(tok)) return;
          const key = norm(tok);
          classMap.set(key, (classMap.get(key) ?? 0) + 1);
        });
    }
    const id = el.getAttribute('id');
    if (id && id.trim()) {
      const tok = id.trim();
      if (filter && filter.test(tok)) return;
      const key = norm(tok);
      idMap.set(key, (idMap.get(key) ?? 0) + 1);
    }
  });

  const toSorted = (m: Map<string, number>): Counted[] =>
    Array.from(m.entries())
      .map(([token, count]) => ({ token, count }))
      .sort((a, b) => a.token.localeCompare(b.token));

  return { classes: toSorted(classMap), ids: toSorted(idMap) };
}

function render(
  classes: Counted[],
  ids: Counted[],
  mode: OutMode,
  view: View,
): string {
  const classTokens = classes.map((c) => c.token);
  const idTokens = ids.map((c) => c.token);

  if (mode === 'json') {
    if (view === 'separate') {
      return JSON.stringify(
        {
          classes: classes.map((c) => ({ name: c.token, count: c.count })),
          ids: ids.map((c) => ({ name: c.token, count: c.count })),
        },
        null,
        2,
      );
    }
    return JSON.stringify([...classTokens.map((c) => '.' + c), ...idTokens.map((i) => '#' + i)], null, 2);
  }

  if (mode === 'css') {
    const lines: string[] = [];
    classTokens.forEach((c) => lines.push(`.${c} {}`));
    idTokens.forEach((i) => lines.push(`#${i} {}`));
    return lines.join('\n');
  }

  const joiner = mode === 'csv' ? ', ' : '\n';

  if (view === 'separate') {
    const parts: string[] = [];
    parts.push('/* classes */');
    parts.push(classes.map((c) => `.${c.token}  (${c.count})`).join(joiner));
    parts.push('');
    parts.push('/* ids */');
    parts.push(ids.map((c) => `#${c.token}  (${c.count})`).join(joiner));
    return parts.join('\n');
  }

  return [
    ...classes.map((c) => `.${c.token}  (${c.count})`),
    ...ids.map((c) => `#${c.token}  (${c.count})`),
  ].join(joiner);
}

export default function HtmlClassAttrExtractorTool() {
  const [mode, setMode] = useState<OutMode>('list');
  const [view, setView] = useState<View>('separate');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [excludeRe, setExcludeRe] = useState('');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const { classes, ids } = collect(input, ignoreCase, excludeRe);
      if (classes.length === 0 && ids.length === 0) return 'No classes or ids found.';
      return render(classes, ids, mode, view);
    },
    [mode, view, ignoreCase, excludeRe],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, view, ignoreCase, excludeRe]}
      inputLabel="HTML"
      outputLabel="Selectors"
      inputPlaceholder="Paste HTML…"
      sample={SAMPLE}
      downloadName="selectors.txt"
      options={
        <>
          <Field label="Output">
            <Select value={mode} onValueChange={(v) => setMode(v as OutMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Plain list</SelectItem>
                <SelectItem value="csv">Comma-separated</SelectItem>
                <SelectItem value="css">CSS stub</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="View">
            <Select value={view} onValueChange={(v) => setView(v as View)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="separate">Separate</SelectItem>
                <SelectItem value="combined">Combined</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ignore case">
            <Switch checked={ignoreCase} onCheckedChange={setIgnoreCase} />
          </Field>
          <Field label="Exclude regex" className="min-w-[180px]">
            <Input
              value={excludeRe}
              onChange={(e) => setExcludeRe(e.target.value)}
              placeholder="^(p|m|text)-"
            />
          </Field>
        </>
      }
    />
  );
}
