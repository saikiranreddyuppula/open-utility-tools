'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `The National Aeronautics and Space Administration (NASA) leads space exploration.
We use a Content Delivery Network (CDN) for assets, and the API (Application Programming Interface) is documented.
HTTP and HTML are common. The U.S.A. has many agencies. Our SLA covers uptime.`;

// Build a case-insensitive word-boundary check for acronym near its expansion.
function buildAcronymRegex(allowDigitsDots: boolean): RegExp {
  // All-caps token of 2+ letters, optionally allowing digits and internal periods.
  const core = allowDigitsDots
    ? '[A-Z](?:[A-Z0-9.]*[A-Z0-9])'
    : '[A-Z][A-Z]+';
  return new RegExp(`\\b${core}\\b`, 'g');
}

// Concatenated first letters of the given words, uppercased.
function initials(words: string[]): string {
  return words
    .map((w) => {
      const c = w[0];
      return c ?? '';
    })
    .join('')
    .toUpperCase();
}

interface Found {
  acronym: string;
  expansion: string;
  count: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findExpansion(text: string, acronym: string): string {
  const clean = acronym.replace(/\./g, '');
  const esc = escapeRegExp(acronym);
  // Pattern 1: "Expansion (ACRONYM)" — capture up to clean.length words before "(ACRONYM)".
  const n = clean.length;
  const wordsBefore = `((?:[A-Za-z][A-Za-z'-]*\\s+){${Math.max(1, n - 1)},${n + 2}})\\(\\s*${esc}\\s*\\)`;
  const re1 = new RegExp(wordsBefore, 'g');
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    const phrase = m[1];
    if (!phrase) continue;
    const cand = pickPhrase(phrase, clean);
    if (cand) return cand;
  }
  // Pattern 2: "ACRONYM (Expansion)".
  const re2 = new RegExp(`${esc}\\s*\\(\\s*([A-Za-z][A-Za-z'\\- ]*?)\\s*\\)`, 'g');
  while ((m = re2.exec(text)) !== null) {
    const phrase = m[1];
    if (!phrase) continue;
    const cand = pickPhrase(phrase, clean);
    if (cand) return cand;
  }
  return '';
}

// Given a candidate phrase, trim it to the words whose initials match the acronym.
function pickPhrase(phrase: string, clean: string): string {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const target = clean.toUpperCase();
  // Try taking exactly the last `target.length` significant words.
  for (let take = target.length; take <= words.length && take <= target.length + 2; take++) {
    const slice = words.slice(words.length - take);
    if (initials(slice).includes(target) || target.includes(initials(slice))) {
      // Accept if first letters line up well enough.
      const init = initials(slice);
      if (init === target) return slice.join(' ');
    }
  }
  // Fallback: whole phrase if its initials match the target.
  if (initials(words) === target) return words.join(' ');
  return '';
}

export default function AcronymExtractorTool() {
  const [allowDigitsDots, setAllowDigitsDots] = useState(true);

  return (
    <TextToolLayout
      deps={[allowDigitsDots]}
      transform={(input) => {
        if (!input.trim()) return '';
        const re = buildAcronymRegex(allowDigitsDots);
        const counts = new Map<string, number>();
        let m: RegExpExecArray | null;
        while ((m = re.exec(input)) !== null) {
          const tok = m[0];
          if (!tok) continue;
          // Require at least 2 letters of substance.
          const letters = tok.replace(/[^A-Z]/g, '');
          if (letters.length < 2) continue;
          counts.set(tok, (counts.get(tok) ?? 0) + 1);
        }
        if (counts.size === 0) return 'No acronyms found.';

        const rows: Found[] = [];
        for (const [acronym, count] of counts) {
          rows.push({ acronym, expansion: findExpansion(input, acronym), count });
        }
        rows.sort((a, b) => (b.count - a.count) || a.acronym.localeCompare(b.acronym));

        const accW = Math.max(7, ...rows.map((r) => r.acronym.length));
        const header = `${'ACRONYM'.padEnd(accW)}  COUNT  EXPANSION`;
        const lines = rows.map(
          (r) =>
            `${r.acronym.padEnd(accW)}  ${String(r.count).padStart(5)}  ${r.expansion || '—'}`,
        );
        return [header, '-'.repeat(header.length), ...lines].join('\n');
      }}
      inputLabel="Text"
      outputLabel="Acronyms & expansions"
      sample={SAMPLE}
      downloadName="acronyms.txt"
      options={
        <Field label="Allow digits & periods (e.g. U.S.A., H2)">
          <Switch checked={allowDigitsDots} onCheckedChange={setAllowDigitsDots} />
        </Field>
      }
    />
  );
}
