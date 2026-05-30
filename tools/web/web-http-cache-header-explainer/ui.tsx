'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

interface DirInfo {
  takesValue: boolean;
  valueIsSeconds?: boolean;
  explain: (v: string | null) => string;
}

function humanizeSeconds(raw: string | null): string {
  if (raw == null) return '(no value)';
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return `${raw} (invalid number)`;
  if (n === 0) return '0 seconds (immediate revalidation)';
  const units: Array<[number, string]> = [
    [86400 * 365, 'year'],
    [86400 * 30, 'month'],
    [86400 * 7, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  const parts: string[] = [];
  let rem = n;
  for (const [size, label] of units) {
    if (rem >= size) {
      const c = Math.floor(rem / size);
      rem -= c * size;
      parts.push(`${c} ${label}${c === 1 ? '' : 's'}`);
    }
    if (parts.length >= 2) break;
  }
  return `${n.toLocaleString()} s = ${parts.join(', ')}`;
}

const DIRECTIVES: Record<string, DirInfo> = {
  'max-age': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) => `Response is fresh for ${humanizeSeconds(v)}. After that, it is stale and must be revalidated.`,
  },
  's-maxage': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) => `Overrides max-age for shared caches (CDNs/proxies): fresh for ${humanizeSeconds(v)}.`,
  },
  'no-cache': {
    takesValue: false,
    explain: () =>
      'May be stored, but the cache MUST revalidate with the origin before reuse. Does NOT mean "do not store".',
  },
  'no-store': {
    takesValue: false,
    explain: () => 'MUST NOT store any part of the request or response anywhere. Strongest privacy directive.',
  },
  private: {
    takesValue: false,
    explain: () => 'May be cached only by the end-user (browser), never by shared caches like CDNs.',
  },
  public: {
    takesValue: false,
    explain: () => 'May be cached by any cache, even if it would normally not be (e.g. authenticated responses).',
  },
  'must-revalidate': {
    takesValue: false,
    explain: () => 'Once stale, the cache MUST revalidate; it may not serve the stale copy on a network error.',
  },
  'proxy-revalidate': {
    takesValue: false,
    explain: () => 'Like must-revalidate, but applies only to shared (proxy) caches.',
  },
  immutable: {
    takesValue: false,
    explain: () => 'The body will not change while fresh; browsers skip revalidation even on reload. Pair with a long max-age.',
  },
  'stale-while-revalidate': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) =>
      `After going stale, the cache may serve the stale copy for ${humanizeSeconds(v)} while it revalidates in the background.`,
  },
  'stale-if-error': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) => `On an origin error, a stale copy may be served for up to ${humanizeSeconds(v)}.`,
  },
  'no-transform': {
    takesValue: false,
    explain: () => 'Intermediaries must not alter the payload (e.g. recompress images).',
  },
  'only-if-cached': {
    takesValue: false,
    explain: () => 'Request directive: return a cached response or a 504; do not contact the origin.',
  },
  'max-stale': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) => (v == null ? 'Client accepts any stale response.' : `Client accepts a response stale by up to ${humanizeSeconds(v)}.`),
  },
  'min-fresh': {
    takesValue: true,
    valueIsSeconds: true,
    explain: (v) => `Client wants a response that stays fresh for at least ${humanizeSeconds(v)}.`,
  },
};

interface Parsed {
  name: string;
  value: string | null;
}

function parse(header: string): Parsed[] {
  // Split on commas not inside quotes.
  const out: Parsed[] = [];
  for (const seg of header.split(',')) {
    const token = seg.trim();
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq === -1) {
      out.push({ name: token.toLowerCase(), value: null });
    } else {
      const name = token.slice(0, eq).trim().toLowerCase();
      let value = token.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
        value = value.slice(1, -1);
      }
      out.push({ name, value });
    }
  }
  return out;
}

function explain(headerRaw: string): string {
  let header = headerRaw.trim();
  if (!header) return '';
  // Allow pasting the whole header line.
  const colon = header.indexOf(':');
  if (colon !== -1 && /^cache-control$/i.test(header.slice(0, colon).trim())) {
    header = header.slice(colon + 1).trim();
  }

  const parsed = parse(header);
  if (parsed.length === 0) return 'No directives found.';

  const lines: string[] = [];
  const names = new Set(parsed.map((p) => p.name));

  for (const { name, value } of parsed) {
    const info = DIRECTIVES[name];
    if (!info) {
      lines.push(`• ${name}${value != null ? '=' + value : ''}`);
      lines.push(`    Unknown or extension directive.`);
      lines.push('');
      continue;
    }
    const display = value != null ? `${name}=${value}` : name;
    lines.push(`• ${display}`);
    lines.push(`    ${info.explain(value)}`);
    if (info.takesValue && value == null) {
      lines.push(`    Warning: this directive normally requires a value.`);
    }
    if (!info.takesValue && value != null) {
      lines.push(`    Warning: this directive does not take a value; "${value}" is ignored.`);
    }
    lines.push('');
  }

  // Conflict notes.
  const conflicts: string[] = [];
  if (names.has('no-store') && (names.has('max-age') || names.has('public') || names.has('s-maxage'))) {
    conflicts.push('no-store overrides any freshness directive (max-age/public/s-maxage). Nothing will be cached.');
  }
  if (names.has('no-cache') && names.has('immutable')) {
    conflicts.push('no-cache forces revalidation while immutable tries to skip it — no-cache wins; immutable is moot.');
  }
  if (names.has('public') && names.has('private')) {
    conflicts.push('public and private are contradictory; behavior depends on the cache, usually treated as private.');
  }
  if (names.has('no-cache') && names.has('max-age')) {
    conflicts.push('no-cache requires revalidation regardless of max-age, so the max-age freshness window has no effect.');
  }

  if (conflicts.length > 0) {
    lines.push('Conflicts / notes:');
    for (const c of conflicts) lines.push(`  ! ${c}`);
  }

  return lines.join('\n').trimEnd();
}

export default function CacheControlExplainerTool() {
  const transform = useCallback((input: string) => explain(input), []);
  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Cache-Control"
      outputLabel="Explanation"
      inputPlaceholder="public, max-age=3600, must-revalidate"
      sample="public, max-age=31536000, s-maxage=600, stale-while-revalidate=86400, immutable"
      downloadName="cache-control.txt"
    />
  );
}
