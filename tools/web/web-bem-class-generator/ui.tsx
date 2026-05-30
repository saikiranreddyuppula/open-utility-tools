'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function slugify(input: string, wordSep: string): string {
  const cleaned = input
    .trim()
    // split camelCase into words
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    // anything not alphanumeric becomes a boundary
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).join(wordSep);
}

interface ModSpec {
  key: string;
  value: string;
}

function parseModifiers(raw: string): ModSpec[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { key: line, value: '' };
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return { key, value };
    });
}

interface Result {
  base: string;
  modifierClasses: string[];
  full: string;
  html: string;
  css: string;
}

function build(
  blockRaw: string,
  elementRaw: string,
  modsRaw: string,
  elSep: string,
  modSep: string,
  wordSep: string,
): { ok: true; value: Result } | { ok: false; error: string } {
  const block = slugify(blockRaw, wordSep);
  if (!block) return { ok: false, error: 'Enter a block name.' };

  const element = slugify(elementRaw, wordSep);
  const base = element ? `${block}${elSep}${element}` : block;

  const mods = parseModifiers(modsRaw);
  const modifierClasses: string[] = [];
  for (const m of mods) {
    const key = slugify(m.key, wordSep);
    if (!key) continue;
    const value = slugify(m.value, wordSep);
    const mod = value ? `${key}${wordSep}${value}` : key;
    modifierClasses.push(`${base}${modSep}${mod}`);
  }

  const full = [base, ...modifierClasses].join(' ');

  const html = `<div class="${full}"></div>`;

  const cssParts: string[] = [];
  cssParts.push(`.${block} {\n  /* block */\n}`);
  if (element) cssParts.push(`.${base} {\n  /* element */\n}`);
  for (const mc of modifierClasses) {
    cssParts.push(`.${mc} {\n  /* modifier */\n}`);
  }
  const css = cssParts.join('\n\n');

  return { ok: true, value: { base, modifierClasses, full, html, css } };
}

export default function BemClassGeneratorTool() {
  const [block, setBlock] = useState('card');
  const [element, setElement] = useState('title');
  const [mods, setMods] = useState('large\ntheme: dark\nactive');
  const [elSep, setElSep] = useState('__');
  const [modSep, setModSep] = useState('--');
  const [wordSep, setWordSep] = useState('-');

  const result = useMemo(
    () => build(block, element, mods, elSep, modSep, wordSep),
    [block, element, mods, elSep, modSep, wordSep],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Block" className="min-w-[160px]">
            <Input value={block} onChange={(e) => setBlock(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Element (optional)" className="min-w-[160px]">
            <Input
              value={element}
              onChange={(e) => setElement(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Field label="Element sep" className="w-24">
            <Input value={elSep} onChange={(e) => setElSep(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Modifier sep" className="w-24">
            <Input
              value={modSep}
              onChange={(e) => setModSep(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Word sep" className="w-24">
            <Input
              value={wordSep}
              onChange={(e) => setWordSep(e.target.value)}
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Modifiers — one per line, optional key:value" />
        <div className="p-3">
          <Textarea
            value={mods}
            onChange={(e) => setMods(e.target.value)}
            spellCheck={false}
            rows={4}
            className="font-mono text-xs"
            placeholder={'large\ntheme: dark\nactive'}
          />
        </div>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="className">
              <CopyButton value={() => result.value.full} />
            </PanelHeader>
            <div className="space-y-2 p-3">
              <code className="block overflow-x-auto whitespace-pre rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
                {result.value.full}
              </code>
              <div className="flex flex-wrap gap-2">
                <ClassChip label={result.value.base} />
                {result.value.modifierClasses.map((c) => (
                  <ClassChip key={c} label={c} />
                ))}
              </div>
            </div>
            <StatBar
              items={[
                `1 base + ${result.value.modifierClasses.length} modifier(s)`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="HTML">
              <CopyButton value={() => result.value.html} />
            </PanelHeader>
            <div className="p-3">
              <code className="block overflow-x-auto whitespace-pre rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                {result.value.html}
              </code>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="CSS skeleton">
              <CopyButton value={() => result.value.css} />
            </PanelHeader>
            <div className="p-3">
              <pre className="overflow-x-auto rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                {result.value.css}
              </pre>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function ClassChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs">
      {label}
      <CopyButton value={label} size="icon-sm" />
    </span>
  );
}
