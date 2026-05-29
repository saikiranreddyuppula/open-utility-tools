'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Format = 'report' | 'json';

interface UrlBreakdown {
  href: string;
  protocol: string;
  scheme: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  origin: string;
  pathname: string;
  pathSegments: string[];
  search: string;
  query: { key: string; value: string }[];
  hash: string;
  fragment: string;
}

function inspect(raw: string): UrlBreakdown {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL. Include a scheme, e.g. https://example.com/path?x=1');
  }
  const pathSegments = url.pathname
    .split('/')
    .filter((s) => s !== '')
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const query: { key: string; value: string }[] = [];
  url.searchParams.forEach((value, key) => {
    query.push({ key, value });
  });
  return {
    href: url.href,
    protocol: url.protocol,
    scheme: url.protocol.replace(/:$/, ''),
    username: url.username,
    password: url.password,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    origin: url.origin,
    pathname: url.pathname,
    pathSegments,
    search: url.search,
    query,
    hash: url.hash,
    fragment: url.hash.replace(/^#/, ''),
  };
}

function toReport(b: UrlBreakdown): string {
  const lines: string[] = [];
  const row = (label: string, value: string) => {
    lines.push(label.padEnd(12) + (value === '' ? '(empty)' : value));
  };
  lines.push('COMPONENTS');
  lines.push('----------');
  row('Scheme', b.scheme);
  row('Username', b.username);
  row('Password', b.password === '' ? '' : '••••••');
  row('Hostname', b.hostname);
  row('Port', b.port);
  row('Origin', b.origin);
  row('Path', b.pathname);
  row('Query', b.search);
  row('Fragment', b.fragment);

  lines.push('');
  lines.push('PATH SEGMENTS (' + b.pathSegments.length + ')');
  lines.push('-------------');
  if (b.pathSegments.length === 0) {
    lines.push('(none)');
  } else {
    b.pathSegments.forEach((seg, i) => {
      lines.push('[' + i + '] ' + seg);
    });
  }

  lines.push('');
  lines.push('QUERY PARAMETERS (' + b.query.length + ')');
  lines.push('----------------');
  if (b.query.length === 0) {
    lines.push('(none)');
  } else {
    b.query.forEach((p, i) => {
      let decoded = p.value;
      try {
        decoded = decodeURIComponent(p.value);
      } catch {
        // keep raw
      }
      lines.push('[' + i + '] ' + p.key + ' = ' + (decoded === '' ? '(empty)' : decoded));
    });
  }

  return lines.join('\n');
}

export default function UrlInspectorTool() {
  const [format, setFormat] = useState<Format>('report');

  const transform = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return '';
      const b = inspect(trimmed);
      if (format === 'json') {
        return JSON.stringify(
          {
            href: b.href,
            scheme: b.scheme,
            username: b.username,
            password: b.password,
            hostname: b.hostname,
            port: b.port,
            origin: b.origin,
            pathname: b.pathname,
            pathSegments: b.pathSegments,
            query: Object.fromEntries(b.query.map((q) => [q.key, q.value])),
            queryList: b.query,
            fragment: b.fragment,
          },
          null,
          2,
        );
      }
      return toReport(b);
    },
    [format],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[format]}
      inputLabel="URL"
      outputLabel="Breakdown"
      inputPlaceholder="https://user@example.com:8080/a/b?x=1&y=2#section"
      sample="https://user:pass@api.example.com:8443/v2/users/42?page=2&sort=name&q=hello%20world#results"
      downloadName={format === 'json' ? 'url.json' : 'url-breakdown.txt'}
      downloadMime={format === 'json' ? 'application/json' : 'text/plain'}
      options={
        <Field label="Output">
          <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList>
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
