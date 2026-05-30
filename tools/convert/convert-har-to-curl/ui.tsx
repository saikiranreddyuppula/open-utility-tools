'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = JSON.stringify(
  {
    log: {
      version: '1.2',
      entries: [
        {
          request: {
            method: 'POST',
            url: 'https://api.example.com/v1/login?ref=home',
            headers: [
              { name: ':authority', value: 'api.example.com' },
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Authorization', value: 'Bearer abc123' },
              { name: 'User-Agent', value: 'Mozilla/5.0' },
            ],
            postData: {
              mimeType: 'application/json',
              text: '{"user":"ada","pass":"secret"}',
            },
          },
        },
      ],
    },
  },
  null,
  2
);

interface HarHeader {
  name?: unknown;
  value?: unknown;
}
interface HarRequest {
  method?: unknown;
  url?: unknown;
  headers?: unknown;
  postData?: { text?: unknown; mimeType?: unknown } | undefined;
}

/** Headers that should not be replayed (pseudo-headers + browser-managed). */
const SKIP_HEADERS = new Set([
  'content-length',
  'host',
  'connection',
  'accept-encoding',
]);

function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, `'\\''`) + "'";
}

function isEssential(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'content-type' || n === 'authorization' || n === 'accept' || n === 'cookie';
}

export default function HarToCurlTool() {
  const [allHeaders, setAllHeaders] = useState(true);
  const [multiline, setMultiline] = useState(true);
  const [longFlags, setLongFlags] = useState(false);

  return (
    <TextToolLayout
      deps={[allHeaders, multiline, longFlags]}
      transform={(input) => {
        const text = input.trim();
        if (!text) return '';

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Input is not valid JSON.');
        }

        // Collect requests: full HAR log, an entry, or a bare request object.
        const requests: HarRequest[] = [];
        const obj = parsed as Record<string, unknown>;
        const log = obj.log as Record<string, unknown> | undefined;
        const entries = log?.entries;
        if (Array.isArray(entries)) {
          for (const e of entries) {
            const req = (e as Record<string, unknown>)?.request;
            if (req && typeof req === 'object') requests.push(req as HarRequest);
          }
        } else if (obj.request && typeof obj.request === 'object') {
          requests.push(obj.request as HarRequest);
        } else if (obj.url || obj.method) {
          requests.push(obj as HarRequest);
        }

        if (requests.length === 0) throw new Error('No HAR request found (expected log.entries[].request or a request object).');

        const sep = multiline ? ' \\\n  ' : ' ';
        const methodFlag = longFlags ? '--request' : '-X';
        const headerFlag = longFlags ? '--header' : '-H';
        const dataFlag = longFlags ? '--data' : '-d';

        const commands = requests.map((req) => {
          const method = typeof req.method === 'string' ? req.method.toUpperCase() : 'GET';
          const url = typeof req.url === 'string' ? req.url : '';
          const parts: string[] = ['curl'];
          if (method !== 'GET') parts.push(`${methodFlag} ${method}`);
          parts.push(shellSingleQuote(url));

          const rawHeaders = Array.isArray(req.headers) ? (req.headers as HarHeader[]) : [];
          for (const h of rawHeaders) {
            const name = typeof h.name === 'string' ? h.name : '';
            const value = typeof h.value === 'string' ? h.value : '';
            if (!name || name.startsWith(':')) continue; // pseudo-headers
            if (SKIP_HEADERS.has(name.toLowerCase())) continue;
            if (!allHeaders && !isEssential(name)) continue;
            parts.push(`${headerFlag} ${shellSingleQuote(`${name}: ${value}`)}`);
          }

          const bodyText = req.postData && typeof req.postData.text === 'string' ? req.postData.text : '';
          if (bodyText) parts.push(`${dataFlag} ${shellSingleQuote(bodyText)}`);

          return parts.join(sep);
        });

        return commands.join('\n\n');
      }}
      inputLabel="HAR JSON"
      outputLabel="cURL"
      sample={SAMPLE}
      downloadName="requests.sh"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Headers">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={allHeaders} onCheckedChange={setAllHeaders} />
              {allHeaders ? 'All headers' : 'Essential only'}
            </label>
          </Field>
          <Field label="Line continuation">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={multiline} onCheckedChange={setMultiline} />
              {multiline ? 'Multi-line' : 'Single line'}
            </label>
          </Field>
          <Field label="Flag style">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={longFlags} onCheckedChange={setLongFlags} />
              {longFlags ? 'Long (--header)' : 'Short (-H)'}
            </label>
          </Field>
        </>
      }
    />
  );
}
