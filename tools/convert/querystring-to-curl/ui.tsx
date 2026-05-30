'use client';

import { useCallback, useState } from 'react';
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
import { TextToolLayout } from '@/components/tools/text-tool';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Mode = 'query' | 'data';

const SAMPLE = 'q=hello world&page=2&tags=a&tags=b&sort=desc';

// Single-quote a string for POSIX shells: wrap in '...', escaping embedded quotes.
function shellQuote(s: string): string {
  if (s === '') return "''";
  if (/^[A-Za-z0-9_./:=@%+,-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function splitInput(raw: string): { base: string; query: string } {
  const trimmed = raw.trim();
  // If the input looks like a full URL, split on the first '?'.
  const qIdx = trimmed.indexOf('?');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) && qIdx !== -1) {
    return { base: trimmed.slice(0, qIdx), query: trimmed.slice(qIdx + 1) };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return { base: trimmed, query: '' };
  }
  return { base: '', query: trimmed.replace(/^\?/, '') };
}

export default function QueryStringToCurlTool() {
  const [baseUrl, setBaseUrl] = useState('https://api.example.com/search');
  const [method, setMethod] = useState<Method>('GET');
  const [mode, setMode] = useState<Mode>('query');
  const [perLine, setPerLine] = useState(true);
  const [longFlags, setLongFlags] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim() && !baseUrl.trim()) return '';
      const { base: inlineBase, query } = splitInput(input);
      const url = (baseUrl.trim() || inlineBase).trim();
      if (url === '') throw new Error('Provide a base URL (in the field or as a full URL in the input).');

      const params = new URLSearchParams(query);
      const pairs: { key: string; value: string }[] = [];
      params.forEach((value, key) => pairs.push({ key, value }));

      const sep = perLine ? ' \\\n  ' : ' ';
      const requestFlag = longFlags ? '--request' : '-X';
      const dataFlag = '--data-urlencode';
      const getFlag = longFlags ? '--get' : '-G';

      const segments: string[] = ['curl'];

      if (mode === 'data') {
        // Send params as --data-urlencode pairs; -G turns them into a query for GET.
        segments.push(`${requestFlag} ${method}`);
        if (method === 'GET') segments.push(getFlag);
        segments.push(shellQuote(url));
        for (const p of pairs) {
          segments.push(`${dataFlag} ${shellQuote(`${p.key}=${p.value}`)}`);
        }
      } else {
        // Append the encoded query directly onto the URL.
        const encoded = pairs
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&');
        const full = encoded ? `${url}?${encoded}` : url;
        if (method !== 'GET') segments.push(`${requestFlag} ${method}`);
        segments.push(shellQuote(full));
      }

      return segments.join(sep);
    },
    [baseUrl, method, mode, perLine, longFlags],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[baseUrl, method, mode, perLine, longFlags]}
      inputLabel="Query string (or full URL)"
      outputLabel="curl command"
      inputPlaceholder="q=hello&page=2"
      sample={SAMPLE}
      downloadName="request.sh"
      downloadMime="text/x-shellscript"
      options={
        <>
          <Field label="Base URL" className="min-w-[260px] flex-1">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/search"
            />
          </Field>
          <Field label="Method">
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mode" hint={mode === 'query' ? 'append to URL' : '--data-urlencode'}>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query">URL query</SelectItem>
                <SelectItem value="data">-G --data-urlencode</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="One flag/line">
            <Switch checked={perLine} onCheckedChange={setPerLine} />
          </Field>
          <Field label="Long flags">
            <Switch checked={longFlags} onCheckedChange={setLongFlags} />
          </Field>
        </>
      }
    />
  );
}
