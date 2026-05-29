'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface RegexEntry {
  token: string;
  desc: string;
}

interface RegexSection {
  category: string;
  entries: RegexEntry[];
}

const REFERENCE: RegexSection[] = [
  {
    category: 'Character classes',
    entries: [
      { token: '.', desc: 'Any character except newline' },
      { token: '\\d', desc: 'Digit (0-9)' },
      { token: '\\D', desc: 'Not a digit' },
      { token: '\\w', desc: 'Word character (a-z, A-Z, 0-9, _)' },
      { token: '\\W', desc: 'Not a word character' },
      { token: '\\s', desc: 'Whitespace (space, tab, newline)' },
      { token: '\\S', desc: 'Not whitespace' },
      { token: '[abc]', desc: 'Any one of a, b, or c' },
      { token: '[^abc]', desc: 'Any character except a, b, or c' },
      { token: '[a-z]', desc: 'Character in the range a to z' },
    ],
  },
  {
    category: 'Anchors & boundaries',
    entries: [
      { token: '^', desc: 'Start of string (or line in multiline mode)' },
      { token: '$', desc: 'End of string (or line in multiline mode)' },
      { token: '\\b', desc: 'Word boundary' },
      { token: '\\B', desc: 'Not a word boundary' },
    ],
  },
  {
    category: 'Quantifiers',
    entries: [
      { token: '*', desc: '0 or more' },
      { token: '+', desc: '1 or more' },
      { token: '?', desc: '0 or 1 (optional)' },
      { token: '{n}', desc: 'Exactly n times' },
      { token: '{n,}', desc: 'n or more times' },
      { token: '{n,m}', desc: 'Between n and m times' },
      { token: '*?', desc: 'Lazy: as few as possible' },
    ],
  },
  {
    category: 'Groups & lookarounds',
    entries: [
      { token: '(abc)', desc: 'Capturing group' },
      { token: '(?:abc)', desc: 'Non-capturing group' },
      { token: '(?<name>abc)', desc: 'Named capturing group' },
      { token: 'a|b', desc: 'Alternation: a or b' },
      { token: '(?=abc)', desc: 'Positive lookahead' },
      { token: '(?!abc)', desc: 'Negative lookahead' },
      { token: '(?<=abc)', desc: 'Positive lookbehind' },
      { token: '(?<!abc)', desc: 'Negative lookbehind' },
      { token: '\\1', desc: 'Backreference to group 1' },
    ],
  },
  {
    category: 'Flags',
    entries: [
      { token: 'g', desc: 'Global: find all matches' },
      { token: 'i', desc: 'Case-insensitive' },
      { token: 'm', desc: 'Multiline: ^ and $ match line breaks' },
      { token: 's', desc: 'Dotall: . matches newline' },
      { token: 'u', desc: 'Unicode mode' },
      { token: 'y', desc: 'Sticky: match from lastIndex only' },
    ],
  },
];

interface Snippet {
  name: string;
  pattern: string;
  desc: string;
}

const SNIPPETS: Snippet[] = [
  {
    name: 'Email',
    pattern: "^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$",
    desc: 'Pragmatic email address match (not RFC-exhaustive).',
  },
  {
    name: 'URL (http/https)',
    pattern: "https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#[\\]@!$&'()*+,;=]*",
    desc: 'Matches http or https URLs.',
  },
  {
    name: 'IPv4 address',
    pattern:
      '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    desc: 'Matches a valid IPv4 address (0-255 per octet).',
  },
  {
    name: 'Date (YYYY-MM-DD)',
    pattern: '\\b\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b',
    desc: 'ISO-style date with basic month/day range checks.',
  },
  {
    name: 'Time (HH:MM 24h)',
    pattern: '\\b(?:[01]\\d|2[0-3]):[0-5]\\d\\b',
    desc: '24-hour time, optionally extend with :ss.',
  },
  {
    name: 'Hex color',
    pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b',
    desc: 'Matches #fff or #ffffff style hex colors.',
  },
  {
    name: 'Slug',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    desc: 'Lowercase, hyphen-separated URL slug.',
  },
  {
    name: 'UUID v4',
    pattern:
      '\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b',
    desc: 'Matches a version-4 UUID.',
  },
  {
    name: 'US phone',
    pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}',
    desc: 'Common US phone number formats.',
  },
  {
    name: 'Strong password',
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$',
    desc: 'At least 8 chars with lower, upper, digit, and symbol.',
  },
  {
    name: 'Leading/trailing whitespace',
    pattern: '^\\s+|\\s+$',
    desc: 'Use with the g flag to trim each line.',
  },
];

function matches(query: string, ...fields: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(q));
}

export default function RegexCheatsheetTool() {
  const [query, setQuery] = useState('');

  const filteredSnippets = useMemo(
    () => SNIPPETS.filter((s) => matches(query, s.name, s.pattern, s.desc)),
    [query],
  );

  const filteredReference = useMemo(
    () =>
      REFERENCE.map((section) => ({
        category: section.category,
        entries: section.entries.filter((e) =>
          matches(query, e.token, e.desc, section.category),
        ),
      })).filter((section) => section.entries.length > 0),
    [query],
  );

  const noResults = filteredSnippets.length === 0 && filteredReference.length === 0;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Regex reference" />
        <OptionsBar>
          <Field label="Search" className="w-full" hint="Filter tokens, snippets, and descriptions">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="email, lookahead, \d, quantifier…"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {noResults ? (
        <Panel>
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No matches for “{query}”.
          </div>
        </Panel>
      ) : null}

      {filteredSnippets.length > 0 ? (
        <Panel>
          <PanelHeader title="Ready-made patterns" />
          <div className="divide-y">
            {filteredSnippets.map((s) => (
              <div key={s.name} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <code className="block break-all rounded bg-muted px-1.5 py-1 font-mono text-xs">
                    {s.pattern}
                  </code>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <CopyButton value={s.pattern} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {filteredReference.map((section) => (
        <Panel key={section.category}>
          <PanelHeader title={section.category} />
          <div className="divide-y">
            {section.entries.map((e) => (
              <div
                key={`${section.category}-${e.token}`}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {e.token}
                  </code>
                  <span className="truncate text-sm text-muted-foreground">{e.desc}</span>
                </div>
                <CopyButton value={e.token} />
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
