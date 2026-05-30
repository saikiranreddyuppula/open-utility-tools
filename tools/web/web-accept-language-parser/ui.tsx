'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'parse' | 'build';

interface Entry {
  value: string;
  q: number;
  raw: string;
}

// Parse one "value;q=0.8;other=x" segment. q defaults to 1.0.
function parseEntry(segment: string): Entry | { error: string } {
  const parts = segment.split(';');
  const value = (parts[0] ?? '').trim();
  if (!value) return { error: `Empty entry: "${segment.trim()}"` };
  let q = 1;
  for (let i = 1; i < parts.length; i += 1) {
    const param = (parts[i] ?? '').trim();
    if (!param) continue;
    const eq = param.indexOf('=');
    if (eq === -1) continue;
    const key = param.slice(0, eq).trim().toLowerCase();
    const val = param.slice(eq + 1).trim();
    if (key === 'q') {
      const n = Number(val);
      if (!Number.isFinite(n)) return { error: `Invalid q value "${val}" in "${segment.trim()}"` };
      if (n < 0 || n > 1) return { error: `q must be between 0 and 1 (got ${val})` };
      q = n;
    }
  }
  return { value, q, raw: segment.trim() };
}

function parseHeader(input: string): string {
  // Headers may be on multiple lines; join then split on commas.
  const joined = input.replace(/\r?\n/g, ',');
  const segments = joined.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length === 0) throw new Error('Paste an Accept-Language or Accept header value.');

  const entries: Entry[] = [];
  for (const seg of segments) {
    const e = parseEntry(seg);
    if ('error' in e) throw new Error(e.error);
    entries.push(e);
  }

  // Stable sort by descending q; ties keep original order (per RFC: server-defined).
  const ranked = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.q - a.e.q) || (a.i - b.i))
    .map((x) => x.e);

  const lines: string[] = [];
  const top = ranked[0];
  if (top) lines.push(`Preferred: ${top.value} (q=${top.q})`);
  lines.push('');
  lines.push('Rank  q       value');
  lines.push('----  ------  -----');
  ranked.forEach((e, idx) => {
    const rank = String(idx + 1).padStart(2, ' ');
    const qStr = e.q.toFixed(3).padEnd(6, ' ');
    lines.push(`  ${rank}  ${qStr}  ${e.value}`);
  });
  lines.push('');
  lines.push(`${ranked.length} entr${ranked.length === 1 ? 'y' : 'ies'} parsed.`);
  return lines.join('\n');
}

// Build mode: each input line is "value" or "value 0.8" or "value q=0.8".
function buildHeader(input: string): string {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Enter one entry per line, e.g. "en-US" or "fr 0.8".');

  const parts: string[] = [];
  for (const line of lines) {
    // Accept "value 0.8", "value q=0.8", or "value;q=0.8".
    const norm = line.replace(/;\s*q\s*=/i, ' ').replace(/\bq\s*=/i, ' ');
    const tokens = norm.split(/\s+/).filter((t) => t.length > 0);
    const value = tokens[0];
    if (!value) continue;
    const qTok = tokens[1];
    if (qTok === undefined) {
      parts.push(value);
      continue;
    }
    const q = Number(qTok);
    if (!Number.isFinite(q) || q < 0 || q > 1) {
      throw new Error(`Invalid weight "${qTok}" for "${value}" (q must be 0–1).`);
    }
    parts.push(q === 1 ? value : `${value};q=${q}`);
  }
  if (parts.length === 0) throw new Error('No valid entries found.');
  return parts.join(',');
}

const SAMPLE_PARSE = 'en-US,en;q=0.9,fr-CA;q=0.8,fr;q=0.7,*;q=0.5';
const SAMPLE_BUILD = 'en-US\nen 0.9\nfr 0.8\n* 0.5';

export default function AcceptLanguageParserTool() {
  const [mode, setMode] = useState<Mode>('parse');

  return (
    <TextToolLayout
      deps={[mode]}
      transform={(input) => {
        if (!input.trim()) return '';
        return mode === 'parse' ? parseHeader(input) : buildHeader(input);
      }}
      inputLabel={mode === 'parse' ? 'Accept-Language / Accept header' : 'Entries (one per line: value [weight])'}
      outputLabel={mode === 'parse' ? 'Sorted by q-factor' : 'Assembled header'}
      sample={mode === 'parse' ? SAMPLE_PARSE : SAMPLE_BUILD}
      downloadName={mode === 'parse' ? 'accept-parsed.txt' : 'accept-header.txt'}
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="parse">Parse</TabsTrigger>
              <TabsTrigger value="build">Build</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
