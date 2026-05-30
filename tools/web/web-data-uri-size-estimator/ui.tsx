'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type SizeUnit = 'bytes' | 'KB' | 'MB';
type Mode = 'size' | 'uri';

const MULT: Record<SizeUnit, number> = { bytes: 1, KB: 1024, MB: 1024 * 1024 };

function humanBytes(n: number): string {
  if (n < 1024) return `${n.toLocaleString()} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// Base64 encoded length for N raw bytes, with padding.
function base64Len(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4;
}

type Row = { label: string; value: string };

export default function DataUriSizeEstimatorTool() {
  const [mode, setMode] = useState<Mode>('size');

  // size mode
  const [rawSize, setRawSize] = useState('12');
  const [unit, setUnit] = useState<SizeUnit>('KB');
  const [mime, setMime] = useState('image/png');

  // uri mode
  const [uri, setUri] = useState('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

  const sizeResult = useMemo((): { error: string } | { rows: Row[] } => {
    const v = Number(rawSize);
    if (!Number.isFinite(v) || v < 0) return { error: 'Enter a non-negative numeric raw size.' };
    const rawBytes = Math.round(v * MULT[unit]);
    const prefix = `data:${mime.trim()};base64,`;
    const b64 = base64Len(rawBytes);
    const total = prefix.length + b64;
    const overheadBytes = total - rawBytes;
    const overheadPct = rawBytes > 0 ? (overheadBytes / rawBytes) * 100 : 0;
    return {
      rows: [
        { label: 'Raw payload', value: `${rawBytes.toLocaleString()} B (${humanBytes(rawBytes)})` },
        { label: 'Base64 body length', value: `${b64.toLocaleString()} B` },
        { label: 'Prefix length', value: `${prefix.length} B  ("${prefix}")` },
        { label: 'Total data URI length', value: `${total.toLocaleString()} B (${humanBytes(total)})` },
        { label: 'Encoding overhead', value: `${overheadBytes.toLocaleString()} B  (+${overheadPct.toFixed(1)}%)` },
        { label: 'gzip-rough estimate', value: `~${humanBytes(Math.round(total * 0.78))} (text gzips ~20-25%; binary already-compressed barely shrinks)` },
      ],
    };
  }, [rawSize, unit, mime]);

  const uriResult = useMemo((): { error: string } | { rows: Row[] } => {
    const s = uri.trim();
    if (!s) return { error: 'Paste a data URI.' };
    const m = s.match(/^data:([^;,]*)(;[^,]*)?,/);
    if (!m) return { error: 'Not a valid data: URI (expected "data:<mime>[;base64],<payload>").' };
    const header = m[0] ?? '';
    const detectedMime = (m[1] ?? '').trim() || 'text/plain';
    const params = m[2] ?? '';
    const isBase64 = /;base64/i.test(params);
    const payload = s.slice(header.length);
    const totalLen = s.length;
    let rawBytes: number;
    if (isBase64) {
      // Each 4 base64 chars => 3 bytes, minus padding.
      const clean = payload.replace(/[^A-Za-z0-9+/=]/g, '');
      const padding = (clean.match(/=+$/)?.[0] ?? '').length;
      rawBytes = Math.max(0, Math.floor(clean.length / 4) * 3 - padding);
    } else {
      // Percent-encoded / plain text URI: byte size = decoded UTF-8 length, estimate via decodeURIComponent.
      let decoded = payload;
      try {
        decoded = decodeURIComponent(payload);
      } catch {
        decoded = payload;
      }
      rawBytes = new TextEncoder().encode(decoded).length;
    }
    const overheadBytes = totalLen - rawBytes;
    const overheadPct = rawBytes > 0 ? (overheadBytes / rawBytes) * 100 : 0;
    return {
      rows: [
        { label: 'Detected MIME', value: detectedMime },
        { label: 'Encoding', value: isBase64 ? 'base64' : 'percent / plain text' },
        { label: 'Total URI length', value: `${totalLen.toLocaleString()} B (${humanBytes(totalLen)})` },
        { label: 'Header length', value: `${header.length} B  ("${header}")` },
        { label: 'Estimated raw payload', value: `${rawBytes.toLocaleString()} B (${humanBytes(rawBytes)})` },
        { label: 'Overhead vs raw', value: `${overheadBytes.toLocaleString()} B  (+${overheadPct.toFixed(1)}%)` },
      ],
    };
  }, [uri]);

  const active = mode === 'size' ? sizeResult : uriResult;

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="size">From raw size</TabsTrigger>
          <TabsTrigger value="uri">Measure pasted URI</TabsTrigger>
        </TabsList>

        <TabsContent value="size">
          <Panel>
            <OptionsBar>
              <Field label="Raw payload size" className="min-w-[160px]">
                <Input value={rawSize} onChange={(e) => setRawSize(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Unit">
                <Select value={unit} onValueChange={(v) => setUnit(v as SizeUnit)}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bytes">bytes</SelectItem>
                    <SelectItem value="KB">KB</SelectItem>
                    <SelectItem value="MB">MB</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="MIME type" className="min-w-[200px] flex-1">
                <Input value={mime} onChange={(e) => setMime(e.target.value)} placeholder="image/png" spellCheck={false} />
              </Field>
            </OptionsBar>
          </Panel>
        </TabsContent>

        <TabsContent value="uri">
          <Panel>
            <div className="p-3">
              <Field label="Paste a data: URI">
                <Textarea
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  spellCheck={false}
                  className="min-h-[120px] font-mono text-xs"
                  placeholder="data:image/png;base64,iVBORw0KGgo..."
                />
              </Field>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      {'error' in active ? (
        <ErrorBanner error={active.error} />
      ) : (
        <Panel>
          <PanelHeader title="Estimate">
            <CopyButton value={() => active.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="divide-y">
            {active.rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3 px-3 py-2">
                <span className="w-44 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-sm">{r.value}</code>
              </div>
            ))}
          </div>
          <StatBar items={['ceil(raw/3)*4 base64 body', 'overhead ≈ +33%']} />
        </Panel>
      )}
    </div>
  );
}
