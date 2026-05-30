'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Pattern {
  name: string;
  pattern: string;
  desc: string;
  category: string;
  match: string;
  noMatch: string;
}

const DATA: Pattern[] = [
  {
    name: 'Email (RFC-lite)',
    pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
    desc: 'Pragmatic email address validation.',
    category: 'contact',
    match: 'jane.doe@example.co.uk',
    noMatch: 'jane@@example',
  },
  {
    name: 'URL (http/https)',
    pattern: "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
    desc: 'HTTP or HTTPS absolute URL.',
    category: 'web',
    match: 'https://example.com/path?q=1',
    noMatch: 'ftp://example.com',
  },
  {
    name: 'Domain name',
    pattern:
      "^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$",
    desc: 'Fully-qualified domain name.',
    category: 'web',
    match: 'sub.example.com',
    noMatch: '-bad.com',
  },
  {
    name: 'Slug',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    desc: 'Lowercase, hyphen-separated URL slug.',
    category: 'web',
    match: 'my-page-title',
    noMatch: 'My Page',
  },
  {
    name: 'Port number',
    pattern:
      '^(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3})$',
    desc: 'TCP/UDP port 1–65535.',
    category: 'network',
    match: '8080',
    noMatch: '70000',
  },
  {
    name: 'IPv4 address',
    pattern:
      '^(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})$',
    desc: 'Dotted-quad IPv4 address.',
    category: 'network',
    match: '192.168.0.1',
    noMatch: '256.1.1.1',
  },
  {
    name: 'IPv6 address',
    pattern:
      '^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})$',
    desc: 'Common IPv6 forms incl. :: compression.',
    category: 'network',
    match: '2001:db8::ff00:42:8329',
    noMatch: '1200::AB00::1234',
  },
  {
    name: 'MAC address',
    pattern: '^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$',
    desc: 'Colon or hyphen separated MAC address.',
    category: 'network',
    match: '01:23:45:67:89:AB',
    noMatch: '0123.4567.89AB',
  },
  {
    name: 'US phone',
    pattern:
      '^(?:\\+?1[-.\\s]?)?\\(?[2-9][0-9]{2}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}$',
    desc: 'North American phone number with optional formatting.',
    category: 'contact',
    match: '(415) 555-0132',
    noMatch: '12-3',
  },
  {
    name: 'International phone (E.164)',
    pattern: '^\\+[1-9]\\d{1,14}$',
    desc: 'E.164 international number.',
    category: 'contact',
    match: '+442071838750',
    noMatch: '0044 20 7183',
  },
  {
    name: 'ISO date (YYYY-MM-DD)',
    pattern:
      '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
    desc: 'Calendar date in ISO 8601 format.',
    category: 'datetime',
    match: '2026-05-30',
    noMatch: '2026-13-01',
  },
  {
    name: 'Time (24h HH:MM)',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
    desc: '24-hour clock time.',
    category: 'datetime',
    match: '23:59',
    noMatch: '24:00',
  },
  {
    name: 'ISO datetime',
    pattern:
      '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?$',
    desc: 'ISO 8601 timestamp with optional zone.',
    category: 'datetime',
    match: '2026-05-30T14:00:00Z',
    noMatch: '2026/05/30 14:00',
  },
  {
    name: 'Hex color',
    pattern: '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$',
    desc: '3-, 6-, or 8-digit hex color.',
    category: 'design',
    match: '#1e90ff',
    noMatch: '#12g',
  },
  {
    name: 'UUID v4',
    pattern:
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
    desc: 'RFC 4122 version-4 UUID.',
    category: 'id',
    match: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    noMatch: 'not-a-uuid',
  },
  {
    name: 'Username',
    pattern: '^[a-zA-Z0-9_]{3,16}$',
    desc: 'Alphanumeric/underscore, 3–16 chars.',
    category: 'id',
    match: 'cool_user99',
    noMatch: 'ab',
  },
  {
    name: 'Strong password',
    pattern:
      '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$',
    desc: '8+ chars with lower, upper, digit and symbol.',
    category: 'id',
    match: 'Str0ng!Pass',
    noMatch: 'password',
  },
  {
    name: 'Credit card',
    pattern:
      '^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$',
    desc: 'Visa / MasterCard / Amex / Discover numbers (no spaces).',
    category: 'id',
    match: '4111111111111111',
    noMatch: '1234567890123456',
  },
  {
    name: 'US ZIP code',
    pattern: '^\\d{5}(?:-\\d{4})?$',
    desc: '5-digit ZIP with optional +4.',
    category: 'postal',
    match: '94103-1234',
    noMatch: '9410',
  },
  {
    name: 'UK postcode',
    pattern:
      '^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$',
    desc: 'UK postal code (uppercase).',
    category: 'postal',
    match: 'SW1A 1AA',
    noMatch: '12345',
  },
  {
    name: 'Canadian postal code',
    pattern: '^[A-Za-z]\\d[A-Za-z]\\s?\\d[A-Za-z]\\d$',
    desc: 'Canadian alphanumeric postal code.',
    category: 'postal',
    match: 'K1A 0B1',
    noMatch: 'K1A0B',
  },
  {
    name: 'Semver',
    pattern:
      '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z-.]+)?(?:\\+[0-9A-Za-z-.]+)?$',
    desc: 'Semantic version with optional pre-release/build.',
    category: 'dev',
    match: '1.2.3-rc.1+build.5',
    noMatch: '1.2',
  },
  {
    name: 'Base64',
    pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
    desc: 'Standard Base64 (with padding).',
    category: 'dev',
    match: 'SGVsbG8=',
    noMatch: 'SGVsbG8*',
  },
  {
    name: 'JWT',
    pattern:
      '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]*$',
    desc: 'Three base64url segments separated by dots.',
    category: 'dev',
    match: 'aaa.bbb.ccc',
    noMatch: 'aaa.bbb',
  },
  {
    name: 'HTML tag',
    pattern: '<\\/?[a-zA-Z][a-zA-Z0-9]*\\b[^>]*>',
    desc: 'Opening or closing HTML tag.',
    category: 'web',
    match: '<div class="x">',
    noMatch: 'plain text',
  },
  {
    name: 'Leading/trailing whitespace',
    pattern: '^\\s+|\\s+$',
    desc: 'Whitespace at the start or end of a string.',
    category: 'text',
    match: '  trim me  ',
    noMatch: 'no-space',
  },
  {
    name: 'Multiple spaces',
    pattern: '\\s{2,}',
    desc: 'Runs of two or more whitespace characters.',
    category: 'text',
    match: 'a    b',
    noMatch: 'a b',
  },
  {
    name: 'Leading zeros',
    pattern: '^0+(?=\\d)',
    desc: 'One or more leading zeros before a digit.',
    category: 'text',
    match: '007',
    noMatch: '7',
  },
  {
    name: 'Integer',
    pattern: '^-?\\d+$',
    desc: 'Optional sign followed by digits.',
    category: 'number',
    match: '-42',
    noMatch: '4.2',
  },
  {
    name: 'Decimal number',
    pattern: '^-?\\d*\\.?\\d+$',
    desc: 'Signed integer or decimal.',
    category: 'number',
    match: '3.14',
    noMatch: '3.1.4',
  },
  {
    name: 'Currency (USD)',
    pattern: '^\\$?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?$',
    desc: 'US currency with optional $ and thousands separators.',
    category: 'number',
    match: '$1,299.00',
    noMatch: '1.2.3',
  },
  {
    name: 'Hashtag',
    pattern: '#[A-Za-z0-9_]+',
    desc: 'Social-media style hashtag.',
    category: 'text',
    match: '#regex101',
    noMatch: '# spaced',
  },
];

export default function RegexPatternLibraryTool() {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DATA;
    return DATA.filter((d) =>
      `${d.name} ${d.desc} ${d.category} ${d.pattern}`.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <Panel>
      <PanelHeader title="Regex Patterns">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, category or description…"
          className="h-7 w-72"
          spellCheck={false}
        />
      </PanelHeader>
      <div className="max-h-[600px] divide-y overflow-auto">
        {rows.map((r) => (
          <div key={r.name} className="space-y-2 px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{r.name}</span>
              <Badge variant="secondary" className="text-2xs">
                {r.category}
              </Badge>
              <span className="ml-auto" />
              <CopyButton value={r.pattern} size="icon-sm" />
            </div>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
            <code className="block overflow-x-auto whitespace-pre rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
              {r.pattern}
            </code>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-2xs">
              <span className="text-emerald-600 dark:text-emerald-400">
                matches: <code className="font-mono">{r.match}</code>
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                no match: <code className="font-mono">{r.noMatch}</code>
              </span>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No patterns match “{q}”.
          </div>
        )}
      </div>
      <StatBar items={[`${rows.length} of ${DATA.length} patterns`]} />
    </Panel>
  );
}
