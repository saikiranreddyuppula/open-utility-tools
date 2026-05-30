'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Encoding = 'base64' | 'percent';

const MIME_OPTIONS: { value: string; label: string }[] = [
  { value: 'text/plain', label: 'text/plain' },
  { value: 'text/html', label: 'text/html' },
  { value: 'text/css', label: 'text/css' },
  { value: 'image/svg+xml', label: 'image/svg+xml' },
  { value: 'application/json', label: 'application/json' },
  { value: 'application/javascript', label: 'application/javascript' },
];

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="#4f46e5"/>
</svg>`;

/** UTF-8 safe base64 (handles non-Latin1 by encoding to bytes first). */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Percent-encode for use inside a data: URI. We keep a generous safe set
 * (encodeURIComponent escapes many chars that are valid unencoded in data URIs,
 * but staying conservative keeps the URI robust across parsers).
 */
function percentEncode(text: string): string {
  // encodeURIComponent is UTF-8 aware; then re-allow a few readable chars.
  return encodeURIComponent(text);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export default function TextDataUriBuilder() {
  const [mime, setMime] = useState('image/svg+xml');
  const [includeCharset, setIncludeCharset] = useState(true);
  const [encoding, setEncoding] = useState<Encoding>('base64');

  return (
    <TextToolLayout
      deps={[mime, includeCharset, encoding]}
      transform={(input) => {
        if (!input) return '';

        const charsetPart = includeCharset ? ';charset=utf-8' : '';

        const base64Data = utf8ToBase64(input);
        const percentData = percentEncode(input);

        const base64Uri = `data:${mime}${charsetPart};base64,${base64Data}`;
        const percentUri = `data:${mime}${charsetPart},${percentData}`;

        const chosen = encoding === 'base64' ? base64Uri : percentUri;

        const rawBytes = byteLength(input);
        const b64Len = base64Uri.length;
        const pctLen = percentUri.length;
        const shorter =
          b64Len === pctLen
            ? 'equal length'
            : b64Len < pctLen
              ? 'base64 is shorter'
              : 'percent-encoding is shorter';

        const report = [
          chosen,
          '',
          `# Source: ${rawBytes} byte(s)`,
          `# base64 URI:  ${b64Len} chars`,
          `# percent URI: ${pctLen} chars`,
          `# → ${shorter}`,
        ].join('\n');

        return report;
      }}
      inputLabel="Text / source"
      outputLabel="data: URI"
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName="data-uri.txt"
      options={
        <>
          <Field label="MIME type">
            <Select value={mime} onValueChange={setMime}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Encoding">
            <Tabs value={encoding} onValueChange={(v) => setEncoding(v as Encoding)}>
              <TabsList>
                <TabsTrigger value="base64">Base64</TabsTrigger>
                <TabsTrigger value="percent">Percent</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <div className="flex items-center gap-2 self-end pb-1">
            <Switch
              id="charset"
              checked={includeCharset}
              onCheckedChange={setIncludeCharset}
            />
            <Label htmlFor="charset" className="text-sm">
              charset=utf-8
            </Label>
          </div>
        </>
      }
    />
  );
}
